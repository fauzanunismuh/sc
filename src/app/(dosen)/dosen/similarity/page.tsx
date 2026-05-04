"use client";

import { AlertCircle, CheckCircle2, TrendingUp, Zap } from "lucide-react";
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
      <div className={`relative w-20 h-20 rounded-full flex items-center justify-center ${color} shadow-lg transform transition hover:scale-110`}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.2" />
          <circle 
            cx="50" cy="50" r="45" 
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
          <div className="text-xs opacity-70">Score</div>
        </span>
      </div>
      <p className="text-xs font-semibold text-gray-600">{label}</p>
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
      return { label: "Plagiarisme Kuat", color: "bg-red-50 border-red-200 text-red-700" };
    }
    if (sw >= 75) {
      return { label: "Mirip Tekstual", color: "bg-orange-50 border-orange-200 text-orange-700" };
    }
    if (scb >= 80) {
      return { label: "Mirip Semantik", color: "bg-yellow-50 border-yellow-200 text-yellow-700" };
    }
    return { label: "Normal / Aman", color: "bg-green-50 border-green-200 text-green-700" };
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
        matchStatus = (r.winnowingScore >= 75 || r.codebertScore >= 80) && !(r.codebertScore >= 80 && r.winnowingScore >= 75);
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
    (r) => (r.winnowingScore >= 75 || r.codebertScore >= 80) && !(r.codebertScore >= 80 && r.winnowingScore >= 75)
  ).length;
  const totalAman = results.filter((r) => r.codebertScore < 80 && r.winnowingScore < 75).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-3xl blur-3xl" />
          <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-100">
                      Analisis Kemiripan Kode
                    </h1>
                    <p className="text-sm text-gray-300 mt-1">Deteksi plagiarisme menggunakan AI hybrid</p>
                  </div>
                </div>
                <div className="text-xs text-gray-400 font-mono bg-black/30 px-4 py-2 rounded-lg w-fit">
                  <span className="text-blue-300">Formula:</span> <span className="text-white">S<sub>H</sub> = {ALPHA}·S<sub>CB</sub> + {(1-ALPHA).toFixed(1)}·S<sub>W</sub></span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                <button
                  onClick={fetchResults}
                  className="px-4 py-2.5 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all duration-300 font-medium backdrop-blur"
                >
                  🔄 Refresh
                </button>
                <button
                  onClick={runBatchAnalysis}
                  disabled={running}
                  className="px-6 py-2.5 text-sm rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl"
                >
                  {running ? "⏳ Memproses..." : "▶ Jalankan Analisis"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500/50 backdrop-blur-xl rounded-2xl px-6 py-4 text-red-200 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Pasangan */}
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-lg hover:border-white/40 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Pasangan</p>
                <p className="text-4xl font-bold text-white mt-2">{results.length}</p>
                <p className="text-xs text-gray-400 mt-2">Kombinasi dianalisis</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <TrendingUp className="w-8 h-8 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Plagiarisme */}
          <div className="bg-gradient-to-br from-red-500/10 to-red-600/10 backdrop-blur-xl rounded-2xl p-6 border border-red-500/30 shadow-lg hover:border-red-500/60 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-300 uppercase tracking-wider font-semibold">⚠️ Plagiarisme</p>
                <p className="text-4xl font-bold text-red-400 mt-2">{totalPlagiat}</p>
                <p className="text-xs text-red-300 mt-2">Kasus kritis</p>
              </div>
              <div className="p-3 bg-red-500/20 rounded-xl">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
            </div>
          </div>

          {/* Perlu Review */}
          <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 backdrop-blur-xl rounded-2xl p-6 border border-amber-500/30 shadow-lg hover:border-amber-500/60 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-300 uppercase tracking-wider font-semibold">🔍 Perlu Ditinjau</p>
                <p className="text-4xl font-bold text-amber-400 mt-2">{totalReview}</p>
                <p className="text-xs text-amber-300 mt-2">Mirip sebagian</p>
              </div>
              <div className="p-3 bg-amber-500/20 rounded-xl">
                <Zap className="w-8 h-8 text-amber-400" />
              </div>
            </div>
          </div>

          {/* Aman */}
          <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 backdrop-blur-xl rounded-2xl p-6 border border-green-500/30 shadow-lg hover:border-green-500/60 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-300 uppercase tracking-wider font-semibold">✓ Aman</p>
                <p className="text-4xl font-bold text-green-400 mt-2">{totalAman}</p>
                <p className="text-xs text-green-300 mt-2">Original</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-5 border border-white/20 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-300 font-semibold uppercase tracking-wider">Cari Data</label>
              <input
                type="text"
                placeholder="Nama, NIM, atau judul..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full mt-2 px-4 py-2.5 rounded-lg bg-black/30 border border-white/20 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
              />
            </div>
            <div>
              <label className="text-xs text-gray-300 font-semibold uppercase tracking-wider">Filter Status</label>
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
              <label className="text-xs text-gray-300 font-semibold uppercase tracking-wider">Urutkan Berdasarkan</label>
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
        </div>


        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full animate-spin mx-auto" />
              <p className="text-gray-300">Memuat data analisis...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center space-y-3">
              <div className="text-6xl">🔍</div>
              <p className="text-gray-300 text-lg">{results.length === 0
                ? "Belum ada data. Jalankan analisis batch terlebih dahulu."
                : "Tidak ada hasil yang cocok dengan filter Anda."}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((r) => {
              const isOpen = expanded === r.id;
              const classification = getClassification(r.codebertScore, r.winnowingScore);
              const snippetA = r.snippetA;
              const snippetB = r.snippetB;

              return (
                <div
                  key={r.id}
                  className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl border border-white/20 hover:border-white/40 shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl"
                >
                  {/* Card Header - Clickable */}
                  <div
                    className="p-6 cursor-pointer hover:bg-white/5 transition"
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                  >
                    <div className="space-y-4">
                      {/* Status Badge & Pair Info */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div>
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur"
                              style={{
                                backgroundColor: classification.color.split(" ")[1] + "/" + "20",
                                borderColor: classification.color.split(" ")[2] + "/" + "50",
                                color: classification.color.split(" ")[3]
                              }}>
                              {classification.label === "Plagiarisme Kuat" && "🚨"}
                              {classification.label === "Mirip Tekstual" && "⚠️"}
                              {classification.label === "Mirip Semantik" && "🔶"}
                              {classification.label === "Normal / Aman" && "✅"}
                              {classification.label}
                            </span>
                          </div>

                          {/* Project Pair */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Project A */}
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">📁 Project A</p>
                              <p className="text-sm font-bold text-white">{r.mahasiswaA.nama}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{r.mahasiswaA.nim}</p>
                              <p className="text-xs text-gray-500 italic mt-2 line-clamp-2">{r.mahasiswaA.judul}</p>
                            </div>

                            {/* Project B */}
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">📁 Project B</p>
                              <p className="text-sm font-bold text-white">{r.mahasiswaB.nama}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{r.mahasiswaB.nim}</p>
                              <p className="text-xs text-gray-500 italic mt-2 line-clamp-2">{r.mahasiswaB.judul}</p>
                            </div>
                          </div>
                        </div>

                        {/* Toggle Icon */}
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 group-hover:bg-white/20 transition">
                          <span className="text-lg text-white transition-transform" style={{ transform: isOpen ? "rotate(180deg)" : "none" }}>▼</span>
                        </div>
                      </div>

                      {/* Score Visualization */}
                      <div className="grid grid-cols-3 gap-4 py-2">
                        <ScoreBadge score={r.codebertScore} label="CodeBERT" color="bg-gradient-to-br from-indigo-500/30 to-indigo-600/20 text-indigo-300" />
                        <ScoreBadge score={r.winnowingScore} label="Winnowing" color="bg-gradient-to-br from-purple-500/30 to-purple-600/20 text-purple-300" />
                        <ScoreBadge score={r.hybridScore} label="Hybrid (Final)" color="bg-gradient-to-br from-blue-500/30 to-blue-600/20 text-blue-300" />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isOpen && (
                    <div className="border-t border-white/10 bg-black/30 p-6 space-y-6">
                      {/* Detailed Score Table */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">📊 Detail Analisis</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* CodeBERT */}
                          <div className="p-4 rounded-xl bg-white/5 border border-indigo-500/30">
                            <p className="text-xs text-indigo-300 font-semibold mb-3">S<sub>CB</sub> (CodeBERT)</p>
                            <p className="text-2xl font-bold text-indigo-300 mb-2">{r.codebertScore.toFixed(2)}%</p>
                            <div className="w-full bg-black/50 rounded-full h-2">
                              <div className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-2 rounded-full transition-all duration-700" style={{ width: `${Math.min(r.codebertScore, 100)}%` }} />
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Kemiripan semantik</p>
                          </div>

                          {/* Winnowing */}
                          <div className="p-4 rounded-xl bg-white/5 border border-purple-500/30">
                            <p className="text-xs text-purple-300 font-semibold mb-3">S<sub>W</sub> (Winnowing)</p>
                            <p className="text-2xl font-bold text-purple-300 mb-2">{r.winnowingScore.toFixed(2)}%</p>
                            <div className="w-full bg-black/50 rounded-full h-2">
                              <div className="bg-gradient-to-r from-purple-500 to-purple-400 h-2 rounded-full transition-all duration-700" style={{ width: `${Math.min(r.winnowingScore, 100)}%` }} />
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Kemiripan tekstual</p>
                          </div>

                          {/* Hybrid */}
                          <div className="p-4 rounded-xl bg-white/5 border border-blue-500/30">
                            <p className="text-xs text-blue-300 font-semibold mb-3">S<sub>H</sub> (Hybrid)</p>
                            <p className="text-2xl font-bold text-blue-300 mb-2">{r.hybridScore.toFixed(2)}%</p>
                            <div className="w-full bg-black/50 rounded-full h-2">
                              <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full transition-all duration-700" style={{ width: `${Math.min(r.hybridScore, 100)}%` }} />
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Skor gabungan final</p>
                          </div>
                        </div>
                      </div>

                      {/* Code Snippets */}
                      {snippetA || snippetB ? (
                        <div className="space-y-3">
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider">💻 Potongan Kode Mirip</h3>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {snippetA && Object.keys(snippetA).slice(0, 2).map((fileA, idx) => (
                              <div key={idx} className="bg-gray-950 rounded-lg overflow-hidden border border-white/10">
                                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-900/50 border-b border-white/10">
                                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                                  <span className="text-xs text-indigo-200 font-mono truncate">[A] {fileA}</span>
                                </div>
                                <pre className="p-3 text-xs text-emerald-300 font-mono overflow-x-auto max-h-32 leading-relaxed whitespace-pre-wrap break-words">
                                  {snippetA[fileA]?.substring(0, 200)}...
                                </pre>
                              </div>
                            ))}
                            {snippetB && Object.keys(snippetB).slice(0, 2).map((fileB, idx) => (
                              <div key={idx} className="bg-gray-950 rounded-lg overflow-hidden border border-white/10">
                                <div className="flex items-center gap-2 px-3 py-2 bg-purple-900/50 border-b border-white/10">
                                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                                  <span className="text-xs text-purple-200 font-mono truncate">[B] {fileB}</span>
                                </div>
                                <pre className="p-3 text-xs text-emerald-300 font-mono overflow-x-auto max-h-32 leading-relaxed whitespace-pre-wrap break-words">
                                  {snippetB[fileB]?.substring(0, 200)}...
                                </pre>
                              </div>
                            ))}
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
    </div>
  );
}
