"use client";

import {
    Button, Card, CardBody, CardHeader, Chip, Progress,
    Spinner,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow
} from "@nextui-org/react";
import { useEffect, useState } from "react";

interface SimilarityResult {
  projectA: { id: string; title: string; mahasiswa: { name: string; nim: string } };
  projectB: { id: string; title: string; mahasiswa: { name: string; nim: string } };
  codebert_score?: number;
  codebertScore?: number;
  winnowing_score?: number;
  winnowingScore?: number;
  hybrid_score?: number;
  hybridScore?: number;
  is_plagiarized?: boolean;
  isPlagiarized?: boolean;
  checkedAt?: string;
}

export default function SimilarityPage() {
  const [results, setResults] = useState<SimilarityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stats, setStats] = useState({ total: 0, plagiarized: 0 });

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/similarity/batch");
      const data = await res.json();
      const r = data.results || [];
      setResults(r);
      setStats({
        total: r.length,
        plagiarized: r.filter((x: SimilarityResult) => x.isPlagiarized || x.is_plagiarized).length,
      });
    } finally {
      setLoading(false);
    }
  };

  const runBatchCheck = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/similarity/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      const r = data.results || [];
      setResults(r);
      setStats({
        total: r.length,
        plagiarized: r.filter((x: SimilarityResult) => x.isPlagiarized || x.is_plagiarized).length,
      });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { fetchResults(); }, []);

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "danger";
    if (score >= 0.6) return "warning";
    return "success";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deteksi Plagiarisme</h1>
          <p className="text-default-500 text-sm">Analisis kemiripan kode menggunakan CodeBERT + Winnowing</p>
        </div>
        <Button color="primary" isLoading={checking} onPress={runBatchCheck}>
          {checking ? "Sedang menganalisis..." : "Jalankan Pengecekan"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardBody className="text-center">
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-default-500 text-sm">Total Pasang Dicek</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-3xl font-bold text-danger">{stats.plagiarized}</p>
            <p className="text-default-500 text-sm">Terindikasi Plagiat</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-3xl font-bold text-success">{stats.total - stats.plagiarized}</p>
            <p className="text-default-500 text-sm">Aman</p>
          </CardBody>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader><h2 className="font-semibold">Hasil Analisis Kemiripan</h2></CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <Table aria-label="Similarity results">
              <TableHeader>
                <TableColumn>PROJECT A</TableColumn>
                <TableColumn>PROJECT B</TableColumn>
                <TableColumn>CODEBERT</TableColumn>
                <TableColumn>WINNOWING</TableColumn>
                <TableColumn>HYBRID SCORE</TableColumn>
                <TableColumn>STATUS</TableColumn>
              </TableHeader>
              <TableBody emptyContent="Belum ada data. Klik 'Jalankan Pengecekan'.">
                {results.map((r, i) => {
                  const hybrid = r.hybrid_score ?? r.hybridScore ?? 0;
                  const codebert = r.codebert_score ?? r.codebertScore ?? 0;
                  const winnowing = r.winnowing_score ?? r.winnowingScore ?? 0;
                  const plagiarized = r.is_plagiarized ?? r.isPlagiarized ?? false;
                  return (
                    <TableRow key={i}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{r.projectA.title}</p>
                          <p className="text-default-400 text-xs">{r.projectA.mahasiswa.name} · {r.projectA.mahasiswa.nim}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{r.projectB.title}</p>
                          <p className="text-default-400 text-xs">{r.projectB.mahasiswa.name} · {r.projectB.mahasiswa.nim}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <p className="text-xs mb-1">{(codebert * 100).toFixed(1)}%</p>
                          <Progress size="sm" value={codebert * 100} color={getScoreColor(codebert)} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <p className="text-xs mb-1">{(winnowing * 100).toFixed(1)}%</p>
                          <Progress size="sm" value={winnowing * 100} color={getScoreColor(winnowing)} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <p className="text-xs font-bold mb-1">{(hybrid * 100).toFixed(1)}%</p>
                          <Progress size="sm" value={hybrid * 100} color={getScoreColor(hybrid)} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip color={plagiarized ? "danger" : "success"} size="sm" variant="flat">
                          {plagiarized ? "Plagiat" : "Aman"}
                        </Chip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}