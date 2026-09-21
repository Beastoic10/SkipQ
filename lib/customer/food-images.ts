/**
 * Deterministic food image mapping utility.
 *
 * Returns a stable, high-definition Unsplash CDN URL for a menu item based
 * on keyword matching against its name and description. Used when item.image_path
 * is null or fails to load — ensures every item has mouthwatering, cohesive photography
 * matching the SkipQ visual reference.
 *
 * All photo IDs are verified stable Unsplash high-resolution food links.
 */

type FoodCategory = {
  keywords: string[];
  /** Unsplash photo ID */
  photoId: string;
  /** Brief alt text descriptor */
  descriptor: string;
  /** Suggested prep time estimate in minutes (min, max) */
  prepTimeMinutes?: [number, number];
};

const FOOD_CATEGORIES: FoodCategory[] = [
  {
    keywords: ["burger", "cheeseburger", "beef burger", "chicken burger", "patty"],
    photoId: "1568901346375-23c9450c58cd",
    descriptor: "Artisan Burger",
    prepTimeMinutes: [10, 15],
  },
  {
    keywords: ["pizza", "slice", "pepperoni", "margherita"],
    photoId: "1565299624946-b28f40a0ae38",
    descriptor: "Stone-baked Pizza",
    prepTimeMinutes: [15, 20],
  },
  {
    keywords: ["biryani", "biriyani", "kacchi", "dum biryani", "tehari", "morog polao"],
    photoId: "1589302168068-964664d93dc0",
    descriptor: "Aromatic Dum Biryani",
    prepTimeMinutes: [10, 15],
  },
  {
    keywords: ["fried rice", "rice", "kichuri", "khichuri", "polao", "plain rice"],
    photoId: "1536304929831-ee1ca9d44906",
    descriptor: "Rice Delicacy",
    prepTimeMinutes: [10, 15],
  },
  {
    keywords: ["chicken", "grilled chicken", "chicken curry", "roast", "crispy chicken", "fry"],
    photoId: "1598515214211-89d3c73ae83b",
    descriptor: "Chicken Specialty",
    prepTimeMinutes: [12, 18],
  },
  {
    keywords: ["sandwich", "sub", "club sandwich", "panini"],
    photoId: "1528735602780-2552fd46c7af",
    descriptor: "Toasted Sandwich",
    prepTimeMinutes: [8, 12],
  },
  {
    keywords: ["wrap", "shawarma", "sharma", "roll", "chicken roll", "egg roll"],
    photoId: "1626700051175-6818013e1d4f",
    descriptor: "Fresh Wrap & Roll",
    prepTimeMinutes: [8, 12],
  },
  {
    keywords: ["noodle", "pasta", "spaghetti", "chow mein", "chowmein", "hakka", "ramen"],
    photoId: "1555126634-323283e090fa",
    descriptor: "Savory Noodles & Pasta",
    prepTimeMinutes: [10, 15],
  },
  {
    keywords: ["samosa", "singara", "somosa", "pakora", "chop", "cutlet", "snack"],
    photoId: "1601050690597-df0568f70950",
    descriptor: "Crispy Campus Snacks",
    prepTimeMinutes: [5, 10],
  },
  {
    keywords: ["fries", "french fries", "wedges", "loaded fries"],
    photoId: "1573080496219-bb080dd4f877",
    descriptor: "Golden Crisp Fries",
    prepTimeMinutes: [8, 12],
  },
  {
    keywords: ["espresso", "single shot", "double shot"],
    photoId: "1510591509098-f4fdc6d0ff04",
    descriptor: "Artisan Espresso",
    prepTimeMinutes: [3, 5],
  },
  {
    keywords: ["americano", "black coffee", "long black"],
    photoId: "1514432324607-a09d9b4aefdd",
    descriptor: "Caffè Americano",
    prepTimeMinutes: [3, 5],
  },
  {
    keywords: ["cappuccino", "cappucino", "mini cap"],
    photoId: "1572442388796-11668a67e53d",
    descriptor: "Frothy Cappuccino",
    prepTimeMinutes: [4, 6],
  },
  {
    keywords: ["latte", "hazelnut", "vanilla", "caramel", "flavor drink"],
    photoId: "1561882468-9110e03e0f78",
    descriptor: "Creamy Café Latte",
    prepTimeMinutes: [4, 6],
  },
  {
    keywords: ["hot chocolate", "chocolate", "cocoa"],
    photoId: "1542990253-0d0f5be5f0ed",
    descriptor: "Rich Hot Chocolate",
    prepTimeMinutes: [4, 7],
  },
  {
    keywords: ["mocha", "caffe mocha"],
    photoId: "1578314675249-a6910f80cc4e",
    descriptor: "Café Mocha",
    prepTimeMinutes: [4, 7],
  },
  {
    keywords: ["fezz", "fizz", "lemon raz", "moroccan mint", "strawberry fezz", "lemon fezz", "cooler", "iced drink"],
    photoId: "1513558161293-cdaf765ed2fd",
    descriptor: "Sparkling Iced Cooler",
    prepTimeMinutes: [3, 6],
  },
  {
    keywords: ["coffee", "cold coffee", "brew"],
    photoId: "1509042239860-f550ce710b93",
    descriptor: "Brewed Coffee",
    prepTimeMinutes: [4, 7],
  },
  {
    keywords: ["tea", "chai", "milk tea", "doodh cha", "black tea", "green tea"],
    photoId: "1576092768241-dec231879fc3",
    descriptor: "Warm Chai",
    prepTimeMinutes: [5, 8],
  },
  {
    keywords: ["juice", "shake", "smoothie", "lassi", "mango drink", "lemonade", "beverage"],
    photoId: "1551024709-8f23befc6f87",
    descriptor: "Chilled Beverage",
    prepTimeMinutes: [5, 8],
  },
  {
    keywords: ["soft drink", "cola", "coke", "pepsi", "sprite", "fanta", "mountain dew", "soda"],
    photoId: "1622483767028-3f66f32aef97",
    descriptor: "Chilled Refreshment",
    prepTimeMinutes: [2, 5],
  },
  {
    keywords: ["salad", "greens", "vegetables", "healthy", "bowl"],
    photoId: "1512621776951-a57ef161bea7",
    descriptor: "Fresh Garden Salad",
    prepTimeMinutes: [8, 12],
  },
  {
    keywords: ["cake", "pastry", "donut", "doughnut", "dessert", "halwa", "pudding", "sweet"],
    photoId: "1578985545062-70097560e0f0",
    descriptor: "Sweet Treat",
    prepTimeMinutes: [3, 6],
  },
  {
    keywords: ["beef", "mutton", "lamb", "rezala", "bhuna", "curry", "meat"],
    photoId: "1547592181-852f23786e73",
    descriptor: "Spiced Curry",
    prepTimeMinutes: [12, 18],
  },
  {
    keywords: ["fish", "hilsa", "ilish", "prawn", "shrimp", "seafood"],
    photoId: "1565557623262-b51531a15b79",
    descriptor: "Fish Dish",
    prepTimeMinutes: [12, 18],
  },
  {
    keywords: ["roti", "naan", "paratha", "bread", "chapati", "puri", "luchi"],
    photoId: "1509440159596-0249088772ff",
    descriptor: "Warm Flatbread",
    prepTimeMinutes: [5, 10],
  },
  {
    keywords: ["egg", "omelette", "dim"],
    photoId: "1525351484163-7529414344d8",
    descriptor: "Egg Dish",
    prepTimeMinutes: [6, 10],
  },
  {
    keywords: ["set meal", "combo", "thali", "platter", "full meal"],
    photoId: "1546069901-ba9599a7e63c",
    descriptor: "Student Platter Combo",
    prepTimeMinutes: [10, 15],
  },
];

/** Clean, mouthwatering generic fallback */
const GENERIC_FOOD_PHOTO_ID = "1504674900247-0877df9cc836";

/**
 * Returns a stable, optimized Unsplash image URL for a food item.
 * Set width to 600px for crisp retina display on mobile and desktop cards.
 */
export function getFoodImageUrl(
  name: string,
  description?: string | null
): string {
  const haystack = `${name} ${description ?? ""}`.toLowerCase();

  for (const category of FOOD_CATEGORIES) {
    if (category.keywords.some((kw) => haystack.includes(kw))) {
      return buildUnsplashUrl(category.photoId);
    }
  }

  return buildUnsplashUrl(GENERIC_FOOD_PHOTO_ID);
}

/**
 * Deterministically estimates prep time based on item name/description
 * for displaying the "⏱️ 15-20 min" pill on menu cards.
 */
export function getEstimatedPrepTime(
  name: string,
  description?: string | null
): string {
  const haystack = `${name} ${description ?? ""}`.toLowerCase();

  for (const category of FOOD_CATEGORIES) {
    if (category.keywords.some((kw) => haystack.includes(kw)) && category.prepTimeMinutes) {
      return `${category.prepTimeMinutes[0]}–${category.prepTimeMinutes[1]} min`;
    }
  }

  return "10–15 min";
}

/**
 * Resolves the display image for a menu item:
 * 1. If item.image_path is non-empty, use it.
 * 2. Otherwise, return high-res deterministic Unsplash photography.
 */
export function resolveMenuItemImage(item: {
  name: string;
  description?: string | null;
  image_path?: string | null;
}): string {
  if (item.image_path && item.image_path.trim().length > 0) {
    return item.image_path;
  }
  return getFoodImageUrl(item.name, item.description);
}

function buildUnsplashUrl(photoId: string): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=640&q=85`;
}
