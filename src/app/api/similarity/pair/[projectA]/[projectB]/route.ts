import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

interface SnippetData {
  student_a?: string;
  student_b?: string;
  project_a?: string;
  project_b?: string;
  code_a: string;
  code_b: string;
  similarity: number;
  snippet_similarity?: number;
  source_path?: string;
  target_path?: string;
  matched_by?: string[];
  detected_as?: string[];
  method_scores?: {
    codebert: number;
    winnowing: number;
    gabungan: number;
  };
  note?: string;
}

function normalizeSnippets(raw: unknown): SnippetData[] {
  let parsed: unknown = raw;

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const normalized: SnippetData[] = [];

  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const item = entry as Record<string, unknown>;
    const codeA = typeof item.code_a === "string" ? item.code_a : null;
    const codeB = typeof item.code_b === "string" ? item.code_b : null;
    const similarity =
      typeof item.similarity === "number"
        ? item.similarity
        : typeof item.snippet_similarity === "number"
          ? item.snippet_similarity
          : null;

    if (!codeA || !codeB || similarity === null) {
      continue;
    }

    normalized.push({
      code_a: codeA,
      code_b: codeB,
      similarity,
      snippet_similarity:
        typeof item.snippet_similarity === "number" ? item.snippet_similarity : undefined,
      source_path: typeof item.source_path === "string" ? item.source_path : undefined,
      target_path: typeof item.target_path === "string" ? item.target_path : undefined,
      note: typeof item.note === "string" ? item.note : undefined,
      matched_by: Array.isArray(item.matched_by)
        ? item.matched_by.filter((v): v is string => typeof v === "string")
        : undefined,
      detected_as: Array.isArray(item.detected_as)
        ? item.detected_as.filter((v): v is string => typeof v === "string")
        : undefined,
      student_a: typeof item.student_a === "string" ? item.student_a : undefined,
      student_b: typeof item.student_b === "string" ? item.student_b : undefined,
      project_a: typeof item.project_a === "string" ? item.project_a : undefined,
      project_b: typeof item.project_b === "string" ? item.project_b : undefined,
    });
  }

  return normalized;
}

function buildFallbackSnippets(snippetA: unknown, snippetB: unknown): SnippetData[] {
  const listA = normalizeSnippets(snippetA);
  const listB = normalizeSnippets(snippetB);

  if (!listA.length || !listB.length) {
    return [];
  }

  const maxLength = Math.min(listA.length, listB.length);
  const merged: SnippetData[] = [];

  for (let i = 0; i < maxLength; i += 1) {
    const a = listA[i];
    const b = listB[i];
    merged.push({
      ...a,
      code_a: a.code_a,
      code_b: b.code_b,
      similarity: typeof a.similarity === "number" ? a.similarity : b.similarity,
      snippet_similarity:
        typeof a.snippet_similarity === "number" ? a.snippet_similarity : b.snippet_similarity,
      source_path: a.source_path,
      target_path: b.target_path,
      note: a.note ?? b.note,
      matched_by: a.matched_by ?? b.matched_by,
    });
  }

  return merged;
}

/**
 * Endpoint untuk mendapatkan detail snippets dari satu pasangan similarity.
 * 
 * URL: /api/similarity/pair/[projectAId]/[projectBId]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectA: string; projectB: string }> }
) {
  try {
    const { projectA: projectAId, projectB: projectBId } = await params;

    // Query similarity result
    const similarity = await prisma.$queryRaw<
      Array<{
        id: string;
        projectAId: string;
        projectBId: string;
        scoreCodebert: number;
        scoreWinnowing: number;
        scoreHybrid: number;
        categoryLabel: string;
        snippets: unknown;
        snippetA: unknown;
        snippetB: unknown;
        createdAt: Date;
      }>
    >`
      SELECT
        sr."id",
        sr."projectAId",
        sr."projectBId",
        sr."scoreCodebert",
        sr."scoreWinnowing",
        sr."scoreHybrid",
        sr."categoryLabel",
        sr."snippets",
        sr."snippetA",
        sr."snippetB",
        sr."createdAt"
      FROM "similarity_results" sr
      WHERE (sr."projectAId" = ${projectAId} AND sr."projectBId" = ${projectBId})
        OR (sr."projectAId" = ${projectBId} AND sr."projectBId" = ${projectAId})
      LIMIT 1
    `;

    if (!similarity || similarity.length === 0) {
      return NextResponse.json(
        { error: "Pasangan similarity tidak ditemukan" },
        { status: 404 }
      );
    }

    const sim = similarity[0];

    // Parse snippets dari field utama, fallback ke snippetA/snippetB bila diperlukan
    let snippets = normalizeSnippets(sim.snippets);
    if (!snippets.length) {
      snippets = buildFallbackSnippets(sim.snippetA, sim.snippetB);
    }

    snippets = snippets.sort(
      (a, b) =>
        (b.snippet_similarity ?? b.similarity ?? 0) -
        (a.snippet_similarity ?? a.similarity ?? 0)
    );

    // Ambil detail project
    const [projectA, projectB] = await Promise.all([
      prisma.project.findUnique({
        where: { id: sim.projectAId },
        select: {
          id: true,
          title: true,
          mahasiswa: { select: { name: true, nim: true, username: true } },
        },
      }),
      prisma.project.findUnique({
        where: { id: sim.projectBId },
        select: {
          id: true,
          title: true,
          mahasiswa: { select: { name: true, nim: true, username: true } },
        },
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        pair: {
          projectA: {
            id: projectA?.id,
            title: projectA?.title,
            student_name: projectA?.mahasiswa?.name,
            student_nim: projectA?.mahasiswa?.nim,
          },
          projectB: {
            id: projectB?.id,
            title: projectB?.title,
            student_name: projectB?.mahasiswa?.name,
            student_nim: projectB?.mahasiswa?.nim,
          },
        },
        scores: {
          codebert: Number(sim.scoreCodebert.toFixed(4)),
          winnowing: Number(sim.scoreWinnowing.toFixed(4)),
          gabungan: Number(sim.scoreHybrid.toFixed(4)),
          hybrid: Number(sim.scoreHybrid.toFixed(4)),
        },
        scores_percentage: {
          codebert: Number((sim.scoreCodebert * 100).toFixed(2)),
          winnowing: Number((sim.scoreWinnowing * 100).toFixed(2)),
          gabungan: Number((sim.scoreHybrid * 100).toFixed(2)),
          hybrid: Number((sim.scoreHybrid * 100).toFixed(2)),
        },
        category: sim.categoryLabel,
        snippets: snippets,
        snippet_count: snippets.length,
        checked_at: sim.createdAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Similarity Pair Error]:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data similarity pair" },
      { status: 500 }
    );
  }
}
