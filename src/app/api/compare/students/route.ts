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
    const templateReviewReason = "Kemiripan didominasi template/framework, perlu verifikasi manual.";

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
      const snippets = normalizeCompareSnippets(result.snippets);
      const categoryLabel = classifyFromScores(scb, sw);
      const storedCategoryLabel = result.categoryLabel || result.category || "Normal";

      const detectedAs =
        categoryLabel === "Plagiarisme Kuat"
          ? (["tekstual", "semantik"] as const)
          : categoryLabel === "Mirip Tekstual"
            ? (["tekstual"] as const)
            : categoryLabel === "Mirip Semantik"
              ? (["semantik"] as const)
              : ([] as const);

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
        category: categoryLabel,
        stored_category_label: storedCategoryLabel,
        snippets: snippets.map((snippet) => ({
          ...snippet,
          detected_as: detectedAs,
          review_required: isStrongMatch(categoryLabel) && looksLikeTemplateSnippet(snippet),
          review_reason:
            isStrongMatch(categoryLabel) && looksLikeTemplateSnippet(snippet)
              ? templateReviewReason
              : undefined,
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
