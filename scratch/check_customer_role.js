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

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

async function main() {
  const { data: users } = await supabase.auth.admin.listUsers();
  const custUser = users.users.find(u => u.email === 'testcustomer@skipq.local');

  const { data: custRole } = await supabase.from('roles').select('id').eq('name', 'customer').single();

  const { data: inserted, error: insErr } = await supabase.from('user_roles').insert({
    user_id: custUser.id,
    role_id: custRole.id,
    is_active: true
  }).select();

  console.log("Insert result:", { inserted, insErr });

  const { data: hasRole } = await supabase.rpc('has_role', { p_user_id: custUser.id, p_role: 'customer' });
  console.log("has_role RPC result:", hasRole);
}

main();
