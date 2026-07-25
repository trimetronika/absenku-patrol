import React, { useState, useEffect } from "react";
import GuidedPatrolScanner from "./components/GuidedPatrolScanner";

export default function ComprehensiveQAPwaApp() {
  const [activeTab, setActiveTab] = useState("PATROL");
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [inScannerMode, setInScannerMode] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [currentGpsStatus, setCurrentGpsStatus] = useState("");
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };
  
  // Authentication State
  const [activeUser, setActiveUser] = useState(() => {
    const saved = localStorage.getItem("activeUser");
    return saved ? JSON.parse(saved) : null;
  });
  
  const [activityLogs, setActivityLogs] = useState([]);
  const [pendingSyncQueue, setPendingSyncQueue] = useState(() => {
    const saved = localStorage.getItem("pendingSyncQueue");
    return saved ? JSON.parse(saved) : [];
  });

  const [patrolPoints, setPatrolPoints] = useState(() => {
    const saved = localStorage.getItem("patrolPoints");
    return saved ? JSON.parse(saved) : [];
  });
  const [schedules, setSchedules] = useState(() => {
    const saved = localStorage.getItem("schedules");
    return saved ? JSON.parse(saved) : [];
  });
  const [sysConfig, setSysConfig] = useState({
    aiPassThreshold: 85.0,
    defaultGeofenceRadius: 15,
    qrExpirySeconds: 30
  });

  const loadSyncedData = async () => {
    try {
      // Refresh active user status to ensure they haven't been revoked by admin
      if (activeUser) {
         try {
           const usersRes = await fetch("/api/users");
           if (usersRes.ok) {
             const allUsers = await usersRes.json();
             const me = allUsers.find(u => u.id === activeUser.id);
             if (!me || me.status !== "ON_DUTY") {
               handleLogout(); // Auto logout if revoked
               return;
             }
           }
         } catch (e) {
           // ignore if offline
         }
      }
      
      const configRes = await fetch("/api/config");
      if (configRes.ok) {
         const cfg = await configRes.json();
         setSysConfig(cfg);
         localStorage.setItem("sysConfig", JSON.stringify(cfg));
      }
      
      const logsRes = await fetch("/api/logs");
      if (logsRes.ok) {
        const l = await logsRes.json();
        if (l.aiLogs) setActivityLogs(l.aiLogs);
      }

      const pointsRes = await fetch("/api/points");
      if (pointsRes.ok) {
        const pointsData = await pointsRes.json();
        if (pointsData && pointsData.length > 0) {
           setPatrolPoints(pointsData);
           localStorage.setItem("patrolPoints", JSON.stringify(pointsData));
        }
      }
      
      const schedulesRes = await fetch("/api/schedules");
      if (schedulesRes.ok) {
        const schedulesData = await schedulesRes.json();
        setSchedules(schedulesData);
        localStorage.setItem("schedules", JSON.stringify(schedulesData));
      }
    } catch (e) {
      console.error("Failed to sync with API:", e);
      if (patrolPoints.length === 0) {
        setPatrolPoints([{
          id: "pt-1784966748564", name: "Kamar Kos Bowo (Kos Kutisari)", building: "Gedung Kos Kutisari", floor: "Floor 1", room: "Kamar 102", latitude: -7.332106, longitude: 112.745033, geofence_radius_meters: 15
        }]);
      }
    }
  };

  useEffect(() => {
    loadSyncedData();
    const interval = setInterval(loadSyncedData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Background Sync Worker for Offline Queue
  useEffect(() => {
    const syncQueue = async () => {
      const savedQueue = localStorage.getItem("pendingSyncQueue");
      if (!savedQueue) return;
      const queue = JSON.parse(savedQueue);
      if (queue.length === 0) return;

      if (navigator.onLine) {
        console.log("Internet restored. Syncing offline queue...", queue.length);
        const remainingQueue = [];
        for (const item of queue) {
          try {
            const res = await fetch("/api/validate/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item.payload)
            });
            if (!res.ok) throw new Error("Sync failed");
            // Upload success, remove from queue
          } catch (err) {
            remainingQueue.push(item); // Keep in queue
          }
        }
        localStorage.setItem("pendingSyncQueue", JSON.stringify(remainingQueue));
        setPendingSyncQueue(remainingQueue);
      }
    };
    
    const syncInterval = setInterval(syncQueue, 15000);
    window.addEventListener("online", syncQueue);
    return () => {
      clearInterval(syncInterval);
      window.removeEventListener("online", syncQueue);
    };
  }, []);

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      showToast("You are currently offline. Please connect to internet to sync.");
      return;
    }
    
    const savedQueue = localStorage.getItem("pendingSyncQueue");
    if (!savedQueue) return showToast("Nothing to sync.");
    
    const queue = JSON.parse(savedQueue);
    if (queue.length === 0) return showToast("All caught up! No pending logs.");

    showToast(`Syncing ${queue.length} logs in background...`);
    
    const remainingQueue = [];
    for (const item of queue) {
      try {
        const res = await fetch("/api/validate/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload)
        });
        if (!res.ok) throw new Error("Sync failed");
      } catch (err) {
        remainingQueue.push(item);
      }
    }
    localStorage.setItem("pendingSyncQueue", JSON.stringify(remainingQueue));
    setPendingSyncQueue(remainingQueue);
    
    if (remainingQueue.length === 0) showToast("Sync Complete!");
    else showToast(`Sync finished, but ${remainingQueue.length} items failed.`);
    
    loadSyncedData(); // Refresh history
  };



  const isScheduleActive = (sched) => {
    if(!sched.startTime || !sched.endTime) return false;
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = sched.startTime.split(':').map(Number);
    const [endH, endM] = sched.endTime.split(':').map(Number);
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    if (start <= end) return current >= start && current <= end;
    return current >= start || current <= end; // crosses midnight
  };

  const activeSchedule = schedules.find(s => s.id === selectedScheduleId) || { id: "s1", name: "Unknown Schedule", startTime: "00:00", endTime: "23:59" };

  const handleValidationComplete = (result) => {
    setInScannerMode(false);
    setValidationResult(result);
  };

  const [loginInput, setLoginInput] = useState("");
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginInput.trim()) return;
    
    try {
      const userRes = await fetch("/api/users/login", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ identifier: loginInput })
      });
      
      const data = await userRes.json();
      
      if (userRes.ok && data.success) {
         setActiveUser(data.user);
         localStorage.setItem("activeUser", JSON.stringify(data.user));
      } else {
         alert(data.error || "Login Failed: Invalid credentials.");
      }
    } catch (err) {
      alert("Network Error: Cannot log in while offline. Please connect to the internet to authenticate.");
    }
  };

  const handleLogout = () => {
    setActiveUser(null);
    localStorage.removeItem("activeUser");
  };

  if (!activeUser) {
    return (
      <div style={styles.appContainer}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>
           <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🛡️</div>
           <h1 style={{ color: "#fff", margin: "0 0 8px 0" }}>Absenku Secure</h1>
           <p style={{ color: "#94a3b8", textAlign: "center", marginBottom: "32px" }}>Officer PWA Login</p>
           
           <form onSubmit={handleLogin} style={{ width: "100%", maxWidth: "300px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <input 
                type="text" 
                placeholder="Enter Officer ID or Phone" 
                value={loginInput}
                onChange={e => setLoginInput(e.target.value)}
                style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15, 23, 42, 0.8)", color: "#fff", fontSize: "1rem", outline: "none", boxSizing: "border-box" }}
              />
              <button type="submit" style={{ ...styles.scanFab, width: "100%" }}>Login</button>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      <header style={styles.header}>
        <div style={styles.brandBox}>
          <div style={styles.logoIcon}>🛡️</div>
          <div>
            <h1 style={styles.appName}>Absenku Secure</h1>
            <span style={styles.badge}>PRO PWA</span>
          </div>
        </div>
        <div style={styles.officerProfile}>
          <div style={styles.avatarMini}>{activeUser ? activeUser.name.substring(0,2).toUpperCase() : "JD"}</div>
        </div>
      </header>

      <main style={styles.mainContent}>
        {inScannerMode ? (
          <GuidedPatrolScanner activeSchedule={activeSchedule} patrolPoints={patrolPoints} sysConfig={sysConfig} activeUser={activeUser} onValidationComplete={handleValidationComplete} />
        ) : validationResult ? (
            <div style={styles.resultCard}>
              <div style={validationResult.isOfflineQueued ? styles.iconWarn : validationResult.success ? styles.iconPass : styles.iconFail}>
                {validationResult.isOfflineQueued ? "⏳" : validationResult.success ? "✓" : "✕"}
              </div>
              <h2 style={styles.resultTitle}>{validationResult.isOfflineQueued ? "Saved Offline" : validationResult.success ? "Patrol Verified" : "Patrol Rejected"}</h2>
              <p style={styles.resultSubtitle}>{validationResult.data?.summary?.checkpoint_id || "Checkpoint"}</p>

            <div style={styles.metricsGrid}>
               <div style={styles.metricItem}>
                 <span style={styles.metricLabel}>Location Lock</span>
                 <span style={validationResult.success ? styles.metricValPass : styles.metricValFail}>
                   {validationResult.success ? `Distance: ${validationResult.data?.summary?.gps_distance_meters || 0}m` : "OUT OF BOUNDS"}
                 </span>
               </div>
               <div style={styles.metricItem}>
                 <span style={styles.metricLabel}>AI Similarity</span>
                 <span style={validationResult.isOfflineQueued ? styles.metricValWarn : validationResult.success ? styles.metricValPass : styles.metricValFail}>
                   {validationResult.isOfflineQueued ? "PENDING" : `${validationResult.data?.summary?.ai_similarity_score || validationResult.score || 0}%`}
                 </span>
               </div>
            </div>

            {!validationResult.success && (
               <div style={styles.errorBox}>
                 {validationResult.data?.summary?.failure_reason || validationResult.error || "Unknown validation error."}
               </div>
            )}

            <button style={styles.primaryBtn} onClick={() => setValidationResult(null)}>Return to Dashboard</button>
          </div>
        ) : (
          <>
            {activeTab === "PATROL" && (
              <div style={styles.tabContent}>
                <div style={styles.statusBanner}>
                  <div style={styles.pulseDot}></div> Server Sync Active ({patrolPoints.length} points)
                </div>
                {pendingSyncQueue.length > 0 && (
                  <div style={{...styles.statusBanner, background: "rgba(234, 179, 8, 0.1)", color: "#eab308", border: "1px solid rgba(234, 179, 8, 0.2)"}}>
                    <div style={{...styles.pulseDot, background: "#eab308", boxShadow: "none", animation: "none"}}></div> Offline Mode: {pendingSyncQueue.length} Pending Syncs
                  </div>
                )}

                <div style={styles.heroCard}>
                  <h3 style={styles.heroTitle}>Select Schedule</h3>
                  <p style={styles.heroSub}>Choose your active patrol window.</p>
                </div>

                <div style={styles.listHeader}>
                  <h4>Available Schedules</h4>
                </div>
                
                <div style={styles.scrollList}>
                  {schedules.length === 0 && <p style={{color: "#94a3b8", textAlign: "center"}}>No schedules synced.</p>}
                  {schedules.map(sched => {
                    const active = isScheduleActive(sched);
                    const isSelected = selectedScheduleId === sched.id;
                    return (
                      <div key={sched.id} 
                           style={{
                             ...(active ? styles.card : {...styles.card, opacity: 0.5, filter: "grayscale(1)"}),
                             ...(isSelected ? { border: "2px solid #38bdf8", background: "rgba(56, 189, 248, 0.1)" } : {})
                           }} 
                           onClick={() => active ? setSelectedScheduleId(sched.id) : showToast("This schedule is not active right now.")}>
                        <div style={styles.cardLeft}>
                          <div style={styles.cardIcon}>{active ? "🕒" : "🔒"}</div>
                          <div>
                            <h4 style={styles.cardTitle}>{sched.name}</h4>
                            <p style={styles.cardSub}>{sched.startTime} - {sched.endTime}</p>
                          </div>
                        </div>
                        {active && <div style={{...styles.checkBadge, background: isSelected ? "#38bdf8" : "#4ade80", color: "#0f172a"}}>{isSelected ? "Selected" : "Active"}</div>}
                      </div>
                    );
                  })}
                </div>
                
                <div style={styles.floatingActionArea}>
                  <button 
                    style={selectedScheduleId ? styles.scanFab : {...styles.scanFab, opacity: 0.5, filter: "grayscale(1)", cursor: "not-allowed"}} 
                    onClick={() => {
                       if (selectedScheduleId) setInScannerMode(true);
                       else showToast("Please select a schedule first.");
                    }}>
                    Start Checkpoint &rarr;
                  </button>
                </div>
              </div>
            )}

            {activeTab === "HISTORY" && (
              <div style={styles.tabContent}>
                {!selectedLog ? (
                  <>
                    <h3 style={{ margin: "0 0 16px 0", color: "#f8fafc" }}>Recent Activity</h3>
                    {activityLogs.length === 0 && <p style={{ color: "#94a3b8" }}>No recent activity.</p>}
                    {activityLogs.map((log, idx) => {
                       const isSuccess = log.status === "VERIFIED" || log.status === "PASSED";
                       return (
                         <div key={idx} style={{...styles.card, cursor: "pointer"}} onClick={() => setSelectedLog(log)}>
                           <div style={styles.cardLeft}>
                              <div style={{...styles.cardIcon, background: isSuccess ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)", color: isSuccess ? "#22c55e" : "#ef4444"}}>
                                {isSuccess ? "✓" : "✕"}
                              </div>
                              <div>
                                <h4 style={styles.cardTitle}>{log.pointName || log.point}</h4>
                                <p style={styles.cardSub}>{new Date(log.timestamp).toLocaleString()} WIB</p>
                              </div>
                           </div>
                           <div style={{...styles.checkBadge, background: isSuccess ? "#38bdf8" : "#f87171"}}>{log.score || 0}%</div>
                         </div>
                       );
                    })}
                  </>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "slideInRight 0.3s ease-out" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                       <button onClick={() => setSelectedLog(null)} style={{ background: "none", border: "none", color: "#38bdf8", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", padding: 0 }}>
                         &larr; Back
                       </button>
                    </div>
                    
                    <div style={{...styles.card, flexDirection: "column", alignItems: "stretch", padding: "20px", gap: "16px"}}>
                       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <h3 style={{margin: 0, color: "#fff", fontSize: "1.2rem"}}>{selectedLog.pointName || selectedLog.point}</h3>
                            <p style={{margin: "4px 0 0 0", color: "#94a3b8", fontSize: "0.85rem"}}>{new Date(selectedLog.timestamp).toLocaleString()} WIB</p>
                          </div>
                          <div style={{
                             padding: "8px 12px", borderRadius: "8px", fontWeight: "bold",
                             background: (selectedLog.status === "VERIFIED" || selectedLog.status === "PASSED") ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                             color: (selectedLog.status === "VERIFIED" || selectedLog.status === "PASSED") ? "#22c55e" : "#ef4444"
                          }}>
                             {selectedLog.score || 0}% Match
                          </div>
                       </div>
                       
                       <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
                         <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.9rem", lineHeight: "1.5" }}>
                           <strong>Justification:</strong> {selectedLog.reason || "No details provided."}
                         </p>
                       </div>
                       
                       {selectedLog.photos && selectedLog.photos.length > 0 && (
                         <div>
                           <h4 style={{ margin: "0 0 8px 0", color: "#94a3b8", fontSize: "0.9rem" }}>Captured Evidence</h4>
                           <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px" }}>
                             {selectedLog.photos.map((p, idx) => (
                               <img key={idx} src={p} style={{ width: "120px", height: "160px", objectFit: "cover", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }} alt="evidence" />
                             ))}
                           </div>
                         </div>
                       )}

                       {(() => {
                          const target = patrolPoints.find(p => p.name === (selectedLog.pointName || selectedLog.point));
                          if (target && target.lat && target.lng) {
                             return (
                               <div style={{ marginTop: "8px" }}>
                                 <h4 style={{ margin: "0 0 8px 0", color: "#94a3b8", fontSize: "0.9rem" }}>Location Telemetry</h4>
                                 <div style={{ background: "#0f172a", borderRadius: "12px", padding: "16px", border: "1px solid rgba(56, 189, 248, 0.2)", display: "flex", flexDirection: "column", gap: "12px" }}>
                                    <div style={{ fontFamily: "monospace", color: "#38bdf8", fontSize: "0.85rem" }}>
                                      LAT: {target.lat.toFixed(6)}<br/>
                                      LNG: {target.lng.toFixed(6)}
                                    </div>
                                    <a href={`https://www.google.com/maps/search/?api=1&query=${target.lat},${target.lng}`} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", background: "#38bdf8", color: "#09090b", textDecoration: "none", padding: "10px", borderRadius: "8px", fontWeight: "bold" }}>
                                       🗺️ Open in Google Maps
                                    </a>
                                 </div>
                               </div>
                             );
                          }
                          return null;
                       })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "PROFILE" && (
              <div style={styles.tabContent}>
                <div style={styles.profileHero}>
                  <div style={styles.profileAvatarBig}>{activeUser ? activeUser.name.substring(0,2).toUpperCase() : "JD"}</div>
                  <h2 style={{ margin: 0, color: "#fff" }}>{activeUser?.name || "Officer"}</h2>
                  <p style={{ margin: 0, color: "#94a3b8" }}>{activeUser?.status === "ON_DUTY" ? "🟢 On Duty" : "⚪ Off Duty"} • ID {activeUser?.id || "N/A"}</p>
                  <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>{activeUser?.phone || ""} • {activeUser?.route || ""}</p>
                </div>
                <div style={styles.card}>
                   <h4 style={styles.cardTitle}>Device Telemetry</h4>
                   <p style={styles.cardSub}>Anti-Cheat: <strong>Enforced</strong></p>
                   <p style={styles.cardSub}>AI Threshold: <strong>{sysConfig.aiPassThreshold}%</strong></p>
                   <p style={styles.cardSub}>Geofence Radius: <strong>{sysConfig.defaultGeofenceRadius}m</strong></p>
                </div>
                
                <div style={{...styles.card, marginTop: "8px", flexDirection: "column", alignItems: "flex-start", gap: "12px"}}>
                   <div style={{display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center"}}>
                      <h4 style={styles.cardTitle}>Offline Sync Queue</h4>
                      <div style={{...styles.checkBadge, background: pendingSyncQueue.length > 0 ? "#eab308" : "#38bdf8", color: pendingSyncQueue.length > 0 ? "#fff" : "#0f172a"}}>{pendingSyncQueue.length} Pending</div>
                   </div>
                   <button onClick={handleManualSync} style={{...styles.actionBtnOutline, border: "1px solid rgba(56, 189, 248, 0.5)", background: "rgba(56, 189, 248, 0.15)"}}>
                     🔄 Sync Now
                   </button>
                </div>
                
                <button onClick={handleLogout} style={{ ...styles.actionBtnOutline, color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.3)", marginTop: "16px" }}>
                  Logout
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <nav style={styles.bottomNav}>
        <div style={activeTab === "PATROL" ? styles.navItemActive : styles.navItem} onClick={() => setActiveTab("PATROL")}>
          <div style={styles.navIcon}>🛡️</div><span>Patrol</span>
        </div>
        <div style={activeTab === "HISTORY" ? styles.navItemActive : styles.navItem} onClick={() => setActiveTab("HISTORY")}>
          <div style={styles.navIcon}>📋</div><span>History</span>
        </div>
        <div style={activeTab === "PROFILE" ? styles.navItemActive : styles.navItem} onClick={() => setActiveTab("PROFILE")}>
          <div style={styles.navIcon}>👤</div><span>Profile</span>
        </div>
      </nav>
    </div>
  );
}

const styles = {
  appContainer: { display: "flex", flexDirection: "column", height: "100vh", maxWidth: "480px", margin: "0 auto", background: "#020617", color: "#f8fafc", fontFamily: "'Inter', -apple-system, sans-serif" },
  header: { padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.05)", position: "sticky", top: 0, zIndex: 10 },
  brandBox: { display: "flex", alignItems: "center", gap: "12px" },
  logoIcon: { fontSize: "1.5rem", background: "linear-gradient(135deg, #0ea5e9, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  appName: { fontSize: "1.1rem", margin: 0, fontWeight: "800", color: "#fff", letterSpacing: "-0.5px" },
  badge: { fontSize: "0.6rem", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "2px 6px", borderRadius: "4px", fontWeight: "700", textTransform: "uppercase" },
  avatarMini: { width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: "bold", color: "#fff", boxShadow: "0 2px 10px rgba(59, 130, 246, 0.3)" },
  mainContent: { flex: 1, overflowY: "auto", padding: "16px", paddingBottom: "100px", position: "relative" },
  tabContent: { display: "flex", flexDirection: "column", gap: "16px", animation: "fadeIn 0.3s ease-out" },
  statusBanner: { background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.2)", padding: "10px 16px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#4ade80", fontWeight: "600" },
  pulseDot: { width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", animation: "pulseDot 1.5s infinite" },
  heroCard: { background: "linear-gradient(145deg, #1e293b 0%, #0f172a 100%)", borderRadius: "20px", padding: "24px", border: "1px solid rgba(255,255,255,0.05)", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" },
  heroTitle: { margin: "0 0 4px 0", fontSize: "1.4rem", fontWeight: "700", color: "#fff" },
  heroSub: { margin: 0, fontSize: "0.9rem", color: "#94a3b8", marginBottom: "20px" },
  actionBtnOutline: { width: "100%", background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)", color: "#38bdf8", padding: "12px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "0.2s" },
  gpsText: { fontSize: "0.75rem", color: "#4ade80", textAlign: "center", marginTop: "12px", fontWeight: "600" },
  listHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 0 0 0" },
  scrollList: { display: "flex", flexDirection: "column", gap: "12px" },
  card: { background: "rgba(30, 41, 59, 0.5)", border: "1px solid rgba(255,255,255,0.05)", padding: "16px", borderRadius: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "0.2s" },
  cardActive: { background: "rgba(15, 23, 42, 0.8)", border: "2px solid #38bdf8", padding: "15px", borderRadius: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", boxShadow: "0 0 20px rgba(56, 189, 248, 0.1)" },
  cardLeft: { display: "flex", gap: "12px", alignItems: "center" },
  cardIcon: { width: "40px", height: "40px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" },
  cardTitle: { margin: 0, fontSize: "0.95rem", fontWeight: "600", color: "#f8fafc" },
  cardSub: { margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" },
  checkBadge: { background: "#38bdf8", color: "#0f172a", fontSize: "0.75rem", fontWeight: "700", padding: "4px 10px", borderRadius: "8px" },
  floatingActionArea: { position: "fixed", bottom: "80px", left: 0, right: 0, display: "flex", justifyContent: "center", padding: "0 20px", pointerEvents: "none", zIndex: 20 },
  scanFab: { background: "linear-gradient(135deg, #0ea5e9, #2563eb)", color: "#fff", border: "none", padding: "16px 32px", borderRadius: "100px", fontSize: "1rem", fontWeight: "700", boxShadow: "0 10px 25px rgba(37, 99, 235, 0.4)", cursor: "pointer", pointerEvents: "auto", transition: "transform 0.2s" },
  
  resultCard: { background: "linear-gradient(145deg, #1e293b, #0f172a)", borderRadius: "24px", padding: "32px 24px", border: "1px solid rgba(255,255,255,0.05)", textAlign: "center", animation: "scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)" },
  iconPass: { width: "80px", height: "80px", borderRadius: "50%", background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", border: "2px solid rgba(34, 197, 94, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem", margin: "0 auto 20px auto" },
  iconFail: { width: "80px", height: "80px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "2px solid rgba(239, 68, 68, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem", margin: "0 auto 20px auto" },
  iconWarn: { width: "80px", height: "80px", borderRadius: "50%", background: "rgba(234, 179, 8, 0.15)", color: "#eab308", border: "2px solid rgba(234, 179, 8, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem", margin: "0 auto 20px auto" },
  resultTitle: { margin: "0 0 8px 0", fontSize: "1.6rem", color: "#fff" },
  resultSubtitle: { color: "#94a3b8", fontSize: "1rem", margin: "0 0 24px 0" },
  metricsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" },
  metricItem: { background: "rgba(0,0,0,0.2)", padding: "16px", borderRadius: "16px", display: "flex", flexDirection: "column", gap: "6px" },
  metricLabel: { fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" },
  metricValPass: { fontSize: "1.1rem", color: "#4ade80", fontWeight: "700" },
  metricValFail: { fontSize: "1.1rem", color: "#ef4444", fontWeight: "700" },
  metricValWarn: { fontSize: "1.1rem", color: "#eab308", fontWeight: "700" },
  errorBox: { background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#fca5a5", padding: "12px", borderRadius: "12px", fontSize: "0.85rem", marginBottom: "24px" },
  primaryBtn: { width: "100%", padding: "16px", background: "#334155", color: "#fff", border: "none", borderRadius: "16px", fontWeight: "600", fontSize: "1rem", cursor: "pointer" },

  profileHero: { textAlign: "center", padding: "32px 0", background: "radial-gradient(circle at top, rgba(56, 189, 248, 0.15) 0%, transparent 60%)" },
  profileAvatarBig: { width: "80px", height: "80px", borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", margin: "0 auto 16px auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", fontWeight: "bold", color: "#fff", boxShadow: "0 10px 30px rgba(59, 130, 246, 0.3)" },

  bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, height: "70px", background: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-around", alignItems: "center", zIndex: 10, paddingBottom: "env(safe-area-inset-bottom)" },
  navItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "0.7rem", cursor: "pointer", transition: "0.2s" },
  navItemActive: { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", color: "#38bdf8", fontSize: "0.7rem", fontWeight: "600", cursor: "pointer" },
  navIcon: { fontSize: "1.3rem", marginBottom: "2px" }
};

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    @keyframes pulseDot { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  `;
  document.head.appendChild(style);
}
