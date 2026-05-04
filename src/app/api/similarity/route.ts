import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE_URL = process.env.SIMILARITY_SERVICE_URL || "http://localhost:8000";

// ✅ GET - untuk cek status di browser
export async function GET() {
    try {
        const res = await fetch(`${PYTHON_SERVICE_URL}/health`);
        const data = await res.json();
        return NextResponse.json({
            status: "Similarity API is running ✓",
            python_service: data,
        });
    } catch {
        return NextResponse.json({
            status: "Similarity API is running ✓",
            python_service: "⚠️ Python service tidak terhubung (port 8000)",
        });
    }
}

// ✅ POST - untuk hitung similarity
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { code1, code2, alpha = 0.6 } = body;

        if (!code1 || !code2) {
            return NextResponse.json(
                { error: "code1 dan code2 wajib diisi" },
                { status: 400 }
            );
        }

        const response = await fetch(`${PYTHON_SERVICE_URL}/similarity`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code1, code2, alpha }),
        });

        if (!response.ok) {
            throw new Error(`Python service error: ${response.status}`);
        }

        const result = await response.json();
        return NextResponse.json(result);
    } catch (error) {
        console.error("Similarity API error:", error);
        return NextResponse.json(
            { error: "Gagal menghitung similarity. Pastikan Python service berjalan di port 8000." },
            { status: 500 }
        );
    }
}