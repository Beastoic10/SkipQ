const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Load environment variables from .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error("Error: .env.local not found at", envPath);
  process.exit(1);
}

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

if (!supabaseUrl || !serviceKey) {
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function main() {
  const targetEmail = (process.argv[2] || 'sakinazmain@gmail.com').trim().toLowerCase();
  const optionalPassword = process.argv[3];

  console.log(`\n--- SkipQ Admin Provisioning ---`);
  console.log(`Target Email: ${targetEmail}`);

  // 2. Fetch admin role from public.roles
  const { data: adminRole, error: roleError } = await supabase
    .from('roles')
    .select('id, name')
    .eq('name', 'admin')
    .single();

  if (roleError || !adminRole) {
    console.error("Failed to find 'admin' role in public.roles:", roleError);
    process.exit(1);
  }

  // 3. Find target user in auth.users
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Failed to list auth users:", listError);
    process.exit(1);
  }

  let user = usersData.users.find(u => u.email?.toLowerCase() === targetEmail);

  if (!user) {
    if (!optionalPassword) {
      console.error(`User "${targetEmail}" does not exist in Supabase Auth.`);
      console.log(`To create a new user, supply a password: node scripts/provision_admin.js ${targetEmail} <password>`);
      process.exit(1);
    }

    console.log(`User does not exist. Creating new auth user for ${targetEmail}...`);
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: targetEmail,
      password: optionalPassword,
      email_confirm: true,
    });

    if (createError || !newUser.user) {
      console.error("Failed to create user:", createError);
      process.exit(1);
    }

    user = newUser.user;
    console.log(`Created new auth user: ${user.id}`);
  } else {
    console.log(`Found existing auth user: ${user.id} (${user.email})`);
  }

  // 4. Ensure profile exists and is active
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (profileError) {
    console.error("Failed to upsert profile:", profileError);
    process.exit(1);
  }

  // 5. Assign admin role in public.user_roles
  const { data: existingUserRole } = await supabase
    .from('user_roles')
    .select('id, is_active')
    .eq('user_id', user.id)
    .eq('role_id', adminRole.id)
    .maybeSingle();

  if (existingUserRole) {
    if (!existingUserRole.is_active) {
      const { error: activateError } = await supabase
        .from('user_roles')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', existingUserRole.id);

      if (activateError) {
        console.error("Failed to reactivate admin role:", activateError);
        process.exit(1);
      }
      console.log(`Reactivated existing admin role for user ${user.email}`);
    } else {
      console.log(`User ${user.email} already has an active admin role.`);
    }
  } else {
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert({
        user_id: user.id,
        role_id: adminRole.id,
        is_active: true,
      });

    if (insertError) {
      console.error("Failed to assign admin role:", insertError);
      process.exit(1);
    }
    console.log(`Assigned admin role (role_id: ${adminRole.id}) to ${user.email}`);
  }

  // 6. Verify role assignment via database function has_role
  const { data: hasAdmin, error: checkError } = await supabase.rpc('has_role', {
    p_user_id: user.id,
    p_role: 'admin',
  });

  if (checkError) {
    console.warn("Notice: Could not check public.has_role function:", checkError.message);
  } else {
    console.log(`Database authorization check (public.has_role('${user.id}', 'admin')): ${hasAdmin}`);
  }

  // 7. Output current active roles for target user
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('roles(name), is_active')
    .eq('user_id', user.id);

  console.log(`Active roles for ${user.email}:`, userRoles?.filter(r => r.is_active).map(r => r.roles?.name));
  console.log(`\nAdmin provisioning complete! User ${user.email} can now access /admin.`);
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
