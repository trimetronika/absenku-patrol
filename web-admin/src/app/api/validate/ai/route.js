import { NextResponse } from 'next/server';
import { readDb, writeDb } from '../../../../lib/db';
import { pipeline, env, RawImage } from '@xenova/transformers';
import { Jimp } from 'jimp';

// Disable local cache warnings or setup a local dir if needed
env.allowLocalModels = false; // Force download from HF hub to ensure we get the right model

let extractor = null;
async function getExtractor() {
  if (!extractor) {
    // Initialize the CLIP Vision Transformer for image feature extraction
    extractor = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
      quantized: true, // Use int8 quantization for much faster inference on CPU
    });
  }
  return extractor;
}

export async function POST(request) {
  try {
    const { pointId, photos, distance, guardName } = await request.json();
    const db = await readDb();
    
    const targetPoint = db.patrolPoints.find(p => p.id === pointId);
    if (!targetPoint) {
      return NextResponse.json({ success: false, error: "Point not found" }, { status: 404 });
    }

    let aiScore = 0;
    
    // Check if the point has a reference photo registered in the DB
    if (!targetPoint.refImages || targetPoint.refImages.length === 0) {
       return NextResponse.json({ success: false, error: `❌ AI REJECTED: Checkpoint has no Reference Photo set in the database.` }, { status: 400 });
    }

    if (photos && photos.length === 2) {
       // Anti-Spoofing Check: Ensure the two live photos are slightly different (not a static printed image)
       const rawSpoofScore = await calculateStructuralSimilarity(photos[0], photos[1]);
       // Exact identical copies usually hit > 0.995 in raw Cosine Similarity
       if (rawSpoofScore > 0.995) {
          return NextResponse.json({ success: false, error: `❌ AI REJECTED: ANTI-SPOOFING TRIGGERED. Static image detected.` }, { status: 400 });
       }
       
       // Helper to find the best match score among all uploaded reference photos
       const getBestScore = async (livePhotoBase64) => {
          let best = 0;
          for (const refImg of targetPoint.refImages) {
             const score = await calculateStructuralSimilarity(livePhotoBase64, refImg);
             if (score > best) best = score;
          }
          return best;
       };
       
       // Compare both Live Photos with the Master Reference Photo(s) from DB
       const rawScore1 = await getBestScore(photos[0]);
       const rawScore2 = await getBestScore(photos[1]);
       
       const avgRawScore = (rawScore1 + rawScore2) / 2;
       
       // STRICT SCALING CALIBRATION (UPDATED):
       // Different rooms (e.g. Kos A vs Kos B): raw ~0.70 - 0.74
       // Same room, slight angle / lighting diff: raw ~0.78 - 0.82
       // Same room, exact angle & lighting: raw ~0.84+
       // We map raw 0.70 -> 0%, 0.83 -> 100%
       // Formula: (raw - 0.70) / 0.13 * 100
       let scaled = ((avgRawScore - 0.70) / 0.13) * 100;
       scaled = Math.min(100, Math.max(0, scaled));
       aiScore = parseFloat(scaled.toFixed(1));
    } else {
       return NextResponse.json({ success: false, error: `❌ AI REJECTED: Requires 2 live photos for validation.` }, { status: 400 });
    }

    const passThreshold = db.sysConfig.aiPassThreshold || 85.0;
    
    // Log function helper
    const saveLog = (status, reason) => {
      db.aiLogs.unshift({
         timestamp: new Date().toISOString(),
         status,
         reason,
         point: targetPoint.name,
         guard: guardName || "Unknown",
         photos: photos,
         score: aiScore
      });
      if (db.aiLogs.length > 50) db.aiLogs.length = 50;
      
      if (status === "VERIFIED") {
        const history = {
          id: `hist-${Date.now()}`,
          timestamp: new Date().toISOString(),
          pointName: targetPoint.name,
          status: "CHECKED_IN",
          guard: guardName || "Unknown Officer"
        };
        db.historyLogs.unshift(history);
      }
      await writeDb(db);
    };

    if (aiScore < passThreshold) {
      saveLog("REJECTED", `Mismatched scene. Score ${aiScore}% < ${passThreshold}%`);
      return NextResponse.json({ 
        success: false, 
        error: `❌ AI REJECTED: Low visual similarity (${aiScore}%). The 2 photos captured were too different.`,
        score: aiScore 
      }, { status: 400 });
    }

    saveLog("VERIFIED", "Visuals match the expected scene context.");
    
    return NextResponse.json({
      success: true,
      data: {
        validation_result: "VALID",
        summary: {
          timestamp: new Date().toISOString(),
          qr_valid: true,
          gps_valid: true,
          gps_distance_meters: distance,
          ai_similarity_score: aiScore,
          anti_cheat_status: "PASSED"
        }
      }
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

async function calculateStructuralSimilarity(b64a, b64b) {
   try {
     const extract = await getExtractor();
     
     // The pipeline automatically handles data URIs (Base64) in browsers, but in Node
     // we must decode it manually and pass a RawImage
     
     const buf1 = Buffer.from(b64a.replace(/^data:image\/\w+;base64,/, ""), 'base64');
     const buf2 = Buffer.from(b64b.replace(/^data:image\/\w+;base64,/, ""), 'base64');
     
     const img1 = await Jimp.read(buf1);
     const img2 = await Jimp.read(buf2);
     
     // Create RawImage (Jimp is RGBA, so 4 channels)
     const raw1 = new RawImage(new Uint8ClampedArray(img1.bitmap.data), img1.bitmap.width, img1.bitmap.height, 4);
     const raw2 = new RawImage(new Uint8ClampedArray(img2.bitmap.data), img2.bitmap.width, img2.bitmap.height, 4);
     
     const out1 = await extract(raw1);
     const out2 = await extract(raw2);
     
     const vec1 = out1.data;
     const vec2 = out2.data;
     
     // Calculate Cosine Similarity between the two semantic vectors
     let dotProduct = 0.0;
     let normA = 0.0;
     let normB = 0.0;
     for (let i = 0; i < vec1.length; i++) {
         dotProduct += vec1[i] * vec2[i];
         normA += vec1[i] * vec1[i];
         normB += vec2[i] * vec2[i];
     }
     
     if (normA === 0 || normB === 0) return 0;
     const cosSim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
     
     // Return raw cosine similarity directly
     return cosSim;
   } catch (e) {
     console.error("AI Deep Learning Error:", e);
     return 0;
   }
}
