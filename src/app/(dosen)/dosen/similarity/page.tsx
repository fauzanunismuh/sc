"use client";

import { AlertCircle, CheckCircle2, TrendingUp, Zap, AlertTriangle, FileCode2, Search, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface SimilarityResult {
  id: string;
  mahasiswaA: { nim: string; nama: string; judul: string };
  mahasiswaB: { nim: string; nama: string; judul: string };
  codebertScore: number;
  winnowingScore: number;
  hybridScore: number;
  status: string;
  checkedAt: string | null;
  snippetA?: Record<string, string>;
  snippetB?: Record<string, string>;
  projectA?: { title: string; mahasiswa: { name: string; nim: string } | null };
  projectB?: { title: string; mahasiswa: { name: string; nim: string } | null };
}

// Komponen Score Badge dengan animasi
const ScoreBadge = ({ score, label, color }: { score: number; label: string; color: string }) => {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative w-20 h-20 rounded-full flex items-center justify-center ${color} shadow-lg transform hover:scale-110 transition duration-1000`}>
        <svg className="absolute inset-0" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.2"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${score * 2.83} 282.7`}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <span className="text-center">
          <div className="text-xl font-bold">{score.toFixed(0)}%</div>
        </span>
      </div>
      <span className="text-xs text-gray-400">Score</span>
      <span className="text-sm font-semibold text-white">{label}</span>
    </div>
  );
};

export default function SimilarityPage() {
  const [results, setResults] = useState<SimilarityResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("hybrid");
  const [error, setError] = useState<string | null>(null);

  const ALPHA = 0.6; // Sesuai proposal: α = 0,6

  interface SimilarityResponse {
    id: string;
    projectA?: { mahasiswa?: { nim: string; name: string }; title: string };
    projectB?: { mahasiswa?: { nim: string; name: string }; title: string };
    codebertScore?: number;
    codebert_score?: number;
    winnowingScore?: number;
    winnowing_score?: number;
    hybridScore?: number;
    hybrid_score?: number;
    status?: string;
    snippetA?: Record<string, string>;
    snippetB?: Record<string, string>;
    checkedAt?: string;
  }

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/similarity/batch");
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setResults([]);
      } else {
        const mapped = (data.results || []).map((r: SimilarityResponse) => ({
          id: r.id,
          mahasiswaA: {
            nim: r.projectA?.mahasiswa?.nim || "-",
            nama: r.projectA?.mahasiswa?.name || r.projectA?.title || "-",
            judul: r.projectA?.title || "-",
          },
          mahasiswaB: {
            nim: r.projectB?.mahasiswa?.nim || "-",
            nama: r.projectB?.mahasiswa?.name || r.projectB?.title || "-",
            judul: r.projectB?.title || "-",
          },
          codebertScore: (r.codebertScore ?? r.codebert_score ?? 0) * 100,
          winnowingScore: (r.winnowingScore ?? r.winnowing_score ?? 0) * 100,
          hybridScore: (r.hybridScore ?? r.hybrid_score ?? 0) * 100,
          status: "",
          checkedAt: r.checkedAt || null,
          snippetA: r.snippetA,
          snippetB: r.snippetB,
        }));
        setResults(mapped);
      }
    } catch (e) {
      setError("Gagal mengambil data. Pastikan server berjalan.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Auto-run batch analysis on page load
    runBatchAnalysis();
  }, []);

  const runBatchAnalysis = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/similarity/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        await fetchResults();
      }
    } catch (e) {
      setError("Gagal menjalankan analisis batch.");
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  // Klasifikasi sesuai Tabel 3 Proposal
  const getClassification = (scb: number, sw: number) => {
    if (scb >= 80 && sw >= 75) {
      return {
        label: "Plagiarisme Kuat",
        color: "bg-red-50 border-red-200 text-red-700",
        icon: AlertCircle,
        iconColor: "text-red-500"
      };
    }
    if (sw >= 75) {
      return {
        label: "Mirip Tekstual",
        color: "bg-orange-50 border-orange-200 text-orange-700",
        icon: AlertTriangle,
        iconColor: "text-orange-500"
      };
    }
    if (scb >= 80) {
      return {
        label: "Mirip Semantik",
        color: "bg-yellow-50 border-yellow-200 text-yellow-700",
        icon: Zap,
        iconColor: "text-yellow-500"
      };
    }
    return {
      label: "Normal / Aman",
      color: "bg-green-50 border-green-200 text-green-700",
      icon: CheckCircle2,
      iconColor: "text-green-500"
    };
  };

  const filtered = results
    .filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        r.mahasiswaA.nama.toLowerCase().includes(q) ||
        r.mahasiswaB.nama.toLowerCase().includes(q) ||
        r.mahasiswaA.nim.includes(q) ||
        r.mahasiswaB.nim.includes(q) ||
        r.mahasiswaA.judul.toLowerCase().includes(q) ||
        r.mahasiswaB.judul.toLowerCase().includes(q);

      let matchStatus = true;
      if (filterStatus === "plagiat") {
        matchStatus = r.codebertScore >= 80 && r.winnowingScore >= 75;
      } else if (filterStatus === "review") {
        matchStatus =
          (r.winnowingScore >= 75 || r.codebertScore >= 80) &&
          !(r.codebertScore >= 80 && r.winnowingScore >= 75);
      } else if (filterStatus === "aman") {
        matchStatus = r.codebertScore < 80 && r.winnowingScore < 75;
      }

      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === "hybrid") return b.hybridScore - a.hybridScore;
      if (sortBy === "codebert") return b.codebertScore - a.codebertScore;
      if (sortBy === "winnowing") return b.winnowingScore - a.winnowingScore;
      return 0;
    });

  const totalPlagiat = results.filter((r) => r.codebertScore >= 80 && r.winnowingScore >= 75).length;
  const totalReview = results.filter(
    (r) =>
      (r.winnowingScore >= 75 || r.codebertScore >= 80) &&
      !(r.codebertScore >= 80 && r.winnowingScore >= 75)
  ).length;
  const totalAman = results.filter((r) => r.codebertScore < 80 && r.winnowingScore < 75).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white p-8">
      {/* Hero Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Analisis Kemiripan Kode
            </h1>
            <p className="text-gray-400">Deteksi plagiarisme menggunakan AI hybrid</p>
            <div className="mt-3 text-sm font-mono bg-black/30 px-4 py-2 rounded-lg inline-block border border-white/10">
              Formula: <span className="text-blue-400">S<sub>H</sub> = {ALPHA}·S<sub>CB</sub> + {(1-ALPHA).toFixed(1)}·S<sub>W</sub></span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchResults}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={runBatchAnalysis}
              disabled={running}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-lg font-semibold transition disabled:opacity-50"
            >
              {running ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Memproses...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" /> Jalankan Analisis
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="max-w-7xl mx-auto mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-200">{error}</span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Total Pasangan */}
        <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <FileCode2 className="w-8 h-8 text-blue-400" />
          </div>
          <div className="text-3xl font-bold mb-1">{results.length}</div>
          <div className="text-sm text-gray-400">Total Pasangan</div>
          <div className="text-xs text-gray-500 mt-1">Kombinasi dianalisis</div>
        </div>

        {/* Plagiarisme */}
        <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <div className="text-3xl font-bold mb-1">{totalPlagiat}</div>
          <div className="text-sm text-gray-400">Plagiarisme</div>
          <div className="text-xs text-gray-500 mt-1">Kasus kritis</div>
        </div>

        {/* Perlu Review */}
        <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <Search className="w-8 h-8 text-yellow-400" />
          </div>
          <div className="text-3xl font-bold mb-1">{totalReview}</div>
          <div className="text-sm text-gray-400">Perlu Ditinjau</div>
          <div className="text-xs text-gray-500 mt-1">Mirip sebagian</div>
        </div>

        {/* Aman */}
        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <div className="text-3xl font-bold mb-1">{totalAman}</div>
          <div className="text-sm text-gray-400">Aman</div>
          <div className="text-xs text-gray-500 mt-1">Original</div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-300">Cari Data</label>
          <input
            type="text"
            placeholder="Nama, NIM, atau judul..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full mt-2 px-4 py-2.5 rounded-lg bg-black/30 border border-white/20 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-300">Filter Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full mt-2 px-4 py-2.5 rounded-lg bg-black/30 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
          >
            <option value="all">Semua Status</option>
            <option value="plagiat">🔴 Plagiarisme Kuat</option>
            <option value="review">🟡 Perlu Ditinjau</option>
            <option value="aman">🟢 Aman</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-300">Urutkan Berdasarkan</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full mt-2 px-4 py-2.5 rounded-lg bg-black/30 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
          >
            <option value="hybrid">S<sub>H</sub> (Hybrid)</option>
            <option value="codebert">S<sub>CB</sub> (CodeBERT)</option>
            <option value="winnowing">S<sub>W</sub> (Winnowing)</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="max-w-7xl mx-auto text-center py-20">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-400" />
          <p className="text-gray-400">Memuat data analisis...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="max-w-7xl mx-auto text-center py-20">
          <Search className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">
            {results.length === 0
              ? "Belum ada data. Jalankan analisis batch terlebih dahulu."
              : "Tidak ada hasil yang cocok dengan filter Anda."}
          </p>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto space-y-4">
          {filtered.map((r) => {
            const isOpen = expanded === r.id;
            const classification = getClassification(r.codebertScore, r.winnowingScore);
            const StatusIcon = classification.icon;
            const snippetA = r.snippetA;
            const snippetB = r.snippetB;

            return (
              <div
                key={r.id}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition"
              >
                {/* Card Header - Clickable */}
                <div
                  className="p-6 cursor-pointer hover:bg-white/5 transition"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                >
                  {/* Status Badge & Pair Info */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${classification.color} text-sm font-semibold`}>
                      <StatusIcon className={`w-4 h-4 ${classification.iconColor}`} />
                      {classification.label}
                    </div>

                    {/* Toggle Icon */}
                    <div className="text-gray-400">
                      <TrendingUp className={`w-5 h-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Project Pair */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    {/* Project A */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileCode2 className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-gray-400 font-semibold">Project A</span>
                      </div>
                      <div className="text-base font-semibold text-white">{r.mahasiswaA.nama}</div>
                      <div className="text-sm text-gray-400">{r.mahasiswaA.nim}</div>
                      <div className="text-sm text-gray-500 italic">{r.mahasiswaA.judul}</div>
                    </div>

                    {/* Project B */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileCode2 className="w-4 h-4 text-purple-400" />
                        <span className="text-xs text-gray-400 font-semibold">Project B</span>
                      </div>
                      <div className="text-base font-semibold text-white">{r.mahasiswaB.nama}</div>
                      <div className="text-sm text-gray-400">{r.mahasiswaB.nim}</div>
                      <div className="text-sm text-gray-500 italic">{r.mahasiswaB.judul}</div>
                    </div>
                  </div>

                  {/* Score Visualization */}
                  <div className="flex items-center justify-around pt-4 border-t border-white/10">
                    <ScoreBadge score={r.codebertScore} label="CodeBERT" color="text-blue-400" />
                    <ScoreBadge score={r.winnowingScore} label="Winnowing" color="text-purple-400" />
                    <ScoreBadge score={r.hybridScore} label="Hybrid" color="text-pink-400" />
                  </div>
                </div>

                {/* Expanded Details */}
                {isOpen && (
                  <div className="border-t border-white/10 p-6 bg-black/20">
                    {/* Detailed Score Table */}
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-400" />
                      Detail Analisis
                    </h3>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {/* CodeBERT */}
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <div className="text-xs text-blue-400 font-semibold mb-1">S<sub>CB</sub> (CodeBERT)</div>
                        <div className="text-2xl font-bold text-white mb-1">{r.codebertScore.toFixed(2)}%</div>
                        <div className="text-xs text-gray-400">Kemiripan semantik</div>
                      </div>

                      {/* Winnowing */}
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                        <div className="text-xs text-purple-400 font-semibold mb-1">S<sub>W</sub> (Winnowing)</div>
                        <div className="text-2xl font-bold text-white mb-1">{r.winnowingScore.toFixed(2)}%</div>
                        <div className="text-xs text-gray-400">Kemiripan tekstual</div>
                      </div>

                      {/* Hybrid */}
                      <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-4">
                        <div className="text-xs text-pink-400 font-semibold mb-1">S<sub>H</sub> (Hybrid)</div>
                        <div className="text-2xl font-bold text-white mb-1">{r.hybridScore.toFixed(2)}%</div>
                        <div className="text-xs text-gray-400">Skor gabungan final</div>
                      </div>
                    </div>

                    {/* Code Snippets - Side by Side */}
                    {snippetA || snippetB ? (
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <FileCode2 className="w-5 h-5 text-green-400" />
                          Potongan Kode Mirip
                        </h3>
                        <div className="space-y-4">
                          {snippetA && Object.keys(snippetA).slice(0, 2).map((fileA, idx) => {
                            const fileB = snippetB ? Object.keys(snippetB)[idx] : null;
                            return (
                              <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Snippet A */}
                                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg overflow-hidden">
                                  <div className="bg-blue-500/10 px-4 py-2 border-b border-blue-500/20 flex items-center gap-2">
                                    <FileCode2 className="w-4 h-4 text-blue-400" />
                                    <span className="text-xs text-blue-400 font-mono font-semibold">[A] {fileA}</span>
                                  </div>
                                  <pre className="p-4 text-xs text-gray-300 font-mono overflow-x-auto">
                                    {snippetA[fileA]?.substring(0, 400)}...
                                  </pre>
                                </div>

                                {/* Snippet B */}
                                {fileB && snippetB && (
                                  <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg overflow-hidden">
                                    <div className="bg-purple-500/10 px-4 py-2 border-b border-purple-500/20 flex items-center gap-2">
                                      <FileCode2 className="w-4 h-4 text-purple-400" />
                                      <span className="text-xs text-purple-400 font-mono font-semibold">[B] {fileB}</span>
                                    </div>
                                    <pre className="p-4 text-xs text-gray-300 font-mono overflow-x-auto">
                                      {snippetB[fileB]?.substring(0, 400)}...
                                    </pre>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 rounded-lg border border-dashed border-white/20 text-center">
                        <p className="text-sm text-gray-400">Snippet belum tersedia</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
