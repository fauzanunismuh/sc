import { randomUUID } from "crypto";
import { Prisma } from "../src/generated/prisma";
import prisma from "../src/lib/prisma";

const PYTHON_SERVICE_URL = "http://localhost:8000";
const ALPHA = 0.5;
const THRESHOLD_CODEBERT = 0.985;
const THRESHOLD_WINNOWING = 0.08;
const MIN_BLOCK_TOKENS = 2;
const BLOCK_MATCH_THRESHOLD = 0.5;
const MAX_SNIPPETS_PER_PAIR = 10;
const MIN_BLOCK_CHAR_LENGTH = 40;
const FETCH_TIMEOUT_MS = 15000;
const SIMILARITY_TIMEOUT_MS = 120000;

const codeExts = [".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".go", ".php", ".rb", ".cs"];
const branches = ["main", "master", "dev", "development"];
const ignoredPathSegments = [
    "/node_modules/",
    "/dist/",
    "/build/",
    "/.next/",
    "/coverage/",
    "/vendor/",
    "/generated/",
    "/out/",
    "/.turbo/",
];

type ProjectRecord = {
    id: string;
    title: string;
    githubRepoUrl: string | null;
    mahasiswa: { name: string | null; nim: string | null } | null;
};

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

function splitIntoBlocks(code: string) {
    return code.split(/\n\s*\n+/).map((block) => block.trim()).filter(Boolean);
}

function stripBoilerplate(code: string) {
    return code
        .split("\n")
        .filter((line) => {
            const normalized = line.trim();
            if (!normalized) return true;
            return ![
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
        })
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

function isIgnoredPath(path: string) {
    const normalized = `/${path.toLowerCase()}`;
    if (ignoredPathSegments.some((segment) => normalized.includes(segment))) {
        return true;
    }

    return normalized.endsWith(".d.ts") || normalized.includes("/migrations/") || normalized.endsWith(".min.js");
}

function hasLowSignal(cleaned: string, tokenSize: number) {
    if (cleaned.length < MIN_BLOCK_CHAR_LENGTH) return true;
    if (tokenSize < MIN_BLOCK_TOKENS) return true;

    const normalized = normalizeBlock(cleaned);
    return [
        /^return\s+[a-z0-9_.$]+\s*;?$/,
        /^}\s*$/,
        /^\{\s*$/,
        /^const\s+[a-z0-9_]+\s*=\s*[a-z0-9_.$]+\s*;?$/,
        /^if\s*\(.+\)\s*\{?$/,
    ].some((pattern) => pattern.test(normalized));
}

function collectBlocks(snippetData: Record<string, string>) {
    const seenNormalized = new Set<string>();

    return Object.entries(snippetData).flatMap(([path, code]) =>
        splitIntoBlocks(code)
            .map((block, index) => ({
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
            .filter((entry) => !hasLowSignal(entry.cleaned, entry.tokens.size))
            .filter((entry) => {
                if (seenNormalized.has(entry.normalized)) {
                    return false;
                }

                seenNormalized.add(entry.normalized);
                return true;
            })
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
        const res = await fetchWithTimeout(`https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/${br}?recursive=1`, { headers });
        if (res.ok) {
            treeData = await res.json();
            activeBranch = br;
            break;
        }
    }

    if (!treeData) return null;

    const codeFiles = ((treeData.tree ?? []) as { type: string; path: string }[])
        .filter((f) => f.type === "blob" && codeExts.some((ext) => f.path.endsWith(ext)) && !isIgnoredPath(f.path));

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

    return {
        code: contents.length > 0 ? contents.join("\n\n") : "",
        snippets,
        hasCode: contents.length > 0,
    };
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
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            return { scb: 0, sw: 0 };
        }
        throw error;
    }
}

type PairJob = {
    index: number;
    a: ProjectRecord;
    b: ProjectRecord;
};

function buildSnippetPairs(
    snippetAData: Record<string, string>,
    snippetBData: Record<string, string>,
    similarity: number
) {
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
    if (matchedPairs.length === 0) return [];

    return matchedPairs.slice(0, MAX_SNIPPETS_PER_PAIR).map(({ a, b, score }) => ({
        code_a: a.code,
        code_b: b.code,
        similarity,
        snippet_similarity: score,
        source_path: a.path,
        target_path: b.path,
    }));
}

async function main() {
    try {
        const projects: ProjectRecord[] = await prisma.project.findMany({
            where: { githubRepoUrl: { not: null } },
            select: { id: true, title: true, githubRepoUrl: true, mahasiswa: { select: { name: true, nim: true } } },
        });

        console.log(`projects=${projects.length}`);

        const projectDataEntries = await Promise.all(
            projects.map(async (project: ProjectRecord, index: number) => {
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
                            projectData[a.id]?.snippets ?? {},
                            projectData[b.id]?.snippets ?? {},
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
                        try {
                            await prisma.$executeRaw(
                                Prisma.sql`
                  INSERT INTO "similarity_results" (
                    "id", "projectAId", "projectBId", "scoreCodebert", "scoreWinnowing", "scoreHybrid", category, "categoryLabel", snippets, "createdAt", "updatedAt"
                  ) VALUES (
                    ${randomUUID()}, ${a.id}, ${b.id}, ${0}, ${0}, ${0}, ${"success"}, ${"Normal"}, CAST(${JSON.stringify([])} AS jsonb), ${new Date()}, ${new Date()}
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
                        } catch (fallbackError) {
                            console.warn(`pair fallback failed: ${a.title} x ${b.title}`, String(fallbackError));
                        }

                        pairCount++;
                        if (pairCount % 20 === 0) {
                            console.log(`processed pairs=${pairCount}`);
                        }
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
