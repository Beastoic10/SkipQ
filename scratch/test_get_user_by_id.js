const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    env[match[1]] = val.trim();
  }
});

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function test() {
  const realId = 'fe3a8843-e9e0-4d0b-81ad-4c43a6840fe7';
  const fakeId = '68c9e1ab-1c60-478b-b497-0c13b2bab26a';
  
  const resReal = await admin.auth.admin.getUserById(realId);
  console.log('Real ID check:', { hasUser: !!resReal.data?.user, err: resReal.error?.message });

  const resFake = await admin.auth.admin.getUserById(fakeId);
  console.log('Fake ID check:', { hasUser: !!resFake.data?.user, err: resFake.error?.message });
}

test().catch(console.error);
