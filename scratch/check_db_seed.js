const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = 'c:/Users/SAKIN/SkipQ/skipq/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    env[match[1]] = val.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

async function main() {
  const { data: shops } = await supabase.from('shops').select('id, name, cafeteria_id, is_active, approval_status');
  console.log("Shops:", shops);

  const { data: terminals } = await supabase.from('terminal_accounts').select('*');
  console.log("Terminal Accounts:", terminals);

  const { data: users } = await supabase.auth.admin.listUsers();
  console.log("Auth Users:", users.users.map(u => ({ id: u.id, email: u.email })));
}

main();
