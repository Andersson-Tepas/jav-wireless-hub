import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Boxes, ClipboardList, Cog, CreditCard, FolderTree, LogOut, Megaphone, Package, Route as RouteIcon, ShoppingBag, Users, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({ meta: [{ title: "Panel administrativo — JAV Wireless" }, { name: "description", content: "Administración de pedidos, productos y servicios." }, { property: "og:title", content: "Panel — JAV Wireless" }, { property: "og:description", content: "Panel administrativo." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: PanelLayout,
});

export const panelSections = [
  { slug: "productos", label: "Productos", icon: Package },
  { slug: "categorias", label: "Categorías", icon: FolderTree },
  { slug: "inventario", label: "Inventario", icon: Boxes },
  { slug: "pedidos", label: "Pedidos", icon: ShoppingBag },
  { slug: "clientes", label: "Clientes", icon: Users },
  { slug: "servicios", label: "Servicios", icon: Wrench },
  { slug: "solicitudes", label: "Solicitudes", icon: ClipboardList },
  { slug: "pagos", label: "Pagos", icon: CreditCard },
  { slug: "promociones", label: "Promociones", icon: Megaphone },
  { slug: "seguimiento", label: "Seguimiento", icon: RouteIcon },
  { slug: "configuracion", label: "Configuración", icon: Cog },
] as const;

function PanelLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: isAdmin, isLoading } = useQuery({ queryKey: ["is-admin", user.id], queryFn: async () => (await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })).data === true });

  async function signOut() { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }

  if (isLoading) return <p className="container-page py-20 text-muted-foreground">Cargando...</p>;
  if (!isAdmin) return <div className="container-page py-20 text-center"><h1 className="font-display text-3xl font-bold text-primary">Acceso restringido</h1><p className="mt-3 text-muted-foreground">Tu cuenta no tiene permisos de administrador.</p><Button variant="outline" className="mt-6" onClick={signOut}>Cerrar sesión</Button></div>;

  const linkCls = "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-surface hover:text-primary";
  const activeCls = "bg-primary/10 text-primary";
  return (
    <div className="container-page grid gap-6 py-8 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <p className="eyebrow">Administración</p>
        <p className="mb-4 font-display text-xl font-bold text-primary">Panel JAV Wireless</p>
        <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
          <Link to="/panel" activeOptions={{ exact: true }} className={linkCls} activeProps={{ className: activeCls }}><BarChart3 className="size-4" /> Dashboard</Link>
          {panelSections.map((s) => <Link key={s.slug} to="/panel/$seccion" params={{ seccion: s.slug }} className={linkCls} activeProps={{ className: activeCls }}><s.icon className="size-4" /> {s.label}</Link>)}
        </nav>
        <div className="mt-4 border-t border-border pt-4"><p className="truncate text-xs text-muted-foreground">{user.email}</p><Button variant="outline" size="sm" className="mt-2" onClick={signOut}><LogOut /> Salir</Button></div>
      </aside>
      <main className="min-w-0"><Outlet /></main>
    </div>
  );
}
