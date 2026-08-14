
# SkipQ permanent development rules

## Product scope
- SkipQ is a cafeteria ordering and queue-management application for three roles: Customer, Shop/Sales Terminal staff, and Admin.
- Build only from the documented requirements. Do not add speculative features without an explicit product decision.
- Prioritize the core ordering lifecycle: university selection, cafeteria selection, menu browsing, cart, payment-method selection, order confirmation, order status tracking, QR collection, terminal validation, and admin oversight.

## Technical direction
- Use Next.js with the App Router, TypeScript, and Tailwind CSS.
- Use Supabase for PostgreSQL, Auth, Realtime, and Storage where appropriate.
- Keep the project compatible with Capacitor mobile packaging; avoid browser-only assumptions in shared application code unless isolated behind platform checks.
- Read the relevant Next.js 16 documentation from `node_modules/next/dist/docs/` before changing application code.

## Security and data access
- Treat Supabase Row Level Security as mandatory for user-facing data access.
- Never expose Supabase service-role keys to client components, browser bundles, or Capacitor clients.
- Perform privileged operations through trusted server-side logic such as Next.js server routes/server functions or Supabase Edge Functions.
- Model authorization around explicit roles and shop/cafeteria membership, not only user-provided route parameters.

## Code quality
- Keep implementation small and incremental for the current milestone.
- Prefer clear domain names matching the product language: universities, cafeterias, shops, menu items, orders, order items, carts, payments, QR collection codes, and roles.
- Do not install dependencies unless they are necessary for the requested task.
- Maintain accessible, responsive UI patterns influenced by the visual reference without copying it literally.

## Inventory and availability
- Inventory is an MVP requirement, not a later feature.
- Each menu item must track remaining stock quantity, maximum quantity per order, and manual availability.
- Stock quantity must be decremented atomically when an order is successfully placed.
- Stock must never become negative.
- If stock reaches zero, the item must display as OUT OF STOCK and cannot be ordered.
- The client must never be trusted to enforce stock or quantity limits; the backend/database must enforce them.
- Concurrent orders must not oversell remaining stock.

## QR collection
- A collection QR code must be generated immediately after a successful order is placed.
- QR availability must not depend on the order becoming READY.
- The QR represents the customer's collection credential, not order readiness.
- QR payloads must contain only an opaque, unpredictable token and must not expose sensitive customer/order information.
- QR creation must be part of the same trusted order-creation workflow as order creation and stock reservation.
- QR validation and collection must be performed server-side and atomically.


## Order cancellation
- Customers must NOT have a self-service cancellation option.
- Customers who need cancellation must contact the physical sales terminal.
- Only authorized shop staff may initiate an order cancellation.
- Cancellation must be performed through a protected backend operation.
- The system must record who cancelled the order, when it was cancelled, and the cancellation reason.
- Cancellation must obey the defined order-state rules.
- If an order is cancelled while its items can still be returned to inventory, the appropriate quantities must be restored atomically.
- Do not automatically restore inventory for prepared/otherwise non-restorable items without an explicit business rule.
- Cancelled orders must remain in the database for audit/history rather than being deleted.

## Payments
- SSLCOMMERZ is the planned online payment gateway.
- bKash should initially be treated as a payment channel through SSLCOMMERZ rather than as a separate payment integration, unless a later product decision requires direct bKash integration.
- The system must support at minimum CASH and ONLINE payment methods for the MVP.
- Payment status must be stored independently from order status.
- Never treat a client-side payment-success redirect as proof that payment succeeded.
- Online payment confirmation must be based on trusted server-to-server notification and transaction validation from SSLCOMMERZ.
- Payment credentials and secrets must remain server-side.
- The amount sent to the payment gateway must be calculated from trusted server/database values rather than client-submitted totals.
- Payment transactions must have a unique transaction/reference ID linked to the SkipQ order.
- Failed, cancelled, pending, and successful payments must be represented explicitly.
- Refunds must be tracked separately from order cancellation.


