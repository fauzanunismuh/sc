import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE_URL = process.env.SIMILARITY_SERVICE_URL || "http://localhost:8000";

async function fetchGitHubCode(repoUrl: string): Promise<{ code: string; snippets: Record<string, string> } | null> {
    try {
        const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) return null;
        const [, owner, repo] = match;
        const cleanRepo = repo.replace(/\.git$/, "");
        const apiUrl = `https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/main?recursive=1`;
        const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
        if (process.env.GITHUB_TOKEN) headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
        const treeRes = await fetch(apiUrl, { headers });
        if (!treeRes.ok) return null;
        const tree = await treeRes.json();
        const codeExts = [".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".go", ".php"];
        const codeFiles = tree.tree
            ?.filter((f: { type: string; path: string }) => f.type === "blob" && codeExts.some((ext) => f.path.endsWith(ext)))
            .slice(0, 10);
        if (!codeFiles?.length) return null;
        const contents: string[] = [];
        const snippets: Record<string, string> = {};
        for (const file of codeFiles) {
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${cleanRepo}/main/${file.path}`;
            const r = await fetch(rawUrl, { headers });
            if (r.ok) {
                const text = await r.text();
                contents.push(text);
                snippets[file.path] = text.split("\n").slice(0, 20).join("\n");
            }
        }
        return { code: contents.join("\n\n"), snippets };
    } catch {
        return null;
    }
}

function getClassification(score: number): { label: string; level: "danger" | "warning" | "secondary" | "success" } {
    if (score >= 0.85) return { label: "Plagiat Tinggi", level: "danger" };
    if (score >= 0.65) return { label: "Kemiripan Signifikan", level: "warning" };
    if (score >= 0.45) return { label: "Kemiripan Sedang", level: "secondary" };
    return { label: "Normal / Aman", level: "success" };
}

export async function POST(req: NextRequest) {
    try {
        const { projectIds } = await req.json();
        const whereClause = projectIds?.length
            ? { id: { in: projectIds }, githubRepoUrl: { not: null } }
            : { githubRepoUrl: { not: null } };
        const projects = await prisma.project.findMany({
            where: whereClause,
            select: { id: true, title: true, githubRepoUrl: true, mahasiswa: { select: { name: true, nim: true } } },
        });
        if (projects.length < 2) return NextResponse.json({ error: "Minimal 2 project diperlukan" }, { status: 400 });

        const projectData: Record<string, { code: string; snippets: Record<string, string> }> = {};
        for (const p of projects) {
            if (p.githubRepoUrl) {
                const data = await fetchGitHubCode(p.githubRepoUrl);
                if (data) projectData[p.id] = data;
            }
        }

        const results = [];
        for (let i = 0; i < projects.length; i++) {
            for (let j = i + 1; j < projects.length; j++) {
                const a = projects[i];
                const b = projects[j];
                if (!projectData[a.id] || !projectData[b.id]) continue;
                const res = await fetch(`${PYTHON_SERVICE_URL}/similarity`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code1: projectData[a.id].code, code2: projectData[b.id].code, alpha: 0.6 }),
                });
                if (!res.ok) continue;
                const sim = await res.json();
                const classification = getClassification(sim.hybrid_score ?? 0);
                await prisma.similarityResult.upsert({
                    where: { projectAId_projectBId: { projectAId: a.id, projectBId: b.id } },
                    update: {
                        codebertScore: sim.codebert_score,
                        winnowingScore: sim.winnowing_score,
                        hybridScore: sim.hybrid_score,
                        isPlagiarized: sim.hybrid_score >= 0.65,
                        checkedAt: new Date(),
                    },
                    create: {
                        projectAId: a.id,
                        projectBId: b.id,
                        codebertScore: sim.codebert_score,
                        winnowingScore: sim.winnowing_score,
                        hybridScore: sim.hybrid_score,
                        isPlagiarized: sim.hybrid_score >= 0.65,
                    },
                });
                results.push({
                    projectA: { id: a.id, title: a.title, mahasiswa: a.mahasiswa },
                    projectB: { id: b.id, title: b.title, mahasiswa: b.mahasiswa },
                    codebert_score: sim.codebert_score,
                    winnowing_score: sim.winnowing_score,
                    hybrid_score: sim.hybrid_score,
                    is_plagiarized: sim.hybrid_score >= 0.65,
                    classification,
                    snippetA: projectData[a.id].snippets,
                    snippetB: projectData[b.id].snippets,
                    checkedAt: new Date().toISOString(),
                });
            }
        }
        results.sort((a, b) => b.hybrid_score - a.hybrid_score);
        return NextResponse.json({ total: results.length, results });
    } catch (error) {
        console.error("Batch similarity error:", error);
        return NextResponse.json({ error: "Gagal menjalankan batch check" }, { status: 500 });
    }
}

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
            classification: getClassification(r.hybridScore),
        }));
        return NextResponse.json({ total: results.length, results });
    } catch (error) {
        return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
    }
}