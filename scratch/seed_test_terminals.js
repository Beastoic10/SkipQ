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
  console.log("Seeding SkipQ Terminal Test Data...");

  // 1. Get university & cafeteria
  const { data: universities } = await supabase.from('universities').select('*').limit(1);
  if (!universities || universities.length === 0) {
    console.error("No university found");
    return;
  }
  const university = universities[0];

  const { data: cafeterias } = await supabase.from('cafeterias').select('*').eq('university_id', university.id).limit(1);
  if (!cafeterias || cafeterias.length === 0) {
    console.error("No cafeteria found");
    return;
  }
  const cafeteria = cafeterias[0];

  // 2. Ensure Shop 1 (Ground Floor) and Shop 2 (1st Floor) exist
  let { data: shop1 } = await supabase.from('shops').select('*').eq('cafeteria_id', cafeteria.id).eq('slug', 'ground-floor').maybeSingle();
  if (!shop1) {
    const { data: created, error } = await supabase.from('shops').insert({
      cafeteria_id: cafeteria.id,
      name: "Ground Floor Terminal Shop",
      slug: "ground-floor",
      description: "Main Ground Floor Counter",
      is_active: true,
      approval_status: 'APPROVED'
    }).select().single();
    if (error) { console.error("Error creating shop 1:", error); return; }
    shop1 = created;
  }

  let { data: shop2 } = await supabase.from('shops').select('*').eq('cafeteria_id', cafeteria.id).eq('slug', 'first-floor').maybeSingle();
  if (!shop2) {
    const { data: created, error } = await supabase.from('shops').insert({
      cafeteria_id: cafeteria.id,
      name: "1st Floor Terminal Shop",
      slug: "first-floor",
      description: "1st Floor Counter",
      is_active: true,
      approval_status: 'APPROVED'
    }).select().single();
    if (error) { console.error("Error creating shop 2:", error); return; }
    shop2 = created;
  }

  console.log("Shops ready:", { shop1: shop1.name, shop2: shop2.name });

  // 3. Ensure menu items exist for both shops
  const { data: menu1 } = await supabase.from('menu_items').select('*').eq('shop_id', shop1.id);
  if (!menu1 || menu1.length === 0) {
    await supabase.from('menu_items').insert([
      { shop_id: shop1.id, name: "Chicken Biryani (Ground Floor)", price: 180, stock_quantity: 50, max_quantity_per_order: 5, is_manually_available: true, is_active: true },
      { shop_id: shop1.id, name: "Lemon Mint Juice", price: 40, stock_quantity: 100, max_quantity_per_order: 10, is_manually_available: true, is_active: true }
    ]);
  }

  const { data: menu2 } = await supabase.from('menu_items').select('*').eq('shop_id', shop2.id);
  if (!menu2 || menu2.length === 0) {
    await supabase.from('menu_items').insert([
      { shop_id: shop2.id, name: "Beef Tehari (1st Floor)", price: 200, stock_quantity: 40, max_quantity_per_order: 5, is_manually_available: true, is_active: true },
      { shop_id: shop2.id, name: "Cold Coffee", price: 60, stock_quantity: 80, max_quantity_per_order: 10, is_manually_available: true, is_active: true }
    ]);
  }

  // 4. Create Terminal 1 Auth User: terminal1@skipq.local / Terminal123!
  const term1Email = "terminal1@skipq.local";
  const term1Pass = "Terminal123!";
  const { data: usersList } = await supabase.auth.admin.listUsers();
  
  let user1 = usersList.users.find(u => u.email === term1Email);
  if (!user1) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: term1Email,
      password: term1Pass,
      email_confirm: true
    });
    if (error) { console.error("Error creating user1:", error); return; }
    user1 = created.user;
  }
  
  // 5. Create Terminal 2 Auth User: terminal2@skipq.local / Terminal123!
  const term2Email = "terminal2@skipq.local";
  const term2Pass = "Terminal123!";
  let user2 = usersList.users.find(u => u.email === term2Email);
  if (!user2) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: term2Email,
      password: term2Pass,
      email_confirm: true
    });
    if (error) { console.error("Error creating user2:", error); return; }
    user2 = created.user;
  }

  // Get role id for terminal
  const { data: roleData } = await supabase.from('roles').select('id').eq('name', 'terminal').single();
  const terminalRoleId = roleData.id;

  // Setup User 1 Profile, Role, Terminal Account
  await supabase.from('profiles').upsert({ id: user1.id, display_name: "Ground Floor Terminal", is_active: true });
  await supabase.from('user_roles').upsert({ user_id: user1.id, role_id: terminalRoleId, is_active: true }, { onConflict: 'user_id,role_id' });
  await supabase.from('terminal_accounts').upsert({ auth_user_id: user1.id, shop_id: shop1.id, display_name: "Ground Floor Terminal", is_active: true }, { onConflict: 'auth_user_id' });

  // Setup User 2 Profile, Role, Terminal Account
  await supabase.from('profiles').upsert({ id: user2.id, display_name: "1st Floor Terminal", is_active: true });
  await supabase.from('user_roles').upsert({ user_id: user2.id, role_id: terminalRoleId, is_active: true }, { onConflict: 'user_id,role_id' });
  await supabase.from('terminal_accounts').upsert({ auth_user_id: user2.id, shop_id: shop2.id, display_name: "1st Floor Terminal", is_active: true }, { onConflict: 'auth_user_id' });

  console.log("\n==========================================");
  console.log("Terminal Test Accounts Created Successfully!");
  console.log("------------------------------------------");
  console.log("Terminal 1:");
  console.log(` Email: ${term1Email}`);
  console.log(` Password: ${term1Pass}`);
  console.log(` Shop: ${shop1.name} (${shop1.id})`);
  console.log("------------------------------------------");
  console.log("Terminal 2:");
  console.log(` Email: ${term2Email}`);
  console.log(` Password: ${term2Pass}`);
  console.log(` Shop: ${shop2.name} (${shop2.id})`);
  console.log("==========================================\n");
}

main().catch(err => console.error("Seeding error:", err));
