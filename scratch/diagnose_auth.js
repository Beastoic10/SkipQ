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
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

async function diagnose() {
  console.log("Starting Terminal Auth Diagnostics...");
  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1. Fetch Terminal 1 details as Admin to verify they exist in database
  const { data: term1AuthUser } = await adminClient.auth.admin.listUsers();
  const t1User = term1AuthUser.users.find(u => u.email === 'terminal1@skipq.local');
  console.log("Admin DB Check - User ID:", t1User?.id);

  if (t1User) {
    const { data: profile } = await adminClient.from('profiles').select('*').eq('id', t1User.id).maybeSingle();
    console.log("Admin DB Check - Profile:", profile);

    const { data: userRoles } = await adminClient.from('user_roles').select('*, roles(*)').eq('user_id', t1User.id);
    console.log("Admin DB Check - User Roles:", userRoles);

    const { data: termAccount } = await adminClient.from('terminal_accounts').select('*').eq('auth_user_id', t1User.id).maybeSingle();
    console.log("Admin DB Check - Terminal Account:", termAccount);
  }

  // 2. Log in as Terminal 1 using anon client (simulating Next.js server client with user's cookies)
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
    email: 'terminal1@skipq.local',
    password: 'Terminal123!'
  });

  if (loginError) {
    console.error("Login Error:", loginError);
    return;
  }
  console.log("\nLogin successful! Authenticated as:", loginData.user.id);

  // 3. Test queries using user session
  console.log("\nQuerying using user token...");
  const { data: userProfile, error: pError } = await client.from('profiles').select('*').maybeSingle();
  console.log("User Query - Profile:", userProfile, "Error:", pError);

  const { data: userRolesResult, error: rError } = await client.from('user_roles').select('roles!inner(name)');
  console.log("User Query - User Roles:", userRolesResult, "Error:", rError);

  const { data: userTermResult, error: tError } = await client.from('terminal_accounts').select('*').maybeSingle();
  console.log("User Query - Terminal Account:", userTermResult, "Error:", tError);
}

diagnose().catch(err => console.error("Diagnostic error:", err));
