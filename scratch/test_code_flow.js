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

async function test() {
  console.log("==================================================");
  console.log("  TESTING 4-DIGIT CODE & COLLECTION FIXES         ");
  console.log("==================================================\n");

  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  let { data: term1Acc } = await adminClient.from('terminal_accounts').select('*').eq('display_name', 'Campus Brew Cafe').maybeSingle();
  if (!term1Acc) {
    const res = await adminClient.from('terminal_accounts').select('*').eq('display_name', 'Ground Floor Terminal').single();
    term1Acc = res.data;
  }
  const { data: term2Acc } = await adminClient.from('terminal_accounts').select('*').eq('display_name', '1st Floor Terminal').single();

  const term1Client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await term1Client.auth.signInWithPassword({ email: 'terminal1@skipq.local', password: 'Terminal123!' });

  const term2Client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await term2Client.auth.signInWithPassword({ email: 'terminal2@skipq.local', password: 'Terminal123!' });

  const custClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await custClient.auth.signInWithPassword({ email: 'testcustomer@skipq.local', password: 'Customer123!' });

  const { data: menu1 } = await adminClient.from('menu_items').select('*').eq('shop_id', term1Acc.shop_id).limit(1).single();

  console.log('--- 1. Create order & check 4-digit code ---');
  const { data: order, error: ordErr } = await custClient.rpc('create_cash_order', {
    p_shop_id: term1Acc.shop_id,
    p_items: [{ menu_item_id: menu1.id, quantity: 1 }]
  });
  if (ordErr) throw ordErr;
  console.log('✓ Order created:', order.order_number, 'Code:', order.order_code, 'Token:', order.collection_token ? 'Present' : 'Missing');
  if (!/^\d{4}$/.test(order.order_code)) throw new Error('Code is not 4 digits');

  console.log('\n--- 2. Terminal 1 lookup by code (verifying fix for format validation bug) ---');
  const { data: lookup1, error: lErr1 } = await term1Client.rpc('lookup_order_by_code', {
    p_code: order.order_code,
    p_shop_id: term1Acc.shop_id
  });
  if (lErr1) throw lErr1;
  console.log('✓ Lookup 1 result:', lookup1);
  if (!lookup1.found || lookup1.order_number !== order.order_number) throw new Error('Lookup mismatch: ' + JSON.stringify(lookup1));

  console.log('\n--- 2b. Terminal 1 lookup with leading zeros stripped e.g. input "42" matching "0042" ---');
  const numericVal = parseInt(order.order_code, 10).toString();
  const { data: lookupNumeric } = await term1Client.rpc('lookup_order_by_code', {
    p_code: numericVal,
    p_shop_id: term1Acc.shop_id
  });
  console.log(`✓ Lookup with "${numericVal}":`, lookupNumeric?.found ? 'Found matching #' + lookupNumeric.order_code : 'Not found');
  if (!lookupNumeric?.found || lookupNumeric.order_code !== order.order_code) throw new Error('Numeric code lookup failed');

  console.log('\n--- 3. Terminal 2 lookup Terminal 1 code (cross-shop isolation) ---');
  const { data: lookup2, error: lErr2 } = await term2Client.rpc('lookup_order_by_code', {
    p_code: order.order_code,
    p_shop_id: term2Acc.shop_id
  });
  console.log('✓ Cross-shop lookup correctly isolated (found = false):', lookup2);
  if (lookup2 && lookup2.found) throw new Error('Cross-shop code lookup leaked order!');

  console.log('\n--- 4. Status transitions: PLACED -> PREPARING -> READY ---');
  await term1Client.rpc('update_order_status', { p_order_id: order.order_id, p_new_status: 'PREPARING' });
  await term1Client.rpc('update_order_status', { p_order_id: order.order_id, p_new_status: 'READY' });
  console.log('✓ Status transitions to READY succeeded');

  console.log('\n--- 5. Terminal 1 collect by code ---');
  const { data: collectRes, error: colErr } = await term1Client.rpc('collect_order_by_code', {
    p_code: order.order_code,
    p_shop_id: term1Acc.shop_id
  });
  if (colErr) throw colErr;
  console.log('✓ Collect result:', collectRes);
  if (collectRes.already_collected) throw new Error('Should not be already collected');

  console.log('\n--- 6. Verify collection_codes synchronization ---');
  const { data: codeRow } = await adminClient.from('collection_codes').select('*').eq('order_id', order.order_id).single();
  console.log('✓ Collection codes synchronized: used_at =', codeRow.used_at, ', validated_by =', codeRow.validated_by);
  if (!codeRow.used_at || !codeRow.validated_by) throw new Error('collection_codes was not synchronized!');

  console.log('\n--- 7. Prevent duplicate collection (code & QR) ---');
  const { data: collect2 } = await term1Client.rpc('collect_order_by_code', {
    p_code: order.order_code,
    p_shop_id: term1Acc.shop_id
  });
  console.log('✓ Double collection by code prevented:', collect2?.already_collected === true);
  if (!collect2?.already_collected) throw new Error('Double collection was not prevented!');

  const { error: qrReuseErr } = await term1Client.rpc('validate_collection_qr', {
    p_token: order.collection_token
  });
  console.log('✓ Subsequent QR validation rejected:', !!qrReuseErr, qrReuseErr ? `(${qrReuseErr.message})` : '');
  if (!qrReuseErr) throw new Error('QR validation succeeded after code collection!');

  console.log('\n--- 8. Verify cancellation rules ---');
  const { error: cancelCollectedErr } = await term1Client.rpc('cancel_order', {
    p_order_id: order.order_id,
    p_reason: 'Testing cancellation on collected order'
  });
  console.log('✓ Cancellation of COLLECTED order rejected:', !!cancelCollectedErr, cancelCollectedErr ? `(${cancelCollectedErr.message})` : '');
  if (!cancelCollectedErr) throw new Error('Cancellation on COLLECTED order succeeded!');

  console.log("\n==================================================");
  console.log("  ALL TESTS PASSED SUCCESSFULLY!                 ");
  console.log("==================================================\n");
}

test().catch(e => { console.error('FAILED:', e); process.exit(1); });
