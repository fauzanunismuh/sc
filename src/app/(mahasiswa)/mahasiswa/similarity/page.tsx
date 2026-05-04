"use client";

import {
  Accordion, AccordionItem,
  Card, CardBody, CardHeader, Chip, Progress, Spinner
} from "@heroui/react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface SimilarityResult {
  projectA: { id: string; title: string; mahasiswa: { name: string; nim: string } };
  projectB: { id: string; title: string; mahasiswa: { name: string; nim: string } };
  hybrid_score?: number; hybridScore?: number;
  classification?: { label: string; level: string };
  snippetA?: Record<string, string>;
  snippetB?: Record<string, string>;
  checkedAt?: string;
}

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
      const filtered = allResults.filter(r =>
        r.projectA.mahasiswa.nim === myNim ||
        r.projectB.mahasiswa.nim === myNim ||
        r.projectA.mahasiswa.name === myName ||
        r.projectB.mahasiswa.name === myName
      );
      setResults(filtered.length > 0 ? filtered : allResults);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchResults();
    const iv = setInterval(fetchResults, 60000);
    return () => clearInterval(iv);
  }, [session]);

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
        <h1 className="text-2xl font-bold">Kemiripan Project Saya</h1>
        <p className="text-sm text-default-500">Perbandingan kode project kamu dengan project lain - Live otomatis</p>
      </div>

      {loading && results.length === 0 ? (
        <div className="flex justify-center py-16"><Spinner label="Menganalisis kemiripan..." /></div>
      ) : results.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-default-400">Belum ada data kemiripan untuk project kamu</p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center w-full">
              <h2 className="font-semibold text-lg">Hasil Perbandingan</h2>
              {loading && <Spinner size="sm" />}
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <Accordion>
              {results.map((r, i) => {
                const hybrid = r.hybrid_score ?? r.hybridScore ?? 0;
                const cls = r.classification ?? { label: "Normal / Aman", level: "success" };
                const myNim = (session?.user as { nim?: string })?.nim;
                const isA = r.projectA.mahasiswa.nim === myNim;
                const myProject = isA ? r.projectA : r.projectB;
                const otherProject = isA ? r.projectB : r.projectA;
                const mySnippet = isA ? r.snippetA : r.snippetB;
                const otherSnippet = isA ? r.snippetB : r.snippetA;

                return (
                  <AccordionItem
                    key={i}
                    title={
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{myProject.title}</span>
                          <span className="text-xs text-default-400 mx-2">mirip dengan</span>
                          <span className="text-sm font-medium">{otherProject.title}</span>
                          <span className="text-xs text-default-500 ml-1">({otherProject.mahasiswa.name})</span>
                        </div>
                        <Chip color={getChipColor(cls.level)} size="sm" variant="flat">{cls.label}</Chip>
                        <span className="text-sm font-bold w-14 text-right">{(hybrid * 100).toFixed(1)}%</span>
                      </div>
                    }
                  >
                    <div className="px-2 pb-4 space-y-4">
                      <div className="p-4 rounded-lg bg-default-50 border border-default-200">
                        <p className="text-xs text-default-500 mb-2">Skor Kemiripan (Hybrid)</p>
                        <Progress value={hybrid * 100} color={getChipColor(cls.level)} />
                        <div className="flex justify-between mt-2">
                          <Chip color={getChipColor(cls.level)} size="sm" variant="flat">{cls.label}</Chip>
                          <span className="text-lg font-bold">{(hybrid * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                          <p className="text-xs font-semibold text-blue-600">PROJECT KAMU</p>
                          <p className="text-sm font-medium">{myProject.title}</p>
                          <p className="text-xs text-default-500">{myProject.mahasiswa.name} - {myProject.mahasiswa.nim}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                          <p className="text-xs font-semibold text-orange-600">MIRIP DENGAN</p>
                          <p className="text-sm font-medium">{otherProject.title}</p>
                          <p className="text-xs text-default-500">{otherProject.mahasiswa.name} - {otherProject.mahasiswa.nim}</p>
                        </div>
                      </div>
                      {(mySnippet || otherSnippet) && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-default-600">SNIPPET KODE</p>
                          <div className="grid grid-cols-2 gap-3">
                            {mySnippet && Object.entries(mySnippet).slice(0, 1).map(([file, code]) => (
                              <div key={file} className="rounded-lg border border-blue-200 overflow-hidden">
                                <p className="text-[10px] font-mono bg-blue-50 px-2 py-1 text-blue-700 truncate">{file}</p>
                                <pre className="text-[10px] font-mono p-2 overflow-auto max-h-32 text-default-700 bg-white">{code}</pre>
                              </div>
                            ))}
                            {otherSnippet && Object.entries(otherSnippet).slice(0, 1).map(([file, code]) => (
                              <div key={file} className="rounded-lg border border-orange-200 overflow-hidden">
                                <p className="text-[10px] font-mono bg-orange-50 px-2 py-1 text-orange-700 truncate">{file}</p>
                                <pre className="text-[10px] font-mono p-2 overflow-auto max-h-32 text-default-700 bg-white">{code}</pre>
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
          </CardBody>
        </Card>
      )}
    </div>
  );
}
