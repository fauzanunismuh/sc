"use client";

import {
  Accordion, AccordionItem,
  Card, CardBody, CardHeader, Chip, Spinner
} from "@heroui/react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

// Mahasiswa hanya bisa melihat:
// - Project miliknya
// - Project yang mirip (identitas + hybrid score + snippet)
// - TIDAK bisa melihat skor per metode (CodeBERT/Winnowing detail)

type ClassLevel = "danger" | "warning" | "secondary" | "success";

function getClassLabel(sg: number): { label: string; level: ClassLevel } {
  if (sg >= 0.80) return { label: "Plagiarisme Kuat", level: "danger" };
  if (sg >= 0.65) return { label: "Kemiripan Terdeteksi", level: "warning" };
  if (sg >= 0.45) return { label: "Sedikit Mirip", level: "secondary" };
  return { label: "Normal / Aman", level: "success" };
}

interface SimilarityResult {
  projectA: { id: string; title: string; mahasiswa: { name: string; nim: string } };
  projectB: { id: string; title: string; mahasiswa: { name: string; nim: string } };
  hybrid_score?: number; hybridScore?: number;
  classification?: { label: string; level: string };
  snippetA?: Record<string, string>;
  snippetB?: Record<string, string>;
  checkedAt?: string;
}

const CHIP_COLOR: Record<ClassLevel, "danger" | "warning" | "secondary" | "success"> = {
  danger: "danger", warning: "warning", secondary: "secondary", success: "success"
};

export default function MahasiswaSimilarityPage() {
  const { data: session } = useSession();
  const [results, setResults] = useState<SimilarityResult[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/similarity/batch");
      const data = await res.json();
      const allResults: SimilarityResult[] = data.results || [];
      const myNim = (session?.user as { nim?: string })?.nim;
      const myName = session?.user?.name;
      // Filter hanya yang melibatkan mahasiswa ini
      const filtered = allResults.filter(r =>
        r.projectA.mahasiswa.nim === myNim ||
        r.projectB.mahasiswa.nim === myNim ||
        r.projectA.mahasiswa.name === myName ||
        r.projectB.mahasiswa.name === myName
      );
      setResults(filtered.length > 0 ? filtered : allResults);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
    const iv = setInterval(fetchResults, 60000);
    return () => clearInterval(iv);
  }, [session]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kemiripan Kode Saya</h1>
        <p className="text-sm text-gray-500">
          Sistem mendeteksi kemiripan secara otomatis · Diperbarui setiap 60 detik
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Hasil Deteksi Kemiripan</h2>
        </CardHeader>
        <CardBody>
          {loading && results.length === 0 ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : results.length === 0 ? (
            <p className="text-center text-gray-500">Tidak ditemukan kemiripan pada project Anda</p>
          ) : (
            <Accordion>
              {results.map((r, i) => {
                const hybrid = r.hybrid_score ?? r.hybridScore ?? 0;
                const clsInfo = r.classification
                  ? { label: r.classification.label, level: (r.classification.level as ClassLevel) }
                  : getClassLabel(hybrid);
                // Tentukan project mana milik mahasiswa ini, mana yang mirip
                const myNim = (session?.user as { nim?: string })?.nim;
                const isProjectA = r.projectA.mahasiswa.nim === myNim;
                const myProject = isProjectA ? r.projectA : r.projectB;
                const similarProject = isProjectA ? r.projectB : r.projectA;
                const mySnippet = isProjectA ? r.snippetA : r.snippetB;
                const theirSnippet = isProjectA ? r.snippetB : r.snippetA;
                return (
                  <AccordionItem
                    key={i}
                    title={
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{myProject.title}</span>
                        <span className="text-gray-400">mirip dengan</span>
                        <span className="font-medium">{similarProject.title}</span>
                        <Chip color={CHIP_COLOR[clsInfo.level]} size="sm">{clsInfo.label}</Chip>
                        <span className="text-sm font-bold">{(hybrid * 100).toFixed(1)}%</span>
                      </div>
                    }
                  >
                    {/* Info project yang mirip */}
                    <div className="bg-gray-50 rounded p-4 mb-4">
                      <div className="text-xs font-bold text-gray-400 mb-2">PROJECT YANG TERDETEKSI MIRIP</div>
                      <div className="font-medium">{similarProject.title}</div>
                      <div className="text-sm text-gray-600">{similarProject.mahasiswa.name} · {similarProject.mahasiswa.nim}</div>
                      <div className="mt-2 text-lg font-bold">
                        Skor Kemiripan Gabungan: {(hybrid * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Kategori: <strong>{clsInfo.label}</strong>
                      </div>
                    </div>

                    {/* Snippet kode */}
                    {(mySnippet || theirSnippet) && (
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Snippet Kode yang Mirip</div>
                        <div className="space-y-2">
                          {mySnippet && Object.entries(mySnippet).slice(0, 2).map(([file, code]) => (
                            <div key={file} className="bg-gray-900 rounded p-3">
                              <div className="text-xs text-blue-400 mb-1">Project Anda — {file}</div>
                              <pre className="text-xs text-green-300 whitespace-pre-wrap overflow-auto max-h-40">{code}</pre>
                            </div>
                          ))}
                          {theirSnippet && Object.entries(theirSnippet).slice(0, 2).map(([file, code]) => (
                            <div key={file} className="bg-gray-900 rounded p-3">
                              <div className="text-xs text-orange-400 mb-1">Project Mirip — {file}</div>
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
