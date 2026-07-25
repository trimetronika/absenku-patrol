import io
import torch
import clip
from PIL import Image
import numpy as np

class ClipEmbeddingService:
    def __init__(self):
        # Load CLIP ViT-B/32 model on CPU/CUDA
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model, self.preprocess = clip.load("ViT-B/32", device=self.device)

    def extract_embedding(self, image_bytes: bytes) -> np.ndarray:
        """Extracts 512-dimensional normalized float embedding vector from image bytes."""
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        processed_image = self.preprocess(image).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            features = self.model.encode_image(processed_image)
            features /= features.norm(dim=-1, keepdim=True)
            
        return features.cpu().numpy()[0]

    def calculate_cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Calculates cosine similarity between two normalized embedding vectors [0.0 to 1.0]."""
        dot_product = np.dot(vec1, vec2)
        norm_v1 = np.linalg.norm(vec1)
        norm_v2 = np.linalg.norm(vec2)
        
        if norm_v1 == 0 or norm_v2 == 0:
            return 0.0
            
        similarity = dot_product / (norm_v1 * norm_v2)
        # Normalize from [-1, 1] range to [0, 1]
        return float(max(0.0, min(1.0, (similarity + 1.0) / 2.0)))
