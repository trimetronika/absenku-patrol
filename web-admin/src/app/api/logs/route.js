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
