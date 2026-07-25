import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim

class SsimFeatureService:
    def __init__(self):
        # Initialize ORB detector for keypoint matching
        self.orb = cv2.ORB_create(nfeatures=1000)

    def calculate_ssim(self, img_bytes_live: bytes, img_bytes_ref: bytes) -> float:
        """Calculates Structural Similarity Index (SSIM) between live capture and reference photo."""
        # Convert bytes to numpy images
        nparr_live = np.frombuffer(img_bytes_live, np.uint8)
        nparr_ref = np.frombuffer(img_bytes_ref, np.uint8)
        
        img_live = cv2.imdecode(nparr_live, cv2.IMREAD_GRAYSCALE)
        img_ref = cv2.imdecode(nparr_ref, cv2.IMREAD_GRAYSCALE)
        
        if img_live is None or img_ref is None:
            return 0.0
            
        # Resize live image to match reference image dimensions
        img_live_resized = cv2.resize(img_live, (img_ref.shape[1], img_ref.shape[0]))
        
        # Calculate SSIM score
        score, _ = ssim(img_ref, img_live_resized, full=True)
        return float(max(0.0, min(1.0, score)))

    def calculate_orb_feature_match(self, img_bytes_live: bytes, img_bytes_ref: bytes) -> float:
        """Extracts ORB keypoints and computes FLANN / BFMatcher match ratio."""
        nparr_live = np.frombuffer(img_bytes_live, np.uint8)
        nparr_ref = np.frombuffer(img_bytes_ref, np.uint8)
        
        img_live = cv2.imdecode(nparr_live, cv2.IMREAD_GRAYSCALE)
        img_ref = cv2.imdecode(nparr_ref, cv2.IMREAD_GRAYSCALE)
        
        if img_live is None or img_ref is None:
            return 0.0

        kp1, des1 = self.orb.detectAndCompute(img_live, None)
        kp2, des2 = self.orb.detectAndCompute(img_ref, None)
        
        if des1 is None or des2 is None or len(des1) == 0 or len(des2) == 0:
            return 0.0
            
        # BFMatcher with Hamming distance
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = bf.match(des1, des2)
        
        # Sort matches by distance
        matches = sorted(matches, key=lambda x: x.distance)
        
        # Count good matches (distance < 50)
        good_matches = [m for m in matches if m.distance < 50]
        
        max_possible = min(len(kp1), len(kp2))
        if max_possible == 0:
            return 0.0
            
        ratio = len(good_matches) / float(max_possible)
        return float(max(0.0, min(1.0, ratio)))
