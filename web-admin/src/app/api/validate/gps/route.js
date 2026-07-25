import { NextResponse } from 'next/server';
import { readDb } from '../../../../lib/db';

export async function POST(request) {
  try {
    const { pointId, gps } = await request.json();
    const db = readDb();
    
    const targetPoint = db.patrolPoints.find(p => p.id === pointId);
    if (!targetPoint) {
      return NextResponse.json({ success: false, error: "Point not found" }, { status: 404 });
    }

    const R = 6371e3;
    const rad = Math.PI / 180;
    const lat1 = gps.latitude * rad;
    const lat2 = targetPoint.lat * rad;
    const dLat = (targetPoint.lat - gps.latitude) * rad;
    const dLng = (targetPoint.lng - gps.longitude) * rad;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = Math.round(R * c);
    
    const allowedRadius = targetPoint.geofence_radius_meters || targetPoint.radius || 15;
    
    if (distance > allowedRadius) {
      return NextResponse.json({ success: false, error: `❌ GPS REJECTED: Out of bounds (${distance}m away. Max: ${allowedRadius}m)` }, { status: 400 });
    }

    return NextResponse.json({ success: true, distance: distance, message: "GPS Verified" });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
