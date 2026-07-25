import { NextResponse } from 'next/server';
import { readDb } from '../../../../lib/db';

export async function POST(request) {
  try {
    const { pointId, qrCode } = await request.json();
    const db = readDb();
    
    const targetPoint = db.patrolPoints.find(p => p.id === pointId);
    if (!targetPoint) {
      return NextResponse.json({ success: false, error: "Point not found" }, { status: 404 });
    }

    const isQrMatch = qrCode && qrCode.includes(targetPoint.id);
    
    if (!isQrMatch) {
      return NextResponse.json({ success: false, error: "❌ QR CODE REJECTED: Unmatched Placard." }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "QR Verified" });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
