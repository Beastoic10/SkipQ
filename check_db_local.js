const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envPath = 'c:/Users/SAKIN/SkipQ/skipq/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing env variables in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

async function main() {
  console.log("Supabase URL:", supabaseUrl);

  const { data: pgSettings, error: pgSettingsError } = await supabase
    .from('profiles')
    .select('id')
    .limit(1);

  console.log("Supabase connection check:", { hasData: !!pgSettings, error: pgSettingsError });

  const dummyUuid = '00000000-0000-0000-0000-000000000000';
  console.log("Calling create_collection_code with dummy UUID...");
  
  const { data: codeData, error: codeError } = await supabase.rpc('create_collection_code', {
    p_order_id: dummyUuid
  });

  console.log("create_collection_code execution result:", { data: codeData, error: codeError });
}

main().catch(err => {
  console.error("Execution failed:", err);
});
