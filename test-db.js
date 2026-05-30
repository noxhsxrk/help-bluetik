global.WebSocket = class {};

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] || '';
const supabaseAnonKey = env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    // 1. Check users RLS
    console.log('\n--- Checking Users Table ---');
    const { data: users, error: usersErr } = await supabase.from('users').select('*').limit(3);
    console.log('Fetch users count:', users ? users.length : 0, 'Error:', usersErr);
    
    console.log('Inserting test user...');
    const testUser = {
      id: 'test_u_' + Math.random().toString(36).substring(2, 11),
      x_username: 'test_user_' + Math.random().toString(36).substring(2, 6),
      x_name: 'Test User',
      role: 'pending',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=test',
      bio: 'test bio',
      help_score: 0,
      google_email: 'test_' + Math.random().toString(36).substring(2, 6) + '@gmail.com'
    };
    const { data: userInsert, error: userInsertErr } = await supabase.from('users').insert([testUser]).select();
    console.log('User Insert Result:', userInsert ? 'Success' : 'Failed', 'Error:', userInsertErr);

    // 2. Check interactions RLS
    console.log('\n--- Checking Interactions Table ---');
    const { data: ints, error: intsErr } = await supabase.from('interactions').select('*').limit(3);
    console.log('Fetch interactions count:', ints ? ints.length : 0, 'Error:', intsErr);
    
    console.log('Inserting test interaction...');
    const testInt = {
      id: 'test_i_' + Math.random().toString(36).substring(2, 11),
      post_id: 'test_p_xyz',
      helper_user_id: 'test_u_abc',
      type: 'like',
      created_at: Date.now()
    };
    const { data: intInsert, error: intInsertErr } = await supabase.from('interactions').insert([testInt]).select();
    console.log('Interaction Insert Result:', intInsert ? 'Success' : 'Failed', 'Error:', intInsertErr);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
