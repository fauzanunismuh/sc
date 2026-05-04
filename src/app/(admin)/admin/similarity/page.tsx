"use client";

import { useEffect, useState } from "react";

// ============ Types ============
type ClassLevel = "danger" | "warning" | "secondary" | "success";
type Classification = { label: string; level: ClassLevel; description?: string };

interface SimilarityResult {
  projectA: { id: string; title: string; mahasiswa: { name: string; nim: string } };
  projectB: { id: string; title: string; mahasiswa: { name: string; nim: string } };
  codebert_score?: number; codebertScore?: number;
  winnowing_score?: number; winnowingScore?: number;
  hybrid_score?: number; hybridScore?: number;
  classification?: Classification;
  snippetA?: Record<string, string> | null;
  snippetB?: Record<string, string> | null;
  checkedAt?: string;
}

// ============ Helpers ============
function getClassification(sg: number, scb: number, sw: number): Classification {
  if (sg >= 0.80) return { label: "Plagiarisme Kuat", level: "danger", description: "Kemiripan tinggi secara semantik dan tekstual" };
  if (sg >= 0.65) return sw >= scb
    ? { label: "Mirip Tekstual", level: "warning", description: "Struktur kode sangat mirip (copy-paste)" }
    : { label: "Mirip Semantik", level: "warning", description: "Logika serupa, teks berbeda (refactoring)" };
  if (sg >= 0.45) return { label: "Mirip Semantik", level: "secondary", description: "Sedikit mirip secara semantik" };
  return { label: "Normal / Aman", level: "success", description: "Tidak terindikasi plagiarisme" };
}

const LEVEL_STYLE: Record<ClassLevel, { bg: string; text: string; badge: string; bar: string; border: string }> = {
  danger:    { bg: "bg-red-50",    text: "text-red-700",    badge: "bg-red-600 text-white",          bar: "bg-red-500",    border: "border-red-200" },
  warning:   { bg: "bg-orange-50", text: "text-orange-700", badge: "bg-orange-500 text-white",        bar: "bg-orange-400", border: "border-orange-200" },
  secondary: { bg: "bg-purple-50", text: "text-purple-700", badge: "bg-purple-500 text-white",        bar: "bg-purple-400", border: "border-purple-200" },
  success:   { bg: "bg-green-50",  text: "text-green-700",  badge: "bg-green-600 text-white",         bar: "bg-green-500",  border: "border-green-200" },
};

// ============ Component ============
export default function AdminSimilarityPage() {
  const [results, setResults] = useState<SimilarityResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [stats, setStats] = useState({ total: 0, kuat: 0, tekstual: 0, semantik: 0, normal: 0 });
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/similarity/batch");
      const data = await res.json();
      const r: SimilarityResult[] = data.results || [];
      setResults(r);
      setLastUpdate(new Date().toLocaleString("id-ID"));
      setStats({
        total: r.length,
        kuat:    r.filter(x => (x.hybrid_score ?? x.hybridScore ?? 0) >= 0.80).length,
        tekstual:r.filter(x => { const s = x.hybrid_score ?? x.hybridScore ?? 0; return s >= 0.65 && s < 0.80; }).length,
        semantik:r.filter(x => { const s = x.hybrid_score ?? x.hybridScore ?? 0; return s >= 0.45 && s < 0.65; }).length,
        normal:  r.filter(x => (x.hybrid_score ?? x.hybridScore ?? 0) < 0.45).length,
      });
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchResults();
    const iv = setInterval(fetchResults, 60000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Deteksi Kemiripan Kode</h1>
          <p className="mt-1 text-sm text-gray-500">
            Hybrid <span className="font-semibold text-blue-600">CodeBERT</span> + <span className="font-semibold text-indigo-600">Winnowing</span>
            &nbsp;&middot;&nbsp;α&nbsp;=&nbsp;0.6&nbsp;&middot;&nbsp;Otomatis setiap 60 detik
          </p>
        </div>
        <div className="text-right text-xs text-gray-400">
          {loading ? (
            <span className="inline-flex items-center gap-1 text-blue-500">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              Memperbarui...
            </span>
          ) : (
            <span>Diperbarui: {lastUpdate}</span>
          )}
        </div>
      </div>

      {/* Statistik 4 Kategori */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Pasang",            value: stats.total,    icon: "📂", cls: "bg-white border border-gray-200 text-gray-700" },
          { label: "Plagiarisme Kuat",         value: stats.kuat,     icon: "🚨", cls: "bg-red-600 text-white" },
          { label: "Mirip Tekstual",           value: stats.tekstual, icon: "⚠️", cls: "bg-orange-500 text-white" },
          { label: "Mirip Semantik",           value: stats.semantik, icon: "🔍", cls: "bg-purple-600 text-white" },
          { label: "Normal / Aman",            value: stats.normal,   icon: "✅", cls: "bg-green-600 text-white" },
        ].map((s, i) => (
          <div key={i} className={`rounded-xl p-4 shadow-sm ${s.cls}`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-3xl font-extrabold">{s.value}</div>
            <div className="text-xs font-medium mt-1 opacity-90">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabel Hasil */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">Hasil Analisis Kemiripan</h2>
          <span className="text-xs text-gray-400">{results.length} pasangan project</span>
        </div>

        {loading && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Menganalisis kemiripan kode...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📂</div>
            <p>Belum ada data kemiripan</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {results.map((r, i) => {
              const hybrid   = r.hybrid_score ?? r.hybridScore ?? 0;
              const codebert = r.codebert_score ?? r.codebertScore ?? 0;
              const winnowing = r.winnowing_score ?? r.winnowingScore ?? 0;
              const cls = r.classification ?? getClassification(hybrid, codebert, winnowing);
              const st  = LEVEL_STYLE[cls.level];
              const isOpen = expanded === i;
              const snippetA = r.snippetA as Record<string, string> | null | undefined;
              const snippetB = r.snippetB as Record<string, string> | null | undefined;

              return (
                <div key={i} className={`transition-colors ${isOpen ? st.bg : "hover:bg-gray-50"}`}>
                  {/* Row Header - klik untuk expand */}
                  <button
                    className="w-full text-left px-6 py-4 flex items-center gap-4"
                    onClick={() => setExpanded(isOpen ? null : i)}
                  >
                    {/* Nomor urut */}
                    <span className="text-sm font-bold text-gray-400 w-5 flex-shrink-0">{i + 1}</span>

                    {/* Nama project */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800 truncate">{r.projectA.title}</span>
                        <span className="text-gray-400 text-xs">↔️</span>
                        <span className="font-semibold text-gray-800 truncate">{r.projectB.title}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {r.projectA.mahasiswa.name} vs {r.projectB.mahasiswa.name}
                      </div>
                    </div>

                    {/* Badge kategori */}
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${st.badge}`}>
                      {cls.label}
                    </span>

                    {/* Persentase */}
                    <div className="text-right flex-shrink-0 w-16">
                      <span className={`text-xl font-extrabold ${st.text}`}>{(hybrid * 100).toFixed(1)}%</span>
                    </div>

                    {/* Chevron */}
                    <span className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
                  </button>

                  {/* Detail Panel */}
                  {isOpen && (
                    <div className="px-6 pb-6 space-y-5">
                      {/* Skor per Metode */}
                      <div className={`rounded-xl border ${st.border} p-4 space-y-3`}>
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Breakdown Skor</h3>
                        {[
                          { label: "CodeBERT (Semantik)",            value: codebert,  color: "bg-blue-500",   note: "SCB" },
                          { label: "Winnowing (Tekstual)",           value: winnowing, color: "bg-indigo-500", note: "SW" },
                          { label: "Hybrid Score (0.6×SCB + 0.4×SW)", value: hybrid,   color: st.bar,          note: "SG" },
                        ].map((s, idx) => (
                          <div key={idx}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">{s.label} <span className="font-mono text-xs text-gray-400">({s.note})</span></span>
                              <span className="font-extrabold text-gray-800">{(s.value * 100).toFixed(2)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div className={`h-2.5 rounded-full ${s.color} transition-all`} style={{ width: `${(s.value * 100).toFixed(1)}%` }} />
                            </div>
                          </div>
                        ))}
                        <p className={`text-xs mt-2 font-medium ${st.text}`}>
                          ℹ️ {cls.description}
                        </p>
                      </div>

                      {/* Info Project */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "PROJECT A", project: r.projectA, color: "border-blue-300 bg-blue-50" },
                          { label: "PROJECT B", project: r.projectB, color: "border-orange-300 bg-orange-50" },
                        ].map(({ label, project, color }) => (
                          <div key={label} className={`rounded-xl border ${color} p-4`}>
                            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">{label}</div>
                            <div className="font-semibold text-gray-800">{project.title}</div>
                            <div className="text-xs text-gray-500 mt-1">👤 {project.mahasiswa.name}</div>
                            <div className="text-xs text-gray-400 font-mono">{project.mahasiswa.nim}</div>
                          </div>
                        ))}
                      </div>

                      {/* Snippet Kode */}
                      {(snippetA || snippetB) ? (
                        <div>
                          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                            💻 Snippet Kode Terdeteksi
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Snippet A */}
                            {snippetA && Object.entries(snippetA).slice(0, 3).map(([file, code]) => (
                              <div key={file} className="bg-gray-900 rounded-xl overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-2 bg-blue-900">
                                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                                  <span className="text-xs text-blue-300 font-mono truncate">[A] {file}</span>
                                </div>
                                <pre className="p-4 text-xs text-green-300 font-mono whitespace-pre-wrap overflow-auto max-h-52 leading-relaxed">{code}</pre>
                              </div>
                            ))}
                            {/* Snippet B */}
                            {snippetB && Object.entries(snippetB).slice(0, 3).map(([file, code]) => (
                              <div key={file} className="bg-gray-900 rounded-xl overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-2 bg-orange-900">
                                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                                  <span className="text-xs text-orange-300 font-mono truncate">[B] {file}</span>
                                </div>
                                <pre className="p-4 text-xs text-green-300 font-mono whitespace-pre-wrap overflow-auto max-h-52 leading-relaxed">{code}</pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400">
                          Snippet belum tersedia &mdash; jalankan analisis batch untuk mengisi data
                        </div>
                      )}

                      <div className="text-xs text-gray-400 text-right">
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
