from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from winnowing import winnowing_similarity
from codebert_similarity import codebert_similarity

# ============================================================
# Konfigurasi hasil kalibrasi awal berdasarkan distribusi data lokal
# Formula: SG = alpha * SCB + (1 - alpha) * SW
# Threshold CodeBERT  : >= 0.99
# Threshold Winnowing : >= 0.13
# Alpha               : 0.5 (bobot seimbang semantik vs tekstual)
# Winnowing: k=5 (k-gram), w=4 (window size) - Ramli et al. 2021
# ============================================================

THRESHOLD_CODEBERT  = 0.99
THRESHOLD_WINNOWING = 0.13
ALPHA_DEFAULT       = 0.5
K_GRAM_DEFAULT      = 5
WINDOW_DEFAULT      = 4


def get_classification(sg: float, scb: float, sw: float) -> dict:
    """
    Klasifikasi sesuai diagram revisi proposal:
    1. Plagiarisme Kuat: SCB >= 0.99 AND SW >= 0.13
    2. Mirip Tekstual  : SCB < 0.99 AND SW >= 0.13
    3. Mirip Semantik  : SCB >= 0.99 AND SW < 0.13
    4. Normal          : SCB < 0.99 AND SW < 0.13
    """
    if scb >= THRESHOLD_CODEBERT and sw >= THRESHOLD_WINNOWING:
        return {"label": "Plagiarisme Kuat", "level": "danger"}

    if sw >= THRESHOLD_WINNOWING:
        return {"label": "Mirip Tekstual", "level": "warning"}

    if scb >= THRESHOLD_CODEBERT:
        return {"label": "Mirip Semantik", "level": "warning"}

    return {"label": "Normal", "level": "success"}


app = FastAPI(title="Similarity Service - Gabungan CodeBERT + Winnowing")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SimilarityRequest(BaseModel):
    code1: str
    code2: str
    alpha: float = ALPHA_DEFAULT       # bobot CodeBERT (0.5)
    k: int = K_GRAM_DEFAULT            # ukuran k-gram Winnowing (5)
    w: int = WINDOW_DEFAULT            # ukuran window Winnowing (4)


class SimilarityResponse(BaseModel):
    codebert_score: float
    winnowing_score: float
    gabungan_score: float
    is_plagiarized: bool
    classification: dict
    threshold_codebert: float
    threshold_winnowing: float
    alpha: float
    review_required: bool
    review_reason: str | None = None


class AnalyzeOnlyResponse(BaseModel):
    scb: float | None = None
    sw: float | None = None


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
    Hitung similarity gabungan CodeBERT + Winnowing.
    Formula: SG = alpha * SCB + (1 - alpha) * SW
    """
    # 1. CodeBERT similarity 
    cb_score = codebert_similarity(req.code1, req.code2)

    # 2. Winnowing similarity 
    wn_score = winnowing_similarity(req.code1, req.code2, req.k, req.w)

    # 3. Skor gabungan:
    gabungan = req.alpha * cb_score + (1 - req.alpha) * wn_score

    # 4. Klasifikasi 4 kategori
    classification = get_classification(gabungan, cb_score, wn_score)

    # 5. is_plagiarized: True jika hasilnya bukan Normal.
    #    Ini mencakup Mirip Tekstual, Mirip Semantik, dan Plagiarisme Kuat.
    is_plagiarized = classification["level"] != "success"
    review_required = classification["level"] == "danger"
    review_reason = (
        "Kemiripan didominasi template/framework, perlu verifikasi manual."
        if review_required
        else None
    )

    return SimilarityResponse(
        codebert_score=round(cb_score, 4),
        winnowing_score=round(wn_score, 4),
        gabungan_score=round(gabungan, 4),
        is_plagiarized=is_plagiarized,
        classification=classification,
        threshold_codebert=THRESHOLD_CODEBERT,
        threshold_winnowing=THRESHOLD_WINNOWING,
        alpha=req.alpha,
        review_required=review_required,
        review_reason=review_reason,
    )


@app.post("/analyze")
def analyze(req: SimilarityRequest):
    """
    Endpoint kompatibilitas lama untuk service caller yang memakai /analyze.
    """
    cb_score = codebert_similarity(req.code1, req.code2)
    wn_score = winnowing_similarity(req.code1, req.code2, req.k, req.w)
    gabungan = req.alpha * cb_score + (1 - req.alpha) * wn_score
    classification = get_classification(gabungan, cb_score, wn_score)

    return {
        "scb": round(cb_score, 4),
        "sw": round(wn_score, 4),
        "sg": round(gabungan, 4),
        "category": classification["label"],
        "level": classification["level"],
    }


@app.post("/analyze/codebert-only", response_model=AnalyzeOnlyResponse)
def analyze_codebert_only(req: SimilarityRequest):
    """
    Endpoint kompatibilitas untuk perhitungan semantik saja.
    """
    cb_score = codebert_similarity(req.code1, req.code2)
    return {"scb": round(cb_score, 4)}


@app.post("/analyze/winnowing-only", response_model=AnalyzeOnlyResponse)
def analyze_winnowing_only(req: SimilarityRequest):
    """
    Endpoint kompatibilitas untuk perhitungan tekstual saja.
    """
    wn_score = winnowing_similarity(req.code1, req.code2, req.k, req.w)
    return {"sw": round(wn_score, 4)}
