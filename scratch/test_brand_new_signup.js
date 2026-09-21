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

const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  const brandNewEmail = `fresh_${Date.now()}@gmail.com`;
  const password = "Password123!";

  console.log("Calling anonClient.auth.signUp for brand new email:", brandNewEmail);
  const { data, error } = await anonClient.auth.signUp({
    email: brandNewEmail,
    password: password,
  });

  console.log("signUp returned error:", error);
  console.log("signUp returned data:", JSON.stringify(data, null, 2));

  if (data?.user) {
    console.log("Checking if user exists in auth.users via admin...");
    const { data: usersList } = await adminClient.auth.admin.listUsers();
    const foundUser = usersList.users.find(u => u.id === data.user.id || u.email === brandNewEmail);
    console.log("Found in auth.users:", foundUser ? { id: foundUser.id, email: foundUser.email, confirmed: !!foundUser.email_confirmed_at } : "NOT FOUND");
  }
}

main().catch(console.error);
