from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from winnowing import winnowing_similarity
from codebert_similarity import codebert_similarity
import re

# ============================================================
# Konfigurasi sesuai proposal skripsi (Tabel 3 - Akbar dkk. 2025)
# Formula: SG = alpha * SCB + (1 - alpha) * SW
# Threshold CodeBERT  : >= 0.80
# Threshold Winnowing : >= 0.75
# Alpha               : 0.6 (CodeBERT lebih dominan - semantik)
# Winnowing: k=5 (k-gram), w=4 (window size) - Ramli et al. 2021
# ============================================================

THRESHOLD_CODEBERT  = 0.80
THRESHOLD_WINNOWING = 0.75
ALPHA_DEFAULT       = 0.6
K_GRAM_DEFAULT      = 5
WINDOW_DEFAULT      = 4


def get_classification(sg: float, scb: float, sw: float) -> dict:
    """
    4 kategori klasifikasi sesuai konteks proposal:
    1. Plagiarisme Kuat: CodeBERT dan Winnowing sama-sama melewati ambang
    2. Mirip Tekstual  : Winnowing dominan
    3. Mirip Semantik  : CodeBERT dominan
    4. Normal          : tidak melewati ambang
    """
    if scb >= THRESHOLD_CODEBERT and sw >= THRESHOLD_WINNOWING:
        return {"label": "Plagiarisme Kuat", "level": "danger"}

    if sw >= THRESHOLD_WINNOWING:
        return {"label": "Mirip Tekstual", "level": "warning"}

    if scb >= THRESHOLD_CODEBERT:
        return {"label": "Mirip Semantik", "level": "warning"}

    return {"label": "Normal", "level": "success"}


app = FastAPI(title="Similarity Service - Hybrid CodeBERT + Winnowing")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SimilarityRequest(BaseModel):
    code1: str
    code2: str
    alpha: float = ALPHA_DEFAULT       # bobot CodeBERT (0.6)
    k: int = K_GRAM_DEFAULT            # ukuran k-gram Winnowing (5)
    w: int = WINDOW_DEFAULT            # ukuran window Winnowing (4)


class SimilarityResponse(BaseModel):
    codebert_score: float
    winnowing_score: float
    hybrid_score: float
    is_plagiarized: bool
    classification: dict
    threshold_codebert: float
    threshold_winnowing: float
    alpha: float


def tokenize_code(code: str) -> list[str]:
    """Tokenisasi: pisahkan berdasarkan non-alphanumeric."""
    tokens = re.findall(r'[a-zA-Z_]\w*|[^\s\w]|\d+', code)
    return tokens


@app.get("/health")
def health():
    return {
        "status": "ok",
        "config": {
            "alpha": ALPHA_DEFAULT,
            "k_gram": K_GRAM_DEFAULT,
            "window": WINDOW_DEFAULT,
            "threshold_codebert": THRESHOLD_CODEBERT,
            "threshold_winnowing": THRESHOLD_WINNOWING,
        }
    }


@app.post("/similarity", response_model=SimilarityResponse)
def calculate_similarity(req: SimilarityRequest):
    """
    Hitung similarity hybrid CodeBERT + Winnowing.
    Formula: SG = alpha * SCB + (1 - alpha) * SW
    """
    # 1. CodeBERT similarity (semantik)
    cb_score = codebert_similarity(req.code1, req.code2)

    # 2. Winnowing similarity (tekstual/struktural)
    tokens1 = tokenize_code(req.code1)
    tokens2 = tokenize_code(req.code2)
    wn_score = winnowing_similarity(tokens1, tokens2, req.k, req.w)

    # 3. Hybrid score: SG = alpha * SCB + (1 - alpha) * SW
    hybrid = req.alpha * cb_score + (1 - req.alpha) * wn_score

    # 4. Klasifikasi 4 kategori
    classification = get_classification(hybrid, cb_score, wn_score)

    # 5. is_plagiarized: True jika masuk kategori mirip (tekstual atau semantik)
    is_plagiarized = classification["level"] != "success"

    return SimilarityResponse(
        codebert_score=round(cb_score, 4),
        winnowing_score=round(wn_score, 4),
        hybrid_score=round(hybrid, 4),
        is_plagiarized=is_plagiarized,
        classification=classification,
        threshold_codebert=THRESHOLD_CODEBERT,
        threshold_winnowing=THRESHOLD_WINNOWING,
        alpha=req.alpha,
    )
