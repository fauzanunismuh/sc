import re
from typing import List, Set, Tuple

class Winnowing:
    """
    Implementasi algoritma Winnowing untuk deteksi plagiarisme kode.
    Berdasarkan proposal BAB II.5:
    - k-gram: k=5 (ukuran substring)
    - window: w=4 (ukuran jendela)
    - Fingerprint selection: rightmost minimum
    - Similarity: Jaccard Index SW = |A∩B| / |A∪B|
    """
    
    def __init__(self, k: int = 5, w: int = 4):
        """
        Args:
            k: Ukuran k-gram (default: 5 sesuai proposal)
            w: Ukuran window (default: 4 sesuai proposal)
        """
        self.k = k
        self.w = w
        self.base = 101  # Bilangan prima untuk rolling hash
        self.mod = 2**32
    
    def preprocess(self, code: str) -> str:
        """
        Preprocessing kode: remove comments, whitespace, lowercase.
        """
        # Remove single-line comments (//)
        code = re.sub(r'//.*?\n', '\n', code)
        # Remove multi-line comments (/* */)
        code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
        # Remove extra whitespace
        code = re.sub(r'\s+', ' ', code)
        # Lowercase
        code = code.lower().strip()
        return code
    
    def generate_kgrams(self, text: str) -> List[str]:
        """
        Generate k-grams dari teks.
        """
        if len(text) < self.k:
            return []
        return [text[i:i+self.k] for i in range(len(text) - self.k + 1)]
    
    def hash_kgram(self, kgram: str) -> int:
        """
        Hitung hash value untuk k-gram menggunakan polynomial rolling hash.
        """
        hash_val = 0
        for i, char in enumerate(kgram):
            hash_val = (hash_val + ord(char) * pow(self.base, i, self.mod)) % self.mod
        return hash_val
    
    def select_fingerprints(self, hashes: List[Tuple[int, int]]) -> Set[Tuple[int, int]]:
        """
        Pilih fingerprints menggunakan windowing dengan rightmost minimum selection.
        
        Args:
            hashes: List of (hash_value, position) tuples
            
        Returns:
            Set of selected fingerprints (hash_value, position)
        """
        if len(hashes) < self.w:
            return set(hashes)
        
        fingerprints = set()
        
        for i in range(len(hashes) - self.w + 1):
            window = hashes[i:i + self.w]
            # Pilih minimum hash dalam window
            # Jika ada ties, pilih yang paling kanan (rightmost)
            min_hash = min(window, key=lambda x: (x[0], -x[1]))
            fingerprints.add(min_hash)
        
        return fingerprints
    
    def get_fingerprints(self, code: str) -> Set[Tuple[int, int]]:
        """
        Extract fingerprints dari kode sumber.
        
        Returns:
            Set of (hash_value, position) tuples
        """
        # Preprocessing
        processed = self.preprocess(code)
        
        # Generate k-grams
        kgrams = self.generate_kgrams(processed)
        
        if not kgrams:
            return set()
        
        # Hash semua k-grams dengan posisi
        hashes = [(self.hash_kgram(kg), i) for i, kg in enumerate(kgrams)]
        
        # Select fingerprints menggunakan windowing
        fingerprints = self.select_fingerprints(hashes)
        
        return fingerprints
    
    def jaccard_similarity(self, fp1: Set[Tuple[int, int]], fp2: Set[Tuple[int, int]]) -> float:
        """
        Hitung Jaccard similarity antara dua set fingerprints.
        Formula: SW = |A ∩ B| / |A ∪ B|
        
        Args:
            fp1: Fingerprints dari kode pertama
            fp2: Fingerprints dari kode kedua
            
        Returns:
            Similarity score [0, 1]
        """
        # Extract hash values only (ignore positions)
        hashes1 = set(h for h, _ in fp1)
        hashes2 = set(h for h, _ in fp2)
        
        if not hashes1 and not hashes2:
            return 0.0
        
        intersection = len(hashes1 & hashes2)
        union = len(hashes1 | hashes2)
        
        if union == 0:
            return 0.0
        
        return intersection / union
    
    def calculate_similarity(self, code1: str, code2: str) -> float:
        """
        Hitung similarity score antara dua kode menggunakan Winnowing.
        
        Args:
            code1: Kode sumber pertama
            code2: Kode sumber kedua
            
        Returns:
            Winnowing similarity score SW [0, 1]
        """
        fp1 = self.get_fingerprints(code1)
        fp2 = self.get_fingerprints(code2)
        
        return self.jaccard_similarity(fp1, fp2)
    
    def find_matching_snippets(self, code1: str, code2: str, threshold: float = 0.75) -> List[dict]:
        """
        Temukan snippet kode yang matching antara dua file.
        Threshold default 0.75 sesuai proposal.
        
        Returns:
            List of matching snippets dengan informasi posisi
        """
        fp1 = self.get_fingerprints(code1)
        fp2 = self.get_fingerprints(code2)
        
        # Find common hashes
        hashes1 = {h: pos for h, pos in fp1}
        hashes2 = {h: pos for h, pos in fp2}
        common_hashes = set(hashes1.keys()) & set(hashes2.keys())
        
        snippets = []
        processed1 = self.preprocess(code1)
        processed2 = self.preprocess(code2)
        
        for h in common_hashes:
            pos1 = hashes1[h]
            pos2 = hashes2[h]
            
            # Extract snippet dari posisi k-gram
            snippet1 = processed1[pos1:pos1 + self.k] if pos1 + self.k <= len(processed1) else processed1[pos1:]
            snippet2 = processed2[pos2:pos2 + self.k] if pos2 + self.k <= len(processed2) else processed2[pos2:]
            
            snippets.append({
                'hash': h,
                'position1': pos1,
                'position2': pos2,
                'snippet1': snippet1,
                'snippet2': snippet2
            })
        
        return snippets
