"use client";

import {
  Accordion, AccordionItem,
  Card, CardBody, CardHeader, Chip, Progress, Spinner
} from "@heroui/react";
import { useEffect, useState } from "react";

// Threshold sesuai proposal skripsi (Tabel 3)
// Plagiarisme Kuat  : SG >= 0.80
// Mirip Tekstual    : 0.65 <= SG < 0.80  (Winnowing dominan)
// Mirip Semantik    : 0.45 <= SG < 0.65  (CodeBERT dominan)
// Normal / Aman     : SG < 0.45

type ClassLevel = "danger" | "warning" | "secondary" | "success";
type Classification = { label: string; level: ClassLevel };

function getClassification(sg: number, scb: number, sw: number): Classification {
  if (sg >= 0.80) return { label: "Plagiarisme Kuat", level: "danger" };
  if (sg >= 0.65) {
    // tentukan dominan antara tekstual vs semantik
    return sw >= scb
      ? { label: "Mirip Tekstual", level: "warning" }
      : { label: "Mirip Semantik", level: "warning" };
  }
  if (sg >= 0.45) return { label: "Mirip Semantik", level: "secondary" };
  return { label: "Normal / Aman", level: "success" };
}

interface SimilarityResult {
  projectA: { id: string; title: string; mahasiswa: { name: string; nim: string } };
  projectB: { id: string; title: string; mahasiswa: { name: string; nim: string } };
  codebert_score?: number; codebertScore?: number;
  winnowing_score?: number; winnowingScore?: number;
  hybrid_score?: number; hybridScore?: number;
  classification?: Classification;
  snippetA?: Record<string, string>;
  snippetB?: Record<string, string>;
  checkedAt?: string;
}

const CHIP_COLOR: Record<ClassLevel, "danger" | "warning" | "secondary" | "success"> = {
  danger: "danger", warning: "warning", secondary: "secondary", success: "success"
};

export default function AdminSimilarityPage() {
  const [results, setResults] = useState<SimilarityResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, kuat: 0, tekstual: 0, semantik: 0, normal: 0 });

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/similarity/batch");
      const data = await res.json();
      const r: SimilarityResult[] = data.results || [];
      setResults(r);
      const kuat = r.filter(x => (x.hybrid_score ?? x.hybridScore ?? 0) >= 0.80).length;
      const tekstual = r.filter(x => { const s = x.hybrid_score ?? x.hybridScore ?? 0; return s >= 0.65 && s < 0.80; }).length;
      const semantik = r.filter(x => { const s = x.hybrid_score ?? x.hybridScore ?? 0; return s >= 0.45 && s < 0.65; }).length;
      const normal = r.filter(x => (x.hybrid_score ?? x.hybridScore ?? 0) < 0.45).length;
      setStats({ total: r.length, kuat, tekstual, semantik, normal });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
    const iv = setInterval(fetchResults, 60000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Deteksi Kemiripan Kode</h1>
        <p className="text-sm text-gray-500">
          Analisis otomatis CodeBERT + Winnowing · α=0.6 · Live setiap 60 detik
        </p>
      </div>

      {/* Statistik 4 Kategori */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Pasang", value: stats.total, color: "bg-gray-100" },
          { label: "Plagiarisme Kuat (≥80%)", value: stats.kuat, color: "bg-red-100" },
          { label: "Mirip Tekstual (65-79%)", value: stats.tekstual, color: "bg-orange-100" },
          { label: "Mirip Semantik (45-64%)", value: stats.semantik, color: "bg-purple-100" },
          { label: "Normal (<45%)", value: stats.normal, color: "bg-green-100" },
        ].map((s, i) => (
          <Card key={i} className={s.color}>
            <CardBody className="text-center py-3">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-gray-600 mt-1">{s.label}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Hasil Analisis Kemiripan</h2>
        </CardHeader>
        <CardBody>
          {loading && results.length === 0 ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : results.length === 0 ? (
            <p className="text-center text-gray-500">Belum ada data kemiripan</p>
          ) : (
            <Accordion>
              {results.map((r, i) => {
                const hybrid = r.hybrid_score ?? r.hybridScore ?? 0;
                const codebert = r.codebert_score ?? r.codebertScore ?? 0;
                const winnowing = r.winnowing_score ?? r.winnowingScore ?? 0;
                const cls = r.classification ?? getClassification(hybrid, codebert, winnowing);
                return (
                  <AccordionItem
                    key={i}
                    title={
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{r.projectA.title}</span>
                        <span className="text-gray-400">vs</span>
                        <span className="font-medium">{r.projectB.title}</span>
                        <Chip color={CHIP_COLOR[cls.level]} size="sm">{cls.label}</Chip>
                        <span className="text-sm font-bold">{(hybrid * 100).toFixed(1)}%</span>
                      </div>
                    }
                  >
                    {/* Skor per metode */}
                    <div className="space-y-2 mb-4">
                      {[
                        { label: "CodeBERT (Semantik) — SCB", value: codebert, color: "secondary" as const },
                        { label: "Winnowing (Tekstual) — SW", value: winnowing, color: "warning" as const },
                        { label: "Hybrid Score (SG = 0.6×SCB + 0.4×SW)", value: hybrid, color: cls.level },
                      ].map((s, idx) => (
                        <div key={idx}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{s.label}</span>
                            <span className="font-bold">{(s.value * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={s.value * 100} color={s.color} size="sm" />
                        </div>
                      ))}
                      <p className="text-xs text-gray-500 italic">
                        Threshold: Plagiarisme Kuat ≥80% | Mirip Tekstual/Semantik 65-79% | Mirip Semantik 45-64% | Normal &lt;45%
                      </p>
                    </div>

                    {/* Info Project */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {[
                        { label: "PROJECT A", project: r.projectA },
                        { label: "PROJECT B", project: r.projectB },
                      ].map(({ label, project }) => (
                        <div key={label} className="bg-gray-50 rounded p-3">
                          <div className="text-xs font-bold text-gray-400 mb-1">{label}</div>
                          <div className="font-medium text-sm">{project.title}</div>
                          <div className="text-xs text-gray-500">{project.mahasiswa.name} · {project.mahasiswa.nim}</div>
                        </div>
                      ))}
                    </div>

                    {/* Snippet Kode */}
                    {(r.snippetA || r.snippetB) && (
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Snippet Kode Terdeteksi</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {r.snippetA && Object.entries(r.snippetA).slice(0, 2).map(([file, code]) => (
                            <div key={file} className="bg-gray-900 rounded p-3">
                              <div className="text-xs text-blue-400 mb-1">[A] {file}</div>
                              <pre className="text-xs text-green-300 whitespace-pre-wrap overflow-auto max-h-40">{code}</pre>
                            </div>
                          ))}
                          {r.snippetB && Object.entries(r.snippetB).slice(0, 2).map(([file, code]) => (
                            <div key={file} className="bg-gray-900 rounded p-3">
                              <div className="text-xs text-orange-400 mb-1">[B] {file}</div>
                              <pre className="text-xs text-green-300 whitespace-pre-wrap overflow-auto max-h-40">{code}</pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-400 mt-3">
                      Terakhir dicek: {r.checkedAt ? new Date(r.checkedAt).toLocaleString("id-ID") : "-"}
                    </div>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
