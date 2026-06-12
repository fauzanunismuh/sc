from typing import List, Dict, Tuple
from codebert import CodeBERT
from winnowing import Winnowing

class HybridSimilarity:
    """
    Implementasi hybrid CodeBERT + Winnowing untuk deteksi plagiarisme.
    Berdasarkan proposal BAB III:
    - Formula: SG = α*SCB + (1-α)*SW dengan α=0.5
    - Threshold: SCB >= 0.99, SW >= 0.13
    - Kategori: Plagiarisme Kuat, Mirip Tekstual, Mirip Semantik, Normal
    """
    
    def __init__(self, alpha: float = 0.5, codebert_threshold: float = 0.99, winnowing_threshold: float = 0.13):
        """
        Args:
            alpha: Bobot untuk CodeBERT (default: 0.5)
            codebert_threshold: Threshold CodeBERT (default: 0.99)
            winnowing_threshold: Threshold Winnowing (default: 0.13)
        """
        self.alpha = alpha
        self.codebert_threshold = codebert_threshold
        self.winnowing_threshold = winnowing_threshold
        
        # Initialize kedua algoritma
        self.codebert = CodeBERT(threshold=codebert_threshold)
        self.winnowing = Winnowing(k=5, w=4)
    
    def calculate_hybrid_score(self, code1: str, code2: str) -> Dict[str, float]:
        """
        Hitung hybrid similarity score.
        Formula: SG = α*SCB + (1-α)*SW
        
        Args:
            code1: Kode sumber pertama
            code2: Kode sumber kedua
            
        Returns:
            Dictionary berisi: scb (CodeBERT), sw (Winnowing), sg (hybrid)
        """
        # Hitung similarity dengan CodeBERT
        scb = self.codebert.calculate_similarity(code1, code2)
        
        # Hitung similarity dengan Winnowing
        sw = self.winnowing.calculate_similarity(code1, code2)
        
        # Hitung hybrid score: SG = α*SCB + (1-α)*SW
        sg = (self.alpha * scb) + ((1 - self.alpha) * sw)
        
        return {
            'scb': scb,
            'sw': sw,
            'sg': sg
        }
    
    def classify_similarity(self, scb: float, sw: float) -> str:
        """
        Klasifikasi hasil plagiarisme berdasarkan threshold.
        Kategori sesuai proposal BAB III:
        1. Plagiarisme Kuat: SCB >= 0.99 AND SW >= 0.13
        2. Mirip Tekstual: SW tinggi, SCB rendah
        3. Mirip Semantik: SCB tinggi, SW rendah
        4. Normal: Keduanya di bawah threshold
        
        Args:
            scb: CodeBERT similarity score
            sw: Winnowing similarity score
            
        Returns:
            Kategori plagiarisme
        """
        # Plagiarisme Kuat: kedua score harus melewati threshold
        if scb >= self.codebert_threshold and sw >= self.winnowing_threshold:
            return "Plagiarisme Kuat"
        
        # Mirip Tekstual: Winnowing tinggi (>= 0.13), CodeBERT rendah
        elif sw >= 0.13 and scb < self.codebert_threshold:
            return "Mirip Tekstual"
        
        # Mirip Semantik: CodeBERT tinggi (>= 0.99), Winnowing rendah
        elif scb >= 0.99 and sw < self.winnowing_threshold:
            return "Mirip Semantik"
        
        # Normal: keduanya di bawah threshold
        else:
            return "Normal"
    
    def analyze(self, code1: str, code2: str) -> Dict:
        """
        Analisis lengkap similarity antara dua kode.
        
        Args:
            code1: Kode sumber pertama
            code2: Kode sumber kedua
            
        Returns:
            Dictionary berisi scores, kategori, dan snippets
        """
        # Hitung hybrid score
        scores = self.calculate_hybrid_score(code1, code2)
        
        # Klasifikasi
        category = self.classify_similarity(scores['scb'], scores['sw'])
        
        # Temukan snippets yang mirip
        snippets = []
        
        # Snippets dari CodeBERT (jika terindikasi mirip)
        if scores['scb'] >= 0.65:
            cb_snippets = self.codebert.find_similar_segments(code1, code2)
            for snippet in cb_snippets[:5]:  # Ambil top 5
                snippets.append({
                    'source': 'CodeBERT',
                    'similarity': snippet['similarity'],
                    'line_start1': snippet['line_start1'],
                    'line_end1': snippet['line_end1'],
                    'line_start2': snippet['line_start2'],
                    'line_end2': snippet['line_end2'],
                    'snippet1': snippet['snippet1'],
                    'snippet2': snippet['snippet2']
                })
        
        # Snippets dari Winnowing (jika terindikasi mirip)
        if scores['sw'] >= 0.60:
            w_snippets = self.winnowing.find_matching_snippets(code1, code2)
            for snippet in w_snippets[:5]:  # Ambil top 5
                snippets.append({
                    'source': 'Winnowing',
                    'hash': snippet['hash'],
                    'position1': snippet['position1'],
                    'position2': snippet['position2'],
                    'snippet1': snippet['snippet1'],
                    'snippet2': snippet['snippet2']
                })
        
        return {
            'scores': scores,
            'category': category,
            'is_plagiarism': category in ['Plagiarisme Kuat', 'Mirip Tekstual', 'Mirip Semantik'],
            'snippets': snippets
        }
    
    def batch_analyze(self, code_pairs: List[Tuple[str, str]]) -> List[Dict]:
        """
        Analisis multiple pairs of code.
        
        Args:
            code_pairs: List of (code1, code2) tuples
            
        Returns:
            List of analysis results
        """
        results = []
        for code1, code2 in code_pairs:
            result = self.analyze(code1, code2)
            results.append(result)
        
        return results
