import { Link } from "@tanstack/react-router";
import { money } from "@/lib/cart";
import { statusLabels } from "@/lib/site-data";
import { Kpi, fmt, lowStockFrom, useAdminCustomers, useAdminOrders, useAdminProducts, useAdminRequests, useLowStock } from "./shared";

export function Dashboard() {
  const { data: orders = [] } = useAdminOrders();
  const { data: products = [] } = useAdminProducts();
  const { data: requests = [] } = useAdminRequests();
  const { data: settings } = useLowStock();
  const { data: customerProfiles = [] } = useAdminCustomers();
  const low = lowStockFrom(settings);
  const today = new Date().toDateString();
  const live = orders.filter((o) => o.status !== "cancelled");
  const salesToday = live.filter((o) => new Date(o.created_at).toDateString() === today && o.payment_status === "confirmed").reduce((n, o) => n + Number(o.total), 0);
  const count = (s: string[]) => live.filter((o) => s.includes(o.status)).length;
  const active = products.filter((p) => p.active);

  return (
    <div className="space-y-8">
      <div><p className="eyebrow">Summary</p><h1 className="font-display text-3xl font-bold text-primary">Dashboard</h1></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Today’s sales" value={money(salesToday)} tone="success" />
        <Kpi label="Pending orders" value={count(["received", "payment_pending", "payment_confirmed"])} tone="accent" />
        <Kpi label="Preparing" value={count(["preparing", "prepared"])} />
        <Kpi label="Ready for pickup" value={count(["ready_for_pickup"])} />
        <Kpi label="Pending requests" value={requests.filter((r) => ["received", "in_review", "processing"].includes(r.status)).length} tone="accent" />
        <Kpi label="Low stock" value={active.filter((p) => p.stock > 0 && p.stock <= low).length} />
        <Kpi label="Out of stock" value={active.filter((p) => p.stock === 0).length} tone="accent" />
        <Kpi label="Total customers" value={customerProfiles.length} />
      </div>
      <div className="card-soft p-5">
        <div className="flex items-center justify-between"><h2 className="font-bold text-primary">Recent orders</h2><Link to="/panel/$seccion" params={{ seccion: "pedidos" }} className="text-sm font-semibold text-primary hover:text-accent">Ver todos →</Link></div>
        <ul className="mt-3 divide-y divide-border text-sm">
          {orders.slice(0, 8).map((o) => <li key={o.id} className="flex flex-wrap justify-between gap-2 py-2"><span><strong>#{o.order_number}</strong> · {o.customer_name}</span><span className="text-muted-foreground">{statusLabels[o.status] ?? o.status} · {money(Number(o.total))} · {fmt(o.created_at)}</span></li>)}
          {!orders.length && <li className="py-2 text-muted-foreground">No orders yet.</li>}
        </ul>
      </div>
    </div>
  );
}
