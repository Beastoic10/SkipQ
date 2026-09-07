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
  console.log("Initializing Supabase Clients...");
  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  // 2. Set up authenticated customer client
  console.log("Authenticating customer client...");
  const custEmail = "testcustomer@skipq.local";
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error: loginError } = await client.auth.signInWithPassword({
    email: custEmail,
    password: "Customer123!"
  });
  if (loginError) {
    console.error("Customer login failed:", loginError);
    return;
  }

  // Get an order belonging to this customer
  const { data: customerOrders, error: custOrdersErr } = await client.from('orders').select('*').limit(1);
  if (custOrdersErr || !customerOrders || customerOrders.length === 0) {
    console.error("No orders found for testcustomer@skipq.local:", custOrdersErr);
    return;
  }
  const testOrder = customerOrders[0];
  console.log(`Using customer order ${testOrder.order_number} (ID: ${testOrder.id}) with status ${testOrder.status}`);

  // 3. Set up realtime subscription
  console.log("Setting up client realtime subscription...");
  let updateReceived = false;
  
  const channel = client
    .channel(`test-order-${testOrder.id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${testOrder.id}`
      },
      (payload) => {
        console.log("REALTIME UPDATE RECEIVED:", payload.new);
        updateReceived = true;
      }
    )
    .subscribe((status) => {
      console.log("Subscription status:", status);
      if (status === 'SUBSCRIBED') {
        // Trigger an update using the admin client
        console.log("Triggering DB update...");
        adminClient.from('orders')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', testOrder.id)
          .then(({ error }) => {
            if (error) console.error("Update error:", error);
            else console.log("DB update query sent successfully");
          });
      }
    });

  // Wait 5 seconds for the update to be received
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log(`Realtime test finished. Update received: ${updateReceived}`);
  
  // Clean up
  client.removeChannel(channel);
}

main().catch(err => console.error(err));
