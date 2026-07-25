const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kcpnjlynfjtxzgcibbwg.supabase.co', 'sb_publishable_5gXtkOHX4Q5h3j3uWITCpg_beRwMvIo');
const defaultData = {
  sysConfig: { aiPassThreshold: 85.0, defaultGeofenceRadius: 15, qrExpirySeconds: 30, googleMapsApiKey: 'AIzaSyDemoGoogleMapsApiKey2026_PRODUCTION', antiCheatMode: 'STRICT' },
  schedules: [
    { id: 's1', name: 'Pagi', startTime: '08:00', endTime: '12:00' },
    { id: 's2', name: 'Siang', startTime: '13:00', endTime: '17:00' },
    { id: 's3', name: 'Malam', startTime: '18:00', endTime: '23:59' }
  ],
  patrolPoints: [],
  aiLogs: [],
  historyLogs: [],
  guards: []
};
async function restore() { await supabase.from('mvp_db').upsert({ id: 1, data: defaultData }); }
restore();
