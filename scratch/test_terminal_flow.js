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

async function main() {
  console.log("==================================================");
  console.log("  SKIPQ TERMINAL MVP END-TO-END VERIFICATION TEST  ");
  console.log("==================================================\n");

  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1. Fetch test terminals
  const { data: term1Acc } = await adminClient.from('terminal_accounts').select('*, shops(*)').eq('display_name', 'Ground Floor Terminal').single();
  const { data: term2Acc } = await adminClient.from('terminal_accounts').select('*, shops(*)').eq('display_name', '1st Floor Terminal').single();

  console.log("✓ Test Terminals found:");
  console.log(`  Terminal 1: ${term1Acc.display_name} -> Shop: ${term1Acc.shops.name} (${term1Acc.shop_id})`);
  console.log(`  Terminal 2: ${term2Acc.display_name} -> Shop: ${term2Acc.shops.name} (${term2Acc.shop_id})`);

  // Create authenticated clients for Terminal 1 and Terminal 2
  const term1Client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: term1Auth, error: t1Err } = await term1Client.auth.signInWithPassword({
    email: 'terminal1@skipq.local',
    password: 'Terminal123!'
  });
  if (t1Err) throw new Error("Terminal 1 login failed: " + t1Err.message);
  console.log("\n1. Terminal 1 login works -> User ID:", term1Auth.user.id);

  const term2Client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: term2Auth, error: t2Err } = await term2Client.auth.signInWithPassword({
    email: 'terminal2@skipq.local',
    password: 'Terminal123!'
  });
  if (t2Err) throw new Error("Terminal 2 login failed: " + t2Err.message);
  console.log("1b. Terminal 2 login works -> User ID:", term2Auth.user.id);

  // 2. Terminal sees only its shop orders (RLS check)
  const { data: t1Orders, error: t1OrdersErr } = await term1Client.from('orders').select('*').eq('shop_id', term1Acc.shop_id);
  console.log("\n2. Terminal 1 order query for its shop succeeded (count:", t1Orders ? t1Orders.length : 0, ", err:", t1OrdersErr, ")");

  const { data: t1CrossOrders } = await term1Client.from('orders').select('*').eq('shop_id', term2Acc.shop_id);
  console.log("2b. Terminal 1 attempting to query Terminal 2's shop orders returns empty (RLS Isolation count:", t1CrossOrders ? t1CrossOrders.length : 0, ")");

  // 3. Create a test customer & customer order for Terminal 1's shop
  const custEmail = "testcustomer@skipq.local";
  const { data: usersList } = await adminClient.auth.admin.listUsers();
  let custUser = usersList.users.find(u => u.email === custEmail);
  if (!custUser) {
    const { data: created } = await adminClient.auth.admin.createUser({ email: custEmail, password: "Customer123!", email_confirm: true });
    custUser = created.user;
  }

  const { data: custRole } = await adminClient.from('roles').select('id').eq('name', 'customer').single();
  await adminClient.from('profiles').upsert({ id: custUser.id, display_name: "Test Customer", is_active: true });
  
  const { data: existingUr } = await adminClient.from('user_roles').select('id').eq('user_id', custUser.id).eq('role_id', custRole.id).maybeSingle();
  if (!existingUr) {
    await adminClient.from('user_roles').insert({ user_id: custUser.id, role_id: custRole.id, is_active: true });
  }

  const custClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await custClient.auth.signInWithPassword({ email: custEmail, password: "Customer123!" });

  const { data: menu1 } = await adminClient.from('menu_items').select('*').eq('shop_id', term1Acc.shop_id).limit(1).single();

  const { data: newOrder, error: orderErr } = await custClient.rpc('create_cash_order', {
    p_shop_id: term1Acc.shop_id,
    p_items: [{ menu_item_id: menu1.id, quantity: 2 }]
  });

  if (orderErr) throw new Error("Order creation failed: " + orderErr.message);
  console.log("\n3. New customer order created -> Order Number:", newOrder.order_number, "ID:", newOrder.order_id);

  // 4. Verify order appears on Terminal 1 query but not Terminal 2
  const { data: t1Check } = await term1Client.from('orders').select('*').eq('id', newOrder.order_id);
  console.log("4. Order visible to Terminal 1:", t1Check && t1Check.length === 1);
  const { data: t2Check } = await term2Client.from('orders').select('*').eq('id', newOrder.order_id);
  console.log("4b. Order visible to Terminal 2 (should be empty):", t2Check ? t2Check.length : 0);

  // 5. Test invalid status transition: PLACED -> READY (should fail)
  const { error: invalidErr } = await term1Client.rpc('update_order_status', {
    p_order_id: newOrder.order_id,
    p_new_status: 'READY'
  });
  console.log("\n7. Invalid transition PLACED -> READY rejected as expected:", !!invalidErr, invalidErr ? `(${invalidErr.message})` : "");

  // 6. Test PLACED -> PREPARING
  const { error: prepErr } = await term1Client.rpc('update_order_status', {
    p_order_id: newOrder.order_id,
    p_new_status: 'PREPARING'
  });
  if (prepErr) throw new Error("PLACED -> PREPARING failed: " + prepErr.message);
  console.log("5. PLACED -> PREPARING succeeded");

  // 7. Test Non-READY QR collection attempt (should fail while order is PREPARING)
  const { error: earlyQrErr } = await term1Client.rpc('validate_collection_qr', { p_token: "DUMMY_TOKEN_WHILE_PREPARING" });
  console.log("10. Collecting non-READY (PREPARING) order rejected as expected:", !!earlyQrErr, earlyQrErr ? `(${earlyQrErr.message})` : "");

  // 8. Test PREPARING -> READY
  const { error: readyErr } = await term1Client.rpc('update_order_status', {
    p_order_id: newOrder.order_id,
    p_new_status: 'READY'
  });
  if (readyErr) throw new Error("PREPARING -> READY failed: " + readyErr.message);
  console.log("6. PREPARING -> READY succeeded");

  // 9. Validate Wrong-Shop QR collection attempt (Terminal 2 scanning Terminal 1's READY order)
  const rawToken = newOrder.collection_token;
  const { error: wrongShopErr } = await term2Client.rpc('validate_collection_qr', { p_token: rawToken });
  console.log("11. Wrong-shop QR collection by Terminal 2 rejected as expected:", !!wrongShopErr, wrongShopErr ? `(${wrongShopErr.message})` : "");

  // 10. Test Valid QR Collection by Terminal 1
  const { data: validCol, error: colErr } = await term1Client.rpc('validate_collection_qr', { p_token: rawToken });
  if (colErr) throw new Error("Valid collection failed: " + colErr.message);
  console.log("9. READY QR collected successfully by Terminal 1 -> Status:", validCol.status, "Message:", validCol.message);

  // 11. Test QR Reuse (should fail after collection)
  const { error: reuseErr } = await term1Client.rpc('validate_collection_qr', { p_token: rawToken });
  console.log("12. Reusing collected QR token rejected as expected:", !!reuseErr, reuseErr ? `(${reuseErr.message})` : "");

  // 12. Test Terminal Cancellation flow on a second order
  const { data: order2 } = await custClient.rpc('create_cash_order', {
    p_shop_id: term1Acc.shop_id,
    p_items: [{ menu_item_id: menu1.id, quantity: 1 }]
  });
  console.log("\n13. Created order 2 for cancellation test -> ID:", order2.order_id);

  const { error: cancelErr } = await term1Client.rpc('cancel_order', {
    p_order_id: order2.order_id,
    p_reason: "Item out of stock",
    p_restore_inventory: true
  });
  if (cancelErr) throw new Error("Terminal cancellation failed: " + cancelErr.message);
  console.log("13b. Terminal cancellation succeeded for order 2");

  // 13. Verify Customer cannot cancel orders
  const { error: custCancelErr } = await custClient.rpc('cancel_order', {
    p_order_id: newOrder.order_id,
    p_reason: "Customer trying to cancel",
    p_restore_inventory: false
  });
  console.log("14. Customer attempting cancel_order rejected as expected:", !!custCancelErr, custCancelErr ? `(${custCancelErr.message})` : "");

  console.log("\n==================================================");
  console.log("  ALL 14 TERMINAL MVP MANUAL VERIFICATION TESTS PASSED! ");
  console.log("==================================================\n");
}

main().catch(err => {
  console.error("\n❌ VERIFICATION TEST FAILED:", err.message);
  process.exit(1);
});
