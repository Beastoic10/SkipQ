import type { CustomerMenuItem } from "./data";

export type CartItem = {
  menu_item_id: string;
  name: string;
  price: number;
  image_path: string | null;
  quantity: number;
  max_quantity_per_order: number;
  available_stock: number;
};

export type OutletContext = {
  university_id: string;
  university_name: string;
  cafeteria_id: string;
  cafeteria_name: string;
  shop_id: string;
  shop_name: string;
};

export type CartState = {
  outlet: OutletContext | null;
  items: CartItem[];
};

export type PendingOutletSwitch = {
  outlet: OutletContext;
  item: CustomerMenuItem;
  quantity: number;
};
