import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * Endpoint untuk mendapatkan list pasangan mirip untuk project tertentu.
 * 
 * URL: /api/similarity/project/[projectId]
 * 
 * Query params:
 * - includeNormal: boolean (default: false)
 * - sortBy: "score" | "category" (default: "score")
 * - limit: number (default: 100)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const includeNormal = searchParams.get("includeNormal") !== "false";
    const sortBy = searchParams.get("sortBy") ?? "score";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 1000);

    // Validasi project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        mahasiswa: { select: { name: true, nim: true, username: true } },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project tidak ditemukan" },
        { status: 404 }
      );
    }

    // Query similarity results untuk project ini
    const similarities = includeNormal
      ? await prisma.$queryRaw<
        Array<{
          id: string;
          projectAId: string;
          projectBId: string;
          scoreCodebert: number;
          scoreWinnowing: number;
          scoreHybrid: number;
          categoryLabel: string;
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
            sr."createdAt"
          FROM "similarity_results" sr
          WHERE (sr."projectAId" = ${projectId} OR sr."projectBId" = ${projectId})
          ORDER BY
            CASE WHEN sr."categoryLabel" = 'Normal' THEN 1 ELSE 0 END ASC,
            sr."scoreHybrid" DESC,
            sr."scoreCodebert" DESC,
            sr."scoreWinnowing" DESC
          LIMIT ${limit}
        `
      : await prisma.$queryRaw<
        Array<{
          id: string;
          projectAId: string;
          projectBId: string;
          scoreCodebert: number;
          scoreWinnowing: number;
          scoreHybrid: number;
          categoryLabel: string;
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
        sr."createdAt"
      FROM "similarity_results" sr
      WHERE (sr."projectAId" = ${projectId} OR sr."projectBId" = ${projectId})
        AND sr."categoryLabel" != 'Normal'
      ORDER BY
        CASE WHEN sr."categoryLabel" = 'Normal' THEN 1 ELSE 0 END ASC,
        sr."scoreHybrid" DESC,
        sr."scoreCodebert" DESC,
        sr."scoreWinnowing" DESC
      LIMIT ${limit}
    `;

    // Ambil detail project untuk kedua sisi
    const comparisonProjectIds = [
      ...new Set(
        similarities.flatMap((s) =>
          s.projectAId === projectId ? [s.projectBId] : [s.projectAId]
        )
      ),
    ];

    const comparisonProjects = await prisma.project.findMany({
      where: { id: { in: comparisonProjectIds } },
      select: {
        id: true,
        title: true,
        mahasiswa: { select: { name: true, nim: true, username: true } },
      },
    });

    const projectMap = new Map(comparisonProjects.map((p) => [p.id, p]));

    if (sortBy === "category") {
      similarities.sort((a, b) => {
        const order = (label: string) => {
          if (label === "Plagiarisme Kuat") return 0;
          if (label === "Mirip Semantik") return 1;
          if (label === "Mirip Tekstual") return 2;
          return 3;
        };
        const byCategory = order(a.categoryLabel) - order(b.categoryLabel);
        if (byCategory !== 0) return byCategory;
        if (b.scoreHybrid !== a.scoreHybrid) return b.scoreHybrid - a.scoreHybrid;
        if (b.scoreCodebert !== a.scoreCodebert) return b.scoreCodebert - a.scoreCodebert;
        return b.scoreWinnowing - a.scoreWinnowing;
      });
    }

    // Format response
    const results = similarities.map((sim) => {
      const isProjectA = sim.projectAId === projectId;
      const otherProjectId = isProjectA ? sim.projectBId : sim.projectAId;
      const otherProject = projectMap.get(otherProjectId);

      return {
        similarity_id: sim.id,
        project_self: {
          id: projectId,
          title: project.title,
          student_name: project.mahasiswa?.name,
          student_nim: project.mahasiswa?.nim,
        },
        project_compared: {
          id: otherProjectId,
          title: otherProject?.title,
          student_name: otherProject?.mahasiswa?.name,
          student_nim: otherProject?.mahasiswa?.nim,
        },
        is_self_project_a: isProjectA,
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
        level:
          sim.categoryLabel === "Plagiarisme Kuat"
            ? "danger"
            : sim.categoryLabel === "Normal"
              ? "success"
              : "warning",
        checked_at: sim.createdAt,
      };
    });

    return NextResponse.json(
      {
        success: true,
        project: {
          id: project.id,
          title: project.title,
          student_name: project.mahasiswa?.name,
          student_nim: project.mahasiswa?.nim,
        },
        similarities: results,
        total_similar: results.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Similarity Project Error]:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data similarity project" },
      { status: 500 }
    );
  }
}
