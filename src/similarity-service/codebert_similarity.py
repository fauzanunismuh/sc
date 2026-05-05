from transformers import AutoTokenizer, AutoModel
import torch
import torch.nn.functional as F
import numpy as np

MODEL_NAME = "microsoft/codebert-base"

tokenizer = None
model = None

def load_model():
    global tokenizer, model
    if tokenizer is None:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        model = AutoModel.from_pretrained(MODEL_NAME)
        model.eval()
    return tokenizer, model

def get_embedding(code: str) -> np.ndarray:
    """Dapatkan vektor embedding dari kode menggunakan CodeBERT."""
    tok, mdl = load_model()
    inputs = tok(
        code,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True
    )
    with torch.no_grad():
        outputs = mdl(**inputs)

    # Mean pooling dengan attention mask agar token padding tidak ikut dihitung.
    last_hidden_state = outputs.last_hidden_state
    attention_mask = inputs["attention_mask"].unsqueeze(-1).expand(last_hidden_state.size()).float()
    masked_hidden_state = last_hidden_state * attention_mask
    pooled = masked_hidden_state.sum(dim=1) / attention_mask.sum(dim=1).clamp(min=1e-9)
    embedding = pooled.squeeze().numpy()
    return embedding

def codebert_similarity(code1: str, code2: str) -> float:
    """
    Hitung cosine similarity antara dua kode menggunakan CodeBERT.
    """
    emb1 = get_embedding(code1)
    emb2 = get_embedding(code2)
    
    emb1_tensor = torch.tensor(emb1).unsqueeze(0)
    emb2_tensor = torch.tensor(emb2).unsqueeze(0)
    
    similarity = F.cosine_similarity(emb1_tensor, emb2_tensor).item()
    # Normalisasi ke [0, 1]
    return (similarity + 1) / 2