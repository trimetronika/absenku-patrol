"use client";
import React, { useState, useEffect } from "react";
import GoogleMapPicker from "../components/GoogleMapPicker";

export default function PremiumAdminDashboard() {
  const [activeTab, setActiveTab] = useState("DASHBOARD");

  // State
  const [sysConfig, setSysConfig] = useState({ aiPassThreshold: 85.0, defaultGeofenceRadius: 15 });
  const [patrolPoints, setPatrolPoints] = useState([]);
  const [aiLogs, setAiLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [guards, setGuards] = useState([]);
  const [schedules, setSchedules] = useState([]);
  
  // New Point Form State
  const [newPoint, setNewPoint] = useState({ name: "", building: "", room: "", latitude: -6.2088, longitude: 106.845, geofence_radius_meters: 15, refImages: [] });

  // New Guard Form State
  const [newGuard, setNewGuard] = useState({ name: "", phone: "", route: "", status: "ON_DUTY", role: "Petugas Keamanan" });

  // New Schedule State
  const [newSchedule, setNewSchedule] = useState({ id: null, name: "", startTime: "08:00", endTime: "12:00" });
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeQr, setActiveQr] = useState(null);
  const [activePointView, setActivePointView] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const configRes = await fetch('/api/config');
        if (configRes.ok) setSysConfig(await configRes.json());
        
        const pointsRes = await fetch('/api/points');
        if (pointsRes.ok) setPatrolPoints(await pointsRes.json());
        
        const logsRes = await fetch('/api/logs');
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setAiLogs(logsData.aiLogs || []);
          setAuditLogs(logsData.auditLogs || []);
          setHistoryLogs(logsData.historyLogs || []);
        }

        const usersRes = await fetch('/api/users');
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setGuards(usersData.users || []);
        }

        const schedulesRes = await fetch('/api/schedules');
        if (schedulesRes.ok) {
          setSchedules(await schedulesRes.json());
        }
      } catch (err) { console.error(err); }
    };
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);
  const handleAddSchedule = async (e) => {
    e.preventDefault();
    if (!newSchedule.name || !newSchedule.startTime || !newSchedule.endTime) return showToast("Fill all schedule fields");
    
    const res = await fetch('/api/schedules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSchedule)
    });
    
    if (res.ok) {
      const { schedule } = await res.json();
      setSchedules([...schedules, schedule]);
      setNewSchedule({ name: "", startTime: "08:00", endTime: "12:00" });
    } else {
      showToast("Failed to add schedule");
    }
  };

  const handleDeleteSchedule = async (id) => {
    if(!confirm("Delete this schedule?")) return;
    const res = await fetch(`/api/schedules?id=${id}`, { method: 'DELETE' });
    if(res.ok) {
        setSchedules(schedules.filter(s => s.id !== id));
        showToast("Schedule deleted successfully");
    }
  };

  return (
    <div style={styles.container}>
      {/* SIDEBAR */}
      <aside style={{ ...styles.sidebar, width: isSidebarOpen ? "260px" : "80px" }}>
        <div style={styles.sidebarHeader}>
          {isSidebarOpen ? (
             <div style={styles.brandBox}>
                <div style={styles.brandLogo}>A</div>
                <h2 style={styles.brandName}>Absenku AI</h2>
             </div>
          ) : (
             <div style={styles.brandLogo}>A</div>
          )}
        </div>
        
        <nav style={styles.navMenu}>
           <NavItem icon="📊" label="Dashboard" active={activeTab==="DASHBOARD"} onClick={() => setActiveTab("DASHBOARD")} expanded={isSidebarOpen} />
           <NavItem icon="🕒" label="Schedules" active={activeTab==="SCHEDULES"} onClick={() => setActiveTab("SCHEDULES")} expanded={isSidebarOpen} />
           <NavItem icon="📍" label="Patrol Points" active={activeTab==="POINTS"} onClick={() => setActiveTab("POINTS")} expanded={isSidebarOpen} />
           <NavItem icon="👥" label="Officers" active={activeTab==="OFFICERS"} onClick={() => setActiveTab("OFFICERS")} expanded={isSidebarOpen} />
           <NavItem icon="🤖" label="AI Logs" active={activeTab==="AILOGS"} onClick={() => setActiveTab("AILOGS")} expanded={isSidebarOpen} />
           <NavItem icon="🛡️" label="Audit Trail" active={activeTab==="AUDIT"} onClick={() => setActiveTab("AUDIT")} expanded={isSidebarOpen} />
           <NavItem icon="⚙️" label="Settings" active={activeTab==="SETTINGS"} onClick={() => setActiveTab("SETTINGS")} expanded={isSidebarOpen} />
        </nav>
      </aside>

      {/* MAIN LAYOUT */}
      <main style={styles.mainContent}>
        <header style={styles.topbar}>
           <button style={styles.toggleBtn} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
           <div style={styles.topbarRight}>
              <div style={styles.adminAvatar}>SA</div>
              <span style={{fontWeight:600}}>Super Admin</span>
           </div>
        </header>

        <div style={styles.contentArea}>
           {activeTab === "DASHBOARD" && (
             <div className="fade-in">
                <h1 style={styles.pageTitle}>System Overview</h1>
                <p style={styles.pageSubtitle}>Real-time telemetry and validation statistics.</p>
                
                <div style={styles.statsGrid}>
                   <StatCard title="Active Points" value={patrolPoints.length} icon="📍" color="#3b82f6" />
                   <StatCard title="Total Patrols" value={historyLogs.length} icon="📋" color="#8b5cf6" />
                   <StatCard title="AI Blocks" value={aiLogs.filter(l => l.status === "REJECTED").length} icon="🛑" color="#ef4444" />
                   <StatCard title="Security Level" value="MAX" icon="🔒" color="#22c55e" />
                </div>

                <div style={styles.dashboardGrid}>
                   <div style={styles.panelCard}>
                      <h3 style={styles.panelTitle}>Recent Patrol Activity</h3>
                      {historyLogs.slice(0, 5).map((log, i) => (
                         <div key={i} style={styles.activityRow}>
                            <div style={styles.activityDot}></div>
                            <div style={styles.activityDetails}>
                               <strong>{log.pointName}</strong>
                               <span>{new Date(log.timestamp).toLocaleTimeString()} • {log.guard}</span>
                            </div>
                         </div>
                      ))}
                      {historyLogs.length === 0 && <p style={{color:"#64748b"}}>No activity yet.</p>}
                   </div>
                </div>
             </div>
           )}

           {activeTab === "SCHEDULES" && (
             <div className="fade-in">
               <h1 style={styles.pageTitle}>Master Schedules</h1>
               <p style={styles.pageSubtitle}>Define patrol time windows for officers.</p>
               
               <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px" }}>
                 <div style={styles.panelCard}>
                   <h3 style={styles.panelTitle}>Add New Schedule</h3>
                   <form onSubmit={handleAddSchedule} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                     <div>
                       <label style={styles.label}>Schedule Name</label>
                       <input type="text" value={newSchedule.name} onChange={e => setNewSchedule({...newSchedule, name: e.target.value})} style={styles.input} placeholder="e.g. Malam" required />
                     </div>
                     <div style={{ display: "flex", gap: "16px" }}>
                       <div style={{flex:1}}>
                         <label style={styles.label}>Start Time</label>
                         <input type="time" value={newSchedule.startTime} onChange={e => setNewSchedule({...newSchedule, startTime: e.target.value})} style={styles.input} required />
                       </div>
                       <div style={{flex:1}}>
                         <label style={styles.label}>End Time</label>
                         <input type="time" value={newSchedule.endTime} onChange={e => setNewSchedule({...newSchedule, endTime: e.target.value})} style={styles.input} required />
                       </div>
                     </div>
                     <button type="submit" style={styles.primaryBtn}>Save Schedule</button>
                   </form>
                 </div>
                 
                 <div style={styles.panelCard}>
                   <h3 style={styles.panelTitle}>Active Schedules</h3>
                   <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                     {schedules.map(sched => (
                       <div key={sched.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
                         <div>
                           <h4 style={{ margin: 0, color: "#f8fafc", fontSize: "1rem" }}>{sched.name}</h4>
                           <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "0.85rem" }}>
                             {sched.startTime} - {sched.endTime}
                           </p>
                         </div>
                         <button onClick={() => handleDeleteSchedule(sched.id)} style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "none", padding: "8px 12px", borderRadius: "8px", cursor: "pointer" }}>Delete</button>
                       </div>
                     ))}
                     {schedules.length === 0 && <p style={{color: "#64748b"}}>No schedules configured.</p>}
                   </div>
                 </div>
               </div>
             </div>
           )}

           {activeTab === "AILOGS" && (
             <div className="fade-in">
               <h1 style={styles.pageTitle}>AI Engine Validation Logs</h1>
               <p style={styles.pageSubtitle}>Deep analysis results for image structural similarity checks.</p>
               
               <div style={styles.panelCard}>
                 <table style={styles.table}>
                   <thead>
                     <tr>
                       <th style={styles.th}>Timestamp</th>
                       <th style={styles.th}>Officer</th>
                       <th style={styles.th}>Checkpoint</th>
                       <th style={styles.th}>Match Score</th>
                       <th style={styles.th}>Photos</th>
                       <th style={styles.th}>Justification</th>
                       <th style={styles.th}>Status</th>
                     </tr>
                   </thead>
                   <tbody>
                     {aiLogs.map(log => (
                       <tr key={log.id} style={styles.tr}>
                         <td style={styles.td}>{new Date(log.timestamp).toLocaleString()}</td>
                         <td style={styles.td}><strong>{log.guardName}</strong></td>
                         <td style={styles.td}>{log.pointName}</td>
                         <td style={styles.td}>
                           <span style={{ fontWeight:"bold", color: log.status === "VERIFIED" ? "#22c55e" : "#ef4444" }}>{log.score}%</span>
                         </td>
                         <td style={styles.td}>
                           {log.photos && log.photos.length > 0 ? (
                             <div style={{ display: "flex", gap: "4px" }}>
                               {log.photos.map((p, i) => <img key={i} src={p} alt="cap" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }} />)}
                             </div>
                           ) : "-"}
                         </td>
                         <td style={styles.td}><small style={{color:"#94a3b8"}}>{log.reason}</small></td>
                         <td style={styles.td}>
                           <span style={log.status === "VERIFIED" ? styles.badgePass : styles.badgeFail}>{log.status}</span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
           )}

           {activeTab === "SETTINGS" && (
             <div className="fade-in">
               <h1 style={styles.pageTitle}>Engine Configuration</h1>
               <p style={styles.pageSubtitle}>Adjust core parameters for AI and GPS validation engines.</p>
               
               <div style={{...styles.panelCard, maxWidth: "600px"}}>
                  <div style={styles.formGroup}>
                     <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                       <label style={styles.label}>AI Validation Threshold (%)</label>
                       {sysConfig._saved === 'ai' && <span style={{fontSize: "0.75rem", color: "#4ade80", transition: "opacity 0.3s"}}>✓ Auto-saved</span>}
                     </div>
                     <p style={styles.helpText}>Minimum visual structural similarity required to pass the AI check.</p>
                     <input type="number" style={styles.input} value={sysConfig.aiPassThreshold} 
                       onChange={async (e) => {
                         const up = {...sysConfig, aiPassThreshold: parseFloat(e.target.value)};
                         setSysConfig(up);
                         await fetch('/api/config', { method: 'POST', body: JSON.stringify(up) });
                         setSysConfig({...up, _saved: 'ai'});
                         setTimeout(() => setSysConfig(prev => ({...prev, _saved: null})), 2000);
                       }} 
                     />
                  </div>
               </div>
             </div>
           )}

           {activeTab === "POINTS" && (
             <div className="fade-in">
                <h1 style={styles.pageTitle}>Patrol Checkpoints</h1>
                <p style={styles.pageSubtitle}>Manage the physical locations that guards must verify.</p>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                  {/* Form */}
                  <div style={styles.panelCard}>
                    <h3 style={styles.panelTitle}>Add New Checkpoint</h3>
                    <div style={styles.formGroup}>
                       <label style={styles.label}>Point Name</label>
                       <input style={styles.input} type="text" placeholder="e.g. Server Room Entrance" value={newPoint.name} onChange={e => setNewPoint({...newPoint, name: e.target.value})} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                       <div>
                          <label style={styles.label}>Building</label>
                          <input style={styles.input} type="text" placeholder="Tower A" value={newPoint.building} onChange={e => setNewPoint({...newPoint, building: e.target.value})} />
                       </div>
                       <div>
                          <label style={styles.label}>Room / Area</label>
                          <input style={styles.input} type="text" placeholder="Floor 2" value={newPoint.room} onChange={e => setNewPoint({...newPoint, room: e.target.value})} />
                       </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                       <div>
                          <label style={styles.label}>Geofence Radius (meters)</label>
                          <input style={styles.input} type="number" min="5" value={newPoint.geofence_radius_meters} onChange={e => setNewPoint({...newPoint, geofence_radius_meters: parseInt(e.target.value)})} />
                       </div>
                       <div>
                          <label style={styles.label}>Upload AI Reference Photos (Multiple)</label>
                          <input style={{...styles.input, padding: "10px"}} type="file" accept="image/*" multiple onChange={(e) => {
                             const files = Array.from(e.target.files);
                             if(files.length > 0) {
                               Promise.all(files.map(file => new Promise(resolve => {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => resolve(ev.target.result);
                                  reader.readAsDataURL(file);
                               }))).then(results => {
                                  setNewPoint({...newPoint, refImages: results});
                               });
                             }
                          }} />
                          {newPoint.refImages && newPoint.refImages.length > 0 && <div style={{marginTop: "8px", fontSize: "0.8rem", color: "#4ade80"}}>{newPoint.refImages.length} photo(s) selected</div>}
                       </div>
                    </div>
                    
                    <div style={{ marginBottom: "16px" }}>
                       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <label style={styles.label}>Pin Location on Map</label>
                          <button style={{...styles.actionBtnOutline, padding: "6px 12px", fontSize: "0.8rem", width: "auto"}} onClick={() => {
                             if(navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition(pos => {
                                   setNewPoint({...newPoint, latitude: pos.coords.latitude, longitude: pos.coords.longitude});
                                });
                             }
                          }}>📍 Get Current Location</button>
                       </div>
                       <GoogleMapPicker 
                          apiKey={sysConfig.googleMapsApiKey} 
                          initialLat={newPoint.latitude} 
                          initialLng={newPoint.longitude} 
                          radius={newPoint.geofence_radius_meters}
                          onLocationSelect={(lat, lng) => setNewPoint({...newPoint, latitude: lat, longitude: lng})}
                       />
                       <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                         <input style={{...styles.input, fontSize: "0.8rem"}} type="text" readOnly value={`Lat: ${newPoint.latitude}`} />
                         <input style={{...styles.input, fontSize: "0.8rem"}} type="text" readOnly value={`Lng: ${newPoint.longitude}`} />
                       </div>
                    </div>

                    <div style={{ display: "flex", gap: "12px" }}>
                      <button style={styles.primaryBtn} onClick={async () => {
                        if(!newPoint.name || !newPoint.latitude || !newPoint.longitude) return showToast("Missing required fields.");
                        const payload = {
                          id: newPoint.id || `pt-${Date.now()}`, name: newPoint.name, building: newPoint.building, room: newPoint.room, 
                          latitude: parseFloat(newPoint.latitude), longitude: parseFloat(newPoint.longitude),
                          lat: parseFloat(newPoint.latitude), lng: parseFloat(newPoint.longitude),
                          geofence_radius_meters: newPoint.geofence_radius_meters || 15,
                          refImages: newPoint.refImages
                        };
                        const res = await fetch('/api/points', { method: 'POST', body: JSON.stringify(payload) });
                        if(res.ok) {
                          const data = await res.json();
                          setPatrolPoints(data.points);
                          setNewPoint({ id: null, name: "", building: "", room: "", latitude: -6.2088, longitude: 106.845, geofence_radius_meters: 15, refImages: [] });
                          showToast("Point saved successfully");
                        }
                      }}>{newPoint.id ? "💾 Update Point" : "+ Save Point"}</button>
                      
                      {newPoint.id && (
                         <button style={{...styles.actionBtnOutline, width: "auto", border: "1px solid rgba(239, 68, 68, 0.5)", color: "#ef4444"}} onClick={() => setNewPoint({ id: null, name: "", building: "", room: "", latitude: -6.2088, longitude: 106.845, geofence_radius_meters: 15, refImages: [] })}>
                           Cancel Edit
                         </button>
                      )}
                    </div>
                  </div>

                  {/* List */}
                  <div style={styles.panelCard}>
                    <h3 style={styles.panelTitle}>Registered Locations</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "600px", overflowY: "auto" }}>
                       {patrolPoints.map(pt => (
                         <div key={pt.id} style={{ background: "rgba(0,0,0,0.3)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                           <div>
                             <h4 style={{ margin: "0 0 4px 0", color: "#38bdf8" }}>{pt.name}</h4>
                             <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>{pt.building} • {pt.room}</p>
                             <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", color: "#64748b" }}>GPS: {pt.lat}, {pt.lng} (Radius: {pt.geofence_radius_meters}m)</p>
                             {pt.createdBy && <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", color: "#8b5cf6" }}>Created by: {pt.createdBy}</p>}
                             {pt.refImages && pt.refImages.length > 0 && <span style={{ fontSize: "0.7rem", background: "rgba(34, 197, 94, 0.2)", color: "#4ade80", padding: "2px 6px", borderRadius: "4px", marginTop: "4px", display: "inline-block" }}>{pt.refImages.length} AI Ref Photos</span>}
                           </div>
                           <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                             <button style={{...styles.actionBtnOutline, width: "auto", padding: "8px 12px", border: "1px solid rgba(56, 189, 248, 0.5)", color: "#38bdf8"}} onClick={() => setActivePointView(pt)}>👁 View</button>
                             <button style={{...styles.actionBtnOutline, width: "auto", padding: "8px 12px", border: "1px solid rgba(234, 179, 8, 0.5)", color: "#eab308"}} onClick={() => { setNewPoint(pt); window.scrollTo({top: 0, behavior: 'smooth'}); }}>✏️ Edit</button>
                             <button style={{...styles.actionBtnOutline, width: "auto", padding: "8px 12px", border: "1px solid rgba(239, 68, 68, 0.5)", color: "#ef4444"}} onClick={async () => {
                                if(confirm("Are you sure you want to delete this checkpoint? This action cannot be undone.")) {
                                   const res = await fetch('/api/points', { method: 'DELETE', body: JSON.stringify({ id: pt.id }) });
                                   if(res.ok) {
                                      const data = await res.json();
                                      setPatrolPoints(data.points);
                                      if (newPoint.id === pt.id) setNewPoint({ id: null, name: "", building: "", room: "", latitude: -6.2088, longitude: 106.845, geofence_radius_meters: sysConfig.defaultGeofenceRadius, refImages: [] });
                                      showToast("Point deleted");
                                   }
                                }
                             }}>🗑 Delete</button>
                             <button style={{...styles.actionBtnOutline, width: "auto", padding: "8px 12px"}} onClick={() => setActiveQr(pt)}>📱 Show QR</button>
                           </div>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
             </div>
           )}

           {activeTab === "AUDIT" && (
             <div className="fade-in">
                <h1 style={styles.pageTitle}>System Audit Trail</h1>
                <p style={styles.pageSubtitle}>Immutable history of all successful patrol check-ins.</p>
                
                <div style={styles.panelCard}>
                  <table style={styles.table}>
                   <thead>
                     <tr>
                       <th style={styles.th}>Timestamp</th>
                       <th style={styles.th}>Officer</th>
                       <th style={styles.th}>Target Point</th>
                       <th style={styles.th}>Status</th>
                     </tr>
                   </thead>
                   <tbody>
                     {historyLogs.map(log => (
                       <tr key={log.id} style={styles.tr}>
                         <td style={styles.td}>{new Date(log.timestamp).toLocaleString()}</td>
                         <td style={styles.td}><strong>{log.guard}</strong></td>
                         <td style={styles.td}>{log.pointName}</td>
                         <td style={styles.td}>
                           <span style={styles.badgePass}>{log.status}</span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
                </div>
             </div>
           )}
           {activeTab === "OFFICERS" && (
             <div className="fade-in">
                <h1 style={styles.pageTitle}>Security Officers</h1>
                <p style={styles.pageSubtitle}>Master data management for all patrol personnel.</p>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "24px" }}>
                  {/* Form */}
                  <div style={styles.panelCard}>
                    <h3 style={styles.panelTitle}>Add New Officer</h3>
                    <div style={styles.formGroup}>
                       <label style={styles.label}>Full Name</label>
                       <input style={styles.input} type="text" placeholder="e.g. Budi Santoso" value={newGuard.name} onChange={e => setNewGuard({...newGuard, name: e.target.value})} />
                    </div>
                    <div style={styles.formGroup}>
                       <label style={styles.label}>Phone Number</label>
                       <input style={styles.input} type="text" placeholder="+62 8..." value={newGuard.phone} onChange={e => setNewGuard({...newGuard, phone: e.target.value})} />
                    </div>
                    <div style={styles.formGroup}>
                       <label style={styles.label}>Assigned Route</label>
                       <input style={styles.input} type="text" placeholder="Main Lobby Route" value={newGuard.route} onChange={e => setNewGuard({...newGuard, route: e.target.value})} />
                    </div>
                    <div style={styles.formGroup}>
                       <label style={styles.label}>Role (Jabatan)</label>
                       <select style={styles.input} value={newGuard.role} onChange={e => setNewGuard({...newGuard, role: e.target.value})}>
                          <option value="Petugas Keamanan">Petugas Keamanan</option>
                          <option value="Koordinator Lapangan">Koordinator Lapangan</option>
                       </select>
                    </div>
                    <button style={styles.primaryBtn} onClick={async () => {
                      if(!newGuard.name) return showToast("Officer Name is required.");
                      const res = await fetch('/api/users', { method: 'POST', body: JSON.stringify(newGuard) });
                      if(res.ok) {
                        const data = await res.json();
                        setGuards(data.users);
                        setNewGuard({ name: "", phone: "", route: "", status: "ON_DUTY", role: "Petugas Keamanan" });
                        showToast("Officer added successfully");
                      }
                    }}>+ Add Officer</button>
                  </div>

                  {/* List */}
                  <div style={styles.panelCard}>
                    <h3 style={styles.panelTitle}>Registered Personnel</h3>
                    <table style={styles.table}>
                       <thead>
                         <tr>
                           <th style={styles.th}>Name</th>
                           <th style={styles.th}>Role</th>
                           <th style={styles.th}>Route</th>
                           <th style={styles.th}>Phone</th>
                           <th style={styles.th}>Status</th>
                         </tr>
                       </thead>
                       <tbody>
                         {guards.map(g => (
                           <tr key={g.id} style={styles.tr}>
                             <td style={styles.td}><strong>{g.name}</strong></td>
                             <td style={styles.td}>{g.role || "Petugas Keamanan"}</td>
                             <td style={styles.td}>{g.route}</td>
                             <td style={styles.td}>{g.phone}</td>
                             <td style={styles.td}>
                               <select 
                                 style={{ padding: "4px 8px", borderRadius: "8px", background: g.status === "ON_DUTY" ? "rgba(34, 197, 94, 0.15)" : g.status === "SUSPENDED" ? "rgba(234, 179, 8, 0.15)" : "rgba(239, 68, 68, 0.15)", color: g.status === "ON_DUTY" ? "#4ade80" : g.status === "SUSPENDED" ? "#eab308" : "#ef4444", border: "1px solid " + (g.status === "ON_DUTY" ? "rgba(34, 197, 94, 0.3)" : g.status === "SUSPENDED" ? "rgba(234, 179, 8, 0.3)" : "rgba(239, 68, 68, 0.3)"), outline: "none", cursor: "pointer", fontWeight: "bold", fontSize: "0.85rem" }}
                                 value={g.status}
                                 onChange={async (e) => {
                                   const newStatus = e.target.value;
                                   const res = await fetch('/api/users', { method: 'PUT', body: JSON.stringify({ id: g.id, status: newStatus }) });
                                   if(res.ok) {
                                     const data = await res.json();
                                     setGuards(data.users);
                                     showToast("Status updated");
                                   }
                                 }}
                               >
                                 <option value="ON_DUTY" style={{ color: "#000" }}>ON DUTY</option>
                                 <option value="OFF_DUTY" style={{ color: "#000" }}>OFF DUTY</option>
                                 <option value="SUSPENDED" style={{ color: "#000" }}>SUSPENDED</option>
                               </select>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                    </table>
                  </div>
                </div>
             </div>
           )}
        </div>

        {/* Toast Popup */}
         {toastMsg && (
           <div style={{ position: "fixed", bottom: "30px", left: "50%", transform: "translateX(-50%)", background: "rgba(15, 23, 42, 0.9)", border: "1px solid #38bdf8", color: "#fff", padding: "12px 24px", borderRadius: "8px", zIndex: 9999, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", whiteSpace: "nowrap", animation: "slideUp 0.3s ease-out" }}>
             {toastMsg}
           </div>
         )}

        {/* QR Code Modal Popup */}
        {activeQr && (
           <div style={styles.modalOverlay} onClick={() => setActiveQr(null)}>
              <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                 <h2 style={{ margin: "0 0 8px 0" }}>{activeQr.name}</h2>
                 <p style={{ margin: "0 0 24px 0", color: "#94a3b8" }}>Placard ID: {activeQr.id}</p>
                 
                 <div style={{ background: "#fff", padding: "16px", borderRadius: "16px", display: "inline-block", marginBottom: "24px" }}>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`POINT_${activeQr.id}_HMAC_TEST`)}`} alt="QR Code" width="250" height="250" />
                 </div>

                 <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "24px" }}>
                    Print this QR code and attach it to the physical location. Guards will scan this using the PWA Scanner to begin validation.
                 </p>

                 <button style={styles.primaryBtn} onClick={() => setActiveQr(null)}>Close</button>
              </div>
           </div>
        )}
         {/* View Details Modal Popup */}
         {activePointView && (
            <div style={styles.modalOverlay} onClick={() => setActivePointView(null)}>
               <div style={{...styles.modalContent, maxWidth: "500px"}} onClick={e => e.stopPropagation()}>
                  <h2 style={{ margin: "0 0 4px 0" }}>{activePointView.name}</h2>
                  <p style={{ margin: "0 0 16px 0", color: "#94a3b8" }}>{activePointView.building} • {activePointView.room}</p>
                  
                  <div style={{ pointerEvents: "none", opacity: 0.8, marginBottom: "16px", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                     <GoogleMapPicker 
                         apiKey={sysConfig.googleMapsApiKey} 
                         initialLat={activePointView.lat} 
                         initialLng={activePointView.lng} 
                         radius={activePointView.geofence_radius_meters}
                     />
                  </div>
                  
                  {activePointView.refImages && activePointView.refImages.length > 0 ? (
                     <div>
                        <p style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "#e2e8f0" }}>AI Reference Photos ({activePointView.refImages.length}):</p>
                        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px" }}>
                           {activePointView.refImages.map((img, i) => (
                              <img key={i} src={img} alt="Ref" style={{ height: "150px", objectFit: "cover", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }} />
                           ))}
                        </div>
                     </div>
                  ) : (
                     <p style={{ color: "#ef4444", fontSize: "0.85rem", padding: "12px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "8px" }}>No AI Reference Photo uploaded.</p>
                  )}

                  <button style={{...styles.primaryBtn, marginTop: "24px"}} onClick={() => setActivePointView(null)}>Close</button>
               </div>
            </div>
         )}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, expanded }) {
  return (
    <div style={active ? styles.navItemActive : styles.navItem} onClick={onClick} className="nav-item">
      <span style={styles.navIcon}>{icon}</span>
      {expanded && <span style={styles.navLabel}>{label}</span>}
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div style={styles.statCard} className="hover-lift">
      <div style={{...styles.statIconBox, background: `${color}20`, color: color }}>{icon}</div>
      <div>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statTitle}>{title}</div>
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", height: "100vh", background: "#020617", color: "#f8fafc", fontFamily: "'Inter', sans-serif" },
  sidebar: { background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(20px)", borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)", zIndex: 100 },
  sidebarHeader: { height: "70px", display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  brandBox: { display: "flex", alignItems: "center", gap: "12px", overflow: "hidden" },
  brandLogo: { width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #0ea5e9, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "1.2rem", flexShrink: 0 },
  brandName: { fontSize: "1.2rem", fontWeight: "800", letterSpacing: "-0.5px", margin: 0, whiteSpace: "nowrap" },
  navMenu: { padding: "20px 10px", display: "flex", flexDirection: "column", gap: "8px" },
  navItem: { display: "flex", alignItems: "center", gap: "16px", padding: "12px", borderRadius: "12px", cursor: "pointer", color: "#94a3b8", transition: "0.2s" },
  navItemActive: { display: "flex", alignItems: "center", gap: "16px", padding: "12px", borderRadius: "12px", cursor: "pointer", color: "#fff", background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.2)", transition: "0.2s" },
  navIcon: { fontSize: "1.2rem", flexShrink: 0 },
  navLabel: { fontSize: "0.9rem", fontWeight: "600", whiteSpace: "nowrap" },
  mainContent: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  topbar: { height: "70px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: "rgba(2, 6, 23, 0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  toggleBtn: { background: "none", border: "none", color: "#fff", fontSize: "1.5rem", cursor: "pointer" },
  topbarRight: { display: "flex", alignItems: "center", gap: "12px" },
  adminAvatar: { width: "36px", height: "36px", borderRadius: "50%", background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "0.9rem" },
  contentArea: { flex: 1, overflowY: "auto", padding: "32px" },
  pageTitle: { margin: "0 0 4px 0", fontSize: "2rem", fontWeight: "800", letterSpacing: "-1px" },
  pageSubtitle: { margin: "0 0 32px 0", color: "#94a3b8" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px", marginBottom: "32px" },
  statCard: { background: "linear-gradient(145deg, #1e293b, #0f172a)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "20px", padding: "24px", display: "flex", alignItems: "center", gap: "20px", transition: "transform 0.2s, box-shadow 0.2s" },
  statIconBox: { width: "60px", height: "60px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem" },
  statValue: { fontSize: "2rem", fontWeight: "800", lineHeight: 1 },
  statTitle: { color: "#94a3b8", fontSize: "0.9rem", marginTop: "4px" },
  dashboardGrid: { display: "grid", gridTemplateColumns: "1fr", gap: "24px" },
  panelCard: { background: "rgba(15, 23, 42, 0.4)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "24px", padding: "24px", backdropFilter: "blur(20px)" },
  panelTitle: { margin: "0 0 20px 0", fontSize: "1.2rem" },
  activityRow: { display: "flex", alignItems: "center", gap: "16px", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  activityDot: { width: "10px", height: "10px", borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 10px #38bdf8" },
  activityDetails: { display: "flex", flexDirection: "column", fontSize: "0.9rem" },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left" },
  th: { padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontWeight: "600", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px" },
  td: { padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.02)", fontSize: "0.95rem" },
  tr: { transition: "background 0.2s", ":hover": { background: "rgba(255,255,255,0.02)" } },
  badgePass: { background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", border: "1px solid rgba(34, 197, 94, 0.3)", padding: "4px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "bold" },
  badgeFail: { background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "4px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "bold" },
  formGroup: { marginBottom: "24px" },
  label: { display: "block", marginBottom: "8px", fontWeight: "600" },
  helpText: { color: "#64748b", fontSize: "0.85rem", marginBottom: "8px" },
  input: { width: "100%", padding: "14px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: "12px", fontSize: "1rem", outline: "none", transition: "border 0.2s" },
  primaryBtn: { width: "100%", background: "linear-gradient(135deg, #0ea5e9, #2563eb)", color: "#fff", border: "none", padding: "14px", borderRadius: "12px", fontSize: "1rem", fontWeight: "600", cursor: "pointer", boxShadow: "0 4px 15px rgba(37,99,235,0.3)", transition: "0.2s" },
  actionBtnOutline: { background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)", color: "#38bdf8", padding: "12px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", cursor: "pointer", transition: "0.2s" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalContent: { background: "#1e293b", padding: "40px", borderRadius: "24px", maxWidth: "450px", width: "90%", textAlign: "center", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }
};

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    .nav-item:hover { background: rgba(255,255,255,0.05); }
    .hover-lift:hover { transform: translateY(-5px); box-shadow: 0 10px 40px rgba(0,0,0,0.3) !important; }
    .fade-in { animation: fadeIn 0.4s ease-out; }
    input:focus { border-color: #38bdf8 !important; box-shadow: 0 0 0 3px rgba(56,189,248,0.2); }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `;
  document.head.appendChild(style);
}
