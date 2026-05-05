# Similarity Service

Layanan deteksi plagiarisme kode menggunakan hybrid CodeBERT dan Winnowing.

## Deskripsi

Similarity Service adalah implementasi dari proposal skripsi untuk deteksi plagiarisme tugas akhir mahasiswa. Service ini menggunakan pendekatan hybrid yang menggabungkan:

1. **CodeBERT** - Untuk mendeteksi kesamaan semantik kode
2. **Winnowing** - Untuk mendeteksi kesamaan tekstual/struktural
3. **Hybrid Score** - Kombinasi dari kedua algoritma

## Arsitektur

Berdasarkan proposal BAB III:

### Algoritma

#### 1. Winnowing (winnowing.py)
- Parameter: k=5 (k-gram), w=4 (window size)
- Fingerprint selection: Rightmost minimum
- Similarity: Jaccard Index
- Formula: SW = |A ∩ B| / |A ∪ B|
- Threshold: SW ≥ 0.75

#### 2. CodeBERT (codebert.py)
- Model: microsoft/codebert-base
- Similarity: Cosine Similarity
- Formula: SCB = cos(θ) = (A · B) / (||A|| × ||B||)
- Threshold: SCB ≥ 0.80

#### 3. Hybrid (hybrid.py)
- Formula: **SG = α*SCB + (1-α)*SW**
- Parameter: α = 0.6
- Kategori:
  - **Plagiarisme Kuat**: SCB ≥ 0.80 OR SW ≥ 0.75
  - **Mirip Tekstual**: SW tinggi, SCB rendah
  - **Mirip Semantik**: SCB tinggi, SW rendah
  - **Normal**: Keduanya di bawah threshold

## Instalasi

```bash
# Clone repository
git clone https://github.com/fauzanunismuh/sc.git
cd sc/similarity-service

# Install dependencies
pip install -r requirements.txt
```

## Penggunaan

### Menjalankan API Server

```bash
python api.py
```

Server akan berjalan di `http://localhost:8000`

### API Endpoints

#### 1. Analyze Similarity (Hybrid)
```bash
POST /analyze

Body:
{
  "code1": "source code 1",
  "code2": "source code 2",
  "file1_name": "file1.py",
  "file2_name": "file2.py"
}

Response:
{
  "scb": 0.85,
  "sw": 0.72,
  "sg": 0.798,
  "category": "Plagiarisme Kuat",
  "is_plagiarism": true,
  "snippets": [...]
}
```

#### 2. CodeBERT Only
```bash
POST /analyze/codebert-only
```

#### 3. Winnowing Only
```bash
POST /analyze/winnowing-only
```

#### 4. Batch Analysis
```bash
POST /analyze/batch
```

### Contoh Penggunaan Python

```python
from hybrid import HybridSimilarity

# Initialize
detector = HybridSimilarity(alpha=0.6)

# Analyze
code1 = "def hello(): print('hello')"
code2 = "def greet(): print('hello')"

result = detector.analyze(code1, code2)

print(f"CodeBERT Score: {result['scores']['scb']}")
print(f"Winnowing Score: {result['scores']['sw']}")
print(f"Hybrid Score: {result['scores']['sg']}")
print(f"Category: {result['category']}")
print(f"Is Plagiarism: {result['is_plagiarism']}")
```

## File Structure

```
similarity-service/
├── api.py              # FastAPI REST endpoints
├── codebert.py         # CodeBERT implementation
├── winnowing.py        # Winnowing implementation
├── hybrid.py           # Hybrid similarity detector
├── requirements.txt    # Dependencies
└── README.md          # Documentation
```

## Dependencies

- FastAPI & Uvicorn - Web framework
- Transformers & PyTorch - CodeBERT model
- scikit-learn - Cosine similarity calculation
- NumPy - Numerical operations

## Referensi

Implementasi berdasarkan:
- Schleimer, S., Wilkerson, D. S., & Aiken, A. (2003). Winnowing: local algorithms for document fingerprinting.
- Feng, Z., et al. (2020). CodeBERT: A Pre-Trained Model for Programming and Natural Languages.

## Lisensi

MIT License
