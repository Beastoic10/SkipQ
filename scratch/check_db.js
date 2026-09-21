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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  const { data: shops } = await supabase.from('shops').select('id, cafeteria_id, name, slug, description, is_active, approval_status');
  console.log('SHOPS:', JSON.stringify(shops, null, 2));

  const { data: terminals } = await supabase.from('terminal_accounts').select('id, shop_id, display_name, is_active, auth_user_id');
  console.log('TERMINAL ACCOUNTS:', JSON.stringify(terminals, null, 2));

  const { data: items } = await supabase.from('menu_items').select('id, shop_id, name, price, stock_quantity, is_active, image_path');
  console.log('MENU ITEMS COUNT:', items ? items.length : 0);
  console.log('MENU ITEMS:', JSON.stringify(items, null, 2));
}

run().catch(console.error);
