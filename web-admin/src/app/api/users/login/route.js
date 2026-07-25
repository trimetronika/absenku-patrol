import { NextResponse } from 'next/server';
import { readDb } from '../../../../lib/db';

export async function POST(request) {
  try {
    const { identifier } = await request.json();
    if (!identifier) {
       return NextResponse.json({ success: false, error: "Identifier is required" }, { status: 400 });
    }
    
    const db = await readDb();
    const guards = db.guards || [];
    
    // Normalize input for flexible matching
    const normalizedInput = identifier.replace(/[\s\-\+]/g, '').toLowerCase();
    
    const matchedGuard = guards.find(g => {
       const normPhone = (g.phone || "").replace(/[\s\-\+]/g, '').toLowerCase();
       const normId = (g.id || "").toLowerCase();
       return normId === normalizedInput || normPhone === normalizedInput;
    });
    
    if (matchedGuard) {
       if (matchedGuard.status !== "ON_DUTY") {
          return NextResponse.json({ success: false, error: `Access Denied: Your status is currently ${matchedGuard.status}. Please contact the Admin.` }, { status: 403 });
       }
       return NextResponse.json({ success: true, user: matchedGuard });
    } else {
       return NextResponse.json({ success: false, error: "Invalid Officer ID or Phone Number. Not registered in Dashboard." }, { status: 401 });
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
