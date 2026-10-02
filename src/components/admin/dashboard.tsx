import { Link } from "@tanstack/react-router";
import { money } from "@/lib/cart";
import { statusLabels } from "@/lib/site-data";
import { Kpi, fmt, lowStockFrom, useAdminCustomers, useAdminOrders, useAdminProducts, useAdminRequests, useLowStock } from "./shared";

export function Dashboard() {
  const { data: orders = [] } = useAdminOrders();
  const { data: products = [] } = useAdminProducts();
  const { data: requests = [] } = useAdminRequests();
  const { data: settings } = useLowStock();
  const { data: customers = 0 } = useAdminCustomers();
  const low = lowStockFrom(settings);
  const today = new Date().toDateString();
  const live = orders.filter((o) => o.status !== "cancelled");
  const salesToday = live.filter((o) => new Date(o.created_at).toDateString() === today && o.payment_status === "confirmed").reduce((n, o) => n + Number(o.total), 0);
  const count = (s: string[]) => live.filter((o) => s.includes(o.status)).length;
  const active = products.filter((p) => p.active);

  return (
    <div className="space-y-8">
      <div><p className="eyebrow">Resumen</p><h1 className="font-display text-3xl font-bold text-primary">Dashboard</h1></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ventas del día" value={money(salesToday)} tone="success" />
        <Kpi label="Pedidos pendientes" value={count(["received", "payment_pending", "payment_confirmed"])} tone="accent" />
        <Kpi label="Preparando" value={count(["preparing", "prepared"])} />
        <Kpi label="Listos para recoger" value={count(["ready_for_pickup"])} />
        <Kpi label="Solicitudes pendientes" value={requests.filter((r) => ["received", "in_review", "processing"].includes(r.status)).length} tone="accent" />
        <Kpi label="Poco stock" value={active.filter((p) => p.stock > 0 && p.stock <= low).length} />
        <Kpi label="Agotados" value={active.filter((p) => p.stock === 0).length} tone="accent" />
        <Kpi label="Total de clientes" value={customers} />
      </div>
      <div className="card-soft p-5">
        <div className="flex items-center justify-between"><h2 className="font-bold text-primary">Últimos pedidos</h2><Link to="/panel/$seccion" params={{ seccion: "pedidos" }} className="text-sm font-semibold text-primary hover:text-accent">Ver todos →</Link></div>
        <ul className="mt-3 divide-y divide-border text-sm">
          {orders.slice(0, 8).map((o) => <li key={o.id} className="flex flex-wrap justify-between gap-2 py-2"><span><strong>#{o.order_number}</strong> · {o.customer_name}</span><span className="text-muted-foreground">{statusLabels[o.status] ?? o.status} · {money(Number(o.total))} · {fmt(o.created_at)}</span></li>)}
          {!orders.length && <li className="py-2 text-muted-foreground">Sin pedidos todavía.</li>}
        </ul>
      </div>
    </div>
  );
}
