import { Prisma } from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE_URL = process.env.SIMILARITY_SERVICE_URL || "http://localhost:8000";

// Threshold sesuai proposal skripsi (Tabel 3)
// CodeBERT: 0.80 (Akbar dkk. 2025), Winnowing: 0.10
const ALPHA = 0.6;
const THRESHOLD_CODEBERT = 0.85;
const THRESHOLD_WINNOWING = 0.75;

/**
 * Klasifikasi sesuai Tabel 3 Proposal:
 * - Plagiarisme Kuat: CodeBERT dan Winnowing sama-sama melewati ambang
 * - Mirip Tekstual: Winnowing dominan
 * - Mirip Semantik: CodeBERT dominan
 * - Normal: tidak melewati ambang
 */
function getClassification(
  scb: number,
  sw: number
): { label: string; level: "danger" | "warning" | "secondary" | "success"; description: string } {
  if (scb >= THRESHOLD_CODEBERT && sw >= THRESHOLD_WINNOWING) {
    return {
      label: "Plagiarisme Kuat",
      level: "danger",
      description: "CodeBERT dan Winnowing sama-sama melewati ambang deteksi",
    };
  }

  if (sw >= THRESHOLD_WINNOWING) {
    return {
      label: "Mirip Tekstual",
      level: "warning",
      description: "Struktur teks sangat mirip (indikasi copy-paste)",
    };
  }

  if (scb >= THRESHOLD_CODEBERT) {
    return {
      label: "Mirip Semantik",
      level: "warning",
      description: "Logika serupa meski teks berbeda (kemungkinan refactoring)",
    };
  }

  return {
    label: "Normal",
    level: "success",
    description: "Tidak terindikasi plagiarisme",
  };
}

/**
 * Fetch kode sumber dari GitHub repo.
 * - Mencoba branch: main, master, dev, development
 * - Jika tidak ada file kode, tetap return string kosong (bukan null)
 *   sehingga pasangan tetap bisa diproses
 */
async function fetchGitHubCode(
  repoUrl: string
): Promise<{ code: string; snippets: Record<string, string>; branch: string; hasCode: boolean } | null> {
  try {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, "");

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
    }

    const branches = ["main", "master", "dev", "development"];

    let treeData: { tree?: { type: string; path: string }[] } | null = null;
    let activeBranch = "main";

    for (const br of branches) {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/${br}?recursive=1`,
        { headers }
      );
      if (res.ok) {
        treeData = await res.json();
        activeBranch = br;
        break;
      }
    }

    if (!treeData) return null;

    const codeExts = [".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".go", ".php", ".rb", ".cs"];
    const codeFiles = ((treeData.tree ?? []) as { type: string; path: string }[])
      .filter((f) => f.type === "blob" && codeExts.some((ext) => f.path.endsWith(ext)))
      .slice(0, 20);

    const contents: string[] = [];
    const snippets: Record<string, string> = {};

    if (codeFiles.length > 0) {
      for (const file of codeFiles) {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${cleanRepo}/${activeBranch}/${file.path}`;
        const r = await fetch(rawUrl, { headers });
        if (r.ok) {
          const text = await r.text();
          contents.push(text);
          snippets[file.path] = text.split("\n").slice(0, 20).join("\n");
        }
      }
    }

    return {
      code: contents.length > 0 ? contents.join("\n\n") : "",
      snippets,
      branch: activeBranch,
      hasCode: contents.length > 0,
    };
  } catch (err) {
    console.error("fetchGitHubCode error:", err);
    return null;
  }
}

async function callWithTimeout(url: string, body: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function getSimilarity(codeA: string, codeB: string) {
  const [cbRes, wRes] = await Promise.all([
    callWithTimeout(`${PYTHON_SERVICE_URL}/analyze/codebert-only`, { code1: codeA, code2: codeB }),
    callWithTimeout(`${PYTHON_SERVICE_URL}/analyze/winnowing-only`, { code1: codeA, code2: codeB }),
  ]);

  const cbJson = cbRes.ok ? await cbRes.json() : null;
  const wJson = wRes.ok ? await wRes.json() : null;

  return {
    scb: typeof cbJson?.scb === "number" ? cbJson.scb : 0,
    sw: typeof wJson?.sw === "number" ? wJson.sw : 0,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { projectIds } = body;

    const whereClause = projectIds?.length ? { id: { in: projectIds } } : {};

    const projects = await prisma.project.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        githubRepoUrl: true,
        mahasiswa: { select: { name: true, nim: true } },
      },
    });

    if (projects.length < 2) {
      return NextResponse.json(
        { error: "Minimal 2 project diperlukan untuk analisis" },
        { status: 400 }
      );
    }

    console.log(`[Batch] Memproses ${projects.length} proyek → ${(projects.length * (projects.length - 1)) / 2} pasangan`);

    const projectData: Record<string, { code: string; snippets: Record<string, string>; hasCode?: boolean }> = {};
    const fetchErrors: string[] = [];

    for (const p of projects) {
      try {
        if (p.githubRepoUrl) {
          const data = await fetchGitHubCode(p.githubRepoUrl);
          if (data) {
            projectData[p.id] = { code: data.code, snippets: data.snippets, hasCode: data.hasCode };
            console.log(`[Batch] ✓ ${p.title} (branch: ${data.branch}, snippets: ${Object.keys(data.snippets).length})`);
          } else {
            projectData[p.id] = {
              code: "",
              snippets: {},
              hasCode: false,
            };
            fetchErrors.push(p.title);
            console.warn(`[Batch] ✗ Gagal fetch: ${p.title} (${p.githubRepoUrl})`);
          }
        } else {
          projectData[p.id] = {
            code: "",
            snippets: {},
            hasCode: false,
          };
          console.warn(`[Batch] ⚠ Tidak ada GitHub URL: ${p.title}`);
        }
      } catch (error) {
        projectData[p.id] = {
          code: "",
          snippets: {},
          hasCode: false,
        };
        fetchErrors.push(p.title);
        console.warn(`[Batch] ✗ Error saat mengambil kode ${p.title}:`, error);
      }
    }

    const results: Array<{
      projectA: { id: string; title: string; mahasiswa: { name: string | null; nim: string | null } | null };
      projectB: { id: string; title: string; mahasiswa: { name: string | null; nim: string | null } | null };
      codebert_score: number;
      winnowing_score: number;
      hybrid_score: number;
      classification: ReturnType<typeof getClassification>;
      snippetA: Record<string, string>;
      snippetB: Record<string, string>;
      checkedAt: string;
    }> = [];
    let pairCount = 0;
    let errorCount = 0;

    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const a = projects[i];
        const b = projects[j];
        pairCount++;

        try {
          const codeA = projectData[a.id]?.code ?? "";
          const codeB = projectData[b.id]?.code ?? "";
          const hasValidCode = Boolean(projectData[a.id]?.hasCode && projectData[b.id]?.hasCode);

          let scb = 0;
          let sw = 0;

          if (hasValidCode) {
            try {
              const sim = await getSimilarity(codeA, codeB);
              scb = sim.scb;
              sw = sim.sw;
            } catch (e) {
              errorCount++;
              console.warn(`[Batch] Timeout/error pasangan ${a.title} x ${b.title}:`, e);
            }
          } else {
            console.warn(`[Batch] Lewati similarity untuk pasangan ${a.title} x ${b.title} karena source code tidak tersedia`);
          }

          const sg = ALPHA * scb + (1 - ALPHA) * sw;
          const classification = getClassification(scb, sw);

          const snippetAData = projectData[a.id]?.snippets ?? {};
          const snippetBData = projectData[b.id]?.snippets ?? {};

          const sharedPath = Object.keys(snippetAData).find((path) => path in snippetBData);
          const sampleCodeA = sharedPath ? snippetAData[sharedPath] : Object.values(snippetAData)[0] ?? "";
          const sampleCodeB = sharedPath ? snippetBData[sharedPath] : Object.values(snippetBData)[0] ?? "";
          const snippets =
            sampleCodeA && sampleCodeB
              ? [
                {
                  student_a: a.mahasiswa?.name || a.mahasiswa?.nim || a.title,
                  student_b: b.mahasiswa?.name || b.mahasiswa?.nim || b.title,
                  project_a: a.title,
                  project_b: b.title,
                  code_a: sampleCodeA,
                  code_b: sampleCodeB,
                  similarity: sg,
                  detected_as:
                    classification.label === "Plagiarisme Kuat"
                      ? ["tekstual", "semantik"]
                      : classification.label === "Mirip Tekstual"
                        ? ["tekstual"]
                        : classification.label === "Mirip Semantik"
                          ? ["semantik"]
                          : [],
                  matched_by:
                    classification.label === "Plagiarisme Kuat"
                      ? ["CodeBERT", "Winnowing"]
                      : classification.label === "Mirip Tekstual"
                        ? ["Winnowing"]
                        : classification.label === "Mirip Semantik"
                          ? ["CodeBERT"]
                          : [],
                  note:
                    classification.label === "Plagiarisme Kuat"
                      ? "Didukung CodeBERT dan Winnowing"
                      : classification.label === "Mirip Tekstual"
                        ? "Didukung Winnowing"
                        : classification.label === "Mirip Semantik"
                          ? "Didukung CodeBERT"
                          : "Belum melewati ambang deteksi",
                },
              ]
              : [];

          await prisma.$executeRaw(
            Prisma.sql`
              INSERT INTO "similarity_results" (
                "id", "projectAId", "projectBId", "scoreCodebert", "scoreWinnowing", "scoreHybrid", category, "categoryLabel", snippets, "createdAt", "updatedAt"
              ) VALUES (
                ${randomUUID()}, ${a.id}, ${b.id}, ${scb}, ${sw}, ${sg}, ${classification.level}, ${classification.label}, CAST(${JSON.stringify(snippets)} AS jsonb), ${new Date()}, ${new Date()}
              )
              ON CONFLICT ("projectAId", "projectBId") DO UPDATE SET
                "scoreCodebert" = EXCLUDED."scoreCodebert",
                "scoreWinnowing" = EXCLUDED."scoreWinnowing",
                "scoreHybrid" = EXCLUDED."scoreHybrid",
                category = EXCLUDED.category,
                "categoryLabel" = EXCLUDED."categoryLabel",
                snippets = EXCLUDED.snippets,
                "updatedAt" = EXCLUDED."updatedAt";
            `
          );

          results.push({
            projectA: { id: a.id, title: a.title, mahasiswa: a.mahasiswa },
            projectB: { id: b.id, title: b.title, mahasiswa: b.mahasiswa },
            codebert_score: scb,
            winnowing_score: sw,
            hybrid_score: sg,
            classification,
            snippetA: snippetAData,
            snippetB: snippetBData,
            checkedAt: new Date().toISOString(),
          });
        } catch (error) {
          errorCount++;
          console.warn(`[Batch] Gagal memproses pasangan ${a.title} x ${b.title}:`, error);
        }
      }
    }

    console.log(`[Batch] Selesai: ${pairCount} pasangan diproses, ${errorCount} error`);

    const levelOrder: Record<string, number> = { danger: 0, warning: 1, secondary: 2, success: 3 };
    results.sort(
      (a, b) =>
        levelOrder[a.classification.level] - levelOrder[b.classification.level] ||
        b.hybrid_score - a.hybrid_score
    );

    return NextResponse.json({
      total: results.length,
      totalProjects: projects.length,
      fetchErrors,
      results,
    });
  } catch (error) {
    console.error("Batch similarity error:", error);
    return NextResponse.json(
      { error: "Gagal menjalankan batch analisis kemiripan" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        projectAId: string;
        projectBId: string;
        codebertScore: number;
        winnowingScore: number;
        hybridScore: number;
        category: string;
        categoryLabel: string | null;
        snippets: unknown;
        projectATitle: string;
        projectAStudent: string | null;
        projectBTitle: string;
        projectBStudent: string | null;
      }>
    >(`
      SELECT
        sr.id,
        sr."projectAId",
        sr."projectBId",
        sr."scoreCodebert" AS "codebertScore",
        sr."scoreWinnowing" AS "winnowingScore",
        sr."scoreHybrid" AS "hybridScore",
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

    const results = rows.map((r) => ({
      id: r.id,
      projectAId: r.projectAId,
      projectBId: r.projectBId,
      codebert_score: r.codebertScore,
      winnowing_score: r.winnowingScore,
      hybrid_score: r.hybridScore,
      classification: getClassification(r.codebertScore, r.winnowingScore),
      snippetA: null,
      snippetB: null,
      projectA: { id: r.projectAId, title: r.projectATitle, mahasiswa: { name: r.projectAStudent, nim: null } },
      projectB: { id: r.projectBId, title: r.projectBTitle, mahasiswa: { name: r.projectBStudent, nim: null } },
    }));

    const levelOrder: Record<string, number> = { danger: 0, warning: 1, secondary: 2, success: 3 };
    results.sort(
      (a, b) =>
        levelOrder[a.classification.level] - levelOrder[b.classification.level] ||
        b.hybrid_score - a.hybrid_score
    );

    return NextResponse.json({ total: results.length, results });
  } catch (error) {
    console.error("GET similarity error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data kemiripan" },
      { status: 500 }
    );
  }
}
