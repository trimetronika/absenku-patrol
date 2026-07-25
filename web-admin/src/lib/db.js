import { supabase } from './supabase';

export async function readDb() {
  try {
    const { data, error } = await supabase.from('mvp_db').select('data').eq('id', 1).single();
    if (error || !data || !data.data) {
      return getFallbackDb();
    }
    return data.data;
  } catch (err) {
    return getFallbackDb();
  }
}

export async function writeDb(dbData) {
  const { error } = await supabase.from('mvp_db').upsert({ id: 1, data: dbData });
  if (error) {
    console.error('Supabase write error:', error);
    throw new Error('Supabase Write Error: ' + error.message);
  }
}

function getFallbackDb() {
  return { sysConfig: { aiPassThreshold: 85, defaultGeofenceRadius: 15 }, schedules: [], patrolPoints: [], historyLogs: [], aiLogs: [], guards: [] };
}
