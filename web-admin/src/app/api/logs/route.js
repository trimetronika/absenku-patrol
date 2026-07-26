export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDb } from '../../../lib/db';

export async function GET() {
  const db = await readDb();
  return NextResponse.json({
    aiLogs: db.aiLogs || [],
    auditLogs: db.auditLogs || [],
    historyLogs: db.historyLogs || []
  });
}

export async function DELETE(req) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const type = url.searchParams.get('type'); // 'ai' or 'audit'

    if (!id || !type) return NextResponse.json({ error: "Missing id or type" }, { status: 400 });

    const db = await readDb();
    const { writeDb } = require('../../../lib/db');

    if (type === 'ai' && db.aiLogs) {
      db.aiLogs = db.aiLogs.filter(log => log.id !== id);
    } else if (type === 'audit' && db.historyLogs) {
      db.historyLogs = db.historyLogs.filter(log => log.id !== id);
    }
    
    await writeDb(db);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete log" }, { status: 500 });
  }
}
