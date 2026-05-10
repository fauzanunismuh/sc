import { Prisma } from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

type CompareSnippet = {
  student_a: string;
  student_b: string;
  project_a: string;
  project_b: string;
  code_a: string;
  code_b: string;
  similarity: number;
  detected_as?: Array<"tekstual" | "semantik">;
  note?: string;
  matched_by?: Array<"CodeBERT" | "Winnowing">;
  review_required?: boolean;
  review_reason?: string;
  method_scores?: {
    codebert: number;
    winnowing: number;
    gabungan: number;
  };
};

type SimilarityRow = {
  projectAId: string;
  projectBId: string;
  codebertScore: number;
  winnowingScore: number;
  gabunganScore: number;
  category: string;
  categoryLabel: string | null;
  snippetCount: number;
  projectATitle: string;
  projectAStudent: string | null;
  projectBTitle: string;
  projectBStudent: string | null;
};

type SimilaritySnippetRow = {
  projectAId: string;
  projectBId: string;
  codebertScore: number;
  winnowingScore: number;
  gabunganScore: number;
  category: string;
  snippets: unknown;
  projectATitle: string;
  projectAStudent: string | null;
  projectBTitle: string;
  projectBStudent: string | null;
};

function toPercent(score: number) {
  return score <= 1 ? score * 100 : score;
}

const THRESHOLD_CODEBERT_PERCENT = 98.5;
const THRESHOLD_WINNOWING_PERCENT = 8;

function classifyFromScores(scb: number, sw: number) {
  if (scb >= THRESHOLD_CODEBERT_PERCENT && sw >= THRESHOLD_WINNOWING_PERCENT) {
    return "Plagiarisme Kuat";
  }

  if (sw >= THRESHOLD_WINNOWING_PERCENT) {
    return "Mirip Tekstual";
  }

  if (scb >= THRESHOLD_CODEBERT_PERCENT) {
    return "Mirip Semantik";
  }

  return "Normal";
}

function normalizeCodeLine(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function hasEnoughSignal(code: string) {
  const normalized = normalizeCodeLine(code);
  if (normalized.length < 40) return false;

  const tokens = normalized.match(/[a-z_][a-z0-9_]{2,}/g) ?? [];
  return new Set(tokens).size >= 4;
}

function isDependencyPath(path?: string) {
  if (!path) return false;
  const normalized = `/${path.toLowerCase()}`;
  return normalized.includes("/node_modules/") || normalized.includes("/.next/") || normalized.includes("/dist/") || normalized.includes("/build/");
}

function looksLikeTemplateSnippet(snippet: CompareSnippet) {
  const combined = [snippet.code_a, snippet.code_b].map(normalizeCodeLine).join("\n");
  const templateSignals = [
    /^import\s+/m,
    /^export\s+(default\s+)?/m,
    /^"use (client|server)";?$/m,
    /^'use (client|server)';?$/m,
    /^const\s+nextconfig\s*:/m,
    /^module\.exports\s*=\s*\{/m,
    /^package\s+config$/m,
    /^pages?\//m,
  ];

  return templateSignals.some((pattern) => pattern.test(combined));
}

function isStrongMatch(category: string) {
  const normalized = category.toLowerCase();
  return normalized.includes("plagiarisme") || normalized.includes("kuat");
}

function normalizeCompareSnippets(snippets: unknown): CompareSnippet[] {
  if (!Array.isArray(snippets)) {
    return [];
  }

  return snippets
    .map((snippet) => {
      if (!snippet || typeof snippet !== "object") {
        return null;
      }

      const entry = snippet as Partial<CompareSnippet>;
      if (
        typeof entry.code_a !== "string" ||
        typeof entry.code_b !== "string" ||
        typeof entry.similarity !== "number"
      ) {
        return null;
      }

      return entry as CompareSnippet;
    })
    .filter((snippet): snippet is CompareSnippet => snippet !== null);
}

function buildDetectedAs(categoryLabel: string): Array<"tekstual" | "semantik"> {
  return categoryLabel === "Plagiarisme Kuat"
    ? ["tekstual", "semantik"]
    : categoryLabel === "Mirip Tekstual"
      ? ["tekstual"]
      : categoryLabel === "Mirip Semantik"
        ? ["semantik"]
        : [];
}

function annotateSnippets(snippets: CompareSnippet[], categoryLabel: string, templateReviewReason: string) {
  const detectedAs: Array<"tekstual" | "semantik"> = [...buildDetectedAs(categoryLabel)];
  const seen = new Set<string>();

  return snippets.map((snippet) => ({
    ...snippet,
    detected_as: detectedAs,
    review_required: isStrongMatch(categoryLabel) && looksLikeTemplateSnippet(snippet),
    review_reason:
      isStrongMatch(categoryLabel) && looksLikeTemplateSnippet(snippet)
        ? templateReviewReason
        : undefined,
  }))
    .filter((snippet) => !looksLikeTemplateSnippet(snippet))
    .filter((snippet) => !isDependencyPath((snippet as CompareSnippet & { source_path?: string }).source_path))
    .filter((snippet) => !isDependencyPath((snippet as CompareSnippet & { target_path?: string }).target_path))
    .filter((snippet) => hasEnoughSignal(snippet.code_a) && hasEnoughSignal(snippet.code_b))
    .filter((snippet) => {
      const key = `${normalizeCodeLine(snippet.code_a)}|${normalizeCodeLine(snippet.code_b)}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function enrichSnippetContext(
  snippets: CompareSnippet[],
  context: { studentA: string; studentB: string; projectA: string; projectB: string; scoreCodebert: number; scoreWinnowing: number; scoreGabungan: number }
) {
  return snippets.map((snippet) => ({
    ...snippet,
    student_a: context.studentA,
    student_b: context.studentB,
    project_a: context.projectA,
    project_b: context.projectB,
    method_scores: {
      codebert: context.scoreCodebert,
      winnowing: context.scoreWinnowing,
      gabungan: context.scoreGabungan,
    },
  }));
}

export async function POST(request: Request) {
  try {
    const templateReviewReason = "Kemiripan didominasi template/framework, perlu verifikasi manual.";
    const body = (await request.json().catch(() => ({}))) as {
      mode?: "summary" | "snippets";
      projectAId?: string;
      projectBId?: string;
    };

    if (body.mode === "snippets" && body.projectAId && body.projectBId) {
      const snippetRow = await prisma.$queryRaw<SimilaritySnippetRow[]>(Prisma.sql`
        SELECT
          sr."projectAId" AS "projectAId",
          sr."projectBId" AS "projectBId",
          sr."scoreCodebert" AS "codebertScore",
          sr."scoreWinnowing" AS "winnowingScore",
          sr."scoreHybrid" AS "gabunganScore",
          sr.category AS category,
          sr.snippets AS snippets,
          pa.title AS "projectATitle",
          COALESCE(ua.name, pa.title) AS "projectAStudent",
          pb.title AS "projectBTitle",
          COALESCE(ub.name, pb.title) AS "projectBStudent"
        FROM similarity_results sr
        JOIN projects pa ON pa.id = sr."projectAId"
        JOIN projects pb ON pb.id = sr."projectBId"
        LEFT JOIN users ua ON ua.id = pa."mahasiswaId"
        LEFT JOIN users ub ON ub.id = pb."mahasiswaId"
        WHERE sr."projectAId" = ${body.projectAId}
          AND sr."projectBId" = ${body.projectBId}
        LIMIT 1;
      `);

      const row = snippetRow[0];
      if (!row) {
        return NextResponse.json({ snippets: [] });
      }

      const scb = toPercent(row.codebertScore);
      const sw = toPercent(row.winnowingScore);
      const sg = toPercent(row.gabunganScore);
      const categoryLabel = classifyFromScores(scb, sw);
      const snippets = normalizeCompareSnippets(row.snippets);
      const contextSnippets = enrichSnippetContext(snippets, {
        studentA: row.projectAStudent || row.projectATitle,
        studentB: row.projectBStudent || row.projectBTitle,
        projectA: row.projectATitle,
        projectB: row.projectBTitle,
        scoreCodebert: scb,
        scoreWinnowing: sw,
        scoreGabungan: sg,
      });

      return NextResponse.json({
        snippets: annotateSnippets(contextSnippets, categoryLabel, templateReviewReason),
      });
    }

    const similarityResults = await prisma.$queryRawUnsafe<SimilarityRow[]>(`
      SELECT
        sr."projectAId" AS "projectAId",
        sr."projectBId" AS "projectBId",
        sr."scoreCodebert" AS "codebertScore",
        sr."scoreWinnowing" AS "winnowingScore",
        sr."scoreHybrid" AS "gabunganScore",
        sr.category AS category,
        sr."categoryLabel" AS "categoryLabel",
        jsonb_array_length(sr.snippets) AS "snippetCount",
        pa.title AS "projectATitle",
        COALESCE(ua.name, pa.title) AS "projectAStudent",
        pb.title AS "projectBTitle",
        COALESCE(ub.name, pb.title) AS "projectBStudent"
      FROM similarity_results sr
      JOIN projects pa ON pa.id = sr."projectAId"
      JOIN projects pb ON pb.id = sr."projectBId"
      LEFT JOIN users ua ON ua.id = pa."mahasiswaId"
      LEFT JOIN users ub ON ub.id = pb."mahasiswaId"
      ORDER BY sr."scoreHybrid" DESC, sr."updatedAt" DESC, sr."createdAt" DESC;
    `);

    const suspiciousPairs = similarityResults.map((result) => {
      const scb = toPercent(result.codebertScore);
      const sw = toPercent(result.winnowingScore);
      const sg = toPercent(result.gabunganScore);
      const categoryLabel = classifyFromScores(scb, sw);
      const storedCategoryLabel = result.categoryLabel || result.category || "Normal";

      return {
        project_a_id: result.projectAId,
        project_b_id: result.projectBId,
        student_a: result.projectAStudent || result.projectATitle,
        student_b: result.projectBStudent || result.projectBTitle,
        project_a: result.projectATitle,
        project_b: result.projectBTitle,
        scores: {
          scb,
          sw,
          sg,
        },
        category: categoryLabel,
        stored_category_label: storedCategoryLabel,
        snippet_count: result.snippetCount,
        snippets: [],
      };
    });

    return NextResponse.json({ suspicious_pairs: suspiciousPairs });
  } catch (error) {
    console.error("Compare students error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil hasil perbandingan mahasiswa." },
      { status: 500 }
    );
  }
}
