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
- Products, categories, orders, service requests and status history live in the database; the catalog reads them publicly via the browser client so admin edits show up immediately.
- Orders, service requests and tracking lookups go through server functions in src/lib/commerce.functions.ts using the admin client, so customers never get direct table access.
- Order status changes trigger DB-side history + notification queue rows, so every status-change path is logged identically.
- Service definitions (fields, requirements, costs) and status flows are centralized in src/lib/site-data.ts to keep the forms, tracking and panel in sync.
- The cart lives in localStorage via CartProvider in the root layout so it persists across pages without an account.
- The admin panel sits under the _authenticated layout and checks the admin role via has_role; the first account created becomes admin.
