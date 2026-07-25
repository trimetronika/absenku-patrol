import { NextResponse } from 'next/server';
import { readDb, writeDb } from '../../../lib/db';

export async function GET() {
  try {
    const db = readDb();
    return NextResponse.json({ success: true, users: db.guards || [] });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const db = readDb();
    
    if (!db.guards) db.guards = [];
    
    const newGuard = {
      id: `g-${Date.now()}`,
      name: data.name,
      phone: data.phone || "-",
      route: data.route || "General Area",
      status: data.status || "OFF_DUTY",
      battery: "100%",
      device: "Android PWA",
      antiCheat: "PASSED"
    };
    
    db.guards.push(newGuard);
    writeDb(db);
    
    return NextResponse.json({ success: true, users: db.guards });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const db = readDb();
    
    if (!db.guards) db.guards = [];
    
    const index = db.guards.findIndex(g => g.id === data.id);
    if (index === -1) {
       return NextResponse.json({ success: false, error: "Officer not found" }, { status: 404 });
    }
    
    db.guards[index] = { ...db.guards[index], ...data };
    writeDb(db);
    
    return NextResponse.json({ success: true, users: db.guards });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
