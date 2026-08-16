# SkipQ Database Design

## 1. Database architecture overview

This document proposes the PostgreSQL/Supabase data model for the SkipQ MVP. It is a design document only: it does not define migrations, create tables, implement functions, or integrate payment/authentication code.

The design supports:

- Customer authentication profiles, university/cafeteria/shop selection, menu browsing, inventory-aware ordering, cash/online payment selection, order tracking, order history, and immediate QR collection credentials after successful order acceptance/finalization.
- Shop/Sales Terminal staff membership, menu management, price and stock management, manual availability, maximum quantity per order, incoming orders, valid order status updates, authorized cancellation, QR validation, and collection.
- Admin management of universities, cafeterias, shops, approvals, staff assignments, users, roles, and basic system visibility.

The database is designed for approximately 10,000 registered users, with shop-scoped operational queries, customer-scoped history queries, and tightly scoped realtime subscriptions.

### Core design choices

1. **Single-shop orders only for MVP**: each order belongs to exactly one shop. This keeps inventory, terminal authorization, payment, QR validation, and cancellation ownership clear.
2. **Supabase Auth remains the identity provider**: `profiles.id` corresponds to `auth.users.id`; application roles are assigned explicitly through database rows, not trusted client claims.
3. **Payment state is separate from order state**: `orders.status` tracks food/order fulfillment; `payment_attempts.status` tracks payment state.
4. **One `payment_attempts` table is enough for MVP**: it can represent minimal cash payment records and multiple online attempts per order without a separate parent `payments` table.
5. **Inventory uses physical stock plus active reservations**: `menu_items.stock_quantity` represents physical on-hand stock not yet permanently consumed. Available stock is `stock_quantity - active_reserved_quantity`. Cash orders decrement `stock_quantity` atomically. Online payments reserve first, then decrement stock and consume the reservation only after trusted SSLCOMMERZ confirmation.
6. **QR codes are opaque collection credentials**: the QR payload contains only an unpredictable token; the database stores only a hashed token lookup value.
7. **Privileged operations are transactional**: order creation, reservation, payment finalization, cancellation, QR generation/validation, and role assignment require PostgreSQL functions, Edge Functions, or server-side logic rather than direct client mutations.

## 2. Entity list

### Identity and authorization

- `profiles`
- `roles`
- `user_roles`
- `shop_staff_memberships`

### Campus and shops

- `universities`
- `cafeterias`
- `shops`

### Menu and inventory

- `menu_items`
- `inventory_reservations`

### Orders

- `orders`
- `order_items`
- `order_status_events`

### Payments and refund-ready tracking

- `payment_attempts`

A separate `payments` parent table is not required for MVP because the order can have many `payment_attempts`, each attempt has its own method/provider/status/reference/metadata, and exactly one successful attempt can be enforced with a partial unique index. Cash is represented as one simple attempt without cash settlement, reconciliation, cash-drawer accounting, or automated cash refund workflows.

### Collection

- `collection_codes`

## 3. Entity-by-entity schema proposal

Types are proposed PostgreSQL/Supabase types. Exact SQL syntax will be defined later in migrations.

### TABLE: profiles

| Column | Type | Nullable | Constraints | Purpose |
| ------ | ---- | -------- | ----------- | ------- |
| `id` | `uuid` | No | Primary key; foreign key to `auth.users.id` on delete cascade/restrict per auth policy | Application profile for a Supabase Auth user. |
| `display_name` | `text` | Yes | Trimmed; length limit recommended | User-visible name. |
| `phone` | `text` | Yes | Unique if phone login/verification is required later | Optional contact phone. |
| `avatar_url` | `text` | Yes | Storage path or external URL policy | Optional profile image reference. |
| `is_active` | `boolean` | No | Default `true` | Allows administrative disabling without deleting auth history. |
| `created_at` | `timestamptz` | No | Default `now()` | Profile creation timestamp. |
| `updated_at` | `timestamptz` | No | Default `now()`; maintained by trigger later | Profile update timestamp. |

### TABLE: roles

| Column | Type | Nullable | Constraints | Purpose |
| ------ | ---- | -------- | ----------- | ------- |
| `id` | `smallint` | No | Primary key | Compact role identifier. |
| `name` | `role_name` enum or `text` | No | Unique; allowed values `customer`, `shop_staff`, `admin` | Explicit application role. |
| `description` | `text` | Yes | | Human-readable role description. |
| `created_at` | `timestamptz` | No | Default `now()` | Audit timestamp. |

`roles` is intentionally a table rather than only an enum because it gives admin tooling and RLS helper functions a stable join target while still allowing a constrained set of role names.

### TABLE: user_roles

| Column | Type | Nullable | Constraints | Purpose |
| ------ | ---- | -------- | ----------- | ------- |
| `id` | `uuid` | No | Primary key | Role assignment row. |
| `user_id` | `uuid` | No | Foreign key to `profiles.id` | User receiving the role. |
| `role_id` | `smallint` | No | Foreign key to `roles.id` | Assigned role. |
| `is_active` | `boolean` | No | Default `true` | Enables revocation without deleting audit history. |
| `assigned_by` | `uuid` | Yes | Foreign key to `profiles.id` | Admin/system actor granting the role. |
| `created_at` | `timestamptz` | No | Default `now()` | Assignment timestamp. |
| `updated_at` | `timestamptz` | No | Default `now()` | Assignment update timestamp. |

### TABLE: universities

| Column | Type | Nullable | Constraints | Purpose |
| ------ | ---- | -------- | ----------- | ------- |
| `id` | `uuid` | No | Primary key | University identifier. |
| `name` | `text` | No | Unique; non-empty | University display name. |
| `slug` | `text` | No | Unique; URL-safe | Stable URL/reference key. |
| `is_active` | `boolean` | No | Default `true` | Controls customer visibility. |
| `created_by` | `uuid` | Yes | Foreign key to `profiles.id` | Admin/system creator. |
| `created_at` | `timestamptz` | No | Default `now()` | Creation timestamp. |
| `updated_at` | `timestamptz` | No | Default `now()` | Update timestamp. |

### TABLE: cafeterias

| Column | Type | Nullable | Constraints | Purpose |
| ------ | ---- | -------- | ----------- | ------- |
| `id` | `uuid` | No | Primary key | Cafeteria identifier. |
| `university_id` | `uuid` | No | Foreign key to `universities.id` | Parent university. |
| `name` | `text` | No | Non-empty; unique with `university_id` recommended | Cafeteria display name. |
| `slug` | `text` | No | Unique with `university_id`; URL-safe | Stable route/reference key. |
| `is_active` | `boolean` | No | Default `true` | Customer visibility/operational state. |
| `approval_status` | `approval_status` | No | Default `PENDING` | Admin approval state. |
| `created_by` | `uuid` | Yes | Foreign key to `profiles.id` | Creator/admin. |
| `approved_by` | `uuid` | Yes | Foreign key to `profiles.id` | Admin approver. |
| `approved_at` | `timestamptz` | Yes | | Approval timestamp. |
| `created_at` | `timestamptz` | No | Default `now()` | Creation timestamp. |
| `updated_at` | `timestamptz` | No | Default `now()` | Update timestamp. |

### TABLE: shops

| Column | Type | Nullable | Constraints | Purpose |
| ------ | ---- | -------- | ----------- | ------- |
| `id` | `uuid` | No | Primary key | Shop identifier. |
| `cafeteria_id` | `uuid` | No | Foreign key to `cafeterias.id` | Parent cafeteria. |
| `owner_profile_id` | `uuid` | Yes | Foreign key to `profiles.id` | Optional owner/shop registrant. |
| `name` | `text` | No | Non-empty; unique with `cafeteria_id` recommended | Shop display name. |
| `slug` | `text` | No | Unique with `cafeteria_id`; URL-safe | Stable route/reference key. |
| `description` | `text` | Yes | | Customer-facing description. |
| `logo_path` | `text` | Yes | Supabase Storage path | Optional shop image/logo. |
| `is_active` | `boolean` | No | Default `true` | Operational visibility. |
| `approval_status` | `approval_status` | No | Default `PENDING` | Admin approval workflow. |
| `created_by` | `uuid` | Yes | Foreign key to `profiles.id` | Creator/admin/registrant. |
| `approved_by` | `uuid` | Yes | Foreign key to `profiles.id` | Admin approver. |
| `approved_at` | `timestamptz` | Yes | | Approval timestamp. |
| `created_at` | `timestamptz` | No | Default `now()` | Creation timestamp. |
| `updated_at` | `timestamptz` | No | Default `now()` | Update timestamp. |

### TABLE: shop_staff_memberships

| Column | Type | Nullable | Constraints | Purpose |
| ------ | ---- | -------- | ----------- | ------- |
| `id` | `uuid` | No | Primary key | Membership identifier. |
| `shop_id` | `uuid` | No | Foreign key to `shops.id` | Shop the staff member can operate. |
| `user_id` | `uuid` | No | Foreign key to `profiles.id` | Staff user. |
| `is_active` | `boolean` | No | Default `true` | Enables activation/deactivation. |
| `assigned_by` | `uuid` | Yes | Foreign key to `profiles.id` | Admin/system actor assigning staff. |
| `created_at` | `timestamptz` | No | Default `now()` | Assignment timestamp. |
| `updated_at` | `timestamptz` | No | Default `now()` | Update timestamp. |

A user must have an active `shop_staff` role and an active `shop_staff_memberships` row for a shop to operate that shop.

### TABLE: menu_items

| Column | Type | Nullable | Constraints | Purpose |
| ------ | ---- | -------- | ----------- | ------- |
| `id` | `uuid` | No | Primary key | Menu item identifier. |
| `shop_id` | `uuid` | No | Foreign key to `shops.id` | Owning shop. |
| `name` | `text` | No | Non-empty | Item name. |
| `description` | `text` | Yes | | Customer-facing details. |
| `price` | `numeric(12,2)` | No | Check `price >= 0` | Current sell price. Historical orders use snapshots. |
| `image_path` | `text` | Yes | Supabase Storage path | Item image reference; binaries are not stored in PostgreSQL. |
| `stock_quantity` | `integer` | No | Check `stock_quantity >= 0`; default `0` | Physical stock available after permanent consumption, before active reservations are subtracted. |
| `max_quantity_per_order` | `integer` | No | Check `max_quantity_per_order > 0` | Per-order cap, separate from stock. |
| `is_manually_available` | `boolean` | No | Default `true` | Staff-controlled manual availability. |
| `is_active` | `boolean` | No | Default `true` | Soft-hide/discontinue without deleting historical references. |
| `created_at` | `timestamptz` | No | Default `now()` | Creation timestamp. |
| `updated_at` | `timestamptz` | No | Default `now()` | Update timestamp. |

Backend order functions must require `is_active = true`, `is_manually_available = true`, requested quantity within `max_quantity_per_order`, and enough available stock.

### TABLE: orders

| Column | Type | Nullable | Constraints | Purpose |
| ------ | ---- | -------- | ----------- | ------- |
| `id` | `uuid` | No | Primary key | Internal order identifier. |
| `order_number` | `text` | No | Unique; human-readable, e.g. `SKQ-1042` | Public order number shown to customers/staff. |
| `customer_id` | `uuid` | No | Foreign key to `profiles.id` | Customer who placed the order. |
| `university_id` | `uuid` | No | Foreign key to `universities.id` | Denormalized campus context at order time. |
| `cafeteria_id` | `uuid` | No | Foreign key to `cafeterias.id` | Denormalized cafeteria context at order time. |
| `shop_id` | `uuid` | No | Foreign key to `shops.id` | Owning shop; exactly one shop per order. |
| `status` | `order_status` | No | Valid enum; default depends on flow | Current order lifecycle status optimized for current-state queries. |
| `payment_method` | `payment_method` | No | `CASH` or `ONLINE` | Customer-selected payment method. |
| `total_amount` | `numeric(12,2)` | No | Check `total_amount >= 0` | Trusted server/database-calculated total. |
| `currency` | `char(3)` | No | Default likely `BDT` | Payment currency. |
| `cancelled_at` | `timestamptz` | Yes | Required if status `CANCELLED` | Cancellation timestamp. |
| `cancelled_by` | `uuid` | Yes | Foreign key to `profiles.id`; required if status `CANCELLED` | Staff/admin actor who cancelled. |
| `cancellation_reason` | `text` | Yes | Required if status `CANCELLED` | Human-provided cancellation reason. |
| `inventory_restored` | `boolean` | No | Default `false` | Whether cancellation restored stock. |
| `collected_at` | `timestamptz` | Yes | Required if status `COLLECTED` | Collection timestamp. |
| `collected_by` | `uuid` | Yes | Foreign key to `profiles.id` | Staff actor who validated collection. |
| `created_at` | `timestamptz` | No | Default `now()` | Creation timestamp. |
| `updated_at` | `timestamptz` | No | Default `now()` | Update timestamp. |

For online checkout attempts before payment confirmation, the order may either be created with a non-fulfillment state such as `PAYMENT_PENDING` or represented as a pending order with payment status `PENDING`. The architecture examples allow an order/payment attempt payment-pending state. This design recommends adding `PAYMENT_PENDING` to `order_status` for online attempts that are not yet active kitchen orders. Once payment is validated, status transitions to `PLACED` and QR is generated.

### TABLE: order_items

| Column | Type | Nullable | Constraints | Purpose |
| ------ | ---- | -------- | ----------- | ------- |
| `id` | `uuid` | No | Primary key | Order line identifier. |
| `order_id` | `uuid` | No | Foreign key to `orders.id` | Parent order. |
| `menu_item_id` | `uuid` | No | Foreign key to `menu_items.id` | Current menu item reference for traceability. |
| `item_name_snapshot` | `text` | No | Non-empty | Preserves historical display even if menu name changes. |
| `quantity` | `integer` | No | Check `quantity > 0` | Purchased quantity. |
| `unit_price_snapshot` | `numeric(12,2)` | No | Check `unit_price_snapshot >= 0` | Trusted unit price at order time. |
| `line_total_snapshot` | `numeric(12,2)` | No | Check `line_total_snapshot = quantity * unit_price_snapshot` where practical | Trusted line total at order time. |
| `created_at` | `timestamptz` | No | Default `now()` | Creation timestamp. |

Description and image snapshots are not required for MVP. The name, quantity, and price snapshots preserve the financial and operational order record. Description/image snapshots can be added later if receipts must be fully immutable visually.

### TABLE: order_status_events

| Column | Type | Nullable | Constraints | Purpose |
| ------ | ---- | -------- | ----------- | ------- |
| `id` | `uuid` | No | Primary key | Status event identifier. |
| `order_id` | `uuid` | No | Foreign key to `orders.id` | Parent order. |
| `previous_status` | `order_status` | Yes | Null for first event | Previous order status. |
| `new_status` | `order_status` | No | Valid enum | New order status. |
| `actor_user_id` | `uuid` | Yes | Foreign key to `profiles.id` | Customer/staff/admin/system actor. |
| `reason` | `text` | Yes | Required for cancellation events | Cancellation reason or operational note. |
| `metadata` | `jsonb` | No | Default `{}` | Context such as inventory restoration decision or payment reference. |
| `created_at` | `timestamptz` | No | Default `now()` | Append-only event timestamp. |

This table should be append-only by policy; updates/deletes should be blocked except for service/admin emergency maintenance.

### TABLE: payment_attempts

| Column | Type | Nullable | Constraints | Purpose |
| ------ | ---- | -------- | ----------- | ------- |
| `id` | `uuid` | No | Primary key | Payment attempt identifier. |
| `order_id` | `uuid` | No | Foreign key to `orders.id` | Related order/checkout. |
| `method` | `payment_method` | No | `CASH` or `ONLINE` | Payment method selected. |
| `provider` | `payment_provider` | Yes | Required for `ONLINE`; `SSLCOMMERZ` for MVP | Online gateway provider. Null or `CASH` provider for cash. |
| `provider_channel` | `text` | Yes | e.g. bKash via SSLCOMMERZ | Gateway channel without direct bKash integration. |
| `status` | `payment_status` | No | Default `PENDING` | Payment lifecycle state. |
| `amount` | `numeric(12,2)` | No | Check `amount >= 0` | Trusted amount sent/recorded. |
| `currency` | `char(3)` | No | Default likely `BDT` | Payment currency. |
| `transaction_ref` | `text` | No | Unique | Internal unique reference sent to/used with gateway. |
| `gateway_session_id` | `text` | Yes | Unique where not null | Gateway session/transaction identifier. |
| `gateway_transaction_id` | `text` | Yes | Unique where not null | Provider transaction identifier after payment. |
| `gateway_metadata` | `jsonb` | No | Default `{}` | Sanitized gateway request/response metadata. |
| `paid_at` | `timestamptz` | Yes | Required if `status = PAID` | Authoritative paid timestamp. |
| `failed_at` | `timestamptz` | Yes | | Failure timestamp. |
| `cancelled_at` | `timestamptz` | Yes | | Payment cancellation timestamp. |
| `expired_at` | `timestamptz` | Yes | | Payment expiry timestamp. |
| `refund_status` | `refund_status` | No | Default `NOT_REQUIRED` | Refund-ready tracking without a full refund subsystem. |
| `refund_reference` | `text` | Yes | | Future/manual refund reference. |
| `refund_metadata` | `jsonb` | No | Default `{}` | Future/manual refund context. |
| `created_at` | `timestamptz` | No | Default `now()` | Attempt creation timestamp. |
| `updated_at` | `timestamptz` | No | Default `now()` | Attempt update timestamp. |

One `payment_attempts` table cleanly supports multiple online attempts and simple cash payment records. Use a partial unique index to allow at most one successful `PAID` attempt per order unless a future product decision supports split payments.

### TABLE: inventory_reservations

| Column | Type | Nullable | Constraints | Purpose |
| ------ | ---- | -------- | ----------- | ------- |
| `id` | `uuid` | No | Primary key | Reservation identifier. |
| `menu_item_id` | `uuid` | No | Foreign key to `menu_items.id` | Reserved item. |
| `order_id` | `uuid` | No | Foreign key to `orders.id` | Related pending/online order. |
| `payment_attempt_id` | `uuid` | Yes | Foreign key to `payment_attempts.id` | Related online attempt; may be nullable during creation then filled atomically. |
| `quantity` | `integer` | No | Check `quantity > 0` | Held quantity. |
| `status` | `reservation_status` | No | Default `ACTIVE` | Reservation lifecycle. |
| `expires_at` | `timestamptz` | No | Must be after `created_at` | Expiration deadline. |
| `consumed_at` | `timestamptz` | Yes | Required if `CONSUMED` | When reservation became permanent stock consumption. |
| `released_at` | `timestamptz` | Yes | Required if `RELEASED` | When reservation was manually released. |
| `expired_at` | `timestamptz` | Yes | Required if `EXPIRED` | When reservation expired. |
| `created_at` | `timestamptz` | No | Default `now()` | Creation timestamp. |
| `updated_at` | `timestamptz` | No | Default `now()` | Update timestamp. |

For online orders with multiple menu items, each line item should have its own reservation row. This keeps concurrency, partial line validation, and release/consumption simple and item-scoped.

### TABLE: collection_codes

| Column | Type | Nullable | Constraints | Purpose |
| ------ | ---- | -------- | ----------- | ------- |
| `id` | `uuid` | No | Primary key | Collection credential row. |
| `order_id` | `uuid` | No | Foreign key to `orders.id`; unique for MVP | The order this credential collects. |
| `token_hash` | `text` | No | Unique | Hash of opaque QR token for lookup; raw token is never stored. |
| `expires_at` | `timestamptz` | Yes | | Optional credential expiry. |
| `used_at` | `timestamptz` | Yes | | Set when QR is successfully used. |
| `validated_by` | `uuid` | Yes | Foreign key to `profiles.id` | Staff member who validated collection. |
| `created_at` | `timestamptz` | No | Default `now()` | Credential creation timestamp. |

`collection_codes.order_id` should be `UNIQUE` for the MVP because there should normally be one active collection credential per accepted/finalized order. If future requirements add credential rotation/reissue, a separate `status` column or partial uniqueness for active credentials can replace this strict uniqueness.

## 4. Relationships

### Relationship map

```text
Supabase auth.users
→ has one profiles

profiles
→ has many user_roles
→ has many shop_staff_memberships
→ has many orders as customer
→ may act in order_status_events, cancellations, and collection validation

roles
→ has many user_roles

University
→ has many Cafeterias
→ Cafeteria has many Shops
→ Shop has many Menu Items
→ Shop has many Staff Memberships
→ Shop has many Orders

Customer/Profile
→ has many Orders

Order
→ belongs to exactly one University
→ belongs to exactly one Cafeteria
→ belongs to exactly one Shop
→ has many Order Items
→ has many Order Status Events
→ has many Payment Attempts
→ has many Inventory Reservations for online holds
→ has one Collection Code for MVP

Menu Item
→ has many Order Items
→ has many Inventory Reservations

Payment Attempt
→ belongs to one Order
→ may have many Inventory Reservations for the online attempt

Collection Code
→ belongs to one Order
→ is validated by one Staff/Profile when used
```

### Ownership boundaries

- A cafeteria is owned by exactly one university.
- A shop is owned by exactly one cafeteria.
- A menu item is owned by exactly one shop.
- A staff member can operate only shops with an active `shop_staff_memberships` row and active `shop_staff` role.
- An order belongs to exactly one shop for MVP; multi-shop carts/orders are intentionally out of scope.

## 5. Enums and statuses

### `role_name`

- `customer`
- `shop_staff`
- `admin`

### `approval_status`

- `PENDING`
- `APPROVED`
- `REJECTED`
- `SUSPENDED`

### `order_status`

Recommended values:

- `PAYMENT_PENDING`: online payment/reservation exists, but the order is not yet an active kitchen order and should not receive a valid QR.
- `PLACED`
- `PREPARING`
- `READY`
- `COLLECTED`
- `CANCELLED`

`PAYMENT_PENDING` is approved as an internal order status for online checkout attempts. It should be hidden or clearly treated as a non-kitchen internal state in customer-facing flows until trusted payment finalization moves the order to `PLACED`, or payment failure/cancellation/expiry releases the reservation and prevents QR generation.

### `payment_method`

- `CASH`
- `ONLINE`

### `payment_provider`

- `SSLCOMMERZ`

Cash attempts may use `provider = null` rather than a `CASH` provider to avoid over-modeling cash accounting.

### `payment_status`

- `PENDING`
- `PAID`
- `FAILED`
- `CANCELLED`
- `EXPIRED`
- `REFUND_PENDING`
- `REFUNDED`

### `refund_status`

- `NOT_REQUIRED`
- `PENDING`
- `REFUNDED`
- `FAILED`

This is intentionally minimal and refund-ready. It does not implement automated refund operations.

### `reservation_status`

- `ACTIVE`
- `CONSUMED`
- `RELEASED`
- `EXPIRED`

## 6. Constraints

### Foreign keys

- `profiles.id` → `auth.users.id`
- `user_roles.user_id` → `profiles.id`
- `user_roles.role_id` → `roles.id`
- `universities.created_by` → `profiles.id`
- `cafeterias.university_id` → `universities.id`
- `cafeterias.created_by`, `cafeterias.approved_by` → `profiles.id`
- `shops.cafeteria_id` → `cafeterias.id`
- `shops.owner_profile_id`, `shops.created_by`, `shops.approved_by` → `profiles.id`
- `shop_staff_memberships.shop_id` → `shops.id`
- `shop_staff_memberships.user_id`, `shop_staff_memberships.assigned_by` → `profiles.id`
- `menu_items.shop_id` → `shops.id`
- `orders.customer_id`, `orders.cancelled_by`, `orders.collected_by` → `profiles.id`
- `orders.university_id` → `universities.id`
- `orders.cafeteria_id` → `cafeterias.id`
- `orders.shop_id` → `shops.id`
- `order_items.order_id` → `orders.id`
- `order_items.menu_item_id` → `menu_items.id`
- `order_status_events.order_id` → `orders.id`
- `order_status_events.actor_user_id` → `profiles.id`
- `payment_attempts.order_id` → `orders.id`
- `inventory_reservations.menu_item_id` → `menu_items.id`
- `inventory_reservations.order_id` → `orders.id`
- `inventory_reservations.payment_attempt_id` → `payment_attempts.id`
- `collection_codes.order_id` → `orders.id`
- `collection_codes.validated_by` → `profiles.id`

### Unique constraints and partial unique indexes

- `roles.name` unique.
- `universities.name` unique.
- `universities.slug` unique.
- `cafeterias(university_id, name)` unique.
- `cafeterias(university_id, slug)` unique.
- `shops(cafeteria_id, name)` unique.
- `shops(cafeteria_id, slug)` unique.
- `orders.order_number` unique.
- `payment_attempts.transaction_ref` unique.
- `payment_attempts.gateway_session_id` unique where not null.
- `payment_attempts.gateway_transaction_id` unique where not null.
- `collection_codes.token_hash` unique.
- `collection_codes.order_id` unique for MVP.
- `user_roles(user_id, role_id)` unique for active role rows, preferably partial where `is_active = true`.
- `shop_staff_memberships(shop_id, user_id)` unique for active memberships, preferably partial where `is_active = true`.
- At most one `PAID` payment attempt per order, with a partial unique index on `payment_attempts(order_id)` where `status = 'PAID'`.

### Check constraints

- `menu_items.price >= 0`.
- `menu_items.stock_quantity >= 0`.
- `menu_items.max_quantity_per_order > 0`.
- `orders.total_amount >= 0`.
- `order_items.quantity > 0`.
- `order_items.unit_price_snapshot >= 0`.
- `order_items.line_total_snapshot >= 0`; generated or validated as `quantity * unit_price_snapshot` where practical.
- `payment_attempts.amount >= 0`.
- `inventory_reservations.quantity > 0`.
- `inventory_reservations.expires_at > created_at`.
- Cancellation columns on `orders` should be all present when `status = 'CANCELLED'`.
- Collection columns on `orders` should be present when `status = 'COLLECTED'`.
- `payment_attempts.provider = 'SSLCOMMERZ'` when `method = 'ONLINE'`.
- `payment_attempts.provider is null` or a simple allowed value when `method = 'CASH'`.

### Valid transition enforcement

A check constraint can restrict valid enum values, but state transition rules require trusted functions/triggers because they depend on previous state, actor authorization, cancellation rules, inventory, and payment state. Direct arbitrary updates to `orders.status` should be blocked by RLS and exposed only through trusted operations.

## 7. Indexes

### Identity and authorization

- `profiles(id)` primary key.
- `user_roles(user_id, is_active)` for role checks.
- `user_roles(role_id, is_active)` for admin visibility by role.
- `shop_staff_memberships(user_id, is_active)` for staff → shops lookup.
- `shop_staff_memberships(shop_id, is_active)` for shop staff management.

### Campus/shop browsing

- `cafeterias(university_id, is_active, approval_status)` for customer cafeteria listing.
- `shops(cafeteria_id, is_active, approval_status)` for customer shop listing.
- `menu_items(shop_id, is_active, is_manually_available)` for shop menu browsing.

### Orders and terminal operations

- `orders(customer_id, created_at desc)` for customer order history.
- `orders(customer_id, status)` for customer active order tracking.
- `orders(shop_id, status, created_at desc)` for terminal incoming/active orders.
- `orders(shop_id, created_at desc)` for terminal history.
- `orders(order_number)` unique lookup.
- `order_items(order_id)` for order details.
- `order_status_events(order_id, created_at)` for status history.

### Payments and inventory

- `payment_attempts(order_id, created_at desc)` for attempts per order.
- `payment_attempts(transaction_ref)` unique lookup for gateway validation.
- `payment_attempts(gateway_session_id)` where not null.
- `payment_attempts(gateway_transaction_id)` where not null.
- `inventory_reservations(menu_item_id, status)` for active reservation sums.
- `inventory_reservations(order_id)` for order/reservation cleanup.
- `inventory_reservations(payment_attempt_id)` for payment finalization/release.
- `inventory_reservations(status, expires_at)` where `status = 'ACTIVE'` for expiry jobs.

### Collection

- `collection_codes(token_hash)` unique lookup for QR validation.
- `collection_codes(order_id)` unique for order confirmation/tracking.
- `collection_codes(used_at)` optional for collection reporting.

## 8. RLS policy design

RLS should be enabled on all application tables. Policies below are conceptual and should be implemented with helper functions such as `is_admin(auth.uid())`, `has_role(auth.uid(), role_name)`, and `is_active_shop_staff(auth.uid(), shop_id)`.

### How RLS determines roles and shop membership

- A user is a **customer** if they have an active `user_roles` row for `customer`.
- A user is **shop staff** if they have an active `user_roles` row for `shop_staff`.
- A user's authorized shops are the active `shop_staff_memberships.shop_id` rows for that user, ideally requiring both active membership and active `shop_staff` role.
- A user is an **admin** if they have an active `user_roles` row for `admin`.
- Client-supplied role claims are never authoritative.

### Public/customer-readable campus data

- `universities`: authenticated users can read active universities; admins can manage all.
- `cafeterias`: authenticated users can read active and approved cafeterias under active universities; admins can manage all.
- `shops`: authenticated users can read active and approved shops under active cafeterias; assigned staff can read their shops; admins can manage all.
- `menu_items`: authenticated users can read active menu items for active/approved shops; assigned staff can manage their shop menu items; admins can read/manage as authorized.

### Customer data policies

- `profiles`: users can read/update their own profile fields; admins can manage profiles.
- `orders`: customers can read their own orders; customers should not directly insert/update orders outside trusted order functions; staff can read shop orders; admins can read authorized data.
- `order_items`: customers can read items for their own orders; staff can read items for assigned shop orders; writes only through trusted order functions.
- `order_status_events`: customers can read events for their own orders; staff can read events for assigned shop orders; inserts only through trusted status/cancellation/collection functions.
- `payment_attempts`: customers can read sanitized payment attempts for their own orders; staff can read necessary payment state for assigned shop orders; gateway-sensitive metadata may require server-only access or restricted columns/views.
- `collection_codes`: customers can read enough data to display their own QR token only if the raw token is returned at generation time or kept in a secure client state. The table stores only `token_hash`, so direct customer reads should avoid exposing hashes. Staff cannot directly update collection rows; validation uses trusted logic.

### Shop staff policies

- Staff can read/update menu items for assigned active shop memberships.
- Staff can update stock/manual availability/max quantity only for assigned shops, preferably through trusted stock adjustment functions for auditability.
- Staff can read and progress orders only for assigned shops and only through valid status-update functions.
- Staff can cancel eligible orders only through trusted cancellation logic.
- Staff can validate QR credentials only through trusted QR validation logic.

### Admin policies

- Admins can manage universities, cafeterias, shops, approvals, staff assignments, users, and role assignments.
- Role assignment should still use trusted server-side/privileged logic to prevent privilege escalation and preserve audit history.

### Privileged operations beyond RLS

RLS is not sufficient for operations requiring multi-table consistency, payment secrets, or atomic inventory changes. The following should use PostgreSQL functions, Next.js server-side routes/functions, and/or Supabase Edge Functions:

- Order creation.
- Inventory reservation.
- Inventory consumption.
- Reservation release/expiry.
- Cancellation.
- QR token generation.
- QR validation/collection.
- Payment initiation.
- Payment confirmation/IPN validation.
- Refund state changes.
- Role assignment and staff membership changes.

## 9. Transactional operation design

These are design specifications only. No functions are implemented yet.

### 9.1 Create cash order

| Aspect | Design |
| ------ | ------ |
| Inputs | Customer ID from session, shop ID, requested item IDs/quantities, payment method `CASH`. |
| Tables affected | `menu_items`, `orders`, `order_items`, `payment_attempts`, `order_status_events`, `collection_codes`. |
| Validations | Authenticated customer; shop/cafeteria/university active and approved; single shop; each item active, manually available, stock > 0, quantity <= max per order, enough available stock; totals calculated server-side. |
| Atomic operations | Lock/update menu item stock rows; decrement `stock_quantity`; create order with `PLACED`; create item snapshots; create simple cash payment attempt; create initial status event; generate/store hashed collection token. |
| Failure/rollback | Any validation or stock update failure rolls back all inserts and stock changes; no partial order or QR remains. |

### 9.2 Create online checkout/reservation

| Aspect | Design |
| ------ | ------ |
| Inputs | Customer ID from session, shop ID, requested item IDs/quantities, payment method `ONLINE`. |
| Tables affected | `menu_items`, `orders`, `order_items`, `inventory_reservations`, `payment_attempts`, optionally status events. |
| Validations | Same menu/shop/customer validations as cash; available stock calculated as physical stock minus active reservations; quantity <= max per order; trusted total calculation. |
| Atomic operations | Lock relevant menu item rows; verify available stock; create `PAYMENT_PENDING` order; create item snapshots; create `PENDING` payment attempt with unique transaction reference; create `ACTIVE` reservations per item with expiry; initiate SSLCOMMERZ via server-side logic after DB transaction or within a controlled orchestration flow. |
| Failure/rollback | If stock is unavailable or references are invalid, transaction rolls back. If gateway initiation fails after reservation, trusted logic should mark payment failed/cancelled and release reservations. |

### 9.3 Finalize successful online payment

| Aspect | Design |
| ------ | ------ |
| Inputs | SSLCOMMERZ IPN/server notification payload, transaction reference, gateway transaction ID, verified amount/currency/status. |
| Tables affected | `payment_attempts`, `inventory_reservations`, `menu_items`, `orders`, `order_status_events`, `collection_codes`. |
| Validations | Server-side gateway validation succeeds; amount/currency match trusted order/payment amount; payment attempt is `PENDING`; reservations are `ACTIVE` and not expired; order belongs to attempt and is payment-pending/not cancelled. |
| Atomic operations | Mark payment `PAID`; lock reservations and menu items; decrement `stock_quantity` by reserved quantity; mark reservations `CONSUMED`; transition order to `PLACED`; create status event; generate/store hashed collection token. |
| Failure/rollback | If validation fails, do not mark paid or generate QR. If stock/reservation state is invalid, transaction rolls back and requires operational review/retry handling. Idempotent handling should treat already-paid/finalized attempts as success without duplicating consumption or QR. |

### 9.4 Release expired/failed reservation

| Aspect | Design |
| ------ | ------ |
| Inputs | Reservation ID, payment attempt ID, or scheduled expiry cutoff. |
| Tables affected | `inventory_reservations`, `payment_attempts`, `orders`, optional `order_status_events`. |
| Validations | Reservation is `ACTIVE`; payment is not `PAID`; reservation expiry/failure/cancellation condition is met. |
| Atomic operations | Mark reservation `RELEASED` or `EXPIRED`; mark payment `FAILED`, `CANCELLED`, or `EXPIRED` as appropriate; optionally mark payment-pending order cancelled/expired if no further attempts are allowed. Physical `stock_quantity` is not incremented because physical stock was not decremented during reservation. |
| Failure/rollback | If reservation is already `CONSUMED`, release must fail. Operation must be idempotent for already released/expired reservations. |

### 9.5 Cancel order

| Aspect | Design |
| ------ | ------ |
| Inputs | Staff user ID from session, order ID, cancellation reason, inventory restoration decision/business-rule metadata. |
| Tables affected | `orders`, `order_status_events`, `menu_items`, `payment_attempts`, possibly `inventory_reservations`. |
| Validations | Staff has active membership for order shop; order status is `PLACED` or eligible `PREPARING`; reason is present; `READY` and `COLLECTED` cancellation rejected by default; inventory restoration allowed only if food/stock is safely restorable. |
| Atomic operations | Transition order to `CANCELLED`; record cancellation metadata; create status event; restore stock atomically only when allowed; update payment/refund status as needed, such as `REFUND_PENDING` for paid online orders. |
| Failure/rollback | Any invalid state, unauthorized staff, missing reason, or stock/payment update error rolls back the cancellation. |

### 9.6 Validate collection QR

| Aspect | Design |
| ------ | ------ |
| Inputs | Staff user ID from session, raw QR token. |
| Tables affected | `collection_codes`, `orders`, `order_status_events`. |
| Validations | Hash token and find collection code; token not expired and unused; related order exists; staff belongs to order shop; order status is `READY`; QR belongs to same shop; no prior collection. |
| Atomic operations | Lock collection code and order; set order `COLLECTED`, `collected_at`, `collected_by`; set collection code `used_at`, `validated_by`; create status event. |
| Failure/rollback | Invalid, reused, wrong-shop, expired, or not-ready QR fails with no state changes. Concurrent scans must allow only one success. |

### 9.7 Update order status

| Aspect | Design |
| ------ | ------ |
| Inputs | Staff user ID from session, order ID, requested new status. |
| Tables affected | `orders`, `order_status_events`. |
| Validations | Staff has active membership for order shop; transition is valid: `PLACED → PREPARING`, `PREPARING → READY`, or collection via QR function for `READY → COLLECTED`; cancellation uses cancellation function. |
| Atomic operations | Lock order; update status; append status event. |
| Failure/rollback | Invalid transition or unauthorized staff rolls back; no status event is inserted. |

## 10. Inventory concurrency strategy

### Chosen stock model: physical stock minus active reservations

This design chooses option A:

```text
available_stock = menu_items.stock_quantity - sum(ACTIVE inventory_reservations.quantity for the item)
```

`menu_items.stock_quantity` represents physical stock not permanently consumed. Active online reservations reduce what customers can reserve/order, but do not permanently decrement physical stock until payment is authoritatively confirmed.

### Why this model

- It cleanly separates temporary online holds from permanent consumption.
- Failed/cancelled/expired online payments only release reservations; they do not need to increment stock that was never decremented.
- Cash orders remain simple: stock is decremented immediately in the same transaction that creates the order.
- Online finalization is explicit: reservation becomes `CONSUMED`, and physical stock is decremented exactly once.

### Preventing overselling

Atomic reservation and consumption functions must lock relevant `menu_items` rows or use equivalent serializable/advisory locking patterns before calculating availability. The operation should validate:

```text
stock_quantity - active_reserved_quantity >= requested_quantity
```

while holding the lock, then insert active reservations or decrement stock before committing. The design must never allow negative physical stock or negative available stock.

### Reservation release behavior

Because physical stock is not decremented for active reservations, releasing an expired/failed reservation changes only reservation state. Available stock increases automatically because the reservation no longer counts as active. Release must be idempotent and must not release a reservation already consumed by a successful payment.

## 11. Payment/inventory relationship

### Cash

```text
Order creation
→ stock consumed atomically
→ order status PLACED
→ cash payment attempt recorded simply
→ collection code generated
```

Cash payment support is intentionally minimal. Cash orders should be represented by a simple `payment_attempts` row sufficient to record method, amount, status, and timestamps. There are no cash drawer, settlement, reconciliation, cash refund, or automated cash refund workflow tables in the MVP design.

### Online with SSLCOMMERZ

```text
Online checkout
→ order created as PAYMENT_PENDING
→ payment attempt PENDING
→ inventory reservations ACTIVE
→ SSLCOMMERZ payment initiated

Trusted IPN/validation succeeds
→ payment attempt PAID
→ reservations CONSUMED
→ stock_quantity decremented
→ order status PLACED
→ collection code generated

Payment fails/cancels/expires
→ payment attempt FAILED/CANCELLED/EXPIRED
→ reservations RELEASED/EXPIRED
→ no stock decrement
→ no valid collection code
```

Retries are handled by creating additional `payment_attempts` rows for the same order or by creating a new checkout order, depending on final UX. The table design supports multiple attempts per order and enforces at most one paid attempt per order.

## 12. QR security model

- Raw QR tokens must be generated by trusted backend logic using cryptographically secure randomness.
- QR payload contains only the opaque raw token.
- PostgreSQL stores only `collection_codes.token_hash`, never the raw token.
- `token_hash` is unique and indexed for lookup.
- `order_id` is unique for MVP, representing one collection credential per successful/accepted order.
- QR is generated immediately for successful cash orders.
- QR is generated only after authoritative SSLCOMMERZ validation/finalization for online orders.
- Validation is server-side and atomic.
- Validation requires staff membership in the order's shop.
- Validation requires order status `READY`.
- Reused tokens fail because `used_at` is already set.
- Wrong-shop tokens fail because staff authorization is checked against `orders.shop_id`.

## 13. Cancellation model

Customers cannot cancel orders from the application.

Only active shop staff for the order's shop can cancel eligible orders. Cancellation supports:

- `PLACED → CANCELLED`
- `PREPARING → CANCELLED` only when business rules allow it.

Cancellation rejects by default:

- `READY → CANCELLED`
- `COLLECTED → CANCELLED`

Cancellation must retain the order and record:

- `orders.cancelled_at`
- `orders.cancelled_by`
- `orders.cancellation_reason`
- `orders.inventory_restored`
- an append-only `order_status_events` row
- payment/refund state in `payment_attempts`

If stock can safely be returned, cancellation restores `menu_items.stock_quantity` atomically. Prepared/non-restorable food should not automatically return to stock. Online cancellation may set `payment_attempts.status` or `refund_status` to indicate refund need, but refund completion remains separate from cancellation.

## 14. Realtime considerations

Realtime should be enabled selectively.

### Recommended realtime tables

- `orders`: customer order status/readiness; shop incoming and active order changes.
- `order_status_events`: optional customer timeline and terminal audit feed.
- `menu_items`: optional terminal/customer availability updates if UX requires live menu changes.

### Avoid broad/global realtime

- Customer clients should subscribe only to their own order rows or order-specific channels.
- Shop terminal clients should subscribe only to assigned shop orders and relevant active statuses.
- Admin realtime should be limited and likely unnecessary for MVP except approval dashboards if needed.
- Avoid global subscriptions for all orders, payment attempts, collection codes, or profiles.

Payment confirmation and QR validation should not rely on realtime for correctness; realtime is only for UI updates after trusted state changes commit.

## 15. Supabase Storage considerations

- Store menu item images, shop logos, and optional profile avatars in Supabase Storage.
- Store only paths/references in PostgreSQL, such as `menu_items.image_path`, `shops.logo_path`, and `profiles.avatar_url`.
- Do not store image binaries in PostgreSQL.
- Storage policies should align with database ownership:
  - Public read or signed read for approved menu/shop images, depending on privacy needs.
  - Write/update only by assigned shop staff for their shop media or admins.
  - Profile avatar writes only by the profile owner or admins.
- Image upload limits, accepted file types, and moderation requirements remain open product decisions.

## 16. Open decisions before migrations

The database design intentionally resolves the major MVP modeling choices, including the internal `PAYMENT_PENDING` order status, single-table `payment_attempts` model, physical-stock-minus-active-reservations inventory model, one unique collection code per accepted/finalized order, terminal-only cancellation, and intentionally minimal cash payment representation. These decisions still require product approval before migrations are created:

1. **Reservation timeout**: exact duration for `inventory_reservations.expires_at`, such as 10 or 15 minutes.
2. **QR expiration policy**: whether collection codes expire and, if so, the exact duration.
3. **`PREPARING → CANCELLED` inventory restoration rule**: exact food/category criteria for safely restoring stock.
4. **Image upload policy**: upload size limits, allowed formats, and whether menu images require admin approval.
5. **Future refund automation**: whether MVP needs only manual refund tracking or a more explicit future `refunds` table before automated refund integration.

## 17. Key design decision summary

- Use Supabase Auth plus `profiles`, `roles`, and `user_roles` for explicit authorization.
- Use `shop_staff_memberships` to define which shop(s) a staff user can operate, with active/deactivated membership support.
- Model the campus hierarchy as University → Cafeteria → Shop → Menu Items.
- Keep MVP orders single-shop only.
- Store stock, maximum quantity per order, and manual availability separately on `menu_items`.
- Use physical stock minus active reservations for available stock.
- Use `inventory_reservations` for online payment holds and consume stock only after trusted SSLCOMMERZ confirmation.
- Use one `payment_attempts` table for cash and multiple online attempts, avoiding over-engineered cash accounting.
- Keep order status and payment status independent.
- Store price snapshots in `order_items` so historical orders remain correct after menu changes.
- Generate one unique collection credential per accepted/finalized order for MVP.
- Store only hashed QR tokens and validate QR collection through trusted atomic logic.
- Use RLS for baseline access control and trusted transactional functions/Edge/server logic for privileged multi-table operations.
