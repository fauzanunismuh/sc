import hashlib
import re

KEYWORDS = {
    "def","return","if","else","elif","for","while","in","not","and","or",
    "True","False","None","import","from","class","try","except","pass",
    "break","continue","lambda","with","as","yield","raise","del","global",
    "nonlocal","assert","finally","is","print","len","range","int","str",
    "float","list","dict","set","tuple","type","self","super"
}

def normalize_tokens(tokens: list) -> list:
    normalized = []
    for t in tokens:
        if t in KEYWORDS:
            normalized.append(t)
        elif re.match(r'^\d+(\.\d+)?$', t):
            normalized.append('NUM')
        elif re.match(r'^[a-zA-Z_]\w*$', t):
            normalized.append('VAR')
        else:
            normalized.append(t)
    return normalized

def get_kgrams(tokens: list, k: int) -> list:
    if len(tokens) < k:
        return [tuple(tokens)]
    return [tuple(tokens[i:i+k]) for i in range(len(tokens) - k + 1)]

def hash_kgram(kgram: tuple) -> int:
    text = " ".join(str(t) for t in kgram)
    return int(hashlib.md5(text.encode()).hexdigest(), 16) % (10**9)

def winnowing(tokens: list, k: int = 5, w: int = 4) -> set:
    if not tokens:
        return set()
    normalized = normalize_tokens(tokens)
    kgrams = get_kgrams(normalized, k)
    hashes = [hash_kgram(kg) for kg in kgrams]
    if not hashes:
        return set()
    if len(hashes) <= w:
        return set(hashes)
    fingerprints = set()
    for i in range(len(hashes) - w + 1):
        window = hashes[i:i+w]
        fingerprints.add(min(window))
    return fingerprints

def winnowing_similarity(tokens1: list, tokens2: list, k: int = 5, w: int = 4) -> float:
    if not tokens1 or not tokens2:
        return 0.0
    fp1 = winnowing(tokens1, k, w)
    fp2 = winnowing(tokens2, k, w)
    if not fp1 or not fp2:
        return 0.0
    intersection = fp1 & fp2
    union = fp1 | fp2
    return len(intersection) / len(union) if union else 0.0
