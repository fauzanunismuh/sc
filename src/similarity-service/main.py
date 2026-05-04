from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from winnowing import winnowing_similarity
from codebert_similarity import codebert_similarity
import re

app = FastAPI(title="Similarity Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class SimilarityRequest(BaseModel):
    code1: str
    code2: str
    alpha: float = 0.6  # bobot CodeBERT
    k: int = 5          # ukuran k-gram Winnowing
    w: int = 4          # ukuran window Winnowing

class SimilarityResponse(BaseModel):
    codebert_score: float
    winnowing_score: float
    hybrid_score: float
    is_plagiarized: bool
    threshold: float = 0.7

def tokenize_code(code: str) -> list[str]:
    """Tokenisasi sederhana: pisahkan berdasarkan non-alphanumeric."""
    tokens = re.findall(r'[a-zA-Z_]\w*|[^\s\w]|\d+', code)
    return tokens

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/similarity", response_model=SimilarityResponse)
def calculate_similarity(req: SimilarityRequest):
    # 1. Hitung CodeBERT similarity (semantic)
    cb_score = codebert_similarity(req.code1, req.code2)
    
    # 2. Hitung Winnowing similarity (struktural)
    tokens1 = tokenize_code(req.code1)
    tokens2 = tokenize_code(req.code2)
    wn_score = winnowing_similarity(tokens1, tokens2, req.k, req.w)
    
    # 3. Hybrid: alpha * CodeBERT + (1 - alpha) * Winnowing
    hybrid = req.alpha * cb_score + (1 - req.alpha) * wn_score
    
    threshold = 0.7
    
    return SimilarityResponse(
        codebert_score=round(cb_score, 4),
        winnowing_score=round(wn_score, 4),
        hybrid_score=round(hybrid, 4),
        is_plagiarized=hybrid >= threshold,
        threshold=threshold
    )