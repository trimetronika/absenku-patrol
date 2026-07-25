import { NextResponse } from 'next/server';
import { readDb, writeDb } from '../../../lib/db';

export async function GET() {
  const db = await readDb();
  return NextResponse.json(db.patrolPoints);
}

export async function POST(request) {
  try {
    const data = await request.json();
    const db = await readDb();
    
    // Simple update or insert
    const existingIndex = db.patrolPoints.findIndex(p => p.id === data.id);
    if (existingIndex >= 0) {
      db.patrolPoints[existingIndex] = { ...db.patrolPoints[existingIndex], ...data };
    } else {
      db.patrolPoints.push({ ...data, id: data.id || `pt-${Date.now()}` });
    }
    
    await writeDb(db);
    return NextResponse.json({ success: true, points: db.patrolPoints });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
export async function DELETE(request) {
  try {
    const { id } = await request.json();
    const db = await readDb();
    
    const index = db.patrolPoints.findIndex(p => p.id === id);
    if (index >= 0) {
      db.patrolPoints.splice(index, 1);
      await writeDb(db);
      return NextResponse.json({ success: true, points: db.patrolPoints });
    } else {
      return NextResponse.json({ success: false, error: "Point not found" }, { status: 404 });
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
