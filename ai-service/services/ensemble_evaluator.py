import time
from typing import Dict, List, Any
from .clip_service import ClipEmbeddingService
from .ssim_service import SsimFeatureService

class EnsembleEvaluatorService:
    def __init__(self):
        self.clip_service = ClipEmbeddingService()
        self.ssim_service = SsimFeatureService()
        
        # Calibrated weights
        self.weight_clip = 0.45
        self.weight_ssim = 0.25
        self.weight_orb = 0.15
        self.weight_object = 0.15
        
        # Decision threshold (85.0%)
        self.pass_threshold = 85.0

    def evaluate_patrol_photos(
        self, 
        live_photos_bytes: List[bytes], 
        ref_photos_bytes: List[bytes]
    ) -> Dict[str, Any]:
        """Runs multi-modal visual similarity evaluation across live and reference photos."""
        start_time = time.time()
        
        best_clip_score = 0.0
        best_ssim_score = 0.0
        best_orb_score = 0.0
        
        # Compare live photo(s) against all reference photos to find maximum alignment
        for live_bytes in live_photos_bytes:
            live_clip_vec = self.clip_service.extract_embedding(live_bytes)
            
            for ref_bytes in ref_photos_bytes:
                ref_clip_vec = self.clip_service.extract_embedding(ref_bytes)
                
                # 1. CLIP Similarity
                clip_sim = self.clip_service.calculate_cosine_similarity(live_clip_vec, ref_clip_vec)
                if clip_sim > best_clip_score:
                    best_clip_score = clip_sim
                    
                # 2. SSIM Score
                ssim_score = self.ssim_service.calculate_ssim(live_bytes, ref_bytes)
                if ssim_score > best_ssim_score:
                    best_ssim_score = ssim_score
                    
                # 3. ORB Keypoint Match
                orb_score = self.ssim_service.calculate_orb_feature_match(live_bytes, ref_bytes)
                if orb_score > best_orb_score:
                    best_orb_score = orb_score

        # Default object presence score (assumed valid if CLIP > 0.70)
        object_score = 0.90 if best_clip_score >= 0.70 else 0.40

        # Calculate final weighted ensemble score
        raw_score = (
            self.weight_clip * best_clip_score +
            self.weight_ssim * best_ssim_score +
            self.weight_orb * best_orb_score +
            self.weight_object * object_score
        )
        
        final_percentage = round(raw_score * 100.0, 2)
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        status = "PASS" if final_percentage >= self.pass_threshold else "FAIL"

        return {
            "status": status,
            "final_score": final_percentage,
            "pass_threshold": self.pass_threshold,
            "metrics": {
                "clip_score": round(best_clip_score * 100, 2),
                "ssim_score": round(best_ssim_score * 100, 2),
                "orb_feature_score": round(best_orb_score * 100, 2),
                "object_presence_score": round(object_score * 100, 2)
            },
            "execution_time_ms": execution_time_ms
        }
