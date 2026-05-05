import torch
import numpy as np
from transformers import RobertaTokenizer, RobertaModel
from typing import List, Tuple
from sklearn.metrics.pairwise import cosine_similarity

class CodeBERT:
    """
    Implementasi CodeBERT untuk deteksi plagiarisme kode.
    Berdasarkan proposal BAB II.4:
    - Model: microsoft/codebert-base
    - Similarity: Cosine Similarity
    - Threshold: SCB >= 0.80 (plagiarisme kuat)
    """
    
    def __init__(self, model_name: str = "microsoft/codebert-base", threshold: float = 0.80):
        """
        Args:
            model_name: Nama model CodeBERT (default: microsoft/codebert-base)
            threshold: Threshold untuk plagiarisme (default: 0.80 sesuai proposal)
        """
        self.threshold = threshold
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Load tokenizer dan model
        self.tokenizer = RobertaTokenizer.from_pretrained(model_name)
        self.model = RobertaModel.from_pretrained(model_name)
        self.model.to(self.device)
        self.model.eval()  # Set ke evaluation mode
    
    def preprocess_code(self, code: str) -> str:
        """
        Preprocessing sederhana untuk kode.
        """
        # Remove extra whitespace
        code = ' '.join(code.split())
        return code.strip()
    
    def get_embedding(self, code: str) -> np.ndarray:
        """
        Extract embedding vector dari kode menggunakan CodeBERT.
        
        Args:
            code: Source code string
            
        Returns:
            Embedding vector sebagai numpy array
        """
        # Preprocess
        processed_code = self.preprocess_code(code)
        
        # Tokenize
        inputs = self.tokenizer(
            processed_code,
            return_tensors='pt',
            max_length=512,
            truncation=True,
            padding=True
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        # Get embeddings
        with torch.no_grad():
            outputs = self.model(**inputs)
            # Gunakan [CLS] token embedding (first token)
            embedding = outputs.last_hidden_state[:, 0, :]
        
        return embedding.cpu().numpy().flatten()
    
    def calculate_similarity(self, code1: str, code2: str) -> float:
        """
        Hitung cosine similarity antara dua kode.
        Formula: SCB = cos(θ) = (A · B) / (||A|| × ||B||)
        
        Args:
            code1: Kode sumber pertama
            code2: Kode sumber kedua
            
        Returns:
            Similarity score [0, 1]
        """
        # Get embeddings
        emb1 = self.get_embedding(code1).reshape(1, -1)
        emb2 = self.get_embedding(code2).reshape(1, -1)
        
        # Calculate cosine similarity
        similarity = cosine_similarity(emb1, emb2)[0][0]
        
        return float(similarity)
    
    def is_plagiarism(self, code1: str, code2: str) -> Tuple[bool, float]:
        """
        Deteksi apakah dua kode terindikasi plagiarisme berdasarkan threshold.
        
        Args:
            code1: Kode sumber pertama
            code2: Kode sumber kedua
            
        Returns:
            Tuple (is_plagiarism, similarity_score)
        """
        similarity = self.calculate_similarity(code1, code2)
        is_plag = similarity >= self.threshold
        
        return is_plag, similarity
    
    def batch_similarity(self, code_pairs: List[Tuple[str, str]]) -> List[float]:
        """
        Hitung similarity untuk multiple pairs of code.
        
        Args:
            code_pairs: List of (code1, code2) tuples
            
        Returns:
            List of similarity scores
        """
        similarities = []
        for code1, code2 in code_pairs:
            sim = self.calculate_similarity(code1, code2)
            similarities.append(sim)
        
        return similarities
    
    def find_similar_segments(self, code1: str, code2: str, segment_size: int = 50) -> List[dict]:
        """
        Temukan segment-segment kode yang mirip.
        Membagi kode menjadi chunks dan bandingkan.
        
        Args:
            code1: Kode sumber pertama
            code2: Kode sumber kedua
            segment_size: Ukuran segment dalam karakter
            
        Returns:
            List of similar segments dengan score
        """
        # Split code into lines
        lines1 = code1.split('\n')
        lines2 = code2.split('\n')
        
        similar_segments = []
        
        # Compare chunks of code
        chunk_size = 5  # 5 lines per chunk
        for i in range(0, len(lines1), chunk_size):
            chunk1 = '\n'.join(lines1[i:i+chunk_size])
            if len(chunk1.strip()) < 10:  # Skip very small chunks
                continue
                
            for j in range(0, len(lines2), chunk_size):
                chunk2 = '\n'.join(lines2[j:j+chunk_size])
                if len(chunk2.strip()) < 10:
                    continue
                
                # Calculate similarity for this pair
                try:
                    sim = self.calculate_similarity(chunk1, chunk2)
                    
                    if sim >= self.threshold:
                        similar_segments.append({
                            'line_start1': i + 1,
                            'line_end1': min(i + chunk_size, len(lines1)),
                            'line_start2': j + 1,
                            'line_end2': min(j + chunk_size, len(lines2)),
                            'similarity': sim,
                            'snippet1': chunk1,
                            'snippet2': chunk2
                        })
                except Exception as e:
                    continue
        
        # Sort by similarity score
        similar_segments.sort(key=lambda x: x['similarity'], reverse=True)
        
        return similar_segments
