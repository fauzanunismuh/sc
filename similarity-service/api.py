from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from hybrid import HybridSimilarity
import uvicorn

app = FastAPI(
    title="Plagiarism Detection API",
    description="API untuk deteksi plagiarisme kode menggunakan hybrid CodeBERT + Winnowing",
    version="1.0.0"
)

# Initialize hybrid similarity detector
detector = HybridSimilarity(alpha=0.6, codebert_threshold=0.80, winnowing_threshold=0.75)

class CodePair(BaseModel):
    """Model untuk pasangan kode yang akan dibandingkan"""
    code1: str
    code2: str
    file1_name: Optional[str] = "File 1"
    file2_name: Optional[str] = "File 2"

class BatchCodePair(BaseModel):
    """Model untuk batch comparison"""
    pairs: List[CodePair]

class SimilarityResponse(BaseModel):
    """Response model untuk similarity analysis"""
    scb: float  # CodeBERT score
    sw: float   # Winnowing score
    sg: float   # Hybrid score
    category: str
    is_plagiarism: bool
    snippets: List[dict]
    file1_name: str
    file2_name: str

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Plagiarism Detection API",
        "version": "1.0.0",
        "algorithms": {
            "codebert": {
                "model": "microsoft/codebert-base",
                "threshold": 0.80
            },
            "winnowing": {
                "k": 5,
                "w": 4,
                "threshold": 0.75
            },
            "hybrid": {
                "alpha": 0.6,
                "formula": "SG = α*SCB + (1-α)*SW"
            }
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "plagiarism-detection"}

@app.post("/analyze", response_model=SimilarityResponse)
async def analyze_similarity(code_pair: CodePair):
    """
    Analisis similarity antara dua kode.
    
    Berdasarkan proposal BAB III:
    - Menggunakan hybrid CodeBERT + Winnowing
    - Formula: SG = 0.6*SCB + 0.4*SW
    - Threshold: SCB >= 0.80, SW >= 0.75
    - Kategori: Plagiarisme Kuat, Mirip Tekstual, Mirip Semantik, Normal
    """
    try:
        # Analisis menggunakan hybrid detector
        result = detector.analyze(code_pair.code1, code_pair.code2)
        
        return SimilarityResponse(
            scb=result['scores']['scb'],
            sw=result['scores']['sw'],
            sg=result['scores']['sg'],
            category=result['category'],
            is_plagiarism=result['is_plagiarism'],
            snippets=result['snippets'],
            file1_name=code_pair.file1_name,
            file2_name=code_pair.file2_name
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing similarity: {str(e)}")

@app.post("/analyze/batch")
async def analyze_batch(batch: BatchCodePair):
    """
    Analisis multiple pairs of code sekaligus.
    Useful untuk batch processing.
    """
    try:
        results = []
        for pair in batch.pairs:
            result = detector.analyze(pair.code1, pair.code2)
            results.append({
                "file1_name": pair.file1_name,
                "file2_name": pair.file2_name,
                "scores": result['scores'],
                "category": result['category'],
                "is_plagiarism": result['is_plagiarism'],
                "snippets": result['snippets']
            })
        
        return {
            "total_pairs": len(batch.pairs),
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in batch analysis: {str(e)}")

@app.post("/analyze/codebert-only")
async def analyze_codebert_only(code_pair: CodePair):
    """
    Analisis menggunakan CodeBERT saja.
    """
    try:
        score = detector.codebert.calculate_similarity(code_pair.code1, code_pair.code2)
        is_plag = score >= detector.codebert_threshold
        
        return {
            "score": score,
            "threshold": detector.codebert_threshold,
            "is_plagiarism": is_plag,
            "file1_name": code_pair.file1_name,
            "file2_name": code_pair.file2_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in CodeBERT analysis: {str(e)}")

@app.post("/analyze/winnowing-only")
async def analyze_winnowing_only(code_pair: CodePair):
    """
    Analisis menggunakan Winnowing saja.
    """
    try:
        score = detector.winnowing.calculate_similarity(code_pair.code1, code_pair.code2)
        is_plag = score >= detector.winnowing_threshold
        
        return {
            "score": score,
            "threshold": detector.winnowing_threshold,
            "is_plagiarism": is_plag,
            "file1_name": code_pair.file1_name,
            "file2_name": code_pair.file2_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in Winnowing analysis: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
