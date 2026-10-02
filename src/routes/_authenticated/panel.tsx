import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Boxes, ClipboardList, Cog, CreditCard, FolderTree, LogOut, Megaphone, Package, Route as RouteIcon, ShoppingBag, Users, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({ meta: [{ title: "Admin Admin Panel — JAV Wireless" }, { name: "description", content: "Manage orders, products, and services." }, { property: "og:title", content: "Admin Panel — JAV Wireless" }, { property: "og:description", content: "Administrative dashboard." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: PanelLayout,
});

export const panelSections = [
  { slug: "productos", label: "Products", icon: Package },
  { slug: "categorias", label: "Categories", icon: FolderTree },
  { slug: "inventario", label: "Inventory", icon: Boxes },
  { slug: "pedidos", label: "Orders", icon: ShoppingBag },
  { slug: "clientes", label: "Customers", icon: Users },
  { slug: "servicios", label: "Services", icon: Wrench },
  { slug: "solicitudes", label: "Requests", icon: ClipboardList },
  { slug: "pagos", label: "Payments", icon: CreditCard },
  { slug: "promociones", label: "Promotions", icon: Megaphone },
  { slug: "seguimiento", label: "Tracking", icon: RouteIcon },
  { slug: "configuracion", label: "Settings", icon: Cog },
] as const;

function PanelLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: isAdmin, isLoading } = useQuery({ queryKey: ["is-admin", user.id], queryFn: async () => (await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })).data === true });

  async function signOut() { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }

  if (isLoading) return <p className="container-page py-20 text-muted-foreground">Loading...</p>;
  if (!isAdmin) return <div className="container-page py-20 text-center"><h1 className="font-display text-3xl font-bold text-primary">Restricted access</h1><p className="mt-3 text-muted-foreground">Your account does not have administrator access.</p><Button variant="outline" className="mt-6" onClick={signOut}>Sign out</Button></div>;

  const linkCls = "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-surface hover:text-primary";
  const activeCls = "bg-primary/10 text-primary";
  return (
    <div className="container-page grid gap-6 py-8 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <p className="eyebrow">Administration</p>
        <p className="mb-4 font-display text-xl font-bold text-primary">JAV Wireless Admin</p>
        <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
          <Link to="/panel" activeOptions={{ exact: true }} className={linkCls} activeProps={{ className: activeCls }}><BarChart3 className="size-4" /> Dashboard</Link>
          {panelSections.map((s) => <Link key={s.slug} to="/panel/$seccion" params={{ seccion: s.slug }} className={linkCls} activeProps={{ className: activeCls }}><s.icon className="size-4" /> {s.label}</Link>)}
        </nav>
        <div className="mt-4 border-t border-border pt-4"><p className="truncate text-xs text-muted-foreground">{user.email}</p><Button variant="outline" size="sm" className="mt-2" onClick={signOut}><LogOut /> Sign out</Button></div>
      </aside>
      <main className="min-w-0"><Outlet /></main>
    </div>
  );
}
