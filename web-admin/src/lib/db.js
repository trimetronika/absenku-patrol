import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), '.data');
const dbFile = path.join(dataDir, 'db.json');

// Default initial database state
const defaultDb = {
  sysConfig: {
    aiPassThreshold: 85.0,
    defaultGeofenceRadius: 15,
    qrExpirySeconds: 30,
    googleMapsApiKey: "AIzaSyDemoGoogleMapsApiKey2026_PRODUCTION",
    antiCheatMode: "STRICT"
  },
  schedules: [
    { id: "s1", name: "Pagi", startTime: "08:00", endTime: "12:00" },
    { id: "s2", name: "Siang", startTime: "13:00", endTime: "17:00" },
    { id: "s3", name: "Malam", startTime: "18:00", endTime: "23:59" }
  ],
  patrolPoints: [
    {
      id: "pt-1784966748564",
      name: "Kamar Kos Bowo (Kos Kutisari)",
      building: "Gedung Kos Kutisari",
      floor: "Floor 1",
      room: "Kamar 102",
      lat: -7.332106,
      lng: 112.745033,
      radius: 15,
      status: "ACTIVE",
      refImages: [
        "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=300&auto=format&fit=crop"
      ],
      refTypes: ["Pintu Depan", "Panel Listrik"],
      notes: "Titik utama area Kutisari Surabaya"
    },
    {
      id: "99b08f02-12a1-4f11-9a00-112233445566",
      name: "Server Room A1 Main Entry",
      building: "Tower A (Main Operations)",
      floor: "Floor 2",
      room: "Room 201",
      lat: -6.208801,
      lng: 106.845599,
      radius: 15,
      status: "ACTIVE",
      refImages: [
        "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=300&auto=format&fit=crop"
      ],
      refTypes: ["Door Frame", "Control Panel"],
      notes: "High security vault point."
    }
  ],
  aiLogs: [],
  auditLogs: [],
  historyLogs: [],
  companies: [
    { id: "c1", name: "PT Dekade Prioritas Security", code: "DEKADE-01", status: "ACTIVE", buildings: 4, points: 38, guards: 24 }
  ],
  buildings: [],
  guards: [
    { id: "g1", name: "Officer John Doe", phone: "+62 812-3456-7890", route: "Utama Surabaya Route", status: "ON_DUTY", battery: "88%", device: "Android PWA", antiCheat: "PASSED" }
  ]
};

// Ensure data directory and db file exist
function initDb() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify(defaultDb, null, 2), 'utf-8');
  }
}

export function readDb() {
  initDb();
  try {
    const raw = fs.readFileSync(dbFile, 'utf-8');
    const db = JSON.parse(raw);
    let needsSave = false;
    if (!db.schedules) {
      db.schedules = defaultDb.schedules;
      needsSave = true;
    }
    if (needsSave) {
      fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf-8');
    }
    return db;
  } catch (err) {
    console.error("DB Read Error:", err);
    return defaultDb;
  }
}

export function writeDb(data) {
  initDb();
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf-8');
}
