import { randomUUID } from "crypto";
import { Prisma } from "../src/generated/prisma";
import prisma from "../src/lib/prisma";

const PYTHON_SERVICE_URL = "http://localhost:8000";
const ALPHA = 0.6;
const THRESHOLD_CODEBERT = 0.985;
const THRESHOLD_WINNOWING = 0.08;
const FETCH_TIMEOUT_MS = 15000;
const SIMILARITY_TIMEOUT_MS = 120000;

const codeExts = [".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".go", ".php", ".rb", ".cs"];
const branches = ["main", "master", "dev", "development"];

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function getClassification(scb: number, sw: number) {
  if (scb >= THRESHOLD_CODEBERT && sw >= THRESHOLD_WINNOWING) return { label: "Plagiarisme Kuat", level: "danger" as const };
  if (sw >= THRESHOLD_WINNOWING) return { label: "Mirip Tekstual", level: "warning" as const };
  if (scb >= THRESHOLD_CODEBERT) return { label: "Mirip Semantik", level: "warning" as const };
  return { label: "Normal", level: "success" as const };
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

function collectBlocks(snippetData: Record<string, string>) {
  return Object.entries(snippetData).flatMap(([path, code]) =>
    splitIntoBlocks(code).map((block, index) => ({
      path,
      index,
      code: block,
      normalized: normalizeBlock(block),
    }))
  );
}

async function fetchGitHubCode(repoUrl: string) {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_ORG_TOKEN;
  if (githubToken) headers.Authorization = `token ${githubToken}`;

  let treeData: { tree?: { type: string; path: string }[] } | null = null;
  let activeBranch = "main";

  for (const br of branches) {
    const res = await fetchWithTimeout(`https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/${br}?recursive=1`, {
      headers,
    });
    if (res.ok) {
      treeData = await res.json();
      activeBranch = br;
      break;
    }
  }

  if (!treeData) return null;

  const codeFiles = ((treeData.tree ?? []) as { type: string; path: string }[])
    .filter((f) => f.type === "blob" && codeExts.some((ext) => f.path.endsWith(ext)));

  const snippets: Record<string, string> = {};
  const contents: string[] = [];

  for (const file of codeFiles) {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${cleanRepo}/${activeBranch}/${file.path}`;
    const r = await fetchWithTimeout(rawUrl, { headers });
    if (r.ok) {
      const text = await r.text();
      const cleaned = stripBoilerplate(text);
      if (cleaned) {
        contents.push(cleaned);
      }
      snippets[file.path] = text;
    }
  }

  return { code: contents.length > 0 ? contents.join("\n\n") : "", snippets, hasCode: contents.length > 0 };
}

async function callWithTimeout(url: string, body: object): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SIMILARITY_TIMEOUT_MS);
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
  try {
    // Use codebert-only + winnowing-only endpoints to skip expensive N² snippet search
    const [cbRes, wRes] = await Promise.all([
      callWithTimeout(`${PYTHON_SERVICE_URL}/analyze/codebert-only`, { code1: codeA, code2: codeB }),
      callWithTimeout(`${PYTHON_SERVICE_URL}/analyze/winnowing-only`, { code1: codeA, code2: codeB }),
    ]);

    const scb = cbRes.ok ? ((await cbRes.json()) as { scb: number }).scb ?? 0 : 0;
    const sw = wRes.ok ? ((await wRes.json()) as { sw: number }).sw ?? 0 : 0;
    return { scb, sw };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { scb: 0, sw: 0 };
    }
    throw error;
  }
}

type PairJob = {
  index: number;
  a: (typeof projects)[number];
  b: (typeof projects)[number];
};

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
  const pairMap = new Map<string, { a: typeof blocksA[number]; b: typeof blocksB[number] }>();

  for (const blockA of blocksA) {
    if (!blockA.normalized) continue;
    for (const blockB of blocksB) {
      if (!blockB.normalized) continue;
      if (blockA.normalized !== blockB.normalized) continue;

      const key = `${blockA.path}:${blockA.index}|${blockB.path}:${blockB.index}`;
      pairMap.set(key, { a: blockA, b: blockB });
    }
  }

  const matchedPairs = [...pairMap.values()];
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

  return matchedPairs.map(({ a, b }) => ({
    student_a: projectAStudent,
    student_b: projectBStudent,
    project_a: projectA.title,
    project_b: projectB.title,
    code_a: a.code,
    code_b: b.code,
    similarity,
    source_path: a.path,
    target_path: b.path,
    matched_by: matchedBy,
    detected_as: detectedAs,
    method_scores: methodScores,
    note,
  }));
}

async function main() {
  try {
    const projects = await prisma.project.findMany({
      where: { githubRepoUrl: { not: null } },
      select: { id: true, title: true, githubRepoUrl: true, mahasiswa: { select: { name: true, nim: true } } },
    });

    console.log(`projects=${projects.length}`);

    const projectDataEntries = await Promise.all(
      projects.map(async (project, index) => {
        try {
          const data = project.githubRepoUrl ? await fetchGitHubCode(project.githubRepoUrl) : null;
          console.log(`fetched ${index + 1}/${projects.length}: ${project.title} ${data ? "ok" : "null"}`);
          return [
            project.id,
            data
              ? { code: data.code, snippets: data.snippets, hasCode: data.hasCode }
              : { code: "", snippets: {}, hasCode: false },
          ] as const;
        } catch (error) {
          console.log(`fetched ${index + 1}/${projects.length}: ${project.title} error`);
          return [project.id, { code: "", snippets: {}, hasCode: false }] as const;
        }
      })
    );

    const projectData = Object.fromEntries(projectDataEntries) as Record<string, { code: string; snippets: Record<string, string>; hasCode: boolean }>;
    const pairJobs: PairJob[] = [];
    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        pairJobs.push({ index: pairJobs.length + 1, a: projects[i], b: projects[j] });
      }
    }

    const concurrency = 1;
    const batches: PairJob[][] = [];
    for (let i = 0; i < pairJobs.length; i += concurrency) {
      batches.push(pairJobs.slice(i, i + concurrency));
    }

    let pairCount = 0;
    for (const batch of batches) {
      await Promise.allSettled(
        batch.map(async ({ a, b }) => {
          try {
            const codeA = projectData[a.id]?.code ?? "";
            const codeB = projectData[b.id]?.code ?? "";
            const hasValidCode = Boolean(projectData[a.id]?.hasCode && projectData[b.id]?.hasCode);

            let scb = 0;
            let sw = 0;

            if (hasValidCode) {
              const sim = await getSimilarity(codeA, codeB);
              scb = sim.scb;
              sw = sim.sw;
            }

            const sg = ALPHA * scb + (1 - ALPHA) * sw;
            const classification = getClassification(scb, sw);
            const snippetPairs = buildSnippetPairs(
              { id: a.id, title: a.title, mahasiswa: a.mahasiswa },
              { id: b.id, title: b.title, mahasiswa: b.mahasiswa },
              projectData[a.id]?.snippets ?? {},
              projectData[b.id]?.snippets ?? {},
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
                  ${randomUUID()}, ${a.id}, ${b.id}, ${scb}, ${sw}, ${sg}, ${classification.level}, ${classification.label}, CAST(${JSON.stringify(snippetPairs)} AS jsonb), ${new Date()}, ${new Date()}
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

            pairCount++;
            if (pairCount % 20 === 0) {
              console.log(`processed pairs=${pairCount}`);
            }
          } catch (error) {
            console.warn(`pair failed: ${a.title} x ${b.title}`, String(error));
          }
        })
      );
    }

    console.log(`done pairs=${pairCount}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});