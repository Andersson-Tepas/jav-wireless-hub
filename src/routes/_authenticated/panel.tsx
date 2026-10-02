import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/cart";
import { allStatusesFor, deliveryLabels, paymentLabels, serviceStatusLabels, services, statusLabels } from "@/lib/site-data";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({ meta: [{ title: "Panel administrativo — JAV Wireless" }, { name: "description", content: "Administración de pedidos, productos y servicios." }, { property: "og:title", content: "Panel — JAV Wireless" }, { property: "og:description", content: "Panel administrativo." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Panel,
});

const tabs = ["Pedidos", "Pagos", "Solicitudes", "Productos", "Categorías", "Clientes", "Servicios", "Notificaciones"] as const;
const fmt = (d: string) => new Date(d).toLocaleString("es", { dateStyle: "short", timeStyle: "short" });

function Panel() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Pedidos");
  const { data: isAdmin, isLoading } = useQuery({ queryKey: ["is-admin", user.id], queryFn: async () => (await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })).data === true });

  async function signOut() { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }

  if (isLoading) return <p className="container-page py-20 text-muted-foreground">Cargando...</p>;
  if (!isAdmin) return <div className="container-page py-20 text-center"><h1 className="font-display text-3xl font-bold text-primary">Acceso restringido</h1><p className="mt-3 text-muted-foreground">Tu cuenta no tiene permisos de administrador.</p><Button variant="outline" className="mt-6" onClick={signOut}>Cerrar sesión</Button></div>;

  return (
    <section className="section-pad pt-8"><div className="container-page">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Administración</p><h1 className="font-display text-3xl font-bold text-primary">Panel JAV Wireless</h1></div><Button variant="outline" size="sm" onClick={signOut}><LogOut /> Salir</Button></div>
      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">{tabs.map((t) => <button type="button" key={t} className="chip shrink-0" data-active={tab === t} onClick={() => setTab(t)}>{t}</button>)}</div>
      <div className="mt-6">
        {tab === "Pedidos" && <Orders />}
        {tab === "Pagos" && <Orders paymentsOnly />}
        {tab === "Solicitudes" && <Requests />}
        {tab === "Productos" && <Products />}
        {tab === "Categorías" && <Categories />}
        {tab === "Clientes" && <Customers />}
        {tab === "Servicios" && <div className="grid gap-3 md:grid-cols-2">{services.map((s) => <div key={s.slug} className="card-soft p-4"><p className="font-bold text-primary">{s.name}</p><p className="text-sm text-muted-foreground">{s.cost}</p></div>)}<p className="text-sm text-muted-foreground md:col-span-2">Los textos y costos de los servicios se editan en el contenido del sitio; pídeme cualquier cambio.</p></div>}
        {tab === "Notificaciones" && <Notifications />}
      </div>
    </div></section>
  );
}

function useOrders() {
  return useQuery({ queryKey: ["admin-orders"], queryFn: async () => (await supabase.from("orders").select("*, order_items(name,quantity,price)").order("created_at", { ascending: false })).data ?? [] });
}

function Orders({ paymentsOnly }: { paymentsOnly?: boolean }) {
  const qc = useQueryClient();
  const { data = [] } = useOrders();
  const [filter, setFilter] = useState("");
  const list = data.filter((o) => (!paymentsOnly || o.payment_method === "zelle") && (!filter || `${o.order_number} ${o.customer_name} ${o.phone} ${o.email}`.toLowerCase().includes(filter.toLowerCase())));
  async function update(id: string, patch: { status?: string; tracking_number?: string | null; carrier?: string | null }) {
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) { toast.error("No se pudo actualizar"); return; }
    toast.success("Pedido actualizado"); qc.invalidateQueries({ queryKey: ["admin-orders"] });
  }
  return (
    <div className="space-y-3">
      <input className="field max-w-sm" placeholder="Buscar por orden, nombre, teléfono..." value={filter} onChange={(e) => setFilter(e.target.value)} />
      {paymentsOnly && <p className="text-sm text-muted-foreground">Pagos por Zelle. Verifica la referencia y cambia el estado a "Pago confirmado". Tarjeta y PayPal son simulados por ahora.</p>}
      {!list.length && <p className="text-muted-foreground">Sin pedidos.</p>}
      {list.map((o) => (
        <div key={o.id} className="card-soft grid gap-4 p-4 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <p className="font-display text-xl font-bold text-primary">#{o.order_number}</p>
            <p className="text-sm">{o.customer_name} · {o.phone}</p><p className="text-xs text-muted-foreground">{o.email} · {fmt(o.created_at)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{o.order_items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
            {o.address && <p className="mt-1 text-xs text-muted-foreground">Envío a: {o.address}</p>}
          </div>
          <div className="text-sm">
            <p><span className="text-muted-foreground">Total:</span> <strong>{money(Number(o.total))}</strong></p>
            <p><span className="text-muted-foreground">Pago:</span> {paymentLabels[o.payment_method]}</p>
            {o.payment_method === "zelle" && <p><span className="text-muted-foreground">Ref. Zelle:</span> <strong>{o.payment_reference}</strong></p>}
            <p><span className="text-muted-foreground">Entrega:</span> {deliveryLabels[o.delivery_method]}</p>
          </div>
          <div className="space-y-2">
            <label className="grid gap-1 text-xs font-semibold">Estado
              <select className="field" value={o.status} onChange={(e) => update(o.id, { status: e.target.value })}>{allStatusesFor(o.delivery_method).map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}</select>
            </label>
            {o.delivery_method === "shipping" && <TrackingInput o={o} onSave={(carrier, tracking_number) => update(o.id, { carrier, tracking_number })} />}
          </div>
        </div>
      ))}
    </div>
  );
}

function TrackingInput({ o, onSave }: { o: { carrier: string | null; tracking_number: string | null }; onSave: (c: string | null, t: string | null) => void }) {
  const [carrier, setCarrier] = useState(o.carrier ?? "");
  const [num, setNum] = useState(o.tracking_number ?? "");
  return <div className="flex gap-2"><input className="field h-9" placeholder="Paquetería" value={carrier} onChange={(e) => setCarrier(e.target.value)} /><input className="field h-9" placeholder="N.º guía" value={num} onChange={(e) => setNum(e.target.value)} /><Button size="sm" variant="outline" onClick={() => onSave(carrier || null, num || null)}>Guardar</Button></div>;
}

function Requests() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["admin-requests"], queryFn: async () => (await supabase.from("service_requests").select("*").order("created_at", { ascending: false })).data ?? [] });
  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("service_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("No se pudo actualizar"); return; }
    toast.success("Solicitud actualizada"); qc.invalidateQueries({ queryKey: ["admin-requests"] });
  }
  if (!data.length) return <p className="text-muted-foreground">Sin solicitudes.</p>;
  return <div className="space-y-3">{data.map((r) => (
    <div key={r.id} className="card-soft grid gap-3 p-4 md:grid-cols-[1.5fr_1fr]">
      <div><p className="font-bold text-primary">{r.reference} · {r.service_name}</p><p className="text-sm">{r.customer_name} · {r.phone} · {r.email}</p><p className="text-xs text-muted-foreground">{fmt(r.created_at)} · {paymentLabels[r.payment_method]}{r.payment_reference ? ` (ref. ${r.payment_reference})` : ""}{r.amount !== null ? ` · ${money(Number(r.amount))}` : ""}</p>
        <dl className="mt-2 text-sm text-muted-foreground">{Object.entries((r.details ?? {}) as Record<string, string>).map(([k, v]) => <div key={k}><span className="font-semibold">{k}:</span> {v}</div>)}</dl></div>
      <label className="grid h-fit gap-1 text-xs font-semibold">Estado<select className="field" value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}>{Object.entries(serviceStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    </div>))}</div>;
}

function Products() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["admin-products"], queryFn: async () => (await supabase.from("products").select("*").order("created_at", { ascending: false })).data ?? [] });
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: async () => (await supabase.from("categories").select("*").order("sort")).data ?? [] });
  const [draft, setDraft] = useState({ name: "", brand: "", category_id: "telefonos", price: "", stock: "", image: "" });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); qc.invalidateQueries({ queryKey: ["products"] }); };
  async function patch(id: string, p: Record<string, unknown>) {
    const { error } = await supabase.from("products").update(p as never).eq("id", id);
    if (error) toast.error("No se pudo guardar"); else { toast.success("Guardado"); refresh(); }
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("products").insert({ name: draft.name, brand: draft.brand, category_id: draft.category_id, price: Number(draft.price), stock: Number(draft.stock), image: draft.image });
    if (error) { toast.error("No se pudo crear"); return; }
    toast.success("Producto creado"); setDraft({ ...draft, name: "", brand: "", price: "", stock: "", image: "" }); refresh();
  }
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card-soft grid gap-2 p-4 md:grid-cols-7">
        <input required className="field md:col-span-2" placeholder="Nombre" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input className="field" placeholder="Marca" value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} />
        <select className="field" value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input required type="number" min={0} step="0.01" className="field" placeholder="Precio" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
        <input required type="number" min={0} className="field" placeholder="Stock" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} />
        <Button type="submit">Agregar</Button>
        <input className="field md:col-span-7" placeholder="URL de imagen (https://...)" value={draft.image} onChange={(e) => setDraft({ ...draft, image: e.target.value })} />
      </form>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Producto</th><th>Categoría</th><th>Precio</th><th>Precio anterior</th><th>Stock</th><th>Destacado</th><th>Más vendido</th><th>Nuevo</th><th>Oferta</th><th>Activo</th></tr></thead>
          <tbody className="divide-y divide-border">{data.map((p) => (
            <tr key={p.id}>
              <td className="p-3 font-semibold">{p.name}<div className="text-xs font-normal text-muted-foreground">{p.brand}</div></td>
              <td><select className="field h-9 w-32" defaultValue={p.category_id} onChange={(e) => patch(p.id, { category_id: e.target.value })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
              <td><input type="number" step="0.01" className="field h-9 w-24" defaultValue={Number(p.price)} onBlur={(e) => Number(e.target.value) !== Number(p.price) && patch(p.id, { price: Number(e.target.value) })} /></td>
              <td><input type="number" step="0.01" className="field h-9 w-24" defaultValue={p.old_price ?? ""} onBlur={(e) => patch(p.id, { old_price: e.target.value ? Number(e.target.value) : null })} /></td>
              <td><input type="number" className="field h-9 w-20" defaultValue={p.stock} onBlur={(e) => Number(e.target.value) !== p.stock && patch(p.id, { stock: Number(e.target.value) })} /></td>
              {(["is_featured", "is_bestseller", "is_new", "is_offer", "active"] as const).map((k) => <td key={k} className="text-center"><input type="checkbox" className="size-4 accent-primary" checked={p[k]} onChange={(e) => patch(p.id, { [k]: e.target.checked })} /></td>)}
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

function Categories() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["categories"], queryFn: async () => (await supabase.from("categories").select("*").order("sort")).data ?? [] });
  const [name, setName] = useState("");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const id = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { error } = await supabase.from("categories").insert({ id, name, sort: data.length + 1 });
    if (error) { toast.error("No se pudo crear"); return; }
    setName(""); qc.invalidateQueries({ queryKey: ["categories"] });
  }
  return <div className="max-w-lg space-y-3"><form onSubmit={add} className="flex gap-2"><input required className="field" placeholder="Nueva categoría" value={name} onChange={(e) => setName(e.target.value)} /><Button type="submit">Agregar</Button></form><ul className="divide-y divide-border rounded-xl border border-border">{data.map((c) => <li key={c.id} className="p-3 font-semibold">{c.name}</li>)}</ul></div>;
}

function Customers() {
  const { data = [] } = useOrders();
  const customers = useMemo(() => {
    const m = new Map<string, { name: string; email: string; phone: string; orders: number; total: number }>();
    data.forEach((o) => { const k = o.email.toLowerCase(); const c = m.get(k) ?? { name: o.customer_name, email: o.email, phone: o.phone, orders: 0, total: 0 }; c.orders++; c.total += Number(o.total); m.set(k, c); });
    return [...m.values()];
  }, [data]);
  if (!customers.length) return <p className="text-muted-foreground">Sin clientes todavía.</p>;
  return <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-sm"><thead className="bg-surface text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Cliente</th><th>Teléfono</th><th>Pedidos</th><th>Total</th></tr></thead><tbody className="divide-y divide-border">{customers.map((c) => <tr key={c.email}><td className="p-3 font-semibold">{c.name}<div className="text-xs font-normal text-muted-foreground">{c.email}</div></td><td>{c.phone}</td><td>{c.orders}</td><td className="font-semibold">{money(c.total)}</td></tr>)}</tbody></table></div>;
}

function Notifications() {
  const { data = [] } = useQuery({ queryKey: ["admin-notifications"], queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  return <div className="space-y-2"><p className="text-sm text-muted-foreground">Avisos generados automáticamente al cambiar el estado de un pedido. Listos para enviarse por correo, SMS o WhatsApp.</p>{!data.length && <p className="text-muted-foreground">Sin avisos.</p>}{data.map((n) => <div key={n.id} className="card-soft flex flex-wrap justify-between gap-2 p-3 text-sm"><span>{n.message}</span><span className="text-muted-foreground">{n.recipient} · {n.channel} · {n.status === "sent" ? "Enviado" : "Pendiente"} · {fmt(n.created_at)}</span></div>)}</div>;
}
