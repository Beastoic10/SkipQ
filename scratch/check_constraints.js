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
  // Query information_schema for unique constraints on user_roles
  const { data: constraints, error } = await supabase.rpc('has_role', { p_user_id: '00000000-0000-0000-0000-000000000000', p_role: 'admin' })
    .then(async () => {
      // Let's run a query to get unique constraints
      const query = `
        SELECT conname, contype, pg_get_constraintdef(c.oid)
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public' AND conrelid = 'public.user_roles'::regclass;
      `;
      return await supabase.rpc('validate_collection_qr', { p_token: 'dummy' })
        .then(() => supabase.from('user_roles').select('*').limit(1)) // fallback
        .catch(() => {});
    });

  // Let's run a SQL query directly using supabase db query CLI since we have it!
  console.log("Querying unique constraints on user_roles...");
}

main();
