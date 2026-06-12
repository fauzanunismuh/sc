"use client";

import { AlertTriangle, ChevronLeft, Loader2, RefreshCw, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface ProjectDetail {
  id: string;
  title: string;
  student_name: string | null;
  student_nim: string | null;
}

interface SimilarityDetail {
  similarity_id: string;
  project_self: ProjectDetail;
  project_compared: ProjectDetail;
  is_self_project_a: boolean;
  scores: {
    codebert: number;
    winnowing: number;
    gabungan?: number;
    hybrid: number;
  };
  scores_percentage: {
    codebert: number;
    winnowing: number;
    gabungan?: number;
    hybrid: number;
  };
  category: string;
  level: "danger" | "warning" | "success";
  checked_at: string;
}

interface ProjectDetailResponse {
  success: boolean;
  project: ProjectDetail;
  similarities: SimilarityDetail[];
  total_similar: number;
}

export default function SimilarityDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [similarities, setSimilarities] = useState<SimilarityDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ projectId }) => {
      setProjectId(projectId);
    });
  }, [params]);

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const fetchData = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/similarity/project/${projectId}`);
      if (!response.ok) {
        throw new Error("Gagal mengambil data project");
      }

      const data: ProjectDetailResponse = await response.json();
      setProject(data.project);
      setSimilarities(data.similarities || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "Plagiarisme Kuat":
        return "border-red-400/30 bg-red-400/10 text-red-700 dark:text-red-100";
      case "Mirip Tekstual":
        return "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-100";
      case "Mirip Semantik":
        return "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-700 dark:text-fuchsia-100";
      default:
        return "border-zinc-400/30 bg-zinc-400/10 text-zinc-700 dark:text-zinc-100";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-cyan-600 dark:text-cyan-300" />
          <p className="text-zinc-600 dark:text-zinc-400">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 bg-[var(--background)] text-[var(--foreground)]">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/80 px-3 py-2 text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm font-medium">Kembali</span>
      </button>

      {/* Project Info */}
      {project && (
        <div className="rounded-3xl border border-zinc-200 bg-white/85 p-6 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-100">
            Analisis 1 : Semua
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{project.title}</h1>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Mahasiswa</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white mt-1">{project.student_name || "-"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">NIM</p>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white mt-1 font-mono">{project.student_nim || "-"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 backdrop-blur">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-700 dark:text-red-300">Error</p>
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Similarity List */}
      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white/85 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-4 flex justify-between items-center dark:border-zinc-800 dark:bg-zinc-950/30">
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-white">Kemiripan Ditemukan</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Total: {similarities.length} pasangan</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-white dark:hover:bg-zinc-800"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {similarities.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-600 dark:text-zinc-400 font-medium">Tidak ada kemiripan terdeteksi</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">Project ini aman dari plagiarisme</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/30">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Judul Project Pembanding
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Mahasiswa
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                    CodeBERT
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Winnowing
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Gabungan
                  </th>
                  <th className="px-14 py-3 text-left text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Kategori
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {similarities.map((sim) => (
                  <tr key={sim.similarity_id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-white">
                      {sim.project_compared.title}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {sim.project_compared.student_name || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="font-semibold text-cyan-600 dark:text-cyan-300">
                        {sim.scores_percentage.codebert.toFixed(1)}%
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{sim.scores.codebert.toFixed(3)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="font-semibold text-cyan-600 dark:text-cyan-300">
                        {sim.scores_percentage.winnowing.toFixed(1)}%
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{sim.scores.winnowing.toFixed(3)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="font-semibold text-cyan-600 dark:text-cyan-300">
                        {(sim.scores_percentage.gabungan ?? sim.scores_percentage.hybrid).toFixed(1)}%
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {(sim.scores.gabungan ?? sim.scores.hybrid).toFixed(3)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getCategoryBadgeColor(sim.category)}`}>
                        {sim.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        href={`/admin/similarity-check/pair/${sim.project_self.id}/${sim.project_compared.id}`}
                        className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-400/20 dark:text-cyan-100"
                      >
                        Lihat
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
