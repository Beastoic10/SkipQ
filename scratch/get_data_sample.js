const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envPath = 'c:/Users/SAKIN/SkipQ/skipq/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

async function main() {
  console.log("Fetching shops...");
  const { data: shops, error: shopsErr } = await supabase.from('shops').select('id, name, is_active, approval_status');
  console.log("Shops:", shopsErr || shops);

  console.log("Fetching terminal accounts...");
  const { data: terminals, error: terminalsErr } = await supabase.from('terminal_accounts').select('id, auth_user_id, shop_id, display_name, is_active');
  console.log("Terminal Accounts:", terminalsErr || terminals);

  console.log("Fetching active orders...");
  const { data: orders, error: ordersErr } = await supabase.from('orders').select('id, order_number, status, shop_id, customer_id').limit(5);
  console.log("Orders:", ordersErr || orders);
}

main().catch(console.error);
