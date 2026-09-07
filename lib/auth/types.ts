export type RoleName = "customer" | "shop_staff" | "terminal" | "admin";

export type Profile = {
  id: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

export type ShopMembership = {
  id: string;
  shop_id: string;
  user_id: string;
  is_active: boolean;
};

export type TerminalAccount = {
  id: string;
  auth_user_id: string;
  shop_id: string;
  display_name: string;
  is_active: boolean;
};

export type CurrentUserContext = {
  userId: string;
  email: string | null;
  profile: Profile | null;
  roles: RoleName[];
  shopMemberships: ShopMembership[];
  terminalAccount: TerminalAccount | null;
};
