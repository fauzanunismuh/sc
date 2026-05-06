import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

const THRESHOLD_CODEBERT = 85;
const THRESHOLD_WINNOWING = 75;

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
  method_scores?: {
    codebert: number;
    winnowing: number;
    gabungan: number;
  };
};

type SimilarityRow = {
  codebertScore: number;
  winnowingScore: number;
  gabunganScore: number;
  category: string;
  categoryLabel: string | null;
  snippets: unknown;
  projectATitle: string;
  projectAStudent: string | null;
  projectBTitle: string;
  projectBStudent: string | null;
};

function toPercent(score: number) {
  return score <= 1 ? score * 100 : score;
}

function getCategory(scb: number, sw: number) {
  if (scb >= THRESHOLD_CODEBERT && sw >= THRESHOLD_WINNOWING) {
    return "Plagiarisme Kuat";
  }

  if (sw >= THRESHOLD_WINNOWING) {
    return "Mirip Tekstual";
  }

  if (scb >= THRESHOLD_CODEBERT) {
    return "Mirip Semantik";
  }

  return "Normal";
}

function getLatestCategoryLabel(scb: number, sw: number) {
  return getCategory(scb, sw);
}

function getDetectedAs(scb: number, sw: number) {
  if (scb >= THRESHOLD_CODEBERT && sw >= THRESHOLD_WINNOWING) {
    return [] as Array<"tekstual" | "semantik">;
  }

  const detectedAs: Array<"tekstual" | "semantik"> = [];

  if (sw >= THRESHOLD_WINNOWING) {
    detectedAs.push("tekstual");
  }

  if (scb >= THRESHOLD_CODEBERT) {
    detectedAs.push("semantik");
  }

  return detectedAs;
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
        typeof entry.student_a !== "string" ||
        typeof entry.student_b !== "string" ||
        typeof entry.project_a !== "string" ||
        typeof entry.project_b !== "string" ||
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

export async function POST() {
  try {
    const similarityResults = await prisma.$queryRawUnsafe<SimilarityRow[]>(`
      SELECT
        sr."scoreCodebert" AS "codebertScore",
        sr."scoreWinnowing" AS "winnowingScore",
        sr."scoreHybrid" AS "gabunganScore",
        sr.category AS category,
        sr."categoryLabel" AS "categoryLabel",
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
      ORDER BY sr."scoreHybrid" DESC, sr."updatedAt" DESC, sr."createdAt" DESC;
    `);

    const suspiciousPairs = similarityResults.map((result) => {
      const scb = toPercent(result.codebertScore);
      const sw = toPercent(result.winnowingScore);
      const sg = toPercent(result.gabunganScore);
      const detectedAs = getDetectedAs(scb, sw);
      const snippets = normalizeCompareSnippets(result.snippets);

      return {
        student_a: result.projectAStudent || result.projectATitle,
        student_b: result.projectBStudent || result.projectBTitle,
        project_a: result.projectATitle,
        project_b: result.projectBTitle,
        scores: {
          scb,
          sw,
          sg,
        },
        category: getLatestCategoryLabel(scb, sw),
        stored_category_label: getLatestCategoryLabel(scb, sw),
        snippets: snippets.map((snippet) => ({
          ...snippet,
          detected_as: snippet.detected_as ?? detectedAs,
        })),
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
