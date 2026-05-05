import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

const THRESHOLD_CODEBERT = 80;
const THRESHOLD_WINNOWING = 75;

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

function normalizeSnippetMap(snippet: unknown): Record<string, string> {
  if (!snippet || typeof snippet !== "object" || Array.isArray(snippet)) {
    return {};
  }

  return Object.entries(snippet as Record<string, unknown>).reduce<Record<string, string>>((accumulator, [file, code]) => {
    if (typeof code === "string") {
      accumulator[file] = code;
    }
    return accumulator;
  }, {});
}

function buildSnippetPairs(
  studentA: string,
  studentB: string,
  projectA: string,
  projectB: string,
  snippetA: Record<string, string>,
  snippetB: Record<string, string>,
  similarity: number
) {
  const sharedFiles = Object.keys(snippetA).filter((file) => snippetB[file]);

  if (sharedFiles.length > 0) {
    return sharedFiles.map((file) => ({
      student_a: studentA,
      student_b: studentB,
      project_a: projectA,
      project_b: projectB,
      code_a: snippetA[file],
      code_b: snippetB[file],
      similarity,
    }));
  }

  const firstA = Object.entries(snippetA)[0];
  const firstB = Object.entries(snippetB)[0];

  if (firstA && firstB) {
    return [
      {
        student_a: studentA,
        student_b: studentB,
        project_a: projectA,
        project_b: projectB,
        code_a: firstA[1],
        code_b: firstB[1],
        similarity,
      },
    ];
  }

  return [];
}

export async function POST() {
  try {
    const similarityResults = await prisma.similarityResult.findMany({
      orderBy: [{ hybridScore: "desc" }, { checkedAt: "desc" }],
      include: {
        projectA: {
          select: {
            title: true,
            mahasiswa: {
              select: {
                name: true,
                nim: true,
              },
            },
          },
        },
        projectB: {
          select: {
            title: true,
            mahasiswa: {
              select: {
                name: true,
                nim: true,
              },
            },
          },
        },
      },
    });

    const suspiciousPairs = similarityResults.map((result) => {
      const scb = toPercent(result.codebertScore);
      const sw = toPercent(result.winnowingScore);
      const sg = toPercent(result.hybridScore);

      const studentA = result.projectA.mahasiswa?.name || result.projectA.title;
      const studentB = result.projectB.mahasiswa?.name || result.projectB.title;
      const projectA = result.projectA.title;
      const projectB = result.projectB.title;

      const snippetA = normalizeSnippetMap(result.snippetA);
      const snippetB = normalizeSnippetMap(result.snippetB);

      return {
        student_a: studentA,
        student_b: studentB,
        project_a: projectA,
        project_b: projectB,
        scores: {
          scb,
          sw,
          sg,
        },
        category: getCategory(scb, sw),
        snippets: buildSnippetPairs(studentA, studentB, projectA, projectB, snippetA, snippetB, sg),
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
