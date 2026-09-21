const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    val = val.trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    env[match[1]] = val.trim();
  }
});

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  console.log("=== Testing Auth Admin createUser & Profiles Upsert ===");

  const testEmail = `testuser_${Date.now()}@test.com`;
  const testPass = 'Password123!';

  console.log(`Creating user via admin: ${testEmail}`);
  const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPass,
    email_confirm: true
  });

  console.log("createUser result:", { user: userData?.user ? { id: userData.user.id, email: userData.user.email } : null, error: userError });

  if (userData?.user) {
    console.log(`Attempting profiles upsert for ID: ${userData.user.id}`);
    const { data: profileData, error: profileError } = await adminClient
      .from('profiles')
      .upsert({ id: userData.user.id }, { onConflict: 'id' })
      .select();

    console.log("profiles upsert result:", { data: profileData, error: profileError });
  }

  // Now test upserting a non-existent fake UUID to see the exact foreign key constraint error!
  const fakeUuid = '00000000-0000-0000-0000-999999999999';
  console.log(`\nAttempting profiles upsert with non-existent fake UUID: ${fakeUuid}`);
  const { data: fakeData, error: fakeError } = await adminClient
    .from('profiles')
    .upsert({ id: fakeUuid }, { onConflict: 'id' })
    .select();

  console.log("Fake UUID upsert result:", { data: fakeData, error: fakeError });
}

main().catch(console.error);
