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

const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function simulateSignup(email, password) {
  console.log(`\n--- Simulating signup for: ${email} ---`);
  
  const { data, error } = await anonClient.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.log("signUp returned error:", error.message);
    return { error: error.message };
  }

  if (!data.user) {
    console.log("signUp returned no user.");
    return { error: "Signup could not be completed. Please try again." };
  }

  // Check if identities array is empty (indicates user already exists in Supabase Auth with user enumeration protection)
  if (!data.user.identities || data.user.identities.length === 0) {
    console.log("signUp returned empty identities array (user already exists in auth.users).");
    return { error: "An account already exists for this email. Try logging in instead." };
  }

  console.log("Fresh user created in auth.users! User ID:", data.user.id);
  
  // Upsert profile
  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert({ id: data.user.id }, { onConflict: "id" });

  if (profileError) {
    console.log("admin.profiles.upsert failed:", profileError.message);
    return { error: profileError.message };
  }
  console.log("✓ Profile upsert succeeded!");

  // Roles lookup
  const { data: customerRole, error: roleError } = await adminClient
    .from("roles")
    .select("id")
    .eq("name", "customer")
    .maybeSingle();

  if (roleError || !customerRole) {
    console.log("Role lookup failed");
    return { error: "Customer role not found" };
  }

  const { error: userRoleError } = await adminClient
    .from("user_roles")
    .insert({ user_id: data.user.id, role_id: customerRole.id, is_active: true });

  if (userRoleError) {
    console.log("user_roles insert failed:", userRoleError.message);
    return { error: userRoleError.message };
  }

  console.log("✓ Customer role assigned!");
  return { success: true, userId: data.user.id };
}

async function main() {
  const freshEmail = `fresh_user_${Date.now()}@gmail.com`;
  const password = 'Password123!';

  // Test 1: Fresh signup
  console.log("Test 1: Fresh User Signup");
  const res1 = await simulateSignup(freshEmail, password);
  console.log("Test 1 Result:", res1);

  // Test 2: Duplicate signup (same email)
  console.log("\nTest 2: Duplicate User Signup (same email)");
  const res2 = await simulateSignup(freshEmail, password);
  console.log("Test 2 Result:", res2);
}

main().catch(console.error);
