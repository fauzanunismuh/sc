import { Prisma } from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE_URL = process.env.SIMILARITY_SERVICE_URL || "http://localhost:8000";

// Threshold hasil kalibrasi lokal
// CodeBERT: 0.985, Winnowing: 0.08
const ALPHA = 0.6;
const THRESHOLD_CODEBERT = 0.985;
const THRESHOLD_WINNOWING = 0.08;
const MIN_BLOCK_TOKENS = 2;
const BLOCK_MATCH_THRESHOLD = 0.5;

/**
Klasifikasi
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

function getDetectedAs(scb: number, sw: number) {
  const out: Array<"tekstual" | "semantik"> = [];
  if (sw >= THRESHOLD_WINNOWING) out.push("tekstual");
  if (scb >= THRESHOLD_CODEBERT) out.push("semantik");
  return out;
}

function getMatchedBy(detectedAs: Array<"tekstual" | "semantik">) {
  const out: Array<"CodeBERT" | "Winnowing"> = [];
  if (detectedAs.includes("semantik")) out.push("CodeBERT");
  if (detectedAs.includes("tekstual")) out.push("Winnowing");
  return out;
}

function getSnippetNote(detectedAs: Array<"tekstual" | "semantik">) {
  if (detectedAs.includes("semantik") && detectedAs.includes("tekstual")) return "Didukung CodeBERT dan Winnowing";
  if (detectedAs.includes("semantik")) return "Didukung CodeBERT";
  if (detectedAs.includes("tekstual")) return "Didukung Winnowing";
  return "Belum melewati ambang deteksi";
}

function splitIntoBlocks(code: string) {
  return code.split(/\n\s*\n+/).map((block) => block.trim()).filter(Boolean);
}

function isBoilerplateLine(line: string) {
  const normalized = line.trim();
  if (!normalized) return true;
  return [
    /^import\s+.+from\s+['"].+['"];?$/,
    /^import\s+['"].+['"];?$/,
    /^export\s+default\s+.+$/,
    /^export\s+(const|function|class|type|interface)\s+.+$/,
    /^"use (client|server)";?$/,
    /^'use (client|server)';?$/,
    /^package\s+config$/,
    /^#\s*include\s+<.+>$/,
    /^using\s+namespace\s+.+;$/,
  ].some((pattern) => pattern.test(normalized));
}

function stripBoilerplate(code: string) {
  return code
    .split("\n")
    .filter((line) => !isBoilerplateLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeBlock(block: string) {
  return block.replace(/\s+/g, " ").trim().toLowerCase();
}

function tokenizeBlock(block: string) {
  return new Set((block.match(/[A-Za-z_][A-Za-z0-9_]{2,}/g) ?? []).map((token) => token.toLowerCase()));
}

function collectBlocks(snippetData: Record<string, string>) {
  return Object.entries(snippetData).flatMap(([path, code]) =>
    splitIntoBlocks(code).map((block, index) => ({
      path,
      index,
      code: block,
      cleaned: stripBoilerplate(block),
    }))
      .filter((entry) => entry.cleaned.length > 0)
      .map((entry) => ({
        ...entry,
        normalized: normalizeBlock(entry.cleaned),
        tokens: tokenizeBlock(entry.cleaned),
      }))
      .filter((entry) => entry.tokens.size >= MIN_BLOCK_TOKENS)
  );
}

function blockSimilarity(left: { tokens: Set<string>; normalized: string }, right: { tokens: Set<string>; normalized: string }) {
  if (!left.normalized || !right.normalized) return 0;

  const leftTokens = left.tokens;
  const rightTokens = right.tokens;
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection++;
  }

  const minSize = Math.min(leftTokens.size, rightTokens.size);
  const maxSize = Math.max(leftTokens.size, rightTokens.size);
  const overlap = intersection / minSize;
  const jaccard = intersection / (leftTokens.size + rightTokens.size - intersection);
  const sizeBalance = minSize / maxSize;

  return (0.55 * overlap) + (0.30 * jaccard) + (0.15 * sizeBalance);
}

function buildSnippetPairs(
  projectA: { id: string; title: string; mahasiswa: { name: string | null; nim: string | null } | null },
  projectB: { id: string; title: string; mahasiswa: { name: string | null; nim: string | null } | null },
  snippetAData: Record<string, string>,
  snippetBData: Record<string, string>,
  similarity: number,
  scoreCodebert: number,
  scoreWinnowing: number,
  scoreGabungan: number
) {
  const projectAStudent = projectA.mahasiswa?.name || projectA.mahasiswa?.nim || "Project A";
  const projectBStudent = projectB.mahasiswa?.name || projectB.mahasiswa?.nim || "Project B";
  const detectedAs = getDetectedAs(scoreCodebert, scoreWinnowing);
  const matchedBy = getMatchedBy(detectedAs);
  const note = getSnippetNote(detectedAs);
  const methodScores = { codebert: scoreCodebert, winnowing: scoreWinnowing, gabungan: scoreGabungan };
  const blocksA = collectBlocks(snippetAData);
  const blocksB = collectBlocks(snippetBData);
  const pairMap = new Map<string, { a: typeof blocksA[number]; b: typeof blocksB[number]; score: number }>();

  for (const blockA of blocksA) {
    for (const blockB of blocksB) {
      const score = blockSimilarity(blockA, blockB);
      if (score < BLOCK_MATCH_THRESHOLD) continue;

      const key = `${blockA.path}:${blockA.index}|${blockB.path}:${blockB.index}`;
      const existing = pairMap.get(key);
      if (!existing || score > existing.score) {
        pairMap.set(key, { a: blockA, b: blockB, score });
      }
    }
  }

  const matchedPairs = [...pairMap.values()].sort((left, right) => right.score - left.score);
  if (matchedPairs.length === 0) {
    const firstSnippetA = Object.values(snippetAData)[0] ?? "";
    const firstSnippetB = Object.values(snippetBData)[0] ?? "";
    if (!firstSnippetA && !firstSnippetB) return [];

    return [
      {
        student_a: projectAStudent,
        student_b: projectBStudent,
        project_a: projectA.title,
        project_b: projectB.title,
        code_a: firstSnippetA,
        code_b: firstSnippetB,
        similarity,
        matched_by: matchedBy,
        detected_as: detectedAs,
        method_scores: methodScores,
        note,
      },
    ];
  }

  return matchedPairs.map(({ a, b, score }) => ({
    student_a: projectAStudent,
    student_b: projectBStudent,
    project_a: projectA.title,
    project_b: projectB.title,
    code_a: a.code,
    code_b: b.code,
    similarity,
    snippet_similarity: score,
    source_path: a.path,
    target_path: b.path,
    matched_by: matchedBy,
    detected_as: detectedAs,
    method_scores: methodScores,
    note,
  }));
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
      .filter((f) => f.type === "blob" && codeExts.some((ext) => f.path.endsWith(ext)));

    const contents: string[] = [];
    const snippets: Record<string, string> = {};

    if (codeFiles.length > 0) {
      for (const file of codeFiles) {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${cleanRepo}/${activeBranch}/${file.path}`;
        const r = await fetch(rawUrl, { headers });
        if (r.ok) {
          const text = await r.text();
          const cleaned = stripBoilerplate(text);
          if (cleaned) {
            contents.push(cleaned);
          }
          snippets[file.path] = text;
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

          const snippets = buildSnippetPairs(
            { id: a.id, title: a.title, mahasiswa: a.mahasiswa },
            { id: b.id, title: b.title, mahasiswa: b.mahasiswa },
            snippetAData,
            snippetBData,
            sg,
            scb,
            sw,
            sg
          );

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
