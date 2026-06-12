import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type CategoryLabel = "Plagiarisme Kuat" | "Mirip Semantik" | "Mirip Tekstual" | "Normal";

const CATEGORY_PRIORITY: CategoryLabel[] = [
  "Plagiarisme Kuat",
  "Mirip Semantik",
  "Mirip Tekstual",
  "Normal",
];

function getDominantStatus(counts: Record<CategoryLabel, number>): CategoryLabel {
  for (const category of CATEGORY_PRIORITY) {
    if (counts[category] > 0) {
      return category;
    }
  }

  return "Normal";
}

/**
 * Endpoint untuk mendapatkan overview similarity untuk semua project.
 * Menampilkan jumlah pasangan mirip (bukan Normal) untuk setiap project.
 * 
 * Query params:
 * - includeNormal: boolean (default: false) - jika true, include kategori Normal juga
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const includeNormal = searchParams.get("includeNormal") === "true";

    // Ambil semua project
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        title: true,
        mahasiswa: { select: { name: true, nim: true, username: true } },
      },
      orderBy: { title: "asc" },
    });

    const globalRows = await prisma.$queryRaw<
      Array<{
        totalPairs: bigint;
        plagiarismeKuat: bigint;
        miripSemantik: bigint;
        miripTekstual: bigint;
        normal: bigint;
      }>
    >`
      SELECT
        COUNT(*)::bigint AS "totalPairs",
        COUNT(*) FILTER (WHERE "categoryLabel" = 'Plagiarisme Kuat')::bigint AS "plagiarismeKuat",
        COUNT(*) FILTER (WHERE "categoryLabel" = 'Mirip Semantik')::bigint AS "miripSemantik",
        COUNT(*) FILTER (WHERE "categoryLabel" = 'Mirip Tekstual')::bigint AS "miripTekstual",
        COUNT(*) FILTER (WHERE "categoryLabel" = 'Normal')::bigint AS "normal"
      FROM "similarity_results"
    `;

    const globalStats = globalRows[0] ?? {
      totalPairs: BigInt(0),
      plagiarismeKuat: BigInt(0),
      miripSemantik: BigInt(0),
      miripTekstual: BigInt(0),
      normal: BigInt(0),
    };

    // Hitung distribusi kategori + skor untuk setiap project
    const overview = await Promise.all(
      projects.map(async (project) => {
        const projectRows = await prisma.$queryRaw<
          Array<{
            plagiarismeKuat: bigint;
            miripSemantik: bigint;
            miripTekstual: bigint;
            normal: bigint;
            totalPairs: bigint;
            detectedPairs: bigint;
            avgHybrid: number | null;
            avgCodebert: number | null;
            avgWinnowing: number | null;
          }>
        >`
          SELECT
            COUNT(*) FILTER (WHERE "categoryLabel" = 'Plagiarisme Kuat')::bigint AS "plagiarismeKuat",
            COUNT(*) FILTER (WHERE "categoryLabel" = 'Mirip Semantik')::bigint AS "miripSemantik",
            COUNT(*) FILTER (WHERE "categoryLabel" = 'Mirip Tekstual')::bigint AS "miripTekstual",
            COUNT(*) FILTER (WHERE "categoryLabel" = 'Normal')::bigint AS "normal",
            COUNT(*)::bigint AS "totalPairs",
            COUNT(*) FILTER (WHERE "categoryLabel" != 'Normal')::bigint AS "detectedPairs",
            AVG("scoreHybrid")::double precision AS "avgHybrid",
            AVG("scoreCodebert")::double precision AS "avgCodebert",
            AVG("scoreWinnowing")::double precision AS "avgWinnowing"
          FROM "similarity_results"
          WHERE ("projectAId" = ${project.id} OR "projectBId" = ${project.id})
        `;

        const row = projectRows[0] ?? {
          plagiarismeKuat: BigInt(0),
          miripSemantik: BigInt(0),
          miripTekstual: BigInt(0),
          normal: BigInt(0),
          totalPairs: BigInt(0),
          detectedPairs: BigInt(0),
          avgHybrid: null,
          avgCodebert: null,
          avgWinnowing: null,
        };

        const categoryCounts: Record<CategoryLabel, number> = {
          "Plagiarisme Kuat": Number(row.plagiarismeKuat),
          "Mirip Semantik": Number(row.miripSemantik),
          "Mirip Tekstual": Number(row.miripTekstual),
          Normal: Number(row.normal),
        };

        const status = getDominantStatus(categoryCounts);
        const combinedScore = Number(((row.avgHybrid ?? 0) * 100).toFixed(2));
        const semanticScore = Number(((row.avgCodebert ?? 0) * 100).toFixed(2));
        const textualScore = Number(((row.avgWinnowing ?? 0) * 100).toFixed(2));

        return {
          projectId: project.id,
          projectTitle: project.title,
          studentName: project.mahasiswa?.name,
          studentNim: project.mahasiswa?.nim,
          studentUsername: project.mahasiswa?.username,
          detectedPairCount: Number(row.detectedPairs),
          totalPairCount: Number(row.totalPairs),
          combinedScore,
          semanticScore,
          textualScore,
          status,
          categoryCounts,
        };
      })
    );

    const categoryTotals = {
      "Plagiarisme Kuat": Number(globalStats.plagiarismeKuat),
      "Mirip Semantik": Number(globalStats.miripSemantik),
      "Mirip Tekstual": Number(globalStats.miripTekstual),
      Normal: Number(globalStats.normal),
    };

    const sortedOverview = [...overview].sort((a, b) => {
      const aIsNormal = a.status === "Normal" ? 1 : 0;
      const bIsNormal = b.status === "Normal" ? 1 : 0;
      if (aIsNormal !== bIsNormal) {
        return aIsNormal - bIsNormal;
      }

      if (b.combinedScore !== a.combinedScore) {
        return b.combinedScore - a.combinedScore;
      }

      if (b.semanticScore !== a.semanticScore) {
        return b.semanticScore - a.semanticScore;
      }

      return b.textualScore - a.textualScore;
    });

    const filteredOverview = includeNormal
      ? sortedOverview
      : sortedOverview.map((item) => ({
        ...item,
        categoryCounts: {
          ...item.categoryCounts,
          Normal: 0,
        },
      }));

    return NextResponse.json(
      {
        success: true,
        data: filteredOverview,
        total_projects: projects.length,
        total_pairs: Number(globalStats.totalPairs),
        total_with_similarity: sortedOverview.filter((o) => o.detectedPairCount > 0).length,
        category_totals: includeNormal
          ? categoryTotals
          : {
            ...categoryTotals,
            Normal: 0,
          },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Similarity Overview Error]:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data overview" },
      { status: 500 }
    );
  }
}
