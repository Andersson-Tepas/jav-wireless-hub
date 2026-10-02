import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { money } from "@/lib/cart";
import { paymentLabels, serviceStatusLabels } from "@/lib/site-data";
import { Field, fmt, paymentStatusLabels, slugify, useAdminCategories, useAdminProducts, useAdminRequests, useInvalidate } from "./shared";

// ---------------- Categories ----------------
export function Categories() {
  const { data = [] } = useAdminCategories();
  const { data: products = [] } = useAdminProducts();
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const refresh = () => invalidate("admin-categories", "categories");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("categories").insert({ id: slugify(name), name: name.trim(), sort: data.length + 1 });
    if (error) { toast.error("No se pudo crear (¿ya existe?)"); return; }
    setName(""); toast.success("Categoría creada"); refresh();
  }
  async function patch(id: string, p: { name?: string; active?: boolean; sort?: number }) {
    const { error } = await supabase.from("categories").update(p).eq("id", id);
    if (error) toast.error("No se pudo guardar"); else refresh();
  }
  async function remove(id: string) {
    if (products.some((p) => p.category_id === id)) { toast.error("Tiene productos: desactívala en su lugar"); return; }
    if (!confirm("¿Delete esta categoría?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error("No se pudo eliminar"); else { toast.success("Categoría eliminada"); refresh(); }
  }
  return (
    <div className="max-w-2xl space-y-3">
      <form onSubmit={add} className="flex gap-2"><input required className="field" placeholder="Nueva categoría" value={name} onChange={(e) => setName(e.target.value)} /><Button type="submit"><Plus /> Add</Button></form>
      <ul className="divide-y divide-border rounded-xl border border-border">{data.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-3 p-3">
          <input className="field h-9 flex-1" defaultValue={c.name} onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && patch(c.id, { name: e.target.value.trim() })} />
          <input type="number" className="field h-9 w-16" defaultValue={c.sort} aria-label="Orden" onBlur={(e) => Number(e.target.value) !== c.sort && patch(c.id, { sort: Number(e.target.value) })} />
          <span className="text-xs text-muted-foreground">{products.filter((p) => p.category_id === c.id).length} productos</span>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-primary" checked={c.active} onChange={(e) => patch(c.id, { active: e.target.checked })} />Activa</label>
          <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(c.id)}><Trash2 /></Button>
        </li>))}</ul>
    </div>
  );
}

// ---------------- Services ----------------
type ServiceRow = Tables<"services">;
type Fld = { name: string; label: string; type?: "text" | "number" | "textarea" | "date" };

export function ServicesAdmin() {
  const invalidate = useInvalidate();
  const { data = [] } = useQuery({ queryKey: ["admin-services"], queryFn: async () => (await supabase.from("services").select("*").order("sort")).data ?? [] });
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null);
  async function toggle(s: ServiceRow) {
    const { error } = await supabase.from("services").update({ active: !s.active }).eq("slug", s.slug);
    if (error) toast.error("No se pudo guardar"); else invalidate("admin-services", "services");
  }
  return (
    <div className="space-y-3">
      <Button onClick={() => setEditing("new")}><Plus /> New servicio</Button>
      <div className="grid gap-3 md:grid-cols-2">{data.map((s) => (
        <div key={s.slug} className={`card-soft flex items-start justify-between gap-3 p-4 ${s.active ? "" : "opacity-60"}`}>
          <div><p className="font-bold text-primary">{s.name}</p><p className="text-sm text-muted-foreground">{s.cost}</p><p className="mt-1 text-xs text-muted-foreground">{(s.fields as unknown as Fld[]).length} campos · {s.requirements.length} requisitos</p></div>
          <div className="flex shrink-0 items-center gap-2"><label className="flex items-center gap-1 text-xs font-semibold"><input type="checkbox" className="size-4 accent-primary" checked={s.active} onChange={() => toggle(s)} />Activo</label><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing(s)}><Pencil /></Button></div>
        </div>))}</div>
      {editing && <ServiceEditor s={editing === "new" ? undefined : editing} nextSort={data.length} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); invalidate("admin-services", "services"); }} />}
    </div>
  );
}

function ServiceEditor({ s, nextSort, onClose, onSaved }: { s?: ServiceRow | undefined; nextSort: number; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState({ name: s?.name ?? "", short: s?.short ?? "", description: s?.description ?? "", requirements: s?.requirements.join("\n") ?? "", cost: s?.cost ?? "", fee: s?.fee != null ? String(s.fee) : "", amount_field: s?.amount_field ?? false, active: s?.active ?? true });
  const [fields, setFields] = useState<Fld[]>(s ? (s.fields as unknown as Fld[]) : []);
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const body = { name: d.name.trim(), short: d.short.trim(), description: d.description.trim(), requirements: d.requirements.split("\n").map((x) => x.trim()).filter(Boolean), cost: d.cost.trim(), fee: d.fee ? Number(d.fee) : null, amount_field: d.amount_field, active: d.active, fields: fields.filter((f) => f.label.trim()).map((f) => ({ ...f, name: f.name || slugify(f.label).replace(/-/g, "_") })), updated_at: new Date().toISOString() };
    const { error } = s ? await supabase.from("services").update(body).eq("slug", s.slug) : await supabase.from("services").insert({ ...body, slug: slugify(d.name), sort: nextSort });
    setBusy(false);
    if (error) { toast.error("No se pudo guardar el servicio"); return; }
    toast.success("Servicio guardado"); onSaved();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{s ? "Edit servicio" : "New servicio"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          <Field label="Name"><input required className="field" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
          <Field label="Summary"><input className="field" value={d.short} onChange={(e) => setD({ ...d, short: e.target.value })} /></Field>
          <Field label="Descripción"><textarea className="field h-20 py-2" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></Field>
          <Field label="Requirements (uno por línea)"><textarea className="field h-24 py-2" value={d.requirements} onChange={(e) => setD({ ...d, requirements: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Texto de costo"><input className="field" value={d.cost} onChange={(e) => setD({ ...d, cost: e.target.value })} /></Field>
            <Field label="Comisión fija (USD, opcional)"><input type="number" min={0} step="0.01" className="field" value={d.fee} onChange={(e) => setD({ ...d, fee: e.target.value })} /></Field>
          </div>
          <div className="flex gap-4 text-sm font-semibold"><label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-primary" checked={d.amount_field} onChange={(e) => setD({ ...d, amount_field: e.target.checked })} />Pedir monto al cliente</label><label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-primary" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} />Activo</label></div>
          <div>
            <p className="mb-2 text-xs font-semibold">Campos del formulario</p>
            <div className="space-y-2">{fields.map((f, i) => (
              <div key={i} className="flex gap-2">
                <input className="field h-9 flex-1" placeholder="Etiqueta" value={f.label} onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <select className="field h-9 w-32" value={f.type ?? "text"} onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, type: e.target.value as "text" } as Fld : x))}><option value="text">Texto</option><option value="number">Número</option><option value="textarea">Párrafo</option><option value="date">Date</option></select>
                <Button type="button" size="icon" variant="ghost" aria-label="Quitar campo" onClick={() => setFields(fields.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>))}</div>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setFields([...fields, { name: "", label: "" }])}><Plus /> Add campo</Button>
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy}>Guardar</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Requests ----------------
export function Requests() {
  const { data = [] } = useAdminRequests();
  const invalidate = useInvalidate();
  const [filter, setFilter] = useState("");
  async function patch(id: string, p: { status?: string; payment_status?: string; internal_notes?: string }, msg = "Request actualizada") {
    const { error } = await supabase.from("service_requests").update({ ...p, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("No se pudo actualizar"); return; }
    toast.success(msg); invalidate("admin-requests");
  }
  const list = data.filter((r) => !filter || r.status === filter);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2"><button type="button" className="chip" data-active={!filter} onClick={() => setFilter("")}>Todas</button>{Object.entries(serviceStatusLabels).map(([k, v]) => <button key={k} type="button" className="chip" data-active={filter === k} onClick={() => setFilter(k)}>{v}</button>)}</div>
      {!list.length && <p className="text-muted-foreground">Sin solicitudes.</p>}
      {list.map((r) => (
        <div key={r.id} className="card-soft grid gap-4 p-4 md:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="font-bold text-primary">{r.reference} · {r.service_name}</p>
            <p className="text-sm">{r.customer_name} · {r.phone} · {r.email}</p>
            <p className="text-xs text-muted-foreground">{fmt(r.created_at)} · {paymentLabels[r.payment_method]}{r.payment_reference ? ` (ref. ${r.payment_reference})` : ""}{r.amount !== null ? ` · ${money(Number(r.amount))}` : ""}</p>
            <dl className="mt-2 text-sm text-muted-foreground">{Object.entries((r.details ?? {}) as Record<string, string>).map(([k, v]) => <div key={k}><span className="font-semibold">{k}:</span> {v}</div>)}</dl>
            <textarea className="field mt-3 h-16 py-2 text-sm" placeholder="Notas internas (no las ve el cliente)" defaultValue={r.internal_notes ?? ""} onBlur={(e) => e.target.value !== (r.internal_notes ?? "") && patch(r.id, { internal_notes: e.target.value }, "Nota guardada")} />
          </div>
          <div className="grid h-fit gap-2">
            <Field label="Status"><select className="field" value={r.status} onChange={(e) => patch(r.id, { status: e.target.value })}>{Object.entries(serviceStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Pago"><select className="field" value={r.payment_status} onChange={(e) => patch(r.id, { payment_status: e.target.value })}>{Object.entries(paymentStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            {r.status !== "completed" && <Button size="sm" onClick={() => patch(r.id, { status: "completed" }, "Request completada")}>Brandr como completada</Button>}
          </div>
        </div>))}
    </div>
  );
}

// ---------------- Promotions ----------------
type Promo = Tables<"promotions"> & { promotion_products: { product_id: string }[] };
const toLocal = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 16) : "");

export function Promotions() {
  const invalidate = useInvalidate();
  const { data: products = [] } = useAdminProducts();
  const { data = [] } = useQuery({ queryKey: ["admin-promotions"], queryFn: async () => ((await supabase.from("promotions").select("*, promotion_products(product_id)").order("starts_at", { ascending: false })).data ?? []) as Promo[] });
  const [editing, setEditing] = useState<Promo | "new" | null>(null);
  const now = Date.now();
  const state = (p: Promo) => !p.active ? "Inactiva" : new Date(p.starts_at).getTime() > now ? "Programada" : p.ends_at && new Date(p.ends_at).getTime() <= now ? "Finalizada" : "Vigente";
  async function remove(id: string) {
    if (!confirm("¿Delete esta promoción?")) return;
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    if (error) toast.error("No se pudo eliminar"); else invalidate("admin-promotions", "promotions");
  }
  return (
    <div className="space-y-3">
      <Button onClick={() => setEditing("new")}><Plus /> Nueva promoción</Button>
      {!data.length && <p className="text-muted-foreground">Sin promociones.</p>}
      {data.map((p) => (
        <div key={p.id} className="card-soft flex flex-wrap items-start justify-between gap-3 p-4">
          <div><p className="font-bold text-primary">{p.title} {p.discount_percent ? <span className="text-accent">−{Number(p.discount_percent)}%</span> : null}</p><p className="text-sm text-muted-foreground">{p.description}</p><p className="mt-1 text-xs text-muted-foreground">{fmt(p.starts_at)} → {p.ends_at ? fmt(p.ends_at) : "sin fecha de fin"} · {p.promotion_products.length} productos</p></div>
          <div className="flex items-center gap-2"><span className="chip" data-active={state(p) === "Vigente"}>{state(p)}</span><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing(p)}><Pencil /></Button><Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(p.id)}><Trash2 /></Button></div>
        </div>))}
      {editing && <PromoEditor p={editing === "new" ? undefined : editing} products={products} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); invalidate("admin-promotions", "promotions"); }} />}
    </div>
  );
}

function PromoEditor({ p, products, onClose, onSaved }: { p?: Promo | undefined; products: { id: string; name: string; active: boolean }[]; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState({ title: p?.title ?? "", description: p?.description ?? "", discount: p?.discount_percent != null ? String(p.discount_percent) : "", starts_at: toLocal(p?.starts_at ?? new Date().toISOString()), ends_at: toLocal(p?.ends_at ?? null), active: p?.active ?? true });
  const [sel, setSel] = useState<string[]>(p?.promotion_products.map((x) => x.product_id) ?? []);
  const [markFeatured, setMarkFeatured] = useState(true);
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const body = { title: d.title.trim(), description: d.description.trim(), discount_percent: d.discount ? Number(d.discount) : null, starts_at: new Date(d.starts_at).toISOString(), ends_at: d.ends_at ? new Date(d.ends_at).toISOString() : null, active: d.active };
    const res = p ? await supabase.from("promotions").update(body).eq("id", p.id).select("id").single() : await supabase.from("promotions").insert(body).select("id").single();
    if (res.error || !res.data) { setBusy(false); toast.error("No se pudo guardar"); return; }
    const id = res.data.id;
    await supabase.from("promotion_products").delete().eq("promotion_id", id);
    if (sel.length) await supabase.from("promotion_products").insert(sel.map((product_id) => ({ promotion_id: id, product_id })));
    if (markFeatured && sel.length) await supabase.from("products").update({ is_featured: true, is_offer: true }).in("id", sel);
    setBusy(false); toast.success("Promoción guardada"); onSaved();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{p ? "Edit promoción" : "Nueva promoción"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <Field label="Título" className="sm:col-span-2"><input required className="field" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></Field>
          <Field label="Descripción" className="sm:col-span-2"><input className="field" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></Field>
          <Field label="Descuento % (opcional)"><input type="number" min={0} max={100} className="field" value={d.discount} onChange={(e) => setD({ ...d, discount: e.target.value })} /></Field>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-primary" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} />Activa</label>
          <Field label="Home"><input required type="datetime-local" className="field" value={d.starts_at} onChange={(e) => setD({ ...d, starts_at: e.target.value })} /></Field>
          <Field label="Fin (opcional)"><input type="datetime-local" className="field" value={d.ends_at} onChange={(e) => setD({ ...d, ends_at: e.target.value })} /></Field>
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-semibold">Products en promoción</p>
            <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2">{products.filter((x) => x.active).map((x) => <label key={x.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={sel.includes(x.id)} onChange={(e) => setSel(e.target.checked ? [...sel, x.id] : sel.filter((y) => y !== x.id))} />{x.name}</label>)}</div>
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={markFeatured} onChange={(e) => setMarkFeatured(e.target.checked)} />Brandr estos productos como destacados y en oferta</label>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy}>Guardar</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Settings ----------------
const settingLabels: Record<string, string> = { zelle_recipient: "Email o teléfono de Zelle", zelle_name: "Name del titular de Zelle", whatsapp: "Número de WhatsApp", store_phone: "Phone de la tienda", low_stock_threshold: "Umbral de stock bajo" };

export function Settings() {
  const invalidate = useInvalidate();
  const { data = [] } = useQuery({ queryKey: ["admin-settings"], queryFn: async () => (await supabase.from("settings").select("*")).data ?? [] });
  async function save(key: string, value: string) {
    const { error } = await supabase.from("settings").update({ value: value.trim() }).eq("key", key);
    if (error) toast.error("No se pudo guardar"); else { toast.success("Guardado"); invalidate("admin-settings", "settings"); }
  }
  return (
    <div className="card-soft max-w-xl space-y-4 p-6">
      {data.map((s) => <Field key={s.key} label={settingLabels[s.key] ?? s.key}><input className="field" defaultValue={s.value} onBlur={(e) => e.target.value.trim() !== s.value && save(s.key, e.target.value)} /></Field>)}
      <p className="text-xs text-muted-foreground">Los cambios se guardan al salir de cada campo y se reflejan de inmediato en el sitio.</p>
    </div>
  );
}
