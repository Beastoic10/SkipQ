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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  const { count: uCount, data: unis } = await supabase.from('universities').select('*', { count: 'exact' });
  const { count: cCount, data: cafes } = await supabase.from('cafeterias').select('*', { count: 'exact' });
  const { count: sCount, data: shops } = await supabase.from('shops').select('*', { count: 'exact' });
  const { count: tCount, data: terms } = await supabase.from('terminal_accounts').select('*', { count: 'exact' });
  const { count: mCount, data: menus } = await supabase.from('menu_items').select('*', { count: 'exact' });
  const { count: oCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });

  console.log("Counts:", {
    universities: uCount,
    cafeterias: cCount,
    shops: sCount,
    terminals: tCount,
    menu_items: mCount,
    orders: oCount
  });
  console.log("\nUniversities:", unis);
  console.log("\nCafeterias:", cafes);
  console.log("\nShops:", shops);
  console.log("\nTerminals:", terms);
  console.log("\nMenu sample:", menus.slice(0, 3));
}

main();
