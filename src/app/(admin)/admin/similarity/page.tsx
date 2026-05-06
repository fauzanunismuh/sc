"use client";

import {
  AlertTriangle,
  BarChart,
  CheckCircle2,
  ChevronDown,
  FileText,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type CompareSnippet = {
  student_a: string;
  student_b: string;
  project_a: string;
  project_b: string;
  code_a: string;
  code_b: string;
  similarity: number;
  detected_as?: Array<"tekstual" | "semantik">;
  source_path?: string;
  target_path?: string;
  matched_by?: Array<"CodeBERT" | "Winnowing">;
  method_scores?: {
    codebert: number;
    winnowing: number;
    gabungan: number;
  };
  note?: string;
};

function toThresholdScores(scores?: CompareSnippet["method_scores"]) {
  if (!scores) {
    return undefined;
  }

  return {
    scb: scores.codebert,
    sw: scores.winnowing,
  };
}

type SuspiciousPair = {
  student_a: string;
  student_b: string;
  project_a: string;
  project_b: string;
  scores: { scb: number; sw: number; sg: number };
  category: string;
  snippets: CompareSnippet[];
};

type CompareStudentsResponse = {
  suspicious_pairs?: SuspiciousPair[];
  error?: string;
};

type ScoreLike = {
  scb?: number;
  sw?: number;
  sg?: number;
  codebert?: number;
  winnowing?: number;
  gabungan?: number;
};

function asPercent(value: number) {
  return value <= 1 ? value * 100 : value;
}

function normalizeScore(value: number) {
  return value > 1 ? value / 100 : value;
}

function isPlagiarismeKuat(category: string, scores?: ScoreLike) {
  const semanticScore = scores?.scb ?? scores?.codebert;
  const textualScore = scores?.sw ?? scores?.winnowing;

  if (typeof semanticScore === "number" && typeof textualScore === "number") {
    return normalizeScore(semanticScore) >= 0.8 && normalizeScore(textualScore) >= 0.75;
  }

  const normalized = category.toLowerCase();
  return normalized.includes("plagiarisme") || normalized.includes("kuat") || (normalized.includes("semantik") && normalized.includes("tekstual"));
}

function classifyCategory(category: string, scores?: ScoreLike) {
  const semanticScore = scores?.scb ?? scores?.codebert;
  const textualScore = scores?.sw ?? scores?.winnowing;

  if (typeof semanticScore === "number" && typeof textualScore === "number") {
    const normalizedSemantic = normalizeScore(semanticScore);
    const normalizedTextual = normalizeScore(textualScore);

    if (normalizedSemantic >= 0.8 && normalizedTextual >= 0.75) {
      return { label: "Plagiarisme Kuat", icon: AlertTriangle, className: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-100" };
    }

    if (normalizedTextual >= 0.75) {
      return { label: "Mirip Tekstual", icon: AlertTriangle, className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-100" };
    }

    if (normalizedSemantic >= 0.8) {
      return { label: "Mirip Semantik", icon: AlertTriangle, className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-100" };
    }

    return { label: "Normal", icon: CheckCircle2, className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100" };
  }

  if (isPlagiarismeKuat(category, scores)) {
    return { label: "Plagiarisme Kuat", icon: AlertTriangle, className: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-100" };
  }

  const normalized = category.toLowerCase();

  if (normalized.includes("tekstual")) {
    return { label: "Mirip Tekstual", icon: AlertTriangle, className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-100" };
  }
  if (normalized.includes("semantik")) {
    return { label: "Mirip Semantik", icon: AlertTriangle, className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-100" };
  }
  return { label: "Normal", icon: CheckCircle2, className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100" };
}

function getSnippetNote(category: string, similarity: number, scores?: ScoreLike) {
  if (isPlagiarismeKuat(category, scores)) {
    return `Memenuhi ambang SCB ≥ 0,80 dan SW ≥ 0,75 (${similarity.toFixed(0)}%)`;
  }

  const normalized = category.toLowerCase();
  if (normalized.includes("semantik") && normalized.includes("tekstual")) {
    return `Mirip secara semantik dan tekstual (${similarity.toFixed(0)}%)`;
  }
  if (normalized.includes("semantik")) {
    return `Mirip secara semantik (${similarity.toFixed(0)}%)`;
  }
  if (normalized.includes("tekstual")) {
    return `Mirip secara tekstual (${similarity.toFixed(0)}%)`;
  }
  return `Potongan terdeteksi mirip (${similarity.toFixed(0)}%)`;
}

function formatCodeLabel(student: string, project: string) {
  return `[${student} - ${project}]`;
}

function formatDetectedLabel(kind: "tekstual" | "semantik") {
  return kind === "tekstual" ? "Terdeteksi Tekstual" : "Terdeteksi Semantik";
}

function getDetectedSummary(snippet: CompareSnippet, category: string) {
  const detectedAs = snippet.detected_as ?? [];
  const thresholdScores = toThresholdScores(snippet.method_scores);

  if (isPlagiarismeKuat(category, thresholdScores)) {
    return "Plagiarisme Kuat";
  }

  if (detectedAs.length > 0) {
    return detectedAs.map((kind) => formatDetectedLabel(kind)).join(" · ");
  }

  const normalized = category.toLowerCase();
  if (normalized.includes("semantik") && normalized.includes("tekstual")) {
    return "Terdeteksi Tekstual · Terdeteksi Semantik";
  }
  if (normalized.includes("semantik")) {
    return "Terdeteksi Semantik";
  }
  if (normalized.includes("tekstual")) {
    return "Terdeteksi Tekstual";
  }

  return "Belum ada label deteksi";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHighlightTerms(primaryCode: string, counterpartCode: string) {
  const tokenPattern = /[A-Za-z_][A-Za-z0-9_]{2,}/g;
  const primaryTokens = new Set((primaryCode.match(tokenPattern) ?? []).map((token) => token.toLowerCase()));
  const counterpartTokens = new Set((counterpartCode.match(tokenPattern) ?? []).map((token) => token.toLowerCase()));

  return [...primaryTokens].filter((token) => counterpartTokens.has(token)).slice(0, 12);
}

function renderHighlightedLine(line: string, terms: string[]) {
  if (terms.length === 0) {
    return line;
  }

  const regex = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");

  return line.split(regex).map((part, index) =>
    terms.some((term) => term.toLowerCase() === part.toLowerCase()) ? (
      <mark key={`${part}-${index}`} className="rounded bg-yellow-300/40 px-0.5 text-inherit dark:bg-yellow-300/20">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function HighlightedCode({ code, counterpart }: { code: string; counterpart: string }) {
  const terms = buildHighlightTerms(code, counterpart);
  const counterpartLines = new Set(
    counterpart
      .split("\n")
      .map((line) => line.trim().replace(/\s+/g, " "))
      .filter((line) => line.length > 0)
  );

  return (
    <div className="max-h-72 overflow-x-auto p-4 text-xs leading-relaxed text-zinc-900 dark:text-white">
      {code.split("\n").map((line, index) => {
        const normalized = line.trim().replace(/\s+/g, " ");
        const isMatched = normalized.length > 0 && counterpartLines.has(normalized);

        return (
          <div
            key={`${index}-${normalized.slice(0, 16)}`}
            className={`flex gap-3 rounded-md px-2 py-0.5 ${isMatched ? "bg-yellow-300/15 dark:bg-yellow-300/10" : ""}`}
          >
            <span className="w-8 shrink-0 select-none text-right text-[10px] text-zinc-400 dark:text-zinc-500">{index + 1}</span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
              {renderHighlightedLine(line, terms)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ScoreInline({ label, score }: { label: string; score: number }) {
  const percent = asPercent(score);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white/90 px-4 py-3 text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-white">
      <div className="flex items-center gap-2 text-sm font-medium">
        <BarChart className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
        <span>{label}</span>
      </div>
      <div className="text-sm font-semibold text-cyan-700 dark:text-cyan-200">{percent.toFixed(1)}%</div>
    </div>
  );
}

function CodeSnippet({ snippet, category }: { snippet: CompareSnippet; category: string }) {
  const thresholdScores = toThresholdScores(snippet.method_scores);
  const strongMatch = isPlagiarismeKuat(category, thresholdScores);
  const note = strongMatch
    ? `Memenuhi ambang SCB ≥ 0,80 dan SW ≥ 0,75 (${snippet.similarity.toFixed(0)}%)`
    : snippet.note ?? getSnippetNote(category, snippet.similarity, thresholdScores);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/30">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <FileText className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
          Potongan kode yang mirip
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {strongMatch ? (
            <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-100">
              Plagiarisme Kuat
            </span>
          ) : (
            snippet.detected_as?.map((kind) => (
              <span
                key={kind}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${kind === "tekstual" ? "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-100" : "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-700 dark:text-fuchsia-100"}`}
              >
                {formatDetectedLabel(kind)}
              </span>
            ))
          )}
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-100">
            Similarity {asPercent(snippet.similarity).toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-200 px-4 py-3 text-[11px] font-medium text-zinc-600 dark:border-zinc-800 dark:text-slate-400">
        <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 dark:border-zinc-700 dark:bg-zinc-900/80">{note}</span>
        {snippet.source_path && <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 dark:border-zinc-700 dark:bg-zinc-900/80">A: {snippet.source_path}</span>}
        {snippet.target_path && <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 dark:border-zinc-700 dark:bg-zinc-900/80">B: {snippet.target_path}</span>}
        {snippet.method_scores && (
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 dark:border-zinc-700 dark:bg-zinc-900/80">
            CB {asPercent(snippet.method_scores.codebert).toFixed(1)}% · WN {asPercent(snippet.method_scores.winnowing).toFixed(1)}%
          </span>
        )}
      </div>

      <div className="border-b border-zinc-200 bg-zinc-50/70 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/20 dark:text-slate-400">
        Bagian yang sama ditandai kuning di bawah.
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-cyan-500/20 bg-cyan-500/5">
          <div className="border-b border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-900 dark:text-cyan-100">
            {formatCodeLabel(snippet.student_a, snippet.project_a)}
          </div>
          <HighlightedCode code={snippet.code_a} counterpart={snippet.code_b} />
        </div>

        <div className="overflow-hidden rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5">
          <div className="border-b border-fuchsia-500/20 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold text-fuchsia-900 dark:text-fuchsia-100">
            {formatCodeLabel(snippet.student_b, snippet.project_b)}
          </div>
          <HighlightedCode code={snippet.code_b} counterpart={snippet.code_a} />
        </div>
      </div>
    </div>
  );
}

export default function AdminSimilarityPage() {
  const [results, setResults] = useState<SuspiciousPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState<"sg" | "scb" | "sw">("sg");
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/compare/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = (await response.json()) as CompareStudentsResponse;

      if (!response.ok || data.error) {
        setResults([]);
        setError(data.error || "Gagal mengambil hasil perbandingan mahasiswa.");
        return;
      }

      setResults(data.suspicious_pairs || []);
    } catch (requestError) {
      console.error(requestError);
      setError("Gagal mengambil data. Pastikan server berjalan.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const runComparison = useCallback(async () => {
    setRunning(true);
    setError(null);

    try {
      const response = await fetch("/api/compare/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = (await response.json()) as CompareStudentsResponse;

      if (!response.ok || data.error) {
        setError(data.error || "Gagal menjalankan analisis batch.");
        return;
      }

      setResults(data.suspicious_pairs || []);
    } catch (requestError) {
      console.error(requestError);
      setError("Gagal menjalankan analisis batch.");
    } finally {
      setRunning(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runComparison();
  }, [runComparison]);

  const filtered = useMemo(() => {
    return results
      .filter((pair) => {
        const query = search.toLowerCase();
        const matchSearch =
          pair.student_a.toLowerCase().includes(query) ||
          pair.student_b.toLowerCase().includes(query) ||
          pair.project_a.toLowerCase().includes(query) ||
          pair.project_b.toLowerCase().includes(query) ||
          pair.category.toLowerCase().includes(query);

        const status = pair.category.toLowerCase();
        const strongMatch = isPlagiarismeKuat(pair.category, pair.scores);
        const matchStatus =
          filterStatus === "all" ||
          (filterStatus === "kuat" && strongMatch) ||
          (filterStatus === "tekstual" && status.includes("tekstual")) ||
          (filterStatus === "semantik" && status.includes("semantik")) ||
          (filterStatus === "normal" && status.includes("normal"));

        return matchSearch && matchStatus;
      })
      .sort((left, right) => {
        if (sortBy === "scb") return asPercent(right.scores.scb) - asPercent(left.scores.scb);
        if (sortBy === "sw") return asPercent(right.scores.sw) - asPercent(left.scores.sw);
        return asPercent(right.scores.sg) - asPercent(left.scores.sg);
      });
  }, [filterStatus, results, search, sortBy]);

  const totalKuat = results.filter((pair) => isPlagiarismeKuat(pair.category, pair.scores)).length;
  const totalTekstual = results.filter((pair) => !isPlagiarismeKuat(pair.category, pair.scores) && pair.category.toLowerCase().includes("tekstual")).length;
  const totalSemantik = results.filter((pair) => !isPlagiarismeKuat(pair.category, pair.scores) && pair.category.toLowerCase().includes("semantik")).length;
  const totalNormal = results.filter((pair) => pair.category.toLowerCase().includes("normal")).length;

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-zinc-200 bg-white/85 p-6 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/70 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-700 dark:text-cyan-100">
                <BarChart className="h-4 w-4" />
                Analisis Kemiripan Antar Mahasiswa
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white md:text-5xl">Deteksi plagiarisme capstone</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-slate-300 md:text-base">
                  Admin melihat seluruh pasangan yang mencurigakan, lengkap dengan skor gabungan, CodeBERT, Winnowing, dan potongan snippet yang sudah dilabeli nama mahasiswa serta project sumbernya.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={fetchResults}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-white dark:hover:bg-zinc-800"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button
                onClick={runComparison}
                disabled={running}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:from-cyan-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {running ? "Memproses..." : "Jalankan Analisis"}
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-700 shadow-sm dark:text-red-100">
            <AlertTriangle className="h-5 w-5 text-red-300" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="mb-3 flex items-center justify-between text-zinc-600 dark:text-slate-300">
              <span className="text-sm font-medium">Total Pasangan</span>
              <FileText className="h-5 w-5" />
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-white">{results.length}</div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">Data yang berhasil dibaca</p>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 shadow-sm backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between text-red-700 dark:text-red-100">
              <span className="text-sm font-medium">Plagiarisme Kuat</span>
              <AlertTriangle className="h-5 w-5 text-red-300" />
            </div>
            <div className="text-3xl font-bold text-red-700 dark:text-red-100">{totalKuat}</div>
            <p className="mt-1 text-xs text-red-700/70 dark:text-red-100/70">SCB ≥ 0,80 dan SW ≥ 0,75</p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 shadow-sm backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between text-amber-700 dark:text-amber-100">
              <span className="text-sm font-medium">Mirip Tekstual</span>
              <AlertTriangle className="h-5 w-5 text-amber-300" />
            </div>
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-100">{totalTekstual}</div>
            <p className="mt-1 text-xs text-amber-700/70 dark:text-amber-100/70">Kemiripan berbasis pola teks/kode</p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 shadow-sm backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between text-amber-700 dark:text-amber-100">
              <span className="text-sm font-medium">Mirip Semantik</span>
              <AlertTriangle className="h-5 w-5 text-amber-300" />
            </div>
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-100">{totalSemantik}</div>
            <p className="mt-1 text-xs text-amber-700/70 dark:text-amber-100/70">Kemiripan makna/konteks kode</p>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 shadow-sm backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between text-emerald-700 dark:text-emerald-100">
              <span className="text-sm font-medium">Normal</span>
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-100">{totalNormal}</div>
            <p className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-100/70">Tidak melewati ambang deteksi</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 rounded-3xl border border-zinc-200 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/70 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-slate-300">Cari data</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-slate-400" />
              <input
                type="text"
                placeholder="Nama mahasiswa, project, atau kategori..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white/90 py-3 pl-10 pr-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20 dark:border-zinc-700 dark:bg-zinc-950/70 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-slate-300">Filter status</label>
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white/90 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20 dark:border-zinc-700 dark:bg-zinc-950/70 dark:text-white"
            >
              <option value="all">Semua status</option>
              <option value="kuat">Plagiarisme Kuat</option>
              <option value="tekstual">Mirip Tekstual</option>
              <option value="semantik">Mirip Semantik</option>
              <option value="normal">Normal</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-slate-300">Urutkan berdasarkan</label>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "sg" | "scb" | "sw")}
              className="w-full rounded-xl border border-zinc-200 bg-white/90 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20 dark:border-zinc-700 dark:bg-zinc-950/70 dark:text-white"
            >
              <option value="sg">SG (Gabungan)</option>
              <option value="scb">SCB (CodeBERT)</option>
              <option value="sw">SW (Winnowing)</option>
            </select>
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-zinc-200 bg-white/80 px-6 py-20 text-center shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/70">
            <RefreshCw className="mx-auto mb-4 h-12 w-12 animate-spin text-cyan-500 dark:text-cyan-300" />
            <p className="text-sm text-zinc-600 dark:text-slate-300">Memuat hasil perbandingan mahasiswa...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/80 px-6 py-20 text-center shadow-sm backdrop-blur-xl dark:border-zinc-700 dark:bg-zinc-900/70">
            <Search className="mx-auto mb-4 h-14 w-14 text-zinc-400 dark:text-slate-500" />
            <p className="text-sm text-zinc-600 dark:text-slate-300">
              {results.length === 0 ? "Belum ada hasil perbandingan. Jalankan analisis dulu." : "Tidak ada data yang cocok dengan filter Anda."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((pair, index) => {
              const expandedKey = `${pair.student_a}-${pair.student_b}-${index}`;
              const isOpen = expanded === expandedKey;
              const category = classifyCategory(pair.category, pair.scores);
              const CategoryIcon = category.icon;

              return (
                <article
                  key={expandedKey}
                  className="overflow-hidden rounded-3xl border border-zinc-200 bg-white/80 shadow-sm backdrop-blur-xl transition hover:border-cyan-300 dark:border-zinc-800 dark:bg-zinc-900/70"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : expandedKey)}
                    className="flex w-full items-start justify-between gap-4 p-6 text-left"
                  >
                    <div className="space-y-4">
                      <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${category.className}`}>
                        <CategoryIcon className="h-4 w-4" />
                        {category.label}
                      </div>

                      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-200">
                          <FileText className="h-4 w-4" />
                          Mirip dengan
                        </div>
                        <div className="text-base font-semibold text-zinc-900 dark:text-white">
                          {pair.student_a} ↔ {pair.student_b}
                        </div>
                        <div className="mt-1 text-sm text-zinc-600 dark:text-slate-300">
                          {pair.project_a} ↔ {pair.project_b}
                        </div>
                      </div>
                    </div>

                    <ChevronDown className={`mt-2 h-5 w-5 flex-none text-zinc-500 transition-transform dark:text-slate-300 ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  <div className="border-t border-zinc-200 px-6 pb-6 pt-2 dark:border-zinc-800">
                    <ScoreInline label="Gabungan" score={pair.scores.sg} />
                  </div>

                  {isOpen && (
                    <div className="border-t border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/40">
                      <div className="mb-4 grid gap-4 md:grid-cols-3">
                        <ScoreInline label="CodeBERT" score={pair.scores.scb} />
                        <ScoreInline label="Winnowing" score={pair.scores.sw} />
                        <ScoreInline label="Gabungan" score={pair.scores.sg} />
                      </div>

                      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white/85 p-4 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-slate-300">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-zinc-900 dark:text-white">Pasangan terdeteksi:</span>
                          <span>{pair.student_a}</span>
                          <span>vs</span>
                          <span>{pair.student_b}</span>
                        </div>
                        <div className="mt-2 text-xs text-zinc-500 dark:text-slate-400">
                          Skor gabungan: {asPercent(pair.scores.sg).toFixed(1)}%
                        </div>
                      </div>

                      {pair.snippets?.length ? (
                        <div className="space-y-4">
                          {pair.snippets.map((snippet, snippetIndex) => (
                            <div key={`${expandedKey}-${snippetIndex}`} className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-600 dark:text-slate-400">
                                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-700 dark:text-cyan-100">
                                  {getDetectedSummary(snippet, pair.category)}
                                </span>
                                <span>{formatCodeLabel(snippet.student_a, snippet.project_a)}</span>
                                <span>vs</span>
                                <span>{formatCodeLabel(snippet.student_b, snippet.project_b)}</span>
                              </div>
                              <CodeSnippet snippet={snippet} category={pair.category} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-slate-400">
                          Snippet belum tersedia.
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
