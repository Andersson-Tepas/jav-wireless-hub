import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/catalog";
import { uploadProductImage } from "@/lib/admin.functions";
import { money } from "@/lib/cart";
import { productImage } from "@/lib/site-data";
import { Field, fmt, lowStockFrom, useAdminCategories, useAdminProducts, useInvalidate, useLowStock } from "./shared";

type Draft = {
  name: string; brand: string; model: string; category_id: string; price: string; old_price: string; stock: string;
  colors: string; capacity: string; description: string; features: string; specs: string; financing: string; image: string;
  is_featured: boolean; is_bestseller: boolean; is_new: boolean; is_offer: boolean; active: boolean;
};

const toDraft = (p?: Product): Draft => ({
  name: p?.name ?? "", brand: p?.brand ?? "", model: p?.model ?? "", category_id: p?.category_id ?? "telefonos",
  price: p ? String(p.price) : "", old_price: p?.old_price != null ? String(p.old_price) : "", stock: p ? String(p.stock) : "0",
  colors: p?.colors.join(", ") ?? "", capacity: p?.capacity ?? "", description: p?.description ?? "",
  features: p?.features.join("\n") ?? "",
  specs: Array.isArray(p?.specs) ? (p!.specs as { label: string; value: string }[]).map((s) => `${s.label}: ${s.value}`).join("\n") : "",
  financing: p?.financing ?? "", image: p?.image ?? "",
  is_featured: p?.is_featured ?? false, is_bestseller: p?.is_bestseller ?? false, is_new: p?.is_new ?? true, is_offer: p?.is_offer ?? false, active: p?.active ?? true,
});

const fromDraft = (d: Draft) => ({
  name: d.name.trim(), brand: d.brand.trim(), model: d.model.trim(), category_id: d.category_id,
  price: Number(d.price), old_price: d.old_price ? Number(d.old_price) : null, stock: Math.max(0, Math.floor(Number(d.stock) || 0)),
  colors: d.colors.split(",").map((s) => s.trim()).filter(Boolean), capacity: d.capacity.trim(), description: d.description.trim(),
  features: d.features.split("\n").map((s) => s.trim()).filter(Boolean),
  specs: d.specs.split("\n").map((l) => { const i = l.indexOf(":"); return i > 0 ? { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() } : null; }).filter(Boolean),
  financing: d.financing.trim() || null, image: d.image.trim(),
  is_featured: d.is_featured, is_bestseller: d.is_bestseller, is_new: d.is_new, is_offer: d.is_offer, active: d.active,
});

export function Products() {
  const { data = [] } = useAdminProducts();
  const { data: cats = [] } = useAdminCategories();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [filter, setFilter] = useState("");
  const refresh = () => invalidate("admin-products", "products");
  const list = data.filter((p) => !filter || `${p.name} ${p.brand} ${p.model}`.toLowerCase().includes(filter.toLowerCase()));

  async function remove(p: Product) {
    if (!confirm(`¿Delete "${p.name}"? Si tiene pedidos se desactivará en lugar de borrarse.`)) return;
    const { data: used } = await supabase.from("order_items").select("id").eq("product_id", p.id).limit(1);
    const { error } = used?.length ? await supabase.from("products").update({ active: false }).eq("id", p.id) : await supabase.from("products").delete().eq("id", p.id);
    if (error) { toast.error("No se pudo eliminar"); return; }
    toast.success(used?.length ? "Producto desactivado (tiene pedidos)" : "Producto eliminado"); refresh();
  }
  async function toggle(p: Product, k: "is_featured" | "is_offer" | "active", v: boolean) {
    const { error } = await supabase.from("products").update({ [k]: v } as never).eq("id", p.id);
    if (error) toast.error("No se pudo guardar"); else refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2"><input className="field max-w-sm" placeholder="Search producto..." value={filter} onChange={(e) => setFilter(e.target.value)} /><Button onClick={() => setEditing("new")}><Plus /> New producto</Button></div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Producto</th><th>Categoría</th><th>Price</th><th>Stock</th><th className="text-center">Destacado</th><th className="text-center">Sale</th><th className="text-center">Activo</th><th /></tr></thead>
          <tbody className="divide-y divide-border">{list.map((p) => (
            <tr key={p.id} className={p.active ? "" : "opacity-60"}>
              <td className="flex items-center gap-3 p-3"><img src={productImage(p.image)} alt="" className="size-10 rounded object-cover" /><div><p className="font-semibold">{p.name}</p><p className="text-xs text-muted-foreground">{p.brand} {p.model}</p></div></td>
              <td>{cats.find((c) => c.id === p.category_id)?.name ?? p.category_id}</td>
              <td className="font-semibold">{money(Number(p.price))}{p.old_price ? <span className="ml-1 text-xs text-muted-foreground line-through">{money(Number(p.old_price))}</span> : null}</td>
              <td>{p.stock}</td>
              {(["is_featured", "is_offer", "active"] as const).map((k) => <td key={k} className="text-center"><input type="checkbox" aria-label={k} className="size-4 accent-primary" checked={p[k]} onChange={(e) => toggle(p, k, e.target.checked)} /></td>)}
              <td className="whitespace-nowrap pr-3 text-right"><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing(p)}><Pencil /></Button><Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(p)}><Trash2 /></Button></td>
            </tr>))}</tbody>
        </table>
      </div>
      {editing && <ProductEditor product={editing === "new" ? undefined : editing} cats={cats} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </div>
  );
}

function ProductEditor({ product, cats, onClose, onSaved }: { product?: Product | undefined; cats: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(toDraft(product));
  const [busy, setBusy] = useState(false);
  const upload = useServerFn(uploadProductImage);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 5_000_000) { toast.error("La imagen debe pesar menos de 5 MB"); return; }
    setBusy(true);
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const r = await upload({ data: { filename: f.name, contentType: f.type as "image/jpeg", base64: btoa(bin) } });
      set("image", r.url); toast.success("Imagen subida");
    } catch { toast.error("Could not upload the image (JPG, PNG o WEBP)"); }
    finally { setBusy(false); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const body = fromDraft(d);
    const { error } = product ? await supabase.from("products").update(body).eq("id", product.id) : await supabase.from("products").insert(body);
    setBusy(false);
    if (error) { toast.error("No se pudo guardar el producto"); return; }
    toast.success(product ? "Producto actualizado" : "Producto creado"); onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{product ? "Edit producto" : "New producto"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2"><input required className="field" value={d.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Brand"><input className="field" value={d.brand} onChange={(e) => set("brand", e.target.value)} /></Field>
          <Field label="Model"><input className="field" value={d.model} onChange={(e) => set("model", e.target.value)} /></Field>
          <Field label="Categoría"><select className="field" value={d.category_id} onChange={(e) => set("category_id", e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Capacidad / talla"><input className="field" value={d.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
          <Field label="Price (USD)"><input required type="number" min={0} step="0.01" className="field" value={d.price} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="Price anterior (para ofertas)"><input type="number" min={0} step="0.01" className="field" value={d.old_price} onChange={(e) => set("old_price", e.target.value)} /></Field>
          <Field label="Stock"><input required type="number" min={0} className="field" value={d.stock} onChange={(e) => set("stock", e.target.value)} /></Field>
          <Field label="Colors (separados por coma)"><input className="field" value={d.colors} onChange={(e) => set("colors", e.target.value)} /></Field>
          <Field label="Descripción" className="sm:col-span-2"><textarea className="field h-24 py-2" value={d.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Features (una por línea)"><textarea className="field h-28 py-2" value={d.features} onChange={(e) => set("features", e.target.value)} /></Field>
          <Field label="Specifications (Etiqueta: valor)"><textarea className="field h-28 py-2" value={d.specs} onChange={(e) => set("specs", e.target.value)} /></Field>
          <Field label="Financing (opcional)" className="sm:col-span-2"><input className="field" value={d.financing} onChange={(e) => set("financing", e.target.value)} /></Field>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-[96px_1fr]">
            <img src={productImage(d.image)} alt="" className="size-24 rounded-lg border border-border object-cover" />
            <div className="grid gap-2">
              <Field label="Imagen"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" /></Field>
              <input className="field" placeholder="o pega un enlace https://..." value={d.image} onChange={(e) => set("image", e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold sm:col-span-2">
            {([["is_featured", "Destacado"], ["is_bestseller", "Más vendido"], ["is_new", "New"], ["is_offer", "Sale"], ["active", "Activo (visible)"]] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-primary" checked={d[k]} onChange={(e) => set(k, e.target.checked)} />{l}</label>)}
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? "Guardando..." : "Guardar"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Inventory() {
  const { data: products = [] } = useAdminProducts();
  const { data: settings } = useLowStock();
  const invalidate = useInvalidate();
  const low = lowStockFrom(settings);
  const [view, setView] = useState<"all" | "low" | "out">("all");
  const { data: moves = [] } = useQuery({ queryKey: ["admin-inventory"], queryFn: async () => (await supabase.from("inventory_movements").select("*, products(name)").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  const list = products.filter((p) => view === "all" || (view === "low" ? p.stock > 0 && p.stock <= low : p.stock === 0));

  async function adjust(p: Product, delta: number) {
    if (!delta) return;
    const next = p.stock + delta;
    if (next < 0) { toast.error("El stock no puede ser negativo"); return; }
    const { error } = await supabase.from("products").update({ stock: next }).eq("id", p.id);
    if (error) { toast.error("No se pudo actualizar"); return; }
    toast.success(delta > 0 ? "Entrada registrada" : "Salida registrada"); invalidate("admin-products", "admin-inventory", "products");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {([["all", `All (${products.length})`], ["low", `Stock bajo ≤ ${low} (${products.filter((p) => p.stock > 0 && p.stock <= low).length})`], ["out", `Out of stock (${products.filter((p) => p.stock === 0).length})`]] as const).map(([k, l]) => <button key={k} type="button" className="chip" data-active={view === k} onClick={() => setView(k)}>{l}</button>)}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Producto</th><th>In stock</th><th>Registrar entrada / salida</th></tr></thead>
          <tbody className="divide-y divide-border">{list.map((p) => <InventoryRow key={p.id} p={p} low={low} onAdjust={adjust} />)}</tbody>
        </table>
      </div>
      <div>
        <h2 className="mb-2 font-bold text-primary">Movimientos recientes</h2>
        <ul className="divide-y divide-border rounded-xl border border-border text-sm">
          {moves.map((m) => <li key={m.id} className="flex flex-wrap justify-between gap-2 p-3"><span><strong className={m.kind === "out" ? "text-accent" : "text-success"}>{m.kind === "out" ? "−" : "+"}{m.quantity}</strong> {(m.products as { name: string } | null)?.name ?? "Producto"} · {m.reason}</span><span className="text-muted-foreground">Queda {m.stock_after} · {m.created_by_email ?? "sistema"} · {fmt(m.created_at)}</span></li>)}
          {!moves.length && <li className="p-3 text-muted-foreground">Sin movimientos.</li>}
        </ul>
      </div>
    </div>
  );
}

function InventoryRow({ p, low, onAdjust }: { p: Product; low: number; onAdjust: (p: Product, d: number) => void }) {
  const [qty, setQty] = useState("1");
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  return (
    <tr>
      <td className="p-3 font-semibold">{p.name}</td>
      <td><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.stock === 0 ? "bg-accent/10 text-accent" : p.stock <= low ? "bg-surface text-foreground" : "text-success"}`}>{p.stock === 0 ? "Out of stock" : p.stock}</span></td>
      <td className="flex gap-2 py-2"><input type="number" min={1} className="field h-9 w-20" value={qty} onChange={(e) => setQty(e.target.value)} /><Button size="sm" variant="outline" onClick={() => onAdjust(p, n)}>+ Entrada</Button><Button size="sm" variant="outline" onClick={() => onAdjust(p, -n)}>− Salida</Button></td>
    </tr>
  );
}
