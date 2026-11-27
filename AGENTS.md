<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules
- The home-page brand carousel derives deduplicated active brands from HomePage's existing `useProducts()` data via `src/lib/brand-catalog.ts` (excluding placeholders and inactive-only rows, pairing exact matches with locally bundled `simple-icons` SVGs) and animates a measured duplicated track with `requestAnimationFrame`.
- Products, categories, orders, service requests and status history live in the database; the catalog reads them publicly via the browser client so admin edits show up immediately.
- Orders, service requests and tracking lookups go through server functions in src/lib/commerce.functions.ts using the admin client, so customers never get direct table access.
- Order status changes trigger DB-side history + notification queue rows, so every status-change path is logged identically.
- Service definitions (fields, requirements, costs) and status flows are centralized in src/lib/site-data.ts to keep the forms, tracking and panel in sync.
- The cart lives in localStorage via CartProvider in the root layout so it persists across pages without an account.
- The admin panel sits under the _authenticated layout and checks the admin role via has_role; every new account gets the user role; only the first email/password account becomes admin (Google sign-ups never do). Panel is reached via 5 quick clicks on the logo, with no visible link.
- Services, promotions, settings (Zelle, WhatsApp, low-stock threshold) live in the database; site-data.ts `services` is seed reference only, so admins can edit without code changes.
- Inventory movements are logged by a DB trigger on products.stock, so every stock change (sale or panel adjustment) is recorded identically.
- REST API: public endpoints under src/routes/api/public/*, admin under src/routes/api/admin/*; handlers live in src/lib/api-handlers.server.ts and every admin handler calls requireAdmin (token + has_role) so security never depends on the UI.
- Panel is a sidebar layout (_authenticated/panel.tsx) with sections in panel.$seccion.tsx mapped to src/components/admin/*; panel writes go through the browser client and are enforced by admin-only RLS.
- Product images upload to a private bucket via an admin-checked server function that returns a long-lived signed URL (public buckets are blocked).
- Customer profiles (customer_profiles) are created by the auth.users signup trigger alongside the role row; admins never also get the user role, and Panel → Clientes lists profiles of non-admin accounts, matching orders/requests by email.
- Bulk ZIP product imports, image-only updates, and initial variant updates parse and validate client-side (`src/lib/zip-product-import.ts` / `src/lib/zip-variant-import.ts`, `fflate`) under explicit modes (`Import new products`, `Update existing images`, and `Update existing variants` via `configure_initial_product_variants`, which atomically rejects preexisting variants/flags, inactive products, stock drift, and variant images).

- Variant configuration is opt-in and goes through configure_product_variants with exact current-stock reconciliation; retained variant IDs preserve audit/order history, and inventory adjustments use adjust_product_inventory to prevent stale writes.
- All storefront/API order creation uses service-role-only create_order_atomic: deterministic parent/variant row locks, server prices, immutable selection snapshots and a payload-bound checkout key prevent oversell and retry deductions; payment callbacks never deduct stock.
- Variant prices inherit product price (no overrides); variant queries are scoped per product and cart identity is product UUID plus variant UUID, keeping legacy stored carts compatible.
- Variant transaction tests run against a fresh localhost PostgreSQL instance with src/test/run-variant-database-tests.sh; never run fixture SQL or create test products in the managed catalog.
- Pending checkout orders reserve stock once; provider retries reuse the payload-bound checkout key, payment callbacks never deduct again, and cancellation retains the existing manual inventory-adjustment behavior rather than guessing restocks.
