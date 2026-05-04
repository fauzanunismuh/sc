"use client";

import {
  Accordion, AccordionItem,
  Card, CardBody, CardHeader, Chip, Progress, Spinner
} from "@heroui/react";
import { useEffect, useState } from "react";

type Classification = { label: string; level: "danger" | "warning" | "secondary" | "success" };

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

export default function DosenSimilarityPage() {
  const [results, setResults] = useState<SimilarityResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, high: 0, significant: 0, moderate: 0, normal: 0 });

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/similarity/batch");
      const data = await res.json();
      const r: SimilarityResult[] = data.results || [];
      setResults(r);
      const high = r.filter(x => (x.hybrid_score ?? x.hybridScore ?? 0) >= 0.85).length;
      const sig = r.filter(x => { const s = x.hybrid_score ?? x.hybridScore ?? 0; return s >= 0.65 && s < 0.85; }).length;
      const mod = r.filter(x => { const s = x.hybrid_score ?? x.hybridScore ?? 0; return s >= 0.45 && s < 0.65; }).length;
      const norm = r.filter(x => (x.hybrid_score ?? x.hybridScore ?? 0) < 0.45).length;
      setStats({ total: r.length, high, significant: sig, moderate: mod, normal: norm });
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchResults();
    const iv = setInterval(fetchResults, 60000);
    return () => clearInterval(iv);
  }, []);

  const getChipColor = (level?: string): "danger" | "warning" | "secondary" | "success" | "default" => {
    if (level === "danger") return "danger";
    if (level === "warning") return "warning";
    if (level === "secondary") return "secondary";
    if (level === "success") return "success";
    return "default";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kemiripan Kode Mahasiswa</h1>
        <p className="text-sm text-default-500">Analisis CodeBERT + Winnowing - Live setiap 60 detik</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Plagiat Tinggi (>=85%)", value: stats.high },
          { label: "Kemiripan Signifikan (65-84%)", value: stats.significant },
          { label: "Kemiripan Sedang (45-64%)", value: stats.moderate },
          { label: "Normal (<45%)", value: stats.normal },
        ].map((s, i) => (
          <Card key={i} className="shadow-sm">
            <CardBody className="py-3 px-4">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-default-500 mt-1">{s.label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center w-full">
            <h2 className="font-semibold text-lg">Hasil Analisis ({stats.total} pasang)</h2>
            {loading && <Spinner size="sm" />}
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {loading && results.length === 0 ? (
            <div className="flex justify-center py-12"><Spinner label="Menganalisis..." /></div>
          ) : results.length === 0 ? (
            <p className="text-center text-default-400 py-12">Belum ada data kemiripan</p>
          ) : (
            <Accordion>
              {results.map((r, i) => {
                const hybrid = r.hybrid_score ?? r.hybridScore ?? 0;
                const codebert = r.codebert_score ?? r.codebertScore ?? 0;
                const winnowing = r.winnowing_score ?? r.winnowingScore ?? 0;
                const cls = r.classification ?? { label: "Normal / Aman", level: "success" as const };
                return (
                  <AccordionItem
                    key={i}
                    title={
                      <div className="flex items-center gap-3 w-full">
                        <span className="text-sm font-medium flex-1">
                          {r.projectA.title} <span className="text-default-400">vs</span> {r.projectB.title}
                        </span>
                        <Chip color={getChipColor(cls.level)} size="sm" variant="flat">{cls.label}</Chip>
                        <span className="text-sm font-bold w-14 text-right">{(hybrid * 100).toFixed(1)}%</span>
                      </div>
                    }
                  >
                    <div className="px-2 pb-4 space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "CodeBERT (Semantik)", value: codebert },
                          { label: "Winnowing (Tekstual)", value: winnowing },
                          { label: "Hybrid Score (a=0.6)", value: hybrid },
                        ].map((s, idx) => (
                          <div key={idx}>
                            <p className="text-xs text-default-500 mb-1">{s.label}</p>
                            <Progress value={s.value * 100} color={getChipColor(cls.level)} size="sm" />
                            <p className="text-sm font-semibold mt-1">{(s.value * 100).toFixed(1)}%</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-default-400">Formula: 0.6 x CodeBERT + 0.4 x Winnowing</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-default-50 border border-default-200">
                          <p className="text-xs font-semibold text-default-600">PROJECT A</p>
                          <p className="text-sm font-medium">{r.projectA.title}</p>
                          <p className="text-xs text-default-500">{r.projectA.mahasiswa.name} - {r.projectA.mahasiswa.nim}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-default-50 border border-default-200">
                          <p className="text-xs font-semibold text-default-600">PROJECT B</p>
                          <p className="text-sm font-medium">{r.projectB.title}</p>
                          <p className="text-xs text-default-500">{r.projectB.mahasiswa.name} - {r.projectB.mahasiswa.nim}</p>
                        </div>
                      </div>
                      {(r.snippetA || r.snippetB) && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-default-600">SNIPPET KODE</p>
                          <div className="grid grid-cols-2 gap-3">
                            {r.snippetA && Object.entries(r.snippetA).slice(0, 1).map(([file, code]) => (
                              <div key={file} className="rounded-lg border border-blue-200 overflow-hidden">
                                <p className="text-[10px] font-mono bg-blue-50 px-2 py-1 text-blue-700 truncate">{file}</p>
                                <pre className="text-[10px] font-mono p-2 overflow-auto max-h-36 text-default-700">{code}</pre>
                              </div>
                            ))}
                            {r.snippetB && Object.entries(r.snippetB).slice(0, 1).map(([file, code]) => (
                              <div key={file} className="rounded-lg border border-orange-200 overflow-hidden">
                                <p className="text-[10px] font-mono bg-orange-50 px-2 py-1 text-orange-700 truncate">{file}</p>
                                <pre className="text-[10px] font-mono p-2 overflow-auto max-h-36 text-default-700">{code}</pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] text-default-400">Terakhir dicek: {r.checkedAt ? new Date(r.checkedAt).toLocaleString("id-ID") : "-"}</p>
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
