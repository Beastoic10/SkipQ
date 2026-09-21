const fs = require('fs');
const path = require('path');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
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

const menuItemsData = [
  // COFFEE
  {
    name: "Espresso",
    description: "Rich and bold single shot of freshly roasted espresso with dense golden crema.",
    price: 85,
    photoId: "1510591509098-f4fdc6d0ff04",
    filename: "espresso.jpg",
    category: "Coffee"
  },
  {
    name: "Americano",
    description: "Classic rich espresso softened with hot water for a smooth, aromatic black coffee.",
    price: 100,
    photoId: "1514432324607-a09d9b4aefdd",
    filename: "americano.jpg",
    category: "Coffee"
  },
  {
    name: "Cappuccino",
    description: "Balanced harmony of rich espresso, silky steamed milk, and velvety thick micro-foam.",
    price: 120,
    photoId: "1572442388796-11668a67e53d",
    filename: "cappuccino.jpg",
    category: "Coffee"
  },
  {
    name: "Latte",
    description: "Smooth roasted espresso poured over abundant creamy steamed milk with barista latte art.",
    price: 120,
    photoId: "1561882468-9110e03e0f78",
    filename: "latte.jpg",
    category: "Coffee"
  },
  {
    name: "Mini Cap",
    description: "Petite, intense cortado-style cappuccino with concentrated espresso and dense velvety froth.",
    price: 105,
    photoId: "1517256064527-09c73fc73e38",
    filename: "mini-cap.jpg",
    category: "Coffee"
  },

  // SPECIALS / FLAVOR DRINKS
  {
    name: "Hazelnut Coffee",
    description: "Freshly roasted espresso blended with aromatic toasted hazelnut syrup and steamed milk.",
    price: 150,
    photoId: "1517701550927-30cf4ba1dba5",
    filename: "hazelnut-coffee.jpg",
    category: "Specials/ Flavor Drinks"
  },
  {
    name: "Vanilla Coffee",
    description: "Velvety espresso harmonized with sweet Madagascar vanilla syrup and creamy milk.",
    price: 150,
    photoId: "1570968915860-54d5c301fa9f",
    filename: "vanilla-coffee.jpg",
    category: "Specials/ Flavor Drinks"
  },
  {
    name: "Caramel Coffee",
    description: "Rich espresso infused with silky sweet caramel and crowned with warm milk.",
    price: 150,
    photoId: "1599398054066-846f28917f38",
    filename: "caramel-coffee.jpg",
    category: "Specials/ Flavor Drinks"
  },
  {
    name: "Hot Chocolate",
    description: "Decadent melted cocoa and warm steamed whole milk topped with a luscious chocolate drizzle.",
    price: 160,
    photoId: "1542990253-0d0f5be5f0ed",
    filename: "hot-chocolate.jpg",
    category: "Specials/ Flavor Drinks"
  },
  {
    name: "Mocha",
    description: "Artisan espresso melted with dark Belgian chocolate and topped with silky frothed milk.",
    price: 185,
    photoId: "1578314675249-a6910f80cc4e",
    filename: "mocha.jpg",
    category: "Specials/ Flavor Drinks"
  },

  // ICED DRINKS
  {
    name: "Fresh Lemon Fezz",
    description: "Freshly hand-squeezed zesty lemon over crushed ice with bubbly sparkling fizz and mint.",
    price: 125,
    photoId: "1513558161293-cdaf765ed2fd",
    filename: "fresh-lemon-fezz.jpg",
    category: "Iced Drinks"
  },
  {
    name: "Lemon Raz",
    description: "Tangy citrus lemon crushed with wild raspberry cooler and sparkling ice.",
    price: 150,
    photoId: "1556881286-fc6915169721",
    filename: "lemon-raz.jpg",
    category: "Iced Drinks"
  },
  {
    name: "Moroccan Mint",
    description: "Authentic refreshing Moroccan spearmint cooler served chilled over crystal ice.",
    price: 150,
    photoId: "1556679343-c7306c1976bc",
    filename: "moroccan-mint.jpg",
    category: "Iced Drinks"
  },
  {
    name: "Strawberry Fezz",
    description: "Fresh macerated strawberries infused with sparkling soda fizz, ice, and garden mint.",
    price: 150,
    photoId: "1553530666-ba11a7da3888",
    filename: "strawberry-fezz.jpg",
    category: "Iced Drinks"
  }
];

function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log("=== Setting up Campus Brew Cafe ===");

  // 1. Ensure target directory exists
  const menuImagesDir = path.join(__dirname, '..', 'public', 'images', 'menu');
  if (!fs.existsSync(menuImagesDir)) {
    fs.mkdirSync(menuImagesDir, { recursive: true });
  }

  // 2. Download images
  console.log("\nDownloading menu item images...");
  for (const item of menuItemsData) {
    const dest = path.join(menuImagesDir, item.filename);
    const url = `https://images.unsplash.com/photo-${item.photoId}?auto=format&fit=crop&w=640&q=85`;
    process.stdout.write(`Downloading ${item.filename}... `);
    try {
      await downloadImage(url, dest);
      console.log("✓ Done");
    } catch (err) {
      console.error(`✗ Error: ${err.message}`);
    }
  }

  // 3. Find ground floor terminal and shop
  const targetShopId = 'c191220e-5941-4b5d-b119-9a01cc2d4d85';
  const targetUserId = '34377d9f-be52-4b51-96ef-6f8a247e1779';

  console.log("\nUpdating Terminal & Shop names in DB...");

  // Update shop
  const { error: shopErr } = await supabase
    .from('shops')
    .update({
      name: "Campus Brew Cafe",
      description: "Fresh Roasted Beans & Specialty Drinks"
    })
    .eq('id', targetShopId);
  if (shopErr) console.error("Error updating shop:", shopErr);
  else console.log("✓ Shop name updated to 'Campus Brew Cafe'");

  // Update terminal_accounts
  const { error: termErr } = await supabase
    .from('terminal_accounts')
    .update({
      display_name: "Campus Brew Cafe"
    })
    .eq('auth_user_id', targetUserId);
  if (termErr) console.error("Error updating terminal account:", termErr);
  else console.log("✓ Terminal display_name updated to 'Campus Brew Cafe'");

  // Update profile
  const { error: profErr } = await supabase
    .from('profiles')
    .update({
      display_name: "Campus Brew Cafe"
    })
    .eq('id', targetUserId);
  if (profErr) console.error("Error updating profile:", profErr);
  else console.log("✓ Profile display_name updated to 'Campus Brew Cafe'");

  // 4. Update Menu Items
  console.log("\nDeactivating old test items for this shop...");
  await supabase
    .from('menu_items')
    .update({ is_active: false })
    .eq('shop_id', targetShopId);

  console.log("Inserting new Campus Brew Cafe menu items...");
  for (const item of menuItemsData) {
    const itemPayload = {
      shop_id: targetShopId,
      name: item.name,
      description: item.description,
      price: item.price,
      image_path: `/images/menu/${item.filename}`,
      stock_quantity: 50,
      max_quantity_per_order: 10,
      is_manually_available: true,
      is_active: true
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('menu_items')
      .insert(itemPayload)
      .select();

    if (insertErr) {
      console.error(`✗ Error inserting ${item.name}:`, insertErr.message);
    } else {
      console.log(`✓ Inserted ${item.name} (${item.price} BDT)`);
    }
  }

  console.log("\n=== Setup completed successfully! ===");
}

main().catch(console.error);
