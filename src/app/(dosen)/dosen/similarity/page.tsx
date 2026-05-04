"use client";

import { useEffect, useState } from "react";

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
}

export default function SimilarityPage() {
  const [results, setResults] = useState<SimilarityResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(70);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("hybrid");

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/similarity");
      const data = await res.json();
      setResults(data.results || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const runBatchAnalysis = async () => {
    setRunning(true);
    try {
      await fetch("/api/similarity/batch", { method: "POST" });
      await fetchResults();
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  const getStatusColor = (score: number) => {
    if (score >= 80) return "bg-red-100 text-red-700 border-red-200";
    if (score >= threshold) return "bg-orange-100 text-orange-700 border-orange-200";
    return "bg-green-100 text-green-700 border-green-200";
  };

  const getStatusLabel = (score: number) => {
    if (score >= 80) return "Terdeteksi Plagiat";
    if (score >= threshold) return "Perlu Ditinjau";
    return "Aman";
  };

  const getBarColor = (score: number) => {
    if (score >= 80) return "bg-red-500";
    if (score >= threshold) return "bg-orange-400";
    return "bg-green-500";
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
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "plagiat" && r.hybridScore >= 80) ||
        (filterStatus === "review" && r.hybridScore >= threshold && r.hybridScore < 80) ||
        (filterStatus === "aman" && r.hybridScore < threshold);
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === "hybrid") return b.hybridScore - a.hybridScore;
      if (sortBy === "codebert") return b.codebertScore - a.codebertScore;
      if (sortBy === "winnowing") return b.winnowingScore - a.winnowingScore;
      return 0;
    });

  const totalPlagiat = results.filter((r) => r.hybridScore >= 80).length;
  const totalReview = results.filter((r) => r.hybridScore >= threshold && r.hybridScore < 80).length;
  const totalAman = results.filter((r) => r.hybridScore < threshold).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Deteksi Plagiarisme Kode
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Analisis kemiripan menggunakan CodeBERT + Winnowing (Hybrid)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchResults}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition"
            >
              🔄 Refresh
            </button>
            <button
              onClick={runBatchAnalysis}
              disabled={running}
              className="px-5 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition font-medium"
            >
              {running ? "⏳ Memproses..." : "▶ Jalankan Analisis Batch"}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total Pasangan</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{results.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-red-100">
            <p className="text-xs text-red-500 uppercase tracking-wider">Plagiat (&ge;80%)</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{totalPlagiat}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
            <p className="text-xs text-orange-500 uppercase tracking-wider">Perlu Ditinjau</p>
            <p className="text-3xl font-bold text-orange-500 mt-1">{totalReview}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
            <p className="text-xs text-green-500 uppercase tracking-wider">Aman</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{totalAman}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-3 items-center">
          <input
            type="text"
            placeholder="Cari nama, NIM, atau judul..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="plagiat">Plagiat</option>
            <option value="review">Perlu Ditinjau</option>
            <option value="aman">Aman</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
          >
            <option value="hybrid">Urutkan: Hybrid</option>
            <option value="codebert">Urutkan: CodeBERT</option>
            <option value="winnowing">Urutkan: Winnowing</option>
          </select>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <label>Threshold:</label>
            <input
              type="number"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-16 px-2 py-1 rounded border border-gray-200 text-center text-sm"
            />
            <span>%</span>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Memuat data...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            {results.length === 0
              ? "Belum ada data. Jalankan analisis batch terlebih dahulu."
              : "Tidak ada hasil yang cocok dengan filter."}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((r) => {
              const isOpen = expanded === r.id;
              const snippetA = r.snippetA;
              const snippetB = r.snippetB;
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  {/* Card Header */}
                  <div
                    className="p-5 cursor-pointer hover:bg-gray-50 transition"
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      {/* Pair info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                              getStatusColor(r.hybridScore)
                            }`}
                          >
                            {getStatusLabel(r.hybridScore)}
                          </span>
                          <span className="text-xs text-gray-400">
                            Hybrid: {r.hybridScore.toFixed(1)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                          <div>
                            <p className="text-xs text-gray-400">Mahasiswa A</p>
                            <p className="text-sm font-semibold text-gray-700">
                              {r.mahasiswaA.nama}
                              <span className="font-normal text-gray-400 ml-1">
                                ({r.mahasiswaA.nim})
                              </span>
                            </p>
                            <p className="text-xs text-gray-500 truncate max-w-xs">
                              {r.mahasiswaA.judul}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Mahasiswa B</p>
                            <p className="text-sm font-semibold text-gray-700">
                              {r.mahasiswaB.nama}
                              <span className="font-normal text-gray-400 ml-1">
                                ({r.mahasiswaB.nim})
                              </span>
                            </p>
                            <p className="text-xs text-gray-500 truncate max-w-xs">
                              {r.mahasiswaB.judul}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Score bars */}
                      <div className="w-full md:w-64 space-y-2">
                        {[
                          { label: "CodeBERT", value: r.codebertScore },
                          { label: "Winnowing", value: r.winnowingScore },
                          { label: "Hybrid", value: r.hybridScore },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                              <span>{label}</span>
                              <span>{value.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  getBarColor(value)
                                }`}
                                style={{ width: `${Math.min(value, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="text-gray-400 text-lg">
                        {isOpen ? "▲" : "▼"}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isOpen && (
                    <div className="border-t border-gray-100 p-5 bg-gray-50 space-y-4">
                      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                        💻 Snippet Kode Terdeteksi
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {snippetA &&
                          Object.entries(snippetA)
                            .slice(0, 3)
                            .map(([file, code]) => (
                              <div
                                key={file}
                                className="bg-gray-900 rounded-xl overflow-hidden"
                              >
                                <div className="flex items-center gap-2 px-4 py-2 bg-blue-900">
                                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                                  <span className="text-xs text-blue-300 font-mono truncate">
                                    [A] {file}
                                  </span>
                                </div>
                                <pre className="p-4 text-xs text-green-300 font-mono whitespace-pre-wrap overflow-auto max-h-52 leading-relaxed">
                                  {code}
                                </pre>
                              </div>
                            ))}
                        {snippetB &&
                          Object.entries(snippetB)
                            .slice(0, 3)
                            .map(([file, code]) => (
                              <div
                                key={file}
                                className="bg-gray-900 rounded-xl overflow-hidden"
                              >
                                <div className="flex items-center gap-2 px-4 py-2 bg-orange-900">
                                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                                  <span className="text-xs text-orange-300 font-mono truncate">
                                    [B] {file}
                                  </span>
                                </div>
                                <pre className="p-4 text-xs text-green-300 font-mono whitespace-pre-wrap overflow-auto max-h-52 leading-relaxed">
                                  {code}
                                </pre>
                              </div>
                            ))}
                      </div>
                      {!snippetA && !snippetB && (
                        <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400">
                          Snippet belum tersedia &mdash; jalankan analisis batch untuk mengisi data
                        </div>
                      )}
                      <div className="text-xs text-gray-400 text-right">
                        Terakhir dicek:{" "}
                        {r.checkedAt
                          ? new Date(r.checkedAt).toLocaleString("id-ID")
                          : "-"}
                      </div>
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
