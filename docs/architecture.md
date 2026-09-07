# SkipQ Architecture and Domain Model

## 1. Product summary

SkipQ is a cafeteria ordering and queue-management application for universities. The first release must support three roles:

- **Customer**: places orders, pays by cash or configured online payment, receives an immediate collection QR after a successful order/payment, tracks order progress, and physically collects food using the QR credential.
- **Shop/Sales Terminal**: represents physical sales points (outlets/counters), not individual human staff. Each physical shop/outlet has its own Supabase Auth terminal account. Anyone operating that physical terminal device uses its account. Manages menu items, inventory, incoming orders, order statuses, terminal-authorized cancellations, QR scanning, and customer collection.
- **Admin**: manages universities, cafeterias, shops, shop approvals, terminal account onboarding, users, roles, and basic system visibility.

The customer experience should be mobile-first, food-focused, rounded, card-based, and warm. The reference UI should influence the design language without being copied literally.

## 2. System architecture

### Frontend application

- **Next.js App Router + TypeScript** for web routes, server-rendered screens, server-side boundaries, and typed domain code.
- **Tailwind CSS** for responsive styling and a reusable design system.
- **Capacitor** compatibility for later mobile packaging. Shared code should avoid browser-only assumptions unless isolated behind platform checks.
- Suggested route grouping:
  - `app/(customer)/...` for customer ordering, confirmation, tracking, and history.
  - `app/(terminal)/...` for shop/sales terminal workflows.
  - `app/(admin)/...` for administrative workflows.
  - `app/auth/...` for login and auth callbacks.

### Supabase platform

- **Supabase Auth**: account identity and session management.
- **Supabase PostgreSQL**: system of record for users, campus data, shops, terminal accounts, menus, inventory, orders, payments, QR credentials, and audit events.
- **Supabase Row Level Security (RLS)**: mandatory access control on tenant/user-scoped data.
- **Supabase Realtime**: scoped subscriptions for customer order updates and shop terminal incoming/relevant order changes.
- **Supabase Storage**: menu item images and shop/cafeteria media where appropriate.
- **Trusted backend logic**: Next.js server routes/server functions, Supabase Edge Functions, and/or PostgreSQL functions for operations requiring secrets, authorization enforcement, atomic transactions, or gateway verification.

### Domain modules

- `auth`: session handling, role checks, profile loading, and terminal authentication.
- `universities`: university selection and admin management.
- `cafeterias`: food vendor/business/brand listing, active/approval state, and university association.
- `shops`: physical outlet/sales-point profile, approval, operational status, and terminal account association (`terminal_accounts`). Customer UI should usually call these “Sales Points” or “Locations” rather than exposing the internal `shops` table name.
- `menu`: outlet-specific item details, pricing, images, manual availability, and max quantity per order.
- `inventory`: stock quantity, atomic consumption, stock reservations, release/expiry, and inventory audit metadata.
- `cart`: in-progress customer cart and quantity UX; not a security boundary.
- `orders`: order creation/finalization, order items, status lifecycle, order history, and status events.
- `payments`: payment attempts, CASH/ONLINE methods, SSLCOMMERZ integration boundaries, payment states, and refund-ready data model.
- `qr-collection`: opaque collection token generation, QR display, validation, use tracking, and collection audit.
- `admin`: system visibility, approvals, terminal account onboarding, users, and role management.

## 3. Customer flow

The core customer flow is:

1. Login.
2. Select university.
3. Select cafeteria/vendor.
4. Resolve the physical sales point:
   - If the selected cafeteria has exactly one active, approved sales point, skip sales-point selection and open that sales point's menu.
   - If the selected cafeteria has multiple active, approved sales points, ask the customer to choose a **Sales Point** or **Location**.
   - If the selected cafeteria has no active, approved sales points, show an unavailable/empty state.
5. Browse the menu for the selected physical sales point.
6. View item details.
7. Add items to cart and adjust quantities.
8. Select payment method: `CASH` or `ONLINE`.
9. Submit order/payment request for that one physical sales point.
10. Complete payment processing when required.
11. See successful order confirmation.
12. Immediately receive a QR code once the order is accepted/finalized.
13. Track order status through realtime updates.
14. See ready status/notification.
15. Physically collect the order by presenting the QR code at the same sales point that owns the order.

The canonical hierarchy is:

```text
University
  → Cafeteria / Vendor / Business / Brand
    → one or more physical Shops / Sales Points / Locations
      → Menu Items
      → Orders
```

A cafeteria/vendor may have exactly one customer-visible sales point or multiple customer-visible sales points. The selected sales point must always be represented internally because it determines the menu, stock, order destination, terminal ownership, staff authorization, QR validation boundary, and realtime scope.

Customers must not have a self-service cancellation button. If a customer wants to cancel, they must physically contact the physical sales terminal, and the terminal operator must perform the cancellation if the order is eligible.

## 4. Database entities and relationships

This section describes the approved domain model. It is not a migration specification.

### Identity and authorization

- `profiles`
  - One row per Supabase Auth user (customers, admins, and terminal accounts).
  - Owns profile metadata.
  - Related to `auth.users` by `id`.
- `roles`
  - Controlled roles: `customer`, `terminal` (or `shop_terminal`), `admin`.
- `user_roles`
  - Many-to-many relationship between users/terminals and roles.
  - Enables explicit role grants and revocation.
- `terminal_accounts`
  - Maps a Supabase Auth terminal account (`auth_user_id`) directly to exactly one physical shop/outlet (`shop_id`).
  - Represents physical sales points, not individual human staff members. Anyone operating that physical terminal device uses its account.
  - Fields: `auth_user_id`, `shop_id`, `display_name`, `is_active`, timestamps.
  - Conceptually: `terminal_account → auth_user_id → shop_id → display_name → is_active`. One terminal account belongs to exactly one physical shop/outlet.
- `shop_staff_memberships`
  - **Removed from active MVP model**: replaced by `terminal_accounts` for direct physical terminal identification. Individual salesman accounts are not required for MVP. (May remain in documentation as an optional extension for future individual staff functionality).

### Onboarding flow

Terminal accounts are NOT self-registered.

Admin onboarding flow:
```text
Admin → select University → select Cafeteria → select Shop → create Terminal Account → Terminal logs in
```
The admin creates the terminal account in Supabase Auth, assigns the `terminal` role, creates the `terminal_accounts` link to the physical shop, and provides credentials to the physical sales point.

### Campus, vendors, and sales points

- `universities`
  - Parent entity for cafeterias/vendors.
  - Managed by admins.
- `cafeterias`
  - Represents the food vendor/business/brand, not necessarily a physical counter.
  - Belongs to one university.
  - Has active/approval state.
  - May have exactly one physical sales point or multiple physical sales points.
  - Managed or approved by admins.
- `shops`
  - Represents a physical outlet/sales point/location belonging to a cafeteria/vendor.
  - Belongs to one cafeteria.
  - Has owner/profile relationship where applicable, approval state, operational state, display metadata, and timestamps.
  - Is operationally independent: its menu items, stock quantities, availability, max order quantities, incoming orders, terminal staff, QR validation, and realtime subscriptions are scoped to this specific sales point.
  - Staff access is granted through `shop_staff_memberships` for the specific sales point.

### Menu

- `menu_items`
  - Belongs to one physical shop/sales point, not only to the cafeteria/vendor.
  - Required fields include name, description, price, image path/reference, current stock quantity, maximum quantity per order, manual availability state, and timestamps.
  - Different sales points for the same cafeteria/vendor may offer different menu items, prices, stock quantities, manual availability, and maximum order quantities.
  - Current menu price changes must never alter historical order totals because `order_items` store price snapshots.

### Inventory

- `inventory_reservations`
  - Required for online payment attempts or any flow where stock is held before final order activation.
  - Associated with menu item, order/payment attempt, quantity, status, `created_at`, and `expires_at`.
  - Reservation statuses should include `ACTIVE`, `CONSUMED`, `RELEASED`, and `EXPIRED`.
  - Active reservations reduce availability for other customers.

### Orders

- `orders`
  - Belongs to exactly one customer profile, university, cafeteria/vendor, and physical shop/sales point.
  - The physical sales point is the operational destination of the order.
  - Stores public order ID, order status, payment method, total calculated from trusted values, cancellation metadata, collection metadata, and timestamps.
  - Payment status must not be stored as the order lifecycle status.
- `order_items`
  - Belongs to one order.
  - References the purchased menu item.
  - Stores item name snapshot if desired, quantity, unit price snapshot, and line total snapshot.
- `order_status_events`
  - Append-only history of status transitions.
  - Records actor, timestamp, previous status, new status, and contextual metadata such as cancellation reason.

### Payments and refunds

- `payments` or `payment_attempts`
  - Belongs to one order or checkout attempt.
  - Stores method (`CASH` or `ONLINE`), provider (`SSLCOMMERZ` for online MVP where configured), unique transaction/reference identifiers, amount from trusted server/database values, status, gateway metadata, and timestamps.
  - bKash should initially be treated as a payment channel inside SSLCOMMERZ, not as a separate direct bKash API integration.
- Refund-ready fields or related refund records should track refund state separately from order cancellation. MVP should not invent automated refunds if SSLCOMMERZ refund integration is not implemented.

### Collection

- `collection_codes`
  - Belongs to one order.
  - Stores only a secure hashed representation of an opaque, unpredictable token, plus expiry/use metadata.
  - Tracks whether the token has been used, when it was used, and which staff member validated collection.
  - The QR payload must contain only the opaque token, never customer names, phone numbers, item details, payment data, or other sensitive order information.

## 5. Order lifecycle

### Active lifecycle

The active order lifecycle is:

```text
PLACED → PREPARING → READY → COLLECTED
```

### Cancellation exception

Cancellation is terminal-authorized and separate from the normal active lifecycle:

```text
PLACED → CANCELLED
PREPARING → CANCELLED
```

Business rule for MVP: `PREPARING → CANCELLED` is allowed only when authorized shop staff confirms the food/inventory can still be safely cancelled. Prepared or non-restorable food must not automatically be returned to available stock.

Default disallowed transitions:

- `READY → CANCELLED` is not allowed by default.
- `COLLECTED → CANCELLED` is never allowed.
- Customer-initiated cancellation is not available.

Invalid state transitions must be rejected by trusted backend/database logic, not only by frontend UI checks.

Cancelled orders must never be deleted. They must retain cancellation timestamp, cancelling staff member, cancellation reason, payment/refund state, inventory effects, and status history.

## 6. Payment lifecycle

Payment status is independent from order status. Do not model paid orders as `order.status = PAID`.

MVP payment methods:

- `CASH`
- `ONLINE`

Recommended payment statuses:

```text
PENDING
PAID
FAILED
CANCELLED
EXPIRED
REFUND_PENDING
REFUNDED
```

The exact enum names may be adjusted during schema design, but the separation between order state and payment state is mandatory.

### Cash order flow

```text
Customer confirms order
→ validate menu availability, max quantity, and inventory
→ atomically consume stock
→ create order
→ create order items with price snapshots
→ create payment record for CASH
→ create order status event
→ generate collection token
→ commit
→ immediately display order confirmation and QR
```

For cash orders, payment may be represented as paid/settled according to the operational model chosen for the shop, but this must remain in the payment domain rather than the order status.

### Online order flow with SSLCOMMERZ

```text
Customer confirms order
→ validate menu availability, max quantity, and inventory
→ atomically create stock reservation
→ create payment-pending order or checkout attempt
→ create payment attempt with unique transaction/reference identifiers
→ initiate SSLCOMMERZ payment using trusted server-calculated amount
→ customer completes payment with SSLCOMMERZ
→ receive SSLCOMMERZ server-side notification/IPN
→ server validates transaction authoritatively
→ payment becomes PAID
→ finalize order
→ consume reserved inventory
→ mark reservation CONSUMED
→ create collection token
→ commit finalization
→ display QR
```

A client-side payment-success redirect is never authoritative. A valid QR must not be generated for an online order merely because the customer lands on a success URL. SSLCOMMERZ credentials, secrets, transaction validation, and amount calculation must remain server-side.

### Refund model

Order cancellation and payment refund are separate. For online payments:

```text
Order CANCELLED ≠ Payment REFUNDED
```

An online order cancellation may move payment state to `REFUND_PENDING` if a refund is required, but actual refund completion must be tracked independently. For the MVP, the schema should be refund-ready without claiming an automated SSLCOMMERZ refund workflow exists. Cash cancellations may involve no electronic refund.

## 7. Inventory lifecycle

Inventory is required for the MVP. The architecture must distinguish:

1. **Stock quantity**: the actual stock count tracked for each menu item.
2. **Stock reservations**: temporary holds for online payment attempts or similar deferred finalization flows.
3. **Manual availability**: staff-controlled switch indicating whether an item is intentionally orderable.

### Customer-facing availability rules

- If stock is `0`, display `OUT OF STOCK`; customers cannot add or order the item.
- If stock is greater than `0` but manual availability is false, display `UNAVAILABLE`; customers cannot order the item.
- If stock is greater than `0` and manual availability is true, the item is orderable.
- Show remaining stock where appropriate, such as `7 left` or `2 left`.
- Do not expose misleading availability.

### Maximum quantity per order

`max_quantity_per_order` is separate from remaining stock.

Example:

```text
Stock = 8
Maximum per order = 2
Customer purchases 2
Remaining stock = 6
Another customer sees 6 left
```

The frontend should provide clear quantity UX, but backend logic must independently enforce max quantity and stock availability.

### Concurrent stock safety

The system must prevent overselling. It must not use a non-atomic pattern such as:

```text
read stock
→ check stock in application code
→ update stock later
```

Cash order stock consumption and online order stock reservation must be atomic database operations. The same stock unit must never be sold to two customers.

### Reservation expiry and release

If an online payment fails, is cancelled, or expires:

```text
payment attempt becomes FAILED/CANCELLED/EXPIRED
→ reservation becomes RELEASED or EXPIRED
→ reserved quantity becomes available again
```

If payment succeeds:

```text
payment becomes PAID
→ reservation becomes CONSUMED
→ order becomes active/finalized
→ QR is generated
```

Expired reservations should be released by trusted backend/database logic, such as a scheduled Supabase Edge Function, scheduled database job, or explicit transactional cleanup before new reservations are created. Release must be idempotent and concurrency-safe so the same reservation cannot be released and consumed simultaneously.

## 8. QR lifecycle and collection validation

The customer collection QR is a collection credential. It does not mean the order is ready.

### QR generation

- Generate a QR token as soon as a cash order is accepted or an online order is authoritatively finalized after payment validation.
- The token must be opaque, unpredictable, and stored securely, preferably as a hash.
- The QR payload must contain only the opaque token.
- The QR remains visible on the order confirmation/tracking screen while the order progresses.

The order confirmation screen should display:

- Order ID, such as `Order #SKQ-1042`.
- QR code.
- Ordered items.
- Quantities.
- Total.
- Payment status where appropriate.
- Order status.
- Collection instructions, such as “Show this QR code when collecting your order.”

The same screen should clearly indicate readiness when the order becomes `READY`.

### QR validation

When a terminal scans a QR code:

1. Decode the opaque token.
2. Send the token to trusted backend logic.
3. Validate the token hash and expiry/use state.
4. Find the associated order.
5. Verify the authenticated terminal's associated shop matches the order's shop (`v_order.shop_id = v_terminal_shop_id`). Never trust a shop ID supplied by the client.
6. Verify the order is `READY` and eligible for collection.
7. Verify the QR has not already been used.
8. Atomically mark the order as `COLLECTED`.
9. Mark the QR token as used.
10. Record collection timestamp and authenticated terminal identity (`collected_by = terminal_auth_id`).

The client must never directly mark an order as collected. Reused QR tokens, QR tokens scanned by a terminal belonging to another physical sales point/shop, and QR tokens for orders that are not ready must fail validation. For example, Toua's Kitchen Ground Floor terminal may validate Ground Floor orders, but Toua's Kitchen 1st Floor terminal may not validate those QR codes merely because both sales points belong to the same cafeteria/vendor.

## 9. Cancellation lifecycle

There is no customer-facing cancellation functionality. Customers must physically contact the sales terminal.

Cancellation is performed by the authenticated terminal account for that physical shop. The cancellation operation must atomically:

- Verify terminal authentication and active status (`is_active_terminal`).
- Verify the terminal belongs to the exact physical sales point/shop that owns the order.
- Verify the order is in a cancellable state (`PLACED` or eligible `PREPARING`).
- Record cancellation timestamp.
- Record the authenticated terminal identity (`cancelled_by = terminal_auth_id`), not an individual salesman.
- Record cancellation reason.
- Update order status to `CANCELLED`.
- Create an order status event.
- Handle inventory effects correctly.
- Handle payment/refund state correctly.

For orders whose inventory can safely be returned, restore the appropriate quantity atomically. Do not automatically return prepared or non-restorable food to available stock. For online payments, cancellation does not mean the payment has already been refunded; refund state must be tracked in the payment/refund domain.

## 10. Shop terminal requirements

The shop terminal represents a physical sales point (counter/outlet) rather than individual staff members. It operates using its dedicated Supabase Auth terminal account. The terminal interface should be optimized for tablet/desktop sales terminal use while remaining responsive. The terminal account can:

- View incoming orders for its physical shop.
- Filter orders.
- View order details.
- Move orders through valid statuses (`PLACED → PREPARING → READY → COLLECTED`).
- Cancel eligible orders for its shop.
- Provide cancellation reasons.
- Manage menu items for its shop.
- Update prices.
- Update stock quantities.
- Change manual availability.
- Configure maximum quantity per order.
- Scan collection QR codes.
- Validate customer collection.
- Mark valid orders as `COLLECTED` through trusted backend validation.

## 11. Authorization and security boundaries

Supabase RLS is mandatory.

- Customers can browse approved public menu data, access their own orders, and access their own collection information.
- Terminal accounts can access only their assigned physical sales point/shop operational data; cafeteria/vendor-level affiliation alone does not authorize operational access. A terminal account may only access its own shop's orders, menu/inventory operations, QR collection, cancellations, and realtime events (e.g. Ground Floor terminal cannot operate 3rd Floor orders).
- Admins can access authorized administrative data for universities, cafeterias, shops, terminal account onboarding, users, roles, approvals, and system visibility.

**Never trust a shop ID supplied by the client.** Terminal access is determined strictly by `authenticated terminal account -> associated shop`. Trusted database logic and RLS must derive the terminal's shop ID directly from `auth.uid()`.

Privileged operations must not rely only on client-side checks. Use trusted server-side logic and/or database functions for:

- Order creation and finalization.
- Inventory reservation.
- Inventory consumption.
- Reservation expiry/release.
- Cancellation.
- QR generation.
- QR validation and collection.
- Payment initiation and confirmation.
- Refund processing state changes.
- Role and terminal account management.
- Administrative operations.

Never expose Supabase service-role credentials, SSLCOMMERZ credentials, or payment secrets to browsers or Capacitor clients.

## 12. Realtime behavior

Realtime is required for:

- Customer order status changes.
- Customer readiness updates.
- Shop terminal incoming orders.
- Shop terminal relevant order changes.

Subscriptions must be scoped to the relevant customer, order, or physical sales point/shop (`shop_id`). Do not broadcast every system order to every connected user. Terminal screens should subscribe only to their assigned sales-point orders (`shop_id = get_terminal_shop_id(auth.uid())`) and relevant active statuses. Multiple sales points under the same cafeteria/vendor must not receive one another's order feeds unless a later explicit business rule authorizes a shared operational view.

## 13. MVP production pilot scope

### Customer

- Authentication.
- University selection.
- Cafeteria/vendor selection.
- Sales-point selection only when a cafeteria has multiple active, approved sales points; otherwise direct menu entry for the single active sales point.
- Menu browsing for the selected physical sales point.
- Item details.
- Stock and availability display.
- Maximum quantity handling.
- Cart.
- Cash/online payment selection.
- Order placement.
- Online payment through SSLCOMMERZ where configured.
- Immediate QR after successful order/payment finalization.
- Order tracking.
- Realtime status updates.
- Order history.

### Shop/Sales Terminal

- Terminal authentication (dedicated Supabase Auth terminal account per physical sales point).
- Sales-point dashboard.
- Incoming orders scoped strictly to the assigned sales point.
- Order status management (`PLACED → PREPARING → READY → COLLECTED`).
- Menu management.
- Price updates.
- Stock management.
- Manual availability management.
- Maximum quantity management.
- Terminal-authorized cancellation.
- QR scanning.
- Collection validation.

### Admin

- Authentication.
- University management.
- Cafeteria management.
- Shop management.
- Shop approval.
- Terminal account onboarding (`Admin → select shop → create terminal account`).
- User and role management.
- Basic system visibility.

Do not add unrelated features such as reviews, loyalty programs, promotions, advanced analytics, or social functionality unless explicitly requested later.

## 14. Scalability considerations for 10,000 registered users

- Index foreign keys and common filters for universities, cafeterias, shops, customers, orders, order statuses, payment statuses, and active reservations.
- Scope customer order queries to authenticated user IDs.
- Scope terminal queries and realtime subscriptions to assigned physical sales point/shop IDs (`terminal_accounts`).
- Use atomic database functions or transactions for order creation, inventory reservation, inventory consumption, cancellation, and collection.
- Keep append-only status events for auditability without overloading active order queries.
- Store price snapshots on `order_items` to keep historical orders stable after menu changes.
- Store only hashed QR tokens and avoid sensitive data in QR payloads.
- Release expired reservations through idempotent, concurrency-safe backend/database jobs.
- Avoid global realtime channels for order data.

## 15. Database impact and remaining product decisions

The database model is updated for terminal authentication:
- `terminal_accounts` is introduced as the table linking a Supabase Auth account (`auth_user_id`) directly to a physical shop (`shop_id`).
- `shop_staff_memberships` is removed from active MVP operations in favor of direct terminal account identity (`terminal_accounts`). Individual salesman accounts are not required for MVP.
- `roles` includes `terminal` (or `shop_terminal`) representing physical terminal accounts.
- Database functions (`cancel_order`, `validate_collection_qr`, `update_order_status`, `adjust_menu_item_stock`) and RLS policies resolve terminal authorization server-side from `auth.uid()` via `terminal_accounts`, ensuring client-supplied shop IDs are never trusted.

Customer Foundation 4A should be updated in a later application milestone so selecting a cafeteria/vendor counts only active, approved shops: zero shows unavailable, one skips Sales Point selection and opens that sales point's menu, and two or more shows Sales Point/Location selection.

The final requirements resolve the major previous ambiguities around payment methods, order statuses, QR timing, inventory, reservations, max quantity, cancellation ownership, terminal authentication, and single-sales-point order ownership. Remaining decisions before implementation are:

- Exact timeout duration for online payment reservations and QR token expiry.
- Exact operational rule for when `PREPARING → CANCELLED` is allowed and whether stock can be restored for specific item categories.
- Whether cash payment is considered immediately settled at order placement or tracked as pending until collection/payment at terminal.
- Which SSLCOMMERZ environments, credentials, webhook/IPN endpoints, and transaction validation rules will be used for pilot deployment.
- Image upload limits, accepted formats, and any moderation/approval workflow for menu item images.
