import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE_URL = process.env.SIMILARITY_SERVICE_URL || "http://localhost:8000";

// Threshold sesuai proposal skripsi (Tabel 3)
// CodeBERT: 0.80 (Akbar dkk. 2025), Winnowing: 0.75 (Ramli 2021)
const ALPHA = 0.6;
const THRESHOLD_CODEBERT = 0.80;
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

    // Coba beberapa branch umum
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

    // Kalau semua branch gagal, return null (repo tidak bisa diakses)
    if (!treeData) return null;

    const codeExts = [".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".go", ".php", ".rb", ".cs"];
    const codeFiles = ((treeData.tree ?? []) as { type: string; path: string }[])
      .filter((f) => f.type === "blob" && codeExts.some((ext) => f.path.endsWith(ext)))
      .slice(0, 20); // Naikkan dari 10 ke 20 untuk representasi lebih baik

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { projectIds } = body;

    // Ambil SEMUA proyek - tidak hanya yang punya githubRepoUrl
    // Proyek tanpa URL akan tetap dipasangkan dengan skor 0
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

    // Fetch kode untuk setiap proyek
    const projectData: Record<string, { code: string; snippets: Record<string, string>; hasCode?: boolean }> = {};
    const fetchErrors: string[] = [];

    for (const p of projects) {
      if (p.githubRepoUrl) {
        const data = await fetchGitHubCode(p.githubRepoUrl);
        if (data) {
          projectData[p.id] = { code: data.code, snippets: data.snippets, hasCode: data.hasCode };
          console.log(`[Batch] ✓ ${p.title} (branch: ${data.branch}, snippets: ${Object.keys(data.snippets).length})`);
        } else {
          // Repo tidak bisa diakses - simpan sebagai tanpa kode agar tidak menghasilkan sinyal palsu
          projectData[p.id] = {
            code: "",
            snippets: {},
            hasCode: false,
          };
          fetchErrors.push(p.title);
          console.warn(`[Batch] ✗ Gagal fetch: ${p.title} (${p.githubRepoUrl})`);
        }
      } else {
        // Proyek tanpa GitHub URL - tidak diberi placeholder agar tidak bias similarity
        projectData[p.id] = {
          code: "",
          snippets: {},
          hasCode: false,
        };
        console.warn(`[Batch] ⚠ Tidak ada GitHub URL: ${p.title}`);
      }
    }

    const results = [];
    let pairCount = 0;
    let errorCount = 0;

    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const a = projects[i];
        const b = projects[j];
        pairCount++;

        const codeA = projectData[a.id]?.code ?? "";
        const codeB = projectData[b.id]?.code ?? "";
        const hasValidCode = Boolean(projectData[a.id]?.hasCode && projectData[b.id]?.hasCode);

        let scb = 0;
        let sw = 0;

        if (hasValidCode) {
          try {
            const res = await fetch(`${PYTHON_SERVICE_URL}/similarity`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code1: codeA, code2: codeB, alpha: ALPHA }),
            });

            if (res.ok) {
              const sim = await res.json();
              scb = sim.codebert_score ?? 0;
              sw = sim.winnowing_score ?? 0;
            } else {
              errorCount++;
              console.warn(`[Batch] Python service error untuk pasangan ${a.title} x ${b.title}`);
            }
          } catch (e) {
            errorCount++;
            console.warn(`[Batch] Timeout/error pasangan ${a.title} x ${b.title}:`, e);
          }
        } else {
          console.warn(`[Batch] Lewati similarity untuk pasangan ${a.title} x ${b.title} karena source code tidak tersedia`);
        }

        const sg = ALPHA * scb + (1 - ALPHA) * sw;
        const classification = getClassification(scb, sw);
        const isPlagiarized = classification.level !== "success";

        const snippetAData = projectData[a.id]?.snippets ?? {};
        const snippetBData = projectData[b.id]?.snippets ?? {};

        // Simpan/update ke database
        await prisma.similarityResult.upsert({
          where: {
            projectAId_projectBId: {
              projectAId: a.id,
              projectBId: b.id,
            },
          },
          update: {
            codebertScore: scb,
            winnowingScore: sw,
            hybridScore: sg,
            isPlagiarized,
            snippetA: snippetAData,
            snippetB: snippetBData,
            checkedAt: new Date(),
          },
          create: {
            projectAId: a.id,
            projectBId: b.id,
            codebertScore: scb,
            winnowingScore: sw,
            hybridScore: sg,
            isPlagiarized,
            snippetA: snippetAData,
            snippetB: snippetBData,
          },
        });

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
    const rows = await prisma.similarityResult.findMany({
      include: {
        projectA: {
          select: {
            id: true,
            title: true,
            githubRepoUrl: true,
            mahasiswa: { select: { name: true, nim: true } },
          },
        },
        projectB: {
          select: {
            id: true,
            title: true,
            githubRepoUrl: true,
            mahasiswa: { select: { name: true, nim: true } },
          },
        },
      },
      orderBy: { hybridScore: "desc" },
    });

    const results = rows.map((r) => ({
      ...r,
      codebert_score: r.codebertScore,
      winnowing_score: r.winnowingScore,
      hybrid_score: r.hybridScore,
      classification: getClassification(r.codebertScore, r.winnowingScore),
      snippetA: r.snippetA as Record<string, string> | null,
      snippetB: r.snippetB as Record<string, string> | null,
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
