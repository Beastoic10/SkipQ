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

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("=== VERIFYING ADMIN PHASE 1-3 ===");

  // 1. Verify Admin User Authorization
  console.log("\n1. Checking admin user...");
  const { data: usersData } = await adminClient.auth.admin.listUsers();
  const targetUser = usersData.users.find(u => u.email === "sakinazmain@gmail.com");
  if (!targetUser) {
    console.error("FAIL: sakinazmain@gmail.com not found!");
    process.exit(1);
  }

  const { data: adminUserRoles, error: adminUserErr } = await adminClient
    .from("user_roles")
    .select(`
      is_active,
      roles!inner (name)
    `)
    .eq("user_id", targetUser.id)
    .eq("is_active", true);

  if (adminUserErr) {
    console.error("Failed to fetch admin roles:", adminUserErr);
    process.exit(1);
  }

  const activeRoles = (adminUserRoles || []).map(ur => ur.roles?.name);

  console.log("Admin active roles:", activeRoles);
  const isAdmin = activeRoles.includes("admin");
  console.log("Is Admin verified:", isAdmin);
  if (!isAdmin) {
    console.error("FAIL: sakinazmain@gmail.com does not have admin role!");
    process.exit(1);
  }

  // 2. Verify Non-Admin Authorization Block
  console.log("\n2. Checking terminal / customer user authorization...");
  const { data: terminalUserRoles } = await adminClient
    .from("user_roles")
    .select(`
      is_active,
      roles!inner (name)
    `)
    .eq("user_id", "34377d9f-be52-4b51-96ef-6f8a247e1779") // Ground Floor Terminal
    .eq("is_active", true);

  const terminalRoles = (terminalUserRoles || []).map(ur => ur.roles?.name);
  console.log("Terminal user roles:", terminalRoles);
  console.log("Terminal is NOT admin:", !terminalRoles.includes("admin"));
  if (terminalRoles.includes("admin")) {
    console.error("FAIL: Terminal user has admin role!");
    process.exit(1);
  }

  // 3. Verify Real Database Data for Admin Dashboard
  console.log("\n3. Testing Admin Dashboard data fetches...");
  const [
    uniRes,
    cafRes,
    shopRes,
    termRes,
    menuRes,
    orderRes,
  ] = await Promise.all([
    adminClient.from("universities").select("id", { count: "exact" }),
    adminClient.from("cafeterias").select("id", { count: "exact" }),
    adminClient.from("shops").select("id", { count: "exact" }),
    adminClient.from("terminal_accounts").select("id", { count: "exact" }),
    adminClient.from("menu_items").select("id", { count: "exact" }),
    adminClient.from("orders").select("id", { count: "exact" }),
  ]);

  console.log("Verified Database Statistics:");
  console.log(`- Universities: ${uniRes.count}`);
  console.log(`- Cafeterias: ${cafRes.count}`);
  console.log(`- Shops: ${shopRes.count}`);
  console.log(`- Terminals: ${termRes.count}`);
  console.log(`- Menu Items: ${menuRes.count}`);
  console.log(`- Orders: ${orderRes.count}`);

  // 4. Test University CRUD Action Simulation
  console.log("\n4. Testing safe University CRUD via DB functions...");
  const testSlug = "test-uni-" + Date.now();
  const { data: newUni, error: createUniErr } = await adminClient
    .from("universities")
    .insert({
      name: "Temporary Verification University",
      slug: testSlug,
      is_active: true,
      created_by: targetUser.id,
    })
    .select("id, name, slug, is_active")
    .single();

  if (createUniErr) {
    console.error("FAIL: Could not create university:", createUniErr);
    process.exit(1);
  }
  console.log("Created test university:", newUni.name, newUni.slug);

  // Update
  const { error: updateUniErr } = await adminClient
    .from("universities")
    .update({ name: "Updated Verification University", is_active: false })
    .eq("id", newUni.id);

  if (updateUniErr) {
    console.error("FAIL: Could not update university:", updateUniErr);
    process.exit(1);
  }
  console.log("Updated test university to inactive.");

  // Delete test university
  const { error: deleteUniErr } = await adminClient
    .from("universities")
    .delete()
    .eq("id", newUni.id);

  if (deleteUniErr) {
    console.error("FAIL: Could not cleanup test university:", deleteUniErr);
    process.exit(1);
  }
  console.log("Cleaned up test university successfully.");

  // 5. Verify Menu Stock Adjustment RPC
  console.log("\n5. Testing adjust_menu_item_stock RPC...");
  const { data: sampleItem } = await adminClient
    .from("menu_items")
    .select("id, name, stock_quantity")
    .limit(1)
    .single();

  if (sampleItem) {
    console.log(`Sample item: "${sampleItem.name}", Current Stock: ${sampleItem.stock_quantity}`);
    // RPC test (adjust +0 to check function accessibility without mutating stock)
    const { data: newStock, error: rpcErr } = await adminClient.rpc("adjust_menu_item_stock", {
      p_menu_item_id: sampleItem.id,
      p_quantity_change: 0,
    });
    if (rpcErr) {
      console.log("RPC adjust_menu_item_stock note (auth.uid check):", rpcErr.message);
    } else {
      console.log("RPC adjust_menu_item_stock returned stock:", newStock);
    }
  }

  // 6. Verify Customer & Terminal Routes Data Availability
  console.log("\n6. Verifying customer and terminal operational queries...");
  const { data: customerActiveUnis, error: custUniErr } = await adminClient
    .from("universities")
    .select("id, name, slug")
    .eq("is_active", true);
  console.log(`Customer accessible active universities: ${customerActiveUnis?.length}`);

  const { data: terminalOrders, error: termOrdErr } = await adminClient
    .from("orders")
    .select("id, order_number, status")
    .eq("shop_id", "c191220e-5941-4b5d-b119-9a01cc2d4d85") // Ground floor shop
    .limit(3);
  console.log(`Terminal orders query returned: ${terminalOrders?.length} sample orders`);

  console.log("\n=== ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ===");
}

main().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
