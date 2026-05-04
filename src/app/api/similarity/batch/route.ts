import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE_URL = process.env.SIMILARITY_SERVICE_URL || "http://localhost:8000";

// Threshold sesuai proposal skripsi (Tabel 3)
const THRESHOLD_CODEBERT = 0.80; // Akbar dkk. 2025
const THRESHOLD_WINNOWING = 0.75; // Ramli et al. 2021
const ALPHA = 0.6; // bobot CodeBERT (semantik lebih dominan)

// Klasifikasi 4 kategori sesuai Tabel 3 proposal
function getClassification(scb: number, sw: number): {
  label: string;
  level: "danger" | "warning" | "secondary" | "success";
  description: string;
} {
  const cbHigh = scb >= THRESHOLD_CODEBERT;
  const wHigh = sw >= THRESHOLD_WINNOWING;
  if (cbHigh && wHigh) return { label: "Plagiarisme Kuat", level: "danger", description: "Kemiripan tinggi secara semantik DAN tekstual" };
  if (!cbHigh && wHigh) return { label: "Mirip Tekstual", level: "warning", description: "Copy-paste terdeteksi, logika berbeda" };
  if (cbHigh && !wHigh) return { label: "Mirip Semantik", level: "secondary", description: "Logika serupa, struktur teks berbeda (refactoring)" };
  return { label: "Normal", level: "success", description: "Tidak terindikasi plagiarisme" };
}

// Ambil kode dari GitHub repo beserta snippets
async function fetchGitHubCode(repoUrl: string): Promise<{ code: string; snippets: Record<string, string> } | null> {
  try {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, "");
    const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
    if (process.env.GITHUB_TOKEN) headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;

    // Coba branch main dulu, fallback ke master
    let treeRes = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/main?recursive=1`, { headers });
    if (!treeRes.ok) {
      treeRes = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/master?recursive=1`, { headers });
    }
    if (!treeRes.ok) return null;
    const tree = await treeRes.json();
    const branch = treeRes.url.includes("main") ? "main" : "master";

    const codeExts = [".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".go", ".php"];
    const codeFiles = (tree.tree ?? [])
      .filter((f: { type: string; path: string }) => f.type === "blob" && codeExts.some((ext) => f.path.endsWith(ext)))
      .slice(0, 10);
    if (!codeFiles.length) return null;

    const contents: string[] = [];
    const snippets: Record<string, string> = {};
    for (const file of codeFiles) {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${cleanRepo}/${branch}/${file.path}`;
      const r = await fetch(rawUrl, { headers });
      if (r.ok) {
        const text = await r.text();
        contents.push(text);
        // Ambil 20 baris pertama sebagai snippet
        snippets[file.path] = text.split("\n").slice(0, 20).join("\n");
      }
    }
    return contents.length ? { code: contents.join("\n\n"), snippets } : null;
  } catch { return null; }
}

// POST: Jalankan analisis batch
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { projectIds } = body;
    const whereClause = projectIds?.length
      ? { id: { in: projectIds }, githubRepoUrl: { not: null } }
      : { githubRepoUrl: { not: null } };

    const projects = await prisma.project.findMany({
      where: whereClause,
      select: { id: true, title: true, githubRepoUrl: true, mahasiswa: { select: { name: true, nim: true } } },
    });
    if (projects.length < 2) return NextResponse.json({ error: "Minimal 2 project dengan GitHub URL diperlukan" }, { status: 400 });

    // Fetch kode semua project
    const projectData: Record<string, { code: string; snippets: Record<string, string> }> = {};
    for (const p of projects) {
      if (p.githubRepoUrl) {
        const data = await fetchGitHubCode(p.githubRepoUrl);
        if (data) projectData[p.id] = data;
      }
    }

    const results = [];
    // Buat semua kombinasi pasang (n choose 2)
    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const a = projects[i];
        const b = projects[j];
        if (!projectData[a.id] || !projectData[b.id]) continue;

        const res = await fetch(`${PYTHON_SERVICE_URL}/similarity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code1: projectData[a.id].code, code2: projectData[b.id].code, alpha: ALPHA }),
        });
        if (!res.ok) continue;
        const sim = await res.json();

        const scb = sim.codebert_score ?? 0;
        const sw = sim.winnowing_score ?? 0;
        // SG = alpha*SCB + (1-alpha)*SW (formula dari proposal)
        const sg = ALPHA * scb + (1 - ALPHA) * sw;
        const classification = getClassification(scb, sw);
        const isPlagiarized = classification.level === "danger" || classification.level === "warning" || classification.level === "secondary";

        await prisma.similarityResult.upsert({
          where: { projectAId_projectBId: { projectAId: a.id, projectBId: b.id } },
          update: {
            codebertScore: scb,
            winnowingScore: sw,
            hybridScore: sg,
            isPlagiarized,
            checkedAt: new Date(),
          },
          create: {
            projectAId: a.id,
            projectBId: b.id,
            codebertScore: scb,
            winnowingScore: sw,
            hybridScore: sg,
            isPlagiarized,
          },
        });

        results.push({
          projectA: { id: a.id, title: a.title, mahasiswa: a.mahasiswa },
          projectB: { id: b.id, title: b.title, mahasiswa: b.mahasiswa },
          codebert_score: scb,
          winnowing_score: sw,
          hybrid_score: sg,
          classification,
          snippetA: projectData[a.id].snippets,
          snippetB: projectData[b.id].snippets,
          checkedAt: new Date().toISOString(),
        });
      }
    }

    // Urutkan: Plagiarisme Kuat > Mirip Tekstual > Mirip Semantik > Normal, lalu by hybrid_score
    const levelOrder: Record<string, number> = { danger: 0, warning: 1, secondary: 2, success: 3 };
    results.sort((a, b) =>
      levelOrder[a.classification.level] - levelOrder[b.classification.level] ||
      b.hybrid_score - a.hybrid_score
    );

    return NextResponse.json({ total: results.length, results });
  } catch (error) {
    console.error("Batch similarity error:", error);
    return NextResponse.json({ error: "Gagal menjalankan batch analisis kemiripan" }, { status: 500 });
  }
}

// GET: Ambil hasil dari database, sudah diurutkan
export async function GET() {
  try {
    const rows = await prisma.similarityResult.findMany({
      include: {
        projectA: { select: { id: true, title: true, githubRepoUrl: true, mahasiswa: { select: { name: true, nim: true } } } },
        projectB: { select: { id: true, title: true, githubRepoUrl: true, mahasiswa: { select: { name: true, nim: true } } } },
      },
      orderBy: { hybridScore: "desc" },
    });
    const results = rows.map((r) => ({
      ...r,
      codebert_score: r.codebertScore,
      winnowing_score: r.winnowingScore,
      hybrid_score: r.hybridScore,
      classification: getClassification(r.codebertScore, r.winnowingScore),
    }));
    return NextResponse.json({ total: results.length, results });
  } catch (error) {
    console.error("GET similarity error:", error);
    return NextResponse.json({ error: "Gagal mengambil data kemiripan" }, { status: 500 });
  }
}
