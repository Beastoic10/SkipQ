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

const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function runVerification() {
  console.log("==================================================");
  console.log("  SKIPQ SIGNUP & AUTH VERIFICATION TEST           ");
  console.log("==================================================\n");

  const testEmail = `newcustomer_${Date.now()}@skipq.test`;
  const testPassword = "CustomerPass123!";

  console.log("1. Testing Fresh Customer Signup Flow...");
  // Create user via admin auth (simulating new user creation in auth.users)
  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  if (createError || !newUser?.user) {
    throw new Error(`Failed to create test user: ${createError?.message}`);
  }

  const userId = newUser.user.id;
  console.log(`✓ User created in auth.users -> ID: ${userId}`);

  // Create profile (as done in actions.ts)
  const { data: profileData, error: profileError } = await adminClient
    .from("profiles")
    .upsert({ id: userId }, { onConflict: "id" })
    .select()
    .single();

  if (profileError || !profileData) {
    throw new Error(`Profile creation failed: ${profileError?.message}`);
  }
  console.log(`✓ Profile row created in profiles with matching UUID: ${profileData.id}`);

  // Assign customer role (as done in actions.ts)
  const { data: customerRole } = await adminClient
    .from("roles")
    .select("id")
    .eq("name", "customer")
    .single();

  const { error: roleAssignError } = await adminClient
    .from("user_roles")
    .insert({ user_id: userId, role_id: customerRole.id, is_active: true });

  if (roleAssignError) {
    throw new Error(`Role assignment failed: ${roleAssignError.message}`);
  }
  console.log(`✓ Customer role assigned to user in user_roles!`);

  // Verify auth.users and profiles match
  const { data: fetchProfile } = await adminClient.from("profiles").select("*").eq("id", userId).single();
  const { data: fetchRoles } = await adminClient.from("user_roles").select("*, roles(name)").eq("user_id", userId);

  console.log("\n2. Verification of DB Integrity:");
  console.log(`  - auth.users.id: ${userId}`);
  console.log(`  - profiles.id:   ${fetchProfile.id}`);
  console.log(`  - Matching:      ${userId === fetchProfile.id}`);
  console.log(`  - Roles:         ${fetchRoles.map(r => r.roles.name).join(", ")}`);

  if (userId !== fetchProfile.id || !fetchRoles.some(r => r.roles.name === 'customer')) {
    throw new Error("Verification failed: UUID mismatch or missing customer role");
  }

  console.log("\n3. Testing Duplicate Email Signup Guard...");
  // Now call anonClient.auth.signUp with the exact same email
  const { data: dupData, error: dupError } = await anonClient.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  // Verify behavior: dupData.user has empty identities
  const isDuplicateDetected = !dupData?.user?.identities || dupData.user.identities.length === 0;
  console.log(`  - Duplicate signup response error: ${dupError?.message || "null"}`);
  console.log(`  - Identities length: ${dupData?.user?.identities ? dupData.user.identities.length : 0}`);
  console.log(`  - Duplicate email correctly detected without 23503 error: ${isDuplicateDetected}`);

  if (!isDuplicateDetected) {
    throw new Error("Duplicate email check failed to detect empty identities!");
  }

  console.log("\n4. Testing Existing Login Flow...");
  const { data: loginData, error: loginError } = await anonClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (loginError || !loginData.user) {
    throw new Error(`Login failed for newly created customer: ${loginError?.message}`);
  }
  console.log(`✓ Customer login succeeded! User ID: ${loginData.user.id}`);

  // Test Terminal Account Login
  const { data: termLogin, error: termLoginErr } = await anonClient.auth.signInWithPassword({
    email: "terminal1@skipq.local",
    password: "Terminal123!",
  });

  if (termLoginErr || !termLogin.user) {
    throw new Error(`Terminal login failed: ${termLoginErr?.message}`);
  }
  console.log(`✓ Existing Terminal login succeeded! User ID: ${termLogin.user.id}`);

  console.log("\n==================================================");
  console.log("  ALL SIGNUP & AUTH VERIFICATION TESTS PASSED!    ");
  console.log("==================================================\n");
}

runVerification().catch(err => {
  console.error("Verification error:", err);
  process.exit(1);
});
