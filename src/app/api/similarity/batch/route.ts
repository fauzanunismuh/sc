import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE_URL = process.env.SIMILARITY_SERVICE_URL || "http://localhost:8000";

// Ambil kode dari GitHub repo
async function fetchGitHubCode(repoUrl: string): Promise<string | null> {
    try {
        const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) return null;
        const [, owner, repo] = match;
        const cleanRepo = repo.replace(/\.git$/, "");

        const apiUrl = `https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/main?recursive=1`;
        const headers: Record<string, string> = {
            Accept: "application/vnd.github.v3+json",
        };
        if (process.env.GITHUB_TOKEN) {
            headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
        }

        const treeRes = await fetch(apiUrl, { headers });
        if (!treeRes.ok) return null;
        const tree = await treeRes.json();

        // Ambil file kode (py, js, ts, java, cpp, dll)
        const codeExts = [".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".go", ".php"];
        const codeFiles = tree.tree
            ?.filter((f: { type: string; path: string }) =>
                f.type === "blob" && codeExts.some((ext) => f.path.endsWith(ext))
            )
            .slice(0, 10); // ambil max 10 file

        if (!codeFiles?.length) return null;

        const contents: string[] = [];
        for (const file of codeFiles) {
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${cleanRepo}/main/${file.path}`;
            const r = await fetch(rawUrl, { headers });
            if (r.ok) contents.push(await r.text());
        }

        return contents.join("\n\n");
    } catch {
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { projectIds } = await req.json();

        // Ambil semua project yang punya githubRepoUrl
        const whereClause = projectIds?.length
            ? { id: { in: projectIds }, githubRepoUrl: { not: null } }
            : { githubRepoUrl: { not: null } };

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
            return NextResponse.json({ error: "Minimal 2 project diperlukan" }, { status: 400 });
        }

        // Fetch kode semua project
        const projectCodes: Record<string, string> = {};
        for (const p of projects) {
            if (p.githubRepoUrl) {
                const code = await fetchGitHubCode(p.githubRepoUrl);
                if (code) projectCodes[p.id] = code;
            }
        }

        const results = [];
        const pairs: string[][] = [];

        // Buat semua kombinasi pasangan
        for (let i = 0; i < projects.length; i++) {
            for (let j = i + 1; j < projects.length; j++) {
                const a = projects[i];
                const b = projects[j];
                if (!projectCodes[a.id] || !projectCodes[b.id]) continue;
                pairs.push([a.id, b.id]);
            }
        }

        // Hitung similarity tiap pasang
        for (const [idA, idB] of pairs) {
            const res = await fetch(`${PYTHON_SERVICE_URL}/similarity`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code1: projectCodes[idA],
                    code2: projectCodes[idB],
                    alpha: 0.6,
                }),
            });

            if (!res.ok) continue;
            const sim = await res.json();

            // Simpan ke database (upsert)
            await prisma.similarityResult.upsert({
                where: { projectAId_projectBId: { projectAId: idA, projectBId: idB } },
                update: {
                    codebertScore: sim.codebert_score,
                    winnowingScore: sim.winnowing_score,
                    hybridScore: sim.hybrid_score,
                    isPlagiarized: sim.is_plagiarized,
                    checkedAt: new Date(),
                },
                create: {
                    projectAId: idA,
                    projectBId: idB,
                    codebertScore: sim.codebert_score,
                    winnowingScore: sim.winnowing_score,
                    hybridScore: sim.hybrid_score,
                    isPlagiarized: sim.is_plagiarized,
                },
            });

            const pA = projects.find((p) => p.id === idA);
            const pB = projects.find((p) => p.id === idB);

            results.push({
                projectA: { id: idA, title: pA?.title, mahasiswa: pA?.mahasiswa },
                projectB: { id: idB, title: pB?.title, mahasiswa: pB?.mahasiswa },
                ...sim,
            });
        }

        // Sort by hybrid_score tertinggi
        results.sort((a, b) => b.hybrid_score - a.hybrid_score);

        return NextResponse.json({ total: results.length, results });
    } catch (error) {
        console.error("Batch similarity error:", error);
        return NextResponse.json({ error: "Gagal menjalankan batch check" }, { status: 500 });
    }
}

export async function GET() {
    try {
        const results = await prisma.similarityResult.findMany({
            include: {
                projectA: { select: { id: true, title: true, mahasiswa: { select: { name: true, nim: true } } } },
                projectB: { select: { id: true, title: true, mahasiswa: { select: { name: true, nim: true } } } },
            },
            orderBy: { hybridScore: "desc" },
        });

        return NextResponse.json({ total: results.length, results });
    } catch (error) {
        return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
    }
}