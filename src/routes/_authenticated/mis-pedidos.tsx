import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyOrders } from "@/lib/account.functions";
import { statusLabels, deliveryLabels } from "@/lib/site-data";

export const Route = createFileRoute("/_authenticated/mis-pedidos")({
  head: () => ({ meta: [{ title: "Mis pedidos — JAV Wireless" }, { name: "description", content: "Consulta tus pedidos en JAV Wireless." }, { property: "og:title", content: "Mis pedidos — JAV Wireless" }, { property: "og:description", content: "Historial de tus pedidos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: MyOrders,
});

function MyOrders() {
  const fetchOrders = useServerFn(getMyOrders);
  const { data, isLoading, error } = useQuery({ queryKey: ["my-orders"], queryFn: () => fetchOrders() });
  return (
    <section className="section-pad"><div className="container-page max-w-3xl">
      <p className="eyebrow">Mi cuenta</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-primary">Mis pedidos</h1>
      <p className="mt-2 text-sm text-muted-foreground">Pedidos realizados con el correo de tu cuenta.</p>
      <div className="mt-6 space-y-3">
        {isLoading && <p className="text-muted-foreground">Cargando...</p>}
        {error && <p className="text-accent">No se pudieron cargar tus pedidos.</p>}
        {data && data.length === 0 && <div className="card-soft p-6 text-muted-foreground">Aún no tienes pedidos. <Link to="/productos" className="font-semibold text-primary">Ver productos</Link></div>}
        {data?.map((o) => (
          <div key={o.order_number} className="card-soft flex flex-wrap items-center justify-between gap-3 p-5">
            <div><p className="font-bold text-primary">{o.order_number}</p><p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("es")} · {(deliveryLabels as Record<string, string>)[o.delivery_method] ?? o.delivery_method}</p></div>
            <span className="chip">{(statusLabels as Record<string, string>)[o.status] ?? o.status}</span>
            <p className="font-bold">${Number(o.total).toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div></section>
  );
}
