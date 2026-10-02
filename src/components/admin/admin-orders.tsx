import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/cart";
import { allStatusesFor, deliveryLabels, paymentLabels, statusLabels } from "@/lib/site-data";
import { fmt, paymentStatusLabels, useAdminOrders, useAdminRequests, useInvalidate } from "./shared";

type OrderPatch = { status?: string; payment_status?: string; tracking_number?: string | null; carrier?: string | null; archived?: boolean };

function useUpdateOrder() {
  const invalidate = useInvalidate();
  return async (id: string, patch: OrderPatch, msg = "Pedido actualizado") => {
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) { toast.error("No se pudo actualizar"); return; }
    toast.success(msg); invalidate("admin-orders");
  };
}

export function Orders() {
  const { data = [] } = useAdminOrders();
  const update = useUpdateOrder();
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const list = data.filter((o) => o.archived === showArchived && (!status || o.status === status) && (!filter || `${o.order_number} ${o.customer_name} ${o.phone} ${o.email}`.toLowerCase().includes(filter.toLowerCase())));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className="field max-w-xs" placeholder="Buscar por orden, nombre, teléfono..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        <select className="field max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos los estados</option>{Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button type="button" className="chip" data-active={showArchived} onClick={() => setShowArchived(!showArchived)}>Archivados</button>
      </div>
      {!list.length && <p className="text-muted-foreground">Sin pedidos.</p>}
      {list.map((o) => (
        <div key={o.id} className="card-soft p-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
            <div>
              <p className="font-display text-xl font-bold text-primary">#{o.order_number}</p>
              <p className="text-sm">{o.customer_name} · {o.phone}</p><p className="text-xs text-muted-foreground">{o.email} · {fmt(o.created_at)}</p>
              <p className="mt-2 text-sm text-muted-foreground">{o.order_items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
              {o.address && <p className="mt-1 text-xs text-muted-foreground">Envío a: {o.address}</p>}
              {o.notes && <p className="mt-1 text-xs text-muted-foreground">Nota: {o.notes}</p>}
            </div>
            <div className="text-sm">
              <p><span className="text-muted-foreground">Total:</span> <strong>{money(Number(o.total))}</strong></p>
              <p><span className="text-muted-foreground">Pago:</span> {paymentLabels[o.payment_method]} · <strong>{paymentStatusLabels[o.payment_status]}</strong></p>
              {o.payment_reference && <p><span className="text-muted-foreground">Referencia:</span> {o.payment_reference}</p>}
              <p><span className="text-muted-foreground">Entrega:</span> {deliveryLabels[o.delivery_method]}</p>
              {o.tracking_number && <p><span className="text-muted-foreground">Guía:</span> {o.carrier} {o.tracking_number}</p>}
            </div>
            <div className="space-y-2">
              <label className="grid gap-1 text-xs font-semibold">Estado
                <select className="field" value={o.status} onChange={(e) => update(o.id, { status: e.target.value })}>{allStatusesFor(o.delivery_method).map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}</select>
              </label>
              {o.delivery_method === "shipping" && <TrackingInput o={o} onSave={(carrier, tracking_number) => update(o.id, { carrier, tracking_number })} />}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => setOpen(open === o.id ? null : o.id)}><ChevronDown /> Historial</Button>
                <Button size="sm" variant="ghost" onClick={() => update(o.id, { archived: !o.archived }, o.archived ? "Pedido restaurado" : "Pedido archivado")}>{o.archived ? "Restaurar" : "Archivar"}</Button>
              </div>
            </div>
          </div>
          {open === o.id && (
            <ol className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
              {[...o.order_status_history].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((h, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2"><span>{h.previous_status ? `${statusLabels[h.previous_status] ?? h.previous_status} → ` : ""}<strong>{statusLabels[h.status] ?? h.status}</strong></span><span className="text-muted-foreground">{h.changed_by_email ?? "Sistema / cliente"} · {fmt(h.created_at)}</span></li>
              ))}
            </ol>
          )}
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

export function Payments() {
  const { data: orders = [] } = useAdminOrders();
  const { data: reqs = [] } = useAdminRequests();
  const invalidate = useInvalidate();
  const [filter, setFilter] = useState("pending");
  const rows = useMemo(() => [
    ...orders.map((o) => ({ kind: "order" as const, id: o.id, code: `#${o.order_number}`, customer: o.customer_name, method: o.payment_method, reference: o.payment_reference, status: o.payment_status, total: Number(o.total), created_at: o.created_at })),
    ...reqs.map((r) => ({ kind: "service" as const, id: r.id, code: r.reference, customer: r.customer_name, method: r.payment_method, reference: r.payment_reference, status: r.payment_status, total: r.amount === null ? null : Number(r.amount), created_at: r.created_at })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)), [orders, reqs]);
  const list = rows.filter((r) => !filter || r.status === filter);

  async function setStatus(r: (typeof rows)[number], payment_status: string) {
    const { error } = r.kind === "order"
      ? await supabase.from("orders").update({ payment_status, ...(payment_status === "confirmed" ? { status: "payment_confirmed" } : {}) }).eq("id", r.id)
      : await supabase.from("service_requests").update({ payment_status, updated_at: new Date().toISOString() }).eq("id", r.id);
    if (error) { toast.error("No se pudo actualizar"); return; }
    toast.success(`Pago ${paymentStatusLabels[payment_status]?.toLowerCase()}`); invalidate("admin-orders", "admin-requests");
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Verifica las referencias de Zelle en tu banco antes de confirmar. Tarjeta y PayPal son de demostración; nunca se guardan datos de tarjetas.</p>
      <div className="flex gap-2">{([["pending", "Pendientes"], ["confirmed", "Confirmados"], ["rejected", "Rechazados"], ["", "Todos"]] as const).map(([k, l]) => <button key={k} type="button" className="chip" data-active={filter === k} onClick={() => setFilter(k)}>{l}</button>)}</div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Orden / Ref.</th><th>Cliente</th><th>Método</th><th>Referencia</th><th>Total</th><th>Fecha</th><th>Estado</th></tr></thead>
          <tbody className="divide-y divide-border">{list.map((r) => (
            <tr key={r.kind + r.id}>
              <td className="p-3 font-semibold">{r.code}<div className="text-xs font-normal text-muted-foreground">{r.kind === "order" ? "Pedido" : "Servicio"}</div></td>
              <td>{r.customer}</td><td>{paymentLabels[r.method] ?? r.method}</td><td className="max-w-[160px] truncate">{r.reference ?? "—"}</td>
              <td className="font-semibold">{r.total !== null ? money(r.total) : "—"}</td><td className="text-muted-foreground">{fmt(r.created_at)}</td>
              <td><select className="field h-9 w-36" value={r.status} onChange={(e) => setStatus(r, e.target.value)}>{Object.entries(paymentStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
            </tr>))}</tbody>
        </table>
        {!list.length && <p className="p-4 text-muted-foreground">Sin pagos en esta vista.</p>}
      </div>
    </div>
  );
}

export function Customers() {
  const { data = [] } = useAdminOrders();
  const { data: reqs = [] } = useAdminRequests();
  const customers = useMemo(() => {
    const m = new Map<string, { name: string; email: string; phone: string; orders: number; requests: number; total: number; last: string }>();
    const get = (email: string, name: string, phone: string, at: string) => { const k = email.toLowerCase(); const c = m.get(k) ?? { name, email, phone, orders: 0, requests: 0, total: 0, last: at }; if (at > c.last) c.last = at; m.set(k, c); return c; };
    data.forEach((o) => { const c = get(o.email, o.customer_name, o.phone, o.created_at); c.orders++; if (o.status !== "cancelled") c.total += Number(o.total); });
    reqs.forEach((r) => { get(r.email, r.customer_name, r.phone, r.created_at).requests++; });
    return [...m.values()].sort((a, b) => b.last.localeCompare(a.last));
  }, [data, reqs]);
  if (!customers.length) return <p className="text-muted-foreground">Sin clientes todavía.</p>;
  return <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[640px] text-sm"><thead className="bg-surface text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Cliente</th><th>Teléfono</th><th>Pedidos</th><th>Solicitudes</th><th>Total comprado</th><th>Última actividad</th></tr></thead><tbody className="divide-y divide-border">{customers.map((c) => <tr key={c.email}><td className="p-3 font-semibold">{c.name}<div className="text-xs font-normal text-muted-foreground">{c.email}</div></td><td>{c.phone}</td><td>{c.orders}</td><td>{c.requests}</td><td className="font-semibold">{money(c.total)}</td><td className="text-muted-foreground">{fmt(c.last)}</td></tr>)}</tbody></table></div>;
}

export function Tracking() {
  const { data: orders = [] } = useAdminOrders();
  const { data: notes = [] } = useQuery({ queryKey: ["admin-notifications"], queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  const active = orders.filter((o) => !o.archived && !["delivered", "picked_up", "cancelled"].includes(o.status));
  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-2 font-bold text-primary">Pedidos en curso ({active.length})</h2>
        <p className="mb-3 text-sm text-muted-foreground">El cliente ve cada cambio en la página Seguimiento en segundos, sin recargar.</p>
        <ul className="divide-y divide-border rounded-xl border border-border text-sm">
          {active.map((o) => <li key={o.id} className="flex flex-wrap justify-between gap-2 p-3"><span><strong>#{o.order_number}</strong> · {o.customer_name} · {deliveryLabels[o.delivery_method]}</span><span className="font-semibold text-primary">{statusLabels[o.status]}<span className="ml-2 font-normal text-muted-foreground">{fmt(o.updated_at)}</span></span></li>)}
          {!active.length && <li className="p-3 text-muted-foreground">No hay pedidos en curso.</li>}
        </ul>
      </div>
      <div>
        <h2 className="mb-2 font-bold text-primary">Avisos al cliente</h2>
        <p className="mb-3 text-sm text-muted-foreground">Se generan automáticamente con cada cambio de estado. Quedan listos para enviarse por correo, SMS o WhatsApp.</p>
        <div className="space-y-2">{notes.map((n) => <div key={n.id} className="card-soft flex flex-wrap justify-between gap-2 p-3 text-sm"><span>{n.message}</span><span className="text-muted-foreground">{n.recipient} · {n.status === "sent" ? "Enviado" : "Pendiente"} · {fmt(n.created_at)}</span></div>)}{!notes.length && <p className="text-muted-foreground">Sin avisos.</p>}</div>
      </div>
    </div>
  );
}
