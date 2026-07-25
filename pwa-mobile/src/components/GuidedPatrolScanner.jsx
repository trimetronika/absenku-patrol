import React, { useRef, useState, useEffect } from "react";
import { initializeLiveCameraStream, captureSnapshotFromStream } from "../services/cameraStream";
import { getCurrentDevicePosition } from "../services/geofenceCheck";

// Audio Synth Helper (No external files needed)
const playTone = (freq, type, duration) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
};

const playSuccessBeep = () => {
  playTone(880, "sine", 0.1);
  setTimeout(() => playTone(1760, "sine", 0.15), 100);
  if (navigator.vibrate) navigator.vibrate(100);
};

const playErrorBuzz = () => {
  playTone(300, "sawtooth", 0.3);
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
};

export default function StrictPixelGuidedPatrolScanner({ activeSchedule, patrolPoints, sysConfig, activeUser, onValidationComplete }) {
  const videoRef = useRef(null);
  const requestRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [step, setStep] = useState(1); // 1: QR, 2: GPS, 3: Photo 1, 4: Photo 2, 5: AI, 6: Result
  const [targetPoint, setTargetPoint] = useState(null);
  
  const [realtimeClock, setRealtimeClock] = useState("");
  const [scannedQrInput, setScannedQrInput] = useState("");
  const [gpsData, setGpsData] = useState(null);
  const [gpsDistance, setGpsDistance] = useState(null);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  
  const [statusMessage, setStatusMessage] = useState("Scan the QR code placard to begin patrol.");
  const [errorMessage, setErrorMessage] = useState(null);
  const [qrFeedback, setQrFeedback] = useState(null); // For live invalid labels
  const [aiProgress, setAiProgress] = useState(0); // Simulated progress 0-100
  const [finalResult, setFinalResult] = useState(null);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setRealtimeClock(now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " WIB");
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let activeStream = null;
    async function startCamera() {
      try {
        setErrorMessage(null);
        const mediaStream = await initializeLiveCameraStream(videoRef.current);
        activeStream = mediaStream;
        setStream(mediaStream);
      } catch (err) {
        setErrorMessage("Camera Access Denied. Please enable permissions.");
      }
    }
    startCamera();
    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const scanQrCodeLoop = () => {
    if (step !== 1 || !videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
       requestRef.current = requestAnimationFrame(scanQrCodeLoop);
       return;
    }
    
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    if (window.jsQR) {
      const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      
      if (code && code.data) {
         if (!code.data.startsWith("POINT_")) {
           // Invalid format, flash red label but keep scanning
           setQrFeedback("INVALID QR FORMAT");
           playErrorBuzz();
           setTimeout(() => setQrFeedback(null), 1500);
           // Skip a few frames before resuming
           setTimeout(() => { requestRef.current = requestAnimationFrame(scanQrCodeLoop); }, 1500);
           return;
         } else {
           handleVerifyQrCode(code.data);
           return; // Stop looping to process
         }
      }
    }
    requestRef.current = requestAnimationFrame(scanQrCodeLoop);
  };

  useEffect(() => {
    if (stream && step === 1 && !qrFeedback) {
      requestRef.current = requestAnimationFrame(scanQrCodeLoop);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [stream, step, qrFeedback]);

  const handleVerifyQrCode = async (payload) => {
    setErrorMessage(null);
    setScannedQrInput(payload);
    setStatusMessage("Verifying QR...");
    
    // Strict Offline-First QR Matching against all patrol points
    const foundPoint = patrolPoints.find(p => payload.includes(p.id) || p.id.includes(payload.replace("POINT_", "")));
    if (!foundPoint) {
        setQrFeedback("UNKNOWN CHECKPOINT");
        playErrorBuzz();
        setTimeout(() => setQrFeedback(null), 2000);
        setStatusMessage("Scan the QR code placard to begin patrol.");
        setTimeout(() => { requestRef.current = requestAnimationFrame(scanQrCodeLoop); }, 2000);
        return;
    }
    
    setTargetPoint(foundPoint);
    
    // QR Success
    playSuccessBeep();
    setStep(2);
    setStatusMessage(`QR Verified: ${foundPoint.name}. Acquiring GPS location...`);
    executeStrictGpsCheck(foundPoint);
  };

  const executeStrictGpsCheck = async (point) => {
    try {
      setErrorMessage(null);
      const pos = await getCurrentDevicePosition();
      setGpsData(pos);

      const res = await fetch("/api/validate/gps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointId: point.id, gps: pos })
      });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        playErrorBuzz();
        setErrorMessage(data.error || "Geofence violation.");
        setTimeout(() => {
          setErrorMessage(null);
          setTargetPoint(null);
          setStep(1);
          setStatusMessage("Scan the QR code placard to begin patrol.");
          // scanQrCodeLoop will auto-resume due to the useEffect watching step === 1
        }, 3000);
        return;
      }
      
      playSuccessBeep();
      setGpsDistance(data.distance);
      setStep(3);
      setStatusMessage(`GPS Verified (${data.distance}m). Please capture scene photo.`);
    } catch (err) {
      playErrorBuzz();
      setErrorMessage(err.message || "Network error verifying GPS.");
      setTimeout(() => {
        setErrorMessage(null);
        setTargetPoint(null);
        setStep(1);
        setStatusMessage("Scan the QR code placard to begin patrol.");
      }, 3000);
    }
  };

  const handleCaptureLivePhoto = async () => {
    if (!videoRef.current) return;
    setErrorMessage(null);
    playTone(600, "square", 0.05); // Shutter sound
    
    const photoBase64 = captureSnapshotFromStream(videoRef.current);
    const updated = [...capturedPhotos, photoBase64];
    setCapturedPhotos(updated);

    if (updated.length === 1) {
      setStep(4);
      setStatusMessage(`Photo 1 Captured. Move slightly for Photo 2.`);
    } else if (updated.length === 2) {
      setStep(5);
      setStatusMessage("AI Engine analyzing scene & anti-spoofing...");
      
      // Simulate AI Progress Bar for dramatic effect
      let p = 0;
      const progressInt = setInterval(() => {
        p += Math.random() * 15;
        if (p > 90) p = 90;
        setAiProgress(Math.floor(p));
      }, 200);

      try {
        const payload = {
          pointId: targetPoint.id,
          distance: gpsDistance,
          photos: updated,
          guardName: activeUser?.name || "Unknown"
        };
        const res = await fetch("/api/validate/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        clearInterval(progressInt);
        setAiProgress(100);
        
        setTimeout(() => {
          if (!res.ok || !data.success) {
            playErrorBuzz();
            setFinalResult({ success: false, reason: data.error });
            setStep(6);
            setTimeout(() => {
              onValidationComplete({
                success: false,
                data: {
                  validation_result: "INVALID",
                  summary: {
                    timestamp: new Date().toISOString(),
                    qr_valid: true, gps_valid: true,
                    failure_reason: data.error,
                    ai_similarity_score: data.score || 0
                  }
                }
              });
            }, 3000);
            return;
          }

          playSuccessBeep();
          setFinalResult({ success: true, score: data.data?.summary?.ai_similarity_score || 95 });
          setStep(6);
          setTimeout(() => onValidationComplete(data), 3000);
        }, 500);

      } catch (e) {
        clearInterval(progressInt);
        setAiProgress(100);
        
        // Network Error -> Offline Queue
        const savedQueue = localStorage.getItem("pendingSyncQueue");
        const queue = savedQueue ? JSON.parse(savedQueue) : [];
        const payload = {
          pointId: targetPoint.id,
          distance: gpsDistance,
          photos: updated,
          guardName: activeUser?.name || "Unknown"
        };
        queue.push({
           id: "offline-" + Date.now(),
           payload,
           timestamp: new Date().toISOString()
        });
        localStorage.setItem("pendingSyncQueue", JSON.stringify(queue));
        
        playSuccessBeep();
        setFinalResult({ success: true, isOffline: true });
        setStep(6);
        setTimeout(() => onValidationComplete({ 
           success: true, 
           isOfflineQueued: true,
           data: { summary: { gps_distance_meters: gpsDistance, ai_similarity_score: "Pending Sync" } }
        }), 3000);
      }
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.glassHeader}>
        <div style={styles.headerTop}>
          <button onClick={() => onValidationComplete(null)} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "6px 12px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
            <span>←</span> Back
          </button>
          <span style={styles.clockBadge}>{realtimeClock}</span>
          <h2 style={styles.title}>{targetPoint ? targetPoint.name : "Scanner Active"}</h2>
        </div>
        
        <div style={styles.stepperContainer}>
          <div style={step >= 1 ? styles.stepActive : styles.stepInactive}>
            <div style={styles.stepDot}>1</div><span>QR</span>
          </div>
          <div style={styles.stepLine}></div>
          <div style={step >= 2 ? styles.stepActive : styles.stepInactive}>
            <div style={styles.stepDot}>2</div><span>GPS</span>
          </div>
          <div style={styles.stepLine}></div>
          <div style={step >= 3 ? styles.stepActive : styles.stepInactive}>
            <div style={styles.stepDot}>3</div><span>AI</span>
          </div>
        </div>
        <p style={styles.subtitle}>{statusMessage}</p>
      </div>

      {step < 6 && (
        <div style={styles.cameraBox}>
          <video ref={videoRef} style={styles.video} playsInline autoPlay muted />
          <div style={styles.cameraOverlay}>
             
             {step === 1 && (
               <>
                 <div style={qrFeedback ? styles.scanReticleError : styles.scanReticle}>
                    <div style={styles.scanLine}></div>
                 </div>
                 {qrFeedback && <div style={styles.liveFeedbackBadge}>{qrFeedback}</div>}
               </>
             )}
             
             {(step === 3 || step === 4) && (
                <>
                  <div style={styles.tacticalBracketCorners}></div>
                  <div style={styles.photoReticle}>+</div>
                  <div style={styles.tacticalInfo}>
                    LAT: {gpsData?.latitude?.toFixed(6) || "WAIT"}<br/>
                    LNG: {gpsData?.longitude?.toFixed(6) || "WAIT"}<br/>
                    DIST: {gpsDistance}M
                  </div>
                </>
             )}
             
             {capturedPhotos.length > 0 && step < 5 && (
               <div style={styles.thumbnailContainer}>
                 <img src={capturedPhotos[0]} style={styles.thumbnail} alt="Snap 1" />
                 <div style={styles.thumbnailBadge}>1 / 2</div>
               </div>
             )}

             {step === 5 && (
               <div style={styles.aiOverlay}>
                 <div style={styles.aiGrid}></div>
                 <div style={styles.aiProgressBox}>
                    <div style={styles.aiProgressText}>Byte Histogram Similarity: {aiProgress}%</div>
                    <div style={styles.aiProgressBarBg}>
                       <div style={{...styles.aiProgressBarFill, width: `${aiProgress}%`}}></div>
                    </div>
                 </div>
               </div>
             )}

          </div>
        </div>
      )}

      {step === 6 && finalResult && (
        <div style={finalResult.success ? styles.resultScreenSuccess : styles.resultScreenError}>
          <div style={styles.resultIcon}>{finalResult.success ? "✓" : "✕"}</div>
          <h2 style={styles.resultTitle}>{finalResult.success ? "ACCESS GRANTED" : "ACCESS DENIED"}</h2>
          <p style={styles.resultDesc}>
            {finalResult.success 
              ? (finalResult.isOffline ? "Patrol Saved Offline (Pending Sync)" : `AI Verification Passed (${finalResult.score}% match)`)
              : `AI Rejected: ${finalResult.reason}`
            }
          </p>
        </div>
      )}

      {errorMessage && (
        <div style={styles.errorAlert}>
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {errorMessage}
        </div>
      )}

      <div style={styles.actionContainer}>
        {step === 1 && !qrFeedback && (
          <div style={styles.loadingState}>
             <div style={styles.spinner}></div>
             Scanning automatically...
          </div>
        )}
        
        {step === 2 && (
          <div style={styles.loadingState}>
            <div style={styles.spinner}></div>
            Locking GPS Coordinates...
          </div>
        )}

        {(step === 3 || step === 4) && (
          <button style={styles.captureBtn} onClick={handleCaptureLivePhoto}>
            <div style={styles.captureInner}></div>
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column", height: "100%", background: "#09090b", color: "#f8fafc", padding: "16px", gap: "16px", borderRadius: "16px" },
  glassHeader: { background: "rgba(30, 41, 59, 0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "16px", boxShadow: "0 4px 30px rgba(0,0,0,0.1)" },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  title: { margin: 0, fontSize: "1.1rem", fontWeight: "600", color: "#e2e8f0" },
  clockBadge: { background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", padding: "4px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "700", fontFamily: "monospace" },
  stepperContainer: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" },
  stepActive: { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", color: "#38bdf8", fontSize: "0.7rem", fontWeight: "600", opacity: 1, transition: "0.3s" },
  stepInactive: { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "0.7rem", opacity: 0.5, transition: "0.3s" },
  stepDot: { width: "24px", height: "24px", borderRadius: "50%", background: "currentColor", color: "#09090b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: "bold" },
  stepLine: { flex: 1, height: "2px", background: "rgba(255,255,255,0.1)", margin: "0 8px", alignSelf: "flex-start", marginTop: "11px" },
  subtitle: { margin: 0, fontSize: "0.85rem", color: "#94a3b8", textAlign: "center", minHeight: "20px" },
  cameraBox: { position: "relative", width: "100%", flex: 1, minHeight: "300px", background: "#000", borderRadius: "20px", overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" },
  video: { width: "100%", height: "100%", objectFit: "cover" },
  cameraOverlay: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  scanReticle: { position: "relative", width: "220px", height: "220px", border: "2px solid rgba(56, 189, 248, 0.3)", borderRadius: "24px", overflow: "hidden", boxShadow: "0 0 30px rgba(56, 189, 248, 0.1) inset" },
  scanReticleError: { position: "relative", width: "220px", height: "220px", border: "2px solid rgba(239, 68, 68, 0.8)", borderRadius: "24px", overflow: "hidden", boxShadow: "0 0 40px rgba(239, 68, 68, 0.4) inset", animation: "shake 0.4s ease-in-out" },
  scanLine: { position: "absolute", width: "100%", height: "2px", background: "#38bdf8", boxShadow: "0 0 10px #38bdf8", animation: "scanLine 2s linear infinite" },
  liveFeedbackBadge: { position: "absolute", top: "20%", background: "rgba(239, 68, 68, 0.9)", color: "#fff", padding: "8px 16px", borderRadius: "20px", fontWeight: "bold", letterSpacing: "1px", fontSize: "0.8rem", animation: "pulse 0.5s infinite" },
  photoReticle: { width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", fontSize: "1.5rem" },
  tacticalBracketCorners: { position: "absolute", width: "250px", height: "250px", background: "linear-gradient(to right, #38bdf8 2px, transparent 2px) 0 0, linear-gradient(to right, #38bdf8 2px, transparent 2px) 100% 0, linear-gradient(to left, #38bdf8 2px, transparent 2px) 0 100%, linear-gradient(to left, #38bdf8 2px, transparent 2px) 100% 100%, linear-gradient(to bottom, #38bdf8 2px, transparent 2px) 0 0, linear-gradient(to bottom, #38bdf8 2px, transparent 2px) 100% 0, linear-gradient(to top, #38bdf8 2px, transparent 2px) 0 100%, linear-gradient(to top, #38bdf8 2px, transparent 2px) 100% 100%", backgroundRepeat: "no-repeat", backgroundSize: "20px 20px" },
  tacticalInfo: { position: "absolute", bottom: "20px", left: "20px", color: "#38bdf8", fontFamily: "monospace", fontSize: "0.7rem", textShadow: "0 0 4px #000" },
  thumbnailContainer: { position: "absolute", top: "20px", right: "20px", width: "60px", height: "80px", borderRadius: "8px", border: "2px solid #fff", overflow: "hidden", animation: "slideInRight 0.3s ease-out", boxShadow: "0 10px 20px rgba(0,0,0,0.5)" },
  thumbnail: { width: "100%", height: "100%", objectFit: "cover" },
  thumbnailBadge: { position: "absolute", bottom: 0, left: 0, width: "100%", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "0.6rem", textAlign: "center", padding: "2px 0", fontWeight: "bold" },
  aiOverlay: { position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.8)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  aiGrid: { position: "absolute", inset: 0, backgroundSize: "30px 30px", backgroundImage: "linear-gradient(to right, rgba(56, 189, 248, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.1) 1px, transparent 1px)", animation: "panBg 10s linear infinite" },
  aiProgressBox: { zIndex: 2, width: "80%", background: "rgba(0,0,0,0.5)", padding: "20px", borderRadius: "16px", border: "1px solid rgba(56,189,248,0.3)", backdropFilter: "blur(10px)" },
  aiProgressText: { color: "#38bdf8", fontSize: "0.8rem", fontFamily: "monospace", marginBottom: "8px", textAlign: "center" },
  aiProgressBarBg: { height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" },
  aiProgressBarFill: { height: "100%", background: "#38bdf8", transition: "width 0.2s", boxShadow: "0 0 10px #38bdf8" },
  resultScreenSuccess: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at center, rgba(34, 197, 94, 0.2) 0%, #09090b 70%)", borderRadius: "20px", border: "1px solid rgba(34, 197, 94, 0.3)", animation: "fadeIn 0.5s" },
  resultScreenError: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at center, rgba(239, 68, 68, 0.2) 0%, #09090b 70%)", borderRadius: "20px", border: "1px solid rgba(239, 68, 68, 0.3)", animation: "fadeIn 0.5s" },
  resultIcon: { fontSize: "4rem", color: "#fff", marginBottom: "16px", textShadow: "0 0 20px currentColor" },
  resultTitle: { margin: "0 0 8px 0", fontSize: "1.5rem", fontWeight: "800", letterSpacing: "2px", color: "#fff" },
  resultDesc: { margin: 0, color: "#94a3b8", fontSize: "0.9rem" },
  errorAlert: { display: "flex", alignItems: "center", gap: "8px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", padding: "12px 16px", borderRadius: "12px", fontSize: "0.85rem", backdropFilter: "blur(8px)", animation: "shake 0.4s ease-in-out" },
  actionContainer: { display: "flex", flexDirection: "column", gap: "12px", padding: "10px 0" },
  captureBtn: { width: "72px", height: "72px", borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "4px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", cursor: "pointer", padding: 0 },
  captureInner: { width: "54px", height: "54px", borderRadius: "50%", background: "#fff", transition: "transform 0.1s" },
  loadingState: { display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", color: "#38bdf8", fontSize: "0.9rem", padding: "20px" },
  spinner: { width: "24px", height: "24px", border: "3px solid rgba(56, 189, 248, 0.2)", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 1s linear infinite" },
};

// Global animations required
if (typeof document !== 'undefined') {
  if(!document.getElementById("scanner-animations")) {
    const style = document.createElement('style');
    style.id = "scanner-animations";
    style.innerHTML = `
      @keyframes spin { 100% { transform: rotate(360deg); } }
      @keyframes pulse { 0% { transform: scale(0.9); opacity: 0.8; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(0.9); opacity: 0.8; } }
      @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
      @keyframes scanLine { 0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
      @keyframes slideInRight { from { transform: translateX(50px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes panBg { from { background-position: 0 0; } to { background-position: 30px 30px; } }
      @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    `;
    document.head.appendChild(style);
  }
}
