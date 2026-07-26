export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDb, writeDb } from '../../../lib/db';

export async function GET() {
  try {
    const db = await readDb();
    return NextResponse.json(db.schedules || []);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    if (!body.name || !body.startTime || !body.endTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = await readDb();
    
    const newSchedule = {
      id: "s" + Date.now(),
      name: body.name,
      startTime: body.startTime,
      endTime: body.endTime
    };
    
    if (!db.schedules) db.schedules = [];
    db.schedules.push(newSchedule);
    await writeDb(db);
    
    return NextResponse.json({ success: true, schedule: newSchedule });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    if (!body.id || !body.name || !body.startTime || !body.endTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = await readDb();
    if (!db.schedules) db.schedules = [];
    
    const index = db.schedules.findIndex(s => s.id === body.id);
    if (index === -1) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    
    db.schedules[index] = { ...db.schedules[index], ...body };
    await writeDb(db);
    
    return NextResponse.json({ success: true, schedule: db.schedules[index] });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const db = await readDb();
    if (!db.schedules) return NextResponse.json({ success: true });
    
    db.schedules = db.schedules.filter(s => s.id !== id);
    await writeDb(db);
    
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 });
  }
}
