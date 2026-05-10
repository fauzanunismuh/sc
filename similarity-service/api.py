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
detector = HybridSimilarity(alpha=0.5, codebert_threshold=0.99, winnowing_threshold=0.13)

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
                "threshold": 0.99
            },
            "winnowing": {
                "k_gram": 5,
                "window": 4,
                "threshold": 0.13
            },
            "hybrid": {
                "alpha": 0.5,
                "formula": "SG = α*SCB + (1-α)*SW"
            }
        },
        "categories": [
            "Plagiarisme Kuat",
            "Mirip Tekstual",
            "Mirip Semantik",
            "Normal"
        ]
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}

@app.post("/analyze", response_model=SimilarityResponse)
async def analyze(pair: CodePair):
    """
    Analyze similarity between two code snippets using hybrid approach.
    
    Returns:
    - SCB (CodeBERT score)
    - SW (Winnowing score)  
    - SG (Hybrid score)
    - Category
    - Snippets evidence
    """
    try:
        result = detector.analyze(pair.code1, pair.code2)
        
        return SimilarityResponse(
            scb=result['scores']['scb'],
            sw=result['scores']['sw'],
            sg=result['scores']['sg'],
            category=result['category'],
            is_plagiarism=result['is_plagiarism'],
            snippets=result['snippets'][:5],  # Top 5 snippets
            file2_name=pair.file2_name
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/batch")
async def analyze_batch(batch: BatchCodePair):
    """
    Batch analysis for multiple code pairs.
    """
    results = []
    
    for pair in batch.pairs:
        try:
            result = detector.analyze(pair.code1, pair.code2)
            results.append({
                "file1_name": pair.file1_name,
                "file2_name": pair.file2_name,
                "scores": result['scores'],
                "category": result['category'],
                "is_plagiarism": result['is_plagiarism'],
                "snippets": result['snippets'][:3]
            })
        except Exception as e:
            results.append({
                "file1_name": pair.file1_name,
                "file2_name": pair.file2_name,
                "error": str(e)
            })
    
    return {"results": results}

@app.post("/analyze/codebert-only")
async def analyze_codebert_only(pair: CodePair):
    """
    Analyze using CodeBERT only (semantic similarity).
    """
    try:
        scb = detector.codebert.calculate_similarity(pair.code1, pair.code2)
        return {
            "scb": scb,
            "threshold": 0.99,
            "is_similar": scb >= 0.99,
            "file1_name": pair.file1_name,
            "file2_name": pair.file2_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/winnowing-only")
async def analyze_winnowing_only(pair: CodePair):
    """
    Analyze using Winnowing only (textual similarity).
    """
    try:
        result = detector.winnowing.calculate_similarity(pair.code1, pair.code2)
        sw = result if isinstance(result, float) else result.get('similarity', 0)
        return {
            "sw": sw,
            "threshold": 0.13,
            "is_similar": sw >= 0.13,
            "file1_name": pair.file1_name,
            "file2_name": pair.file2_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    pass

# ================================================
# ANTAR MAHASISWA: Project Comparison
# ================================================

class ProjectSubmission(BaseModel):
    project_id: str
    student_name: str
    code: str

@app.post("/compare/students")
async def compare_student_projects(projects: List[ProjectSubmission]):
    """
    Compare ANTAR MAHASISWA (Project A vs B vs C).
    Dosen deteksi plagiarisme antar mahasiswa berbeda.
    
    Input: List of projects dari mahasiswa yang berbeda
    Output: Matrix similarity + suspicious pairs dengan label student yang jelas
    """
    results = []
    suspicious = []
    
    # PENTING: Bandingkan hanya antar mahasiswa berbeda, BUKAN dalam satu project
    for i in range(len(projects)):
        for j in range(i + 1, len(projects)):
            proj_a = projects[i]
            proj_b = projects[j]
            
            # Skip jika sama student (tidak mungkin terjadi dalam use case normal)
            if proj_a.student_name == proj_b.student_name:
                continue
            
            analysis = detector.analyze(proj_a.code, proj_b.code)
            
            # PERBAIKAN: Tambahkan label student pada setiap snippet
            labeled_snippets = []
            for snippet in analysis.get('snippets', []):
                labeled_snippet = {
                    'student_a': proj_a.student_name,
                    'student_b': proj_b.student_name,
                    'project_a': proj_a.project_id,
                    'project_b': proj_b.project_id,
                    'code_a': snippet.get('code1', ''),
                    'code_b': snippet.get('code2', ''),
                    'similarity': snippet.get('similarity', 0)
                }
                labeled_snippets.append(labeled_snippet)
            
            comparison = {
                "student_a": proj_a.student_name,
                "student_b": proj_b.student_name,
                "project_a": proj_a.project_id,
                "project_b": proj_b.project_id,
                "scores": analysis['scores'],
                "category": analysis['category'],
                "is_plagiarism": analysis['is_plagiarism'],
                "snippets": labeled_snippets[:3]  # Top 3 dengan label jelas
            }
            
            results.append(comparison)
            
            # Flag jika suspicious (>= 0.70)
            if analysis['scores']['sg'] >= 0.70:
                suspicious.append({
                    **comparison,
                    "snippets": labeled_snippets[:3]
                })
    
    # Sort by score (highest first)
    suspicious.sort(key=lambda x: x['scores']['sg'], reverse=True)
    
    return {
        "total_students": len(projects),
        "total_comparisons": len(results),
        "suspicious_pairs": suspicious,
        "all_comparisons": results
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
