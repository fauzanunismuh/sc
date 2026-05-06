import hashlib
import re

def normalize_text(code: str) -> str:
    cleaned = code.lower()
    cleaned = re.sub(r"#.*", " ", cleaned)
    cleaned = re.sub(r"//.*", " ", cleaned)
    cleaned = re.sub(r"/\*.*?\*/", " ", cleaned, flags=re.S)
    cleaned = re.sub(r"[^a-z0-9_]+", "", cleaned)
    return cleaned

def get_kgrams(text: str, k: int) -> list:
    if len(text) < k:
        return [tuple(text)] if text else []
    return [tuple(text[i:i+k]) for i in range(len(text) - k + 1)]

def hash_kgram(kgram: tuple) -> int:
    text = " ".join(str(t) for t in kgram)
    return int(hashlib.md5(text.encode()).hexdigest(), 16) % (10**9)

def winnowing(code: str, k: int = 5, w: int = 4) -> set:
    if not code:
        return set()
    normalized = normalize_text(code)
    kgrams = get_kgrams(normalized, k)
    hashes = [hash_kgram(kg) for kg in kgrams]
    if not hashes:
        return set()
    if len(hashes) <= w:
        return set(hashes)
    fingerprints = set()
    for i in range(len(hashes) - w + 1):
        window = hashes[i:i+w]
        min_hash = min(window)
        rightmost_index = max(idx for idx, value in enumerate(window) if value == min_hash)
        fingerprints.add(window[rightmost_index])
    return fingerprints

def winnowing_similarity(code1: str, code2: str, k: int = 5, w: int = 4) -> float:
    if not code1 or not code2:
        return 0.0
    fp1 = winnowing(code1, k, w)
    fp2 = winnowing(code2, k, w)
    if not fp1 or not fp2:
        return 0.0
    intersection = fp1 & fp2
    union = fp1 | fp2
    return len(intersection) / len(union) if union else 0.0
