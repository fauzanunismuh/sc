"use client";

import { Check, ChevronLeft, Copy, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const SEMANTIC_THRESHOLD = 0.99;
const TEXTUAL_THRESHOLD = 0.13;
const COMBINED_THRESHOLD = 0.55;

const TOKEN_REGEX = /[A-Za-z_][A-Za-z0-9_]{3,}/g;
const STOPWORDS = new Set([
  "this",
  "that",
  "true",
  "false",
  "null",
  "undefined",
  "const",
  "let",
  "var",
  "return",
  "import",
  "from",
  "export",
  "class",
  "function",
  "public",
  "private",
  "static",
  "async",
  "await",
]);

function collectMeaningfulTokens(code: string): Set<string> {
  const matches = code.match(TOKEN_REGEX) ?? [];
  const result = new Set<string>();

  for (const token of matches) {
    const normalized = token.toLowerCase();
    if (!STOPWORDS.has(normalized)) {
      result.add(token);
    }
  }

  return result;
}

function getHighlightTokens(codeA: string, codeB: string): string[] {
  const tokensA = collectMeaningfulTokens(codeA);
  const tokensB = collectMeaningfulTokens(codeB);
  const shared: string[] = [];

  for (const token of tokensA) {
    if (tokensB.has(token)) {
      shared.push(token);
    }
  }

  return shared
    .sort((a, b) => b.length - a.length)
    .slice(0, 40);
}

function buildSnippetKey(snippet: SnippetData, index: number): string {
  const a = (snippet.code_a ?? "").slice(0, 80);
  const b = (snippet.code_b ?? "").slice(0, 80);
  return `${index}-${a}-${b}`;
}

function renderHighlightedCode(code: string, highlightTokens: string[], semanticTint = false) {
  if (!highlightTokens.length && !semanticTint) {
    return <code>{code}</code>;
  }

  const escapedTokens = highlightTokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const tokenRegex = escapedTokens.length > 0 ? new RegExp(`(${escapedTokens.join("|")})`, "g") : null;
  const tokenSet = new Set(highlightTokens);
  const lines = code.split("\n");

  return (
    <code>
      {lines.map((line, lineIndex) => {
        const parts = tokenRegex ? line.split(tokenRegex) : [line];

        return (
          <span
            key={`line-${lineIndex}`}
            className={semanticTint && line.trim().length > 0 ? "block rounded-sm bg-fuchsia-300/20 dark:bg-fuchsia-500/10" : "block"}
          >
            {parts.map((part, idx) => {
              if (tokenSet.has(part)) {
                return (
                  <mark
                    key={`${lineIndex}-${part}-${idx}`}
                    className="rounded bg-yellow-300/80 px-0.5 text-zinc-950 dark:bg-yellow-400/70 dark:text-zinc-950"
                  >
                    {part}
                  </mark>
                );
              }

              return <span key={`${lineIndex}-${idx}-${part.length}`}>{part}</span>;
            })}
          </span>
        );
      })}
    </code>
  );
}

interface SnippetData {
  student_a: string;
  student_b: string;
  project_a: string;
  project_b: string;
  code_a: string;
  code_b: string;
  similarity: number;
  snippet_similarity?: number;
  source_path?: string;
  target_path?: string;
  matched_by: string[];
  detected_as: string[];
  method_scores: {
    codebert: number;
    winnowing: number;
    gabungan: number;
  };
  note: string;
}

interface PairDetail {
  success: boolean;
  pair: {
    projectA: {
      id: string;
      title: string;
      student_name: string | null;
      student_nim: string | null;
    };
    projectB: {
      id: string;
      title: string;
      student_name: string | null;
      student_nim: string | null;
    };
  };
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
  snippets: SnippetData[];
  snippet_count: number;
  checked_at: string;
}

export default function SimilarityPairDetailPage({
  params,
}: {
  params: Promise<{ projectAId: string; projectBId: string }>;
}) {
  const router = useRouter();
  const [projectIds, setProjectIds] = useState<{ projectAId: string; projectBId: string } | null>(null);
  const [data, setData] = useState<PairDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    params.then((ids) => {
      setProjectIds(ids);
    });
  }, [params]);

  useEffect(() => {
    if (projectIds) {
      fetchData();
    }
  }, [projectIds]);

  const fetchData = async () => {
    if (!projectIds) return;
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/similarity/pair/${projectIds.projectAId}/${projectIds.projectBId}`
      );
      if (!response.ok) {
        throw new Error("Gagal mengambil data pair");
      }

      const result: PairDetail = await response.json();
      setData(result);
      setVisibleCount(50);
      setShowAll(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (code: string, key: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(key);
    setTimeout(() => setCopiedCode(null), 2000);
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

  const getSnippetIndicator = (
    snippet: SnippetData,
    pairCategory: string
  ): { label: string; className: string } => {
    const matched = (snippet.matched_by ?? []).map((item) => item.toLowerCase());
    const detected = (snippet.detected_as ?? []).map((item) => item.toLowerCase());
    const note = (snippet.note ?? "").toLowerCase();
    const score = snippet.snippet_similarity ?? snippet.similarity ?? 0;
    const semantic = snippet.method_scores?.codebert ?? 0;
    const textual = snippet.method_scores?.winnowing ?? 0;
    const combined = snippet.method_scores?.gabungan ?? 0;
    const hasSemantic =
      semantic >= SEMANTIC_THRESHOLD ||
      matched.includes("codebert") ||
      detected.some((d) => d.includes("semantik"));
    const hasTextual =
      textual >= TEXTUAL_THRESHOLD ||
      matched.includes("winnowing") ||
      detected.some((d) => d.includes("tekstual"));
    const isStrongPlagiarism =
      pairCategory === "Plagiarisme Kuat" ||
      (semantic >= SEMANTIC_THRESHOLD && textual >= TEXTUAL_THRESHOLD) ||
      note.includes("plagiarisme");

    if (isStrongPlagiarism) {
      return {
        label: "Plagiarisme Kuat",
        className: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-100",
      };
    }

    if (hasSemantic) {
      return {
        label: "Terdeteksi Semantik",
        className: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-700 dark:text-fuchsia-100",
      };
    }

    if (hasTextual || combined >= COMBINED_THRESHOLD || detected.some((d) => d.includes("gabungan"))) {
      return {
        label: "Terdeteksi Tekstual",
        className: "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-100",
      };
    }

    if (score < 0.13) {
      return {
        label: "Terdeteksi Normal",
        className: "border-zinc-400/30 bg-zinc-400/10 text-zinc-700 dark:text-zinc-100",
      };
    }

    return {
      label: "Terdeteksi Normal",
      className: "border-zinc-400/30 bg-zinc-400/10 text-zinc-700 dark:text-zinc-100",
    };
  };

  const visibleSnippets = useMemo(() => {
    if (!data) {
      return [] as Array<{ snippet: SnippetData; index: number }>;
    }

    if (showAll) {
      return data.snippets.map((snippet, index) => ({ snippet, index }));
    }

    return data.snippets.slice(0, visibleCount).map((snippet, index) => ({ snippet, index }));
  }, [data, showAll, visibleCount]);

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

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400">Data tidak ditemukan</p>
          <button
            onClick={() => router.back()}
            className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 mt-4 font-medium transition-colors"
          >
            Kembali
          </button>
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

      {/* Project Comparison Header */}
      <div className="rounded-3xl border border-zinc-200 bg-white/85 p-6 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Project A */}
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 md:border-r md:pr-6">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{data.pair.projectA.title}</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">{data.pair.projectA.student_name || "-"}</p>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">NIM: {data.pair.projectA.student_nim || "-"}</p>
          </div>

          {/* Project B */}
          <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{data.pair.projectB.title}</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">{data.pair.projectB.student_name || "-"}</p>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">NIM: {data.pair.projectB.student_nim || "-"}</p>
          </div>
        </div>

        {/* Scores and Category */}
        <div className="border-t border-zinc-200 pt-6 grid grid-cols-1 md:grid-cols-4 gap-4 dark:border-zinc-800">
          <div>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm uppercase tracking-wider font-medium">CodeBERT Score</p>
            <p className="text-2xl font-bold mt-1 text-cyan-600 dark:text-cyan-300">{data.scores_percentage.codebert.toFixed(1)}%</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.scores.codebert.toFixed(3)}</p>
          </div>
          <div>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm uppercase tracking-wider font-medium">Winnowing Score</p>
            <p className="text-2xl font-bold mt-1 text-cyan-600 dark:text-cyan-300">{data.scores_percentage.winnowing.toFixed(1)}%</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.scores.winnowing.toFixed(3)}</p>
          </div>
          <div>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm uppercase tracking-wider font-medium">Skor Gabungan</p>
            <p className="text-2xl font-bold mt-1 text-cyan-600 dark:text-cyan-300">{(data.scores_percentage.gabungan ?? data.scores_percentage.hybrid).toFixed(1)}%</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{(data.scores.gabungan ?? data.scores.hybrid).toFixed(3)}</p>
          </div>
          <div>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm uppercase tracking-wider font-medium">Kategori</p>
            <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium border ${getCategoryBadgeColor(data.category)}`}>
              {data.category}
            </span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 backdrop-blur">
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Snippet List */}
      {data.snippet_count > 0 && (
        <div className="rounded-3xl border border-zinc-200 bg-white/85 p-6 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/70">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-6">
            Potongan kode yang mirip <span className="text-cyan-600 dark:text-cyan-300">({data.snippet_count} snippet)</span>
          </h3>

          {!showAll && data.snippet_count > visibleCount && (
            <div className="mb-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs text-cyan-800 dark:text-cyan-100">
              Menampilkan {visibleCount} dari {data.snippet_count} snippet. Gunakan Read More untuk memuat bertahap.
            </div>
          )}

          <div className="space-y-6">
            {visibleSnippets.map(({ snippet, index }) => {
              const highlightTokens = getHighlightTokens(snippet.code_a, snippet.code_b);
              const snippetKey = buildSnippetKey(snippet, index);
              const detectionIndicator = getSnippetIndicator(snippet, data.category);
              const semanticTint =
                ["Terdeteksi Semantik", "Plagiarisme Kuat"].includes(detectionIndicator.label);

              return (
              <div key={snippetKey} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/30">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">Potongan kode yang mirip #{index + 1}</p>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${detectionIndicator.className}`}>
                      {detectionIndicator.label}
                    </span>
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-100">
                      Similarity {Math.round((snippet.snippet_similarity ?? snippet.similarity ?? 0) * 100)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                  <div className="overflow-hidden rounded-xl border border-cyan-500/20 bg-cyan-500/5">
                    <div className="bg-cyan-500/10 px-4 py-3 border-b border-cyan-500/20 flex justify-between items-center">
                      <p className="font-semibold text-cyan-900 dark:text-cyan-100 text-xs">[{snippet.student_a || data.pair.projectA.student_name || "Project A"} - {snippet.project_a || data.pair.projectA.title}]</p>
                      <button
                        onClick={() => copyToClipboard(snippet.code_a, `${index}-a`)}
                        className="p-1 hover:bg-cyan-500/20 rounded transition-colors"
                        title="Copy"
                      >
                        {copiedCode === `${index}-a` ? (
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                        )}
                      </button>
                    </div>
                    <pre className="bg-white/60 dark:bg-zinc-950/80 text-zinc-900 dark:text-zinc-50 p-4 overflow-x-auto text-xs font-mono max-h-96">
                      {renderHighlightedCode(snippet.code_a, highlightTokens, semanticTint)}
                    </pre>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5">
                    <div className="bg-fuchsia-500/10 px-4 py-3 border-b border-fuchsia-500/20 flex justify-between items-center">
                      <p className="font-semibold text-fuchsia-900 dark:text-fuchsia-100 text-xs">[{snippet.student_b || data.pair.projectB.student_name || "Project B"} - {snippet.project_b || data.pair.projectB.title}]</p>
                      <button
                        onClick={() => copyToClipboard(snippet.code_b, `${index}-b`)}
                        className="p-1 hover:bg-fuchsia-500/20 rounded transition-colors"
                        title="Copy"
                      >
                        {copiedCode === `${index}-b` ? (
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                        )}
                      </button>
                    </div>
                    <pre className="bg-white/60 dark:bg-zinc-950/80 text-zinc-900 dark:text-zinc-50 p-4 overflow-x-auto text-xs font-mono max-h-96">
                      {renderHighlightedCode(snippet.code_b, highlightTokens, semanticTint)}
                    </pre>
                  </div>
                </div>

                <div className="px-4 pb-3 -mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Bagian yang sama ditandai kuning di bawah.
                </div>

                <div className="border-t border-zinc-200 rounded-b-2xl bg-cyan-400/10 p-2 dark:border-zinc-800" />
              </div>
            );})}
          </div>

          {data.snippet_count > visibleSnippets.length && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setVisibleCount((prev) => Math.min(prev + 50, data.snippet_count))}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Read More (50)
              </button>
              <button
                onClick={() => setShowAll(true)}
                className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-400/20 dark:text-cyan-100"
              >
                Tampilkan Semua
              </button>
            </div>
          )}
        </div>
      )}

      {/* No Snippets */}
      {data.snippet_count === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">Tidak ada snippet terdeteksi untuk pasangan ini</p>
        </div>
      )}
    </div>
  );
}
