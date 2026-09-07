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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  const { data: users } = await supabase.auth.admin.listUsers();
  console.log("Auth users count:", users.users.length);

  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log("Profiles:", profiles);

  const { data: userRoles } = await supabase.from('user_roles').select('*, roles(*)');
  console.log("User roles count:", userRoles.length);
  userRoles.forEach(ur => {
    const user = users.users.find(u => u.id === ur.user_id);
    console.log(`User ${user?.email ?? ur.user_id} -> role: ${ur.roles?.name} (active: ${ur.is_active})`);
  });
}

main();
