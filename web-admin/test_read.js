const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kcpnjlynfjtxzgcibbwg.supabase.co', 'sb_publishable_5gXtkOHX4Q5h3j3uWITCpg_beRwMvIo');
async function test() {
  const { data, error } = await supabase.from('mvp_db').select('data').eq('id', 1).single();
  console.log('Result:', JSON.stringify(data), error);
}
test();
