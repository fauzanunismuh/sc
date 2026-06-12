"use client";

import { AlertTriangle, BarChart3, CheckCircle2, Loader2, RefreshCw, Shield } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type CategoryLabel = "Plagiarisme Kuat" | "Mirip Semantik" | "Mirip Tekstual" | "Normal";

interface ProjectOverview {
  projectId: string;
  projectTitle: string;
  studentName: string | null;
  studentNim: string | null;
  studentUsername: string | null;
  detectedPairCount: number;
  totalPairCount: number;
  combinedScore: number;
  semanticScore: number;
  textualScore: number;
  status: CategoryLabel;
  categoryCounts: Record<CategoryLabel, number>;
}

interface OverviewResponse {
  success: boolean;
  data: ProjectOverview[];
  total_projects: number;
  total_pairs: number;
  total_with_similarity: number;
  category_totals: Record<CategoryLabel, number>;
}

export default function SimilarityCheckPage() {
  const [overview, setOverview] = useState<ProjectOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    totalPairs: 0,
    categories: {
      "Plagiarisme Kuat": 0,
      "Mirip Semantik": 0,
      "Mirip Tekstual": 0,
      Normal: 0,
    } as Record<CategoryLabel, number>,
  });

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/similarity/overview?includeNormal=true");
      if (!response.ok) {
        throw new Error("Gagal mengambil data overview");
      }

      const data: OverviewResponse = await response.json();
      setOverview(data.data || []);
      setStats({
        total: data.total_projects,
        totalPairs: data.total_pairs,
        categories: data.category_totals,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
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

  const getStatusBadge = (status: CategoryLabel) => {
    switch (status) {
      case "Plagiarisme Kuat":
        return "border-red-400/30 bg-red-400/10 text-red-700 dark:text-red-100";
      case "Mirip Semantik":
        return "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-700 dark:text-fuchsia-100";
      case "Mirip Tekstual":
        return "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-100";
      default:
        return "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-100";
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-[var(--background)] text-[var(--foreground)]">
      <section className="rounded-3xl border border-zinc-200 bg-white/85 p-6 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-700 dark:text-cyan-100">
              <BarChart3 className="h-4 w-4" />
              Analisis Kemiripan Antar Mahasiswa
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white md:text-5xl">Deteksi Kemiripan Project</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300 md:text-base">
                Konsep 1:semua - setiap project dibandingkan terhadap seluruh project lain untuk memetakan indikasi plagiarisme dan kemiripan.
              </p>
            </div>
          </div>
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-white dark:hover:bg-zinc-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">Total Project</p>
              <p className="text-3xl font-bold text-zinc-900 dark:text-white mt-2">{stats.total}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-cyan-600 dark:text-cyan-300 opacity-20" />
          </div>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-red-700 dark:text-red-100">Total Pasangan</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">{stats.totalPairs}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400 opacity-20" />
          </div>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-red-700 dark:text-red-100">Plagiarisme Kuat</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">{stats.categories["Plagiarisme Kuat"]}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400 opacity-20" />
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-100">Mirip Tekstual</p>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">{stats.categories["Mirip Tekstual"]}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400 opacity-20" />
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-100">Mirip Semantik</p>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">{stats.categories["Mirip Semantik"]}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400 opacity-20" />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-100">Normal</p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{stats.categories.Normal}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400 opacity-20" />
          </div>
        </div>
      </section>

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

      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white/85 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/30">
          <h2 className="font-semibold text-zinc-900 dark:text-white">Daftar Project</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Total: {overview.length} project</p>
        </div>

        {overview.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-600 dark:text-zinc-400 font-medium">Tidak ada data project</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/30">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Judul Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Mahasiswa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                    NIM
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Skor Gabungan
                  </th>
                  <th className="px-16 py-3 text-left text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {overview.map((project) => (
                  <tr
                    key={project.projectId}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-6 py-3 text-sm font-medium text-zinc-900 dark:text-white">{project.projectTitle}</td>
                    <td className="px-3 py-4 text-sm text-zinc-600 dark:text-zinc-400">{project.studentName || "-"}</td>
                    <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400 font-mono">{project.studentNim || "-"}</td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-cyan-600 dark:text-cyan-300">
                          {project.combinedScore.toFixed(1)}%
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {project.detectedPairCount} pasangan terdeteksi
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadge(project.status)}`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        href={`/admin/similarity-check/${project.projectId}`}
                        className="font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors"
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
      </section>
    </div>
  );
}
