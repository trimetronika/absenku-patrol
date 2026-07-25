import { NextResponse } from 'next/server';
import { readDb, writeDb } from '../../../lib/db';

export async function GET() {
  const db = readDb();
  return NextResponse.json(db.sysConfig);
}

export async function POST(request) {
  try {
    const data = await request.json();
    const db = readDb();
    db.sysConfig = { ...db.sysConfig, ...data };
    writeDb(db);
    return NextResponse.json({ success: true, config: db.sysConfig });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
