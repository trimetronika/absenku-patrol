import { NextResponse } from 'next/server';
import { readDb } from '../../../../lib/db';

export async function GET() {
  try {
    const db = await readDb();
    const guards = db.guards || [];
    
    // Find the first guard on duty
    let activeGuard = guards.find(g => g.status === "ON_DUTY");
    
    // If no guard is on duty, fallback to the first guard
    if (!activeGuard && guards.length > 0) {
      activeGuard = guards[0];
    }
    
    // If db is totally empty, return a fallback
    if (!activeGuard) {
      activeGuard = { id: "g-fallback", name: "Default Guard", status: "OFF_DUTY" };
    }

    return NextResponse.json({ success: true, user: activeGuard });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
