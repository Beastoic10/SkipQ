export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type AdminStats = {
  totalUniversities: number;
  totalCafeterias: number;
  totalShops: number;
  activeShops: number;
  totalTerminals: number;
  activeTerminals: number;
  totalMenuItems: number;
  totalOrders: number;
  pendingApprovalsCount: number;
  recentOrders: AdminRecentOrder[];
};

export type AdminRecentOrder = {
  id: string;
  order_number: string;
  order_code: string | null;
  status: "PAYMENT_PENDING" | "PLACED" | "PREPARING" | "READY" | "COLLECTED" | "CANCELLED";
  payment_method: "CASH" | "ONLINE";
  total_amount: number;
  currency: string;
  shop_name: string;
  cafeteria_name: string;
  created_at: string;
};

export type AdminUniversity = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  cafeteria_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminCafeteria = {
  id: string;
  university_id: string;
  university_name: string;
  name: string;
  slug: string;
  is_active: boolean;
  approval_status: ApprovalStatus;
  shop_count: number;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminShop = {
  id: string;
  cafeteria_id: string;
  cafeteria_name: string;
  university_name: string;
  name: string;
  slug: string;
  description: string | null;
  logo_path: string | null;
  is_active: boolean;
  approval_status: ApprovalStatus;
  terminal_count: number;
  menu_item_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminTerminalAccount = {
  id: string;
  auth_user_id: string;
  email: string | null;
  shop_id: string;
  shop_name: string;
  cafeteria_name: string;
  university_name: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminMenuItem = {
  id: string;
  shop_id: string;
  shop_name: string;
  cafeteria_name: string;
  name: string;
  description: string | null;
  price: number;
  image_path: string | null;
  stock_quantity: number;
  max_quantity_per_order: number;
  is_manually_available: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminApprovalItem = {
  id: string;
  type: "cafeteria" | "shop";
  name: string;
  parent_name: string;
  slug: string;
  approval_status: ApprovalStatus;
  created_at: string;
};

export type AdminActionResult = {
  success: boolean;
  message: string;
  error?: string;
  id?: string;
};

// Form mutation inputs
export type CreateUniversityInput = {
  name: string;
  slug: string;
  is_active?: boolean;
};

export type UpdateUniversityInput = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

export type CreateCafeteriaInput = {
  university_id: string;
  name: string;
  slug: string;
  is_active?: boolean;
  approval_status?: ApprovalStatus;
};

export type UpdateCafeteriaInput = {
  id: string;
  university_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  approval_status: ApprovalStatus;
};

export type CreateShopInput = {
  cafeteria_id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean;
  approval_status?: ApprovalStatus;
};

export type UpdateShopInput = {
  id: string;
  cafeteria_id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  approval_status: ApprovalStatus;
};

export type CreateTerminalAccountInput = {
  shop_id: string;
  display_name: string;
  email: string;
  password?: string;
};

export type UpdateTerminalAccountInput = {
  id: string;
  shop_id: string;
  display_name: string;
  is_active: boolean;
};

export type CreateMenuItemInput = {
  shop_id: string;
  name: string;
  description?: string | null;
  price: number;
  initial_stock: number;
  max_quantity_per_order: number;
  is_manually_available?: boolean;
  is_active?: boolean;
  image_path?: string | null;
};

export type UpdateMenuItemInput = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  stock_adjustment?: number;
  max_quantity_per_order: number;
  is_manually_available: boolean;
  is_active: boolean;
  image_path?: string | null;
};
