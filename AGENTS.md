<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

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
