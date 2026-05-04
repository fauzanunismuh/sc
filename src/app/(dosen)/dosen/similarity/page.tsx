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
  projectA?: { title: string; mahasiswa: { name: string; nim: string } | null };
  projectB?: { title: string; mahasiswa: { name: string; nim: string } | null };
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
  const [error, setError] = useState<string | null>(null);

  const ALPHA = 0.6; // Sesuai proposal: α = 0,6

  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/similarity/batch");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setResults([]);
      } else {
        const mapped = (data.results || []).map((r: any) => ({
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
          status: r.classification?.label || "-",
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
  };

  useEffect(() => {
    fetchResults();
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
  const getClassification = (scb: number, sw: number, sh: number) => {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Analisis Kemiripan <span className="text-indigo-600">Code Project</span>
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Metode Hybrid: CodeBERT + Winnowing Algorithm
              </p>
              <div className="text-xs text-gray-400 mt-2 font-mono">
                <span className="font-semibold">Formula:</span> S<sub>H</sub> = α·S<sub>CB</sub> + (1−α)·S<sub>W</sub> dengan α = {ALPHA}
              </div>
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
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Summary Cards (Sesuai Tabel 3 Proposal) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Pasangan</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{results.length}</p>
            <p className="text-xs text-gray-400 mt-1">Kombinasi proyek</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-red-100">
            <p className="text-xs text-red-500 uppercase tracking-wider font-semibold">Plagiarisme Kuat</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{totalPlagiat}</p>
            <p className="text-xs text-red-400 mt-1">S<sub>CB</sub>&ge;80% & S<sub>W</sub>&ge;75%</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
            <p className="text-xs text-orange-500 uppercase tracking-wider font-semibold">Perlu Ditinjau</p>
            <p className="text-3xl font-bold text-orange-500 mt-1">{totalReview}</p>
            <p className="text-xs text-orange-400 mt-1">Mirip semantik/tekstual</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
            <p className="text-xs text-green-500 uppercase tracking-wider font-semibold">Aman</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{totalAman}</p>
            <p className="text-xs text-green-400 mt-1">Normal</p>
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
            <option value="plagiat">Plagiarisme Kuat</option>
            <option value="review">Perlu Ditinjau</option>
            <option value="aman">Aman</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
          >
            <option value="hybrid">Urutkan: Hybrid (S_H)</option>
            <option value="codebert">Urutkan: CodeBERT (S_CB)</option>
            <option value="winnowing">Urutkan: Winnowing (S_W)</option>
          </select>
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
              const classification = getClassification(r.codebertScore, r.winnowingScore, r.hybridScore);
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
                    <div className="flex flex-col gap-3">
                      {/* Classification & Info */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${classification.color}`}>
                              {classification.label}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-gray-400 font-semibold">Mahasiswa A</p>
                              <p className="text-sm font-semibold text-gray-700">
                                {r.mahasiswaA.nama}
                                <span className="font-normal text-gray-400 ml-1">({r.mahasiswaA.nim})</span>
                              </p>
                              <p className="text-xs text-gray-500 italic truncate max-w-xs">{r.mahasiswaA.judul}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 font-semibold">Mahasiswa B</p>
                              <p className="text-sm font-semibold text-gray-700">
                                {r.mahasiswaB.nama}
                                <span className="font-normal text-gray-400 ml-1">({r.mahasiswaB.nim})</span>
                              </p>
                              <p className="text-xs text-gray-500 italic truncate max-w-xs">{r.mahasiswaB.judul}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-gray-400 text-lg ml-2">{isOpen ? "▲" : "▼"}</div>
                      </div>

                      {/* Score Table (Sesuai Proposal) */}
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Metrik</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Skor</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Visualisasi</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-t border-gray-200">
                              <td className="px-3 py-2 font-mono text-xs text-gray-700">
                                S<sub>CB</sub> (CodeBERT)
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-indigo-600">
                                {r.codebertScore.toFixed(2)}%
                              </td>
                              <td className="px-3 py-2">
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div
                                    className="bg-indigo-500 h-2 rounded-full"
                                    style={{ width: `${Math.min(r.codebertScore, 100)}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                            <tr className="border-t border-gray-200">
                              <td className="px-3 py-2 font-mono text-xs text-gray-700">
                                S<sub>W</sub> (Winnowing)
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-purple-600">
                                {r.winnowingScore.toFixed(2)}%
                              </td>
                              <td className="px-3 py-2">
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div
                                    className="bg-purple-500 h-2 rounded-full"
                                    style={{ width: `${Math.min(r.winnowingScore, 100)}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                            <tr className="border-t border-gray-200 bg-blue-50">
                              <td className="px-3 py-2 font-mono text-xs text-gray-700 font-semibold">
                                S<sub>H</sub> (Hybrid)
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-blue-700">
                                {r.hybridScore.toFixed(2)}%
                              </td>
                              <td className="px-3 py-2">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${Math.min(r.hybridScore, 100)}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail - Code Snippets */}
                  {isOpen && (
                    <div className="border-t border-gray-100 p-5 bg-gray-50 space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                          💻 Potongan Kode Terdeteksi
                        </h3>
                        <span className="text-xs text-gray-400">(Side-by-side comparison)</span>
                      </div>

                      {!snippetA && !snippetB ? (
                        <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
                          Snippet belum tersedia. Jalankan analisis batch untuk mengisi data potongan kode.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {snippetA &&
                            snippetB &&
                            Object.keys(snippetA)
                              .slice(0, 3)
                              .map((fileA, idx) => {
                                const fileB = Object.keys(snippetB)[idx];
                                return (
                                  <div key={idx} className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    {/* Snippet A */}
                                    <div className="bg-gray-900 rounded-xl overflow-hidden">
                                      <div className="flex items-center gap-2 px-4 py-2 bg-blue-900">
                                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                                        <span className="text-xs text-blue-300 font-mono truncate">
                                          [A] {fileA}
                                        </span>
                                      </div>
                                      <pre className="p-4 text-xs text-green-300 font-mono whitespace-pre-wrap overflow-auto max-h-64 leading-relaxed">
                                        {snippetA[fileA]}
                                      </pre>
                                    </div>

                                    {/* Snippet B */}
                                    {fileB && (
                                      <div className="bg-gray-900 rounded-xl overflow-hidden">
                                        <div className="flex items-center gap-2 px-4 py-2 bg-orange-900">
                                          <span className="w-2 h-2 rounded-full bg-orange-400" />
                                          <span className="text-xs text-orange-300 font-mono truncate">
                                            [B] {fileB}
                                          </span>
                                        </div>
                                        <pre className="p-4 text-xs text-green-300 font-mono whitespace-pre-wrap overflow-auto max-h-64 leading-relaxed">
                                          {snippetB[fileB]}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                        </div>
                      )}

                      <div className="text-xs text-gray-400 text-right pt-2 border-t border-gray-200">
                        Terakhir dicek: {r.checkedAt ? new Date(r.checkedAt).toLocaleString("id-ID") : "-"}
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
