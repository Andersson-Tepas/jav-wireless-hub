import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileArchive, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { localizeProduct, type Product } from "@/lib/catalog";
import { uploadProductImage } from "@/lib/admin.functions";
import { money } from "@/lib/cart";
import { productImage } from "@/lib/site-data";
import { Field, fmt, lowStockFrom, useAdminCategories, useAdminProducts, useInvalidate, useLowStock } from "./shared";
import { ZipProductImporter } from "./zip-product-importer";

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
  specs: Array.isArray(p?.specs) ? (p.specs as { label: string; value: string }[]).map((s) => `${s.label}: ${s.value}`).join("\n") : "",
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
  const [importingZip, setImportingZip] = useState(false);
  const [filter, setFilter] = useState("");
  const refresh = () => invalidate("admin-products", "products", "admin-inventory");
  const list = data.filter((p) => !filter || `${localizeProduct(p).name} ${p.brand} ${p.model}`.toLowerCase().includes(filter.toLowerCase()));

  async function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"? If it has orders, it will be deactivated instead of deleted.`)) return;
    const { data: used } = await supabase.from("order_items").select("id").eq("product_id", p.id).limit(1);
    const { error } = used?.length ? await supabase.from("products").update({ active: false }).eq("id", p.id) : await supabase.from("products").delete().eq("id", p.id);
    if (error) { toast.error("Could not delete"); return; }
    toast.success(used?.length ? "Product deactivated because it has orders" : "Product deleted"); refresh();
  }
  async function toggle(p: Product, k: "is_featured" | "is_offer" | "active", v: boolean) {
    const { error } = await supabase.from("products").update({ [k]: v } as never).eq("id", p.id);
    if (error) toast.error("Could not save"); else refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2"><input className="field max-w-sm" placeholder="Search products..." value={filter} onChange={(e) => setFilter(e.target.value)} /><Button onClick={() => setEditing("new")}><Plus /> New product</Button><Button variant="outline" onClick={() => setImportingZip(true)}><FileArchive /> Import products (ZIP)</Button></div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Product</th><th>Category</th><th>Price</th><th>Stock</th><th className="text-center">Featured</th><th className="text-center">Sale</th><th className="text-center">Active</th><th /></tr></thead>
          <tbody className="divide-y divide-border">{list.map((p) => (
            <tr key={p.id} className={p.active ? "" : "opacity-60"}>
              <td className="flex items-center gap-3 p-3"><img src={productImage(p.image)} alt="" className="size-10 rounded object-cover" /><div><p className="font-semibold">{localizeProduct(p).name}</p><p className="text-xs text-muted-foreground">{p.brand} {p.model}</p></div></td>
              <td>{cats.find((c) => c.id === p.category_id)?.name ?? p.category_id}</td>
              <td className="font-semibold">{money(Number(p.price))}{p.old_price ? <span className="ml-1 text-xs text-muted-foreground line-through">{money(Number(p.old_price))}</span> : null}</td>
              <td>{p.stock}</td>
              {(["is_featured", "is_offer", "active"] as const).map((k) => <td key={k} className="text-center"><input type="checkbox" aria-label={k} className="size-4 accent-primary" checked={p[k]} onChange={(e) => toggle(p, k, e.target.checked)} /></td>)}
              <td className="whitespace-nowrap pr-3 text-right"><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing(p)}><Pencil /></Button><Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(p)}><Trash2 /></Button></td>
            </tr>))}</tbody>
        </table>
      </div>
      {editing && <ProductEditor product={editing === "new" ? undefined : editing} cats={cats} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {importingZip && <ZipProductImporter cats={cats} onClose={() => setImportingZip(false)} onImported={refresh} />}
    </div>
  );
}

function ProductEditor({ product, cats, onClose, onSaved }: { product?: Product | undefined; cats: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const localized = product ? localizeProduct(product) : undefined;
  const initial = toDraft(localized);
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const upload = useServerFn(uploadProductImage);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const [pending, setPending] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  function pick(f: File | undefined) {
    if (!f) return;
    const okType = ["image/jpeg", "image/png", "image/webp"].includes(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);
    if (!okType) { toast.error("Invalid file type. Please choose a JPG, JPEG, PNG, or WebP image."); return; }
    if (f.size > 5_000_000) { toast.error("The image is too large. Maximum size is 5 MB."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setPending(f); setPreview(URL.createObjectURL(f));
  }

  async function uploadPending(f: File): Promise<string> {
    const ext = f.name.split(".").pop()?.toLowerCase();
    const type = (["image/jpeg", "image/png", "image/webp"].includes(f.type) ? f.type : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg") as "image/jpeg";
    const buf = new Uint8Array(await f.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const r = await upload({ data: { filename: f.name.slice(0, 120), contentType: type, base64: btoa(bin) } });
    return r.url;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const body = fromDraft(d);
    if (pending) {
      try { body.image = await uploadPending(pending); }
      catch { setBusy(false); toast.error("Could not upload the image. Please try again."); return; }
    }
    if (product) {
      const original = toDraft(product);
      if (d.name === initial.name) body.name = original.name.trim();
      if (d.colors === initial.colors) body.colors = original.colors.split(",").map((s) => s.trim()).filter(Boolean);
      if (d.capacity === initial.capacity) body.capacity = original.capacity.trim();
      if (d.description === initial.description) body.description = original.description.trim();
      if (d.features === initial.features) body.features = original.features.split("\n").map((s) => s.trim()).filter(Boolean);
      if (d.specs === initial.specs) body.specs = fromDraft({ ...d, specs: original.specs }).specs;
      if (d.financing === initial.financing) body.financing = original.financing.trim() || null;
    }
    const { error } = product ? await supabase.from("products").update(body).eq("id", product.id) : await supabase.from("products").insert(body);
    setBusy(false);
    if (error) { toast.error("Could not save the product"); return; }
    toast.success(product ? "Product updated" : "Product created"); onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2"><input required className="field" value={d.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Brand"><input className="field" value={d.brand} onChange={(e) => set("brand", e.target.value)} /></Field>
          <Field label="Model"><input className="field" value={d.model} onChange={(e) => set("model", e.target.value)} /></Field>
          <Field label="Category"><select className="field" value={d.category_id} onChange={(e) => set("category_id", e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Capacity / size"><input className="field" value={d.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
          <Field label="Price (USD)"><input required type="number" min={0} step="0.01" className="field" value={d.price} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="Previous price (for sales)"><input type="number" min={0} step="0.01" className="field" value={d.old_price} onChange={(e) => set("old_price", e.target.value)} /></Field>
          <Field label="Stock"><input required type="number" min={0} className="field" value={d.stock} onChange={(e) => set("stock", e.target.value)} /></Field>
          <Field label="Colors (comma-separated)"><input className="field" value={d.colors} onChange={(e) => set("colors", e.target.value)} /></Field>
          <Field label="Description" className="sm:col-span-2"><textarea className="field h-24 py-2" value={d.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Features (one per line)"><textarea className="field h-28 py-2" value={d.features} onChange={(e) => set("features", e.target.value)} /></Field>
          <Field label="Specifications (Label: value)"><textarea className="field h-28 py-2" value={d.specs} onChange={(e) => set("specs", e.target.value)} /></Field>
          <Field label="Financing (optional)" className="sm:col-span-2"><input className="field" value={d.financing} onChange={(e) => set("financing", e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-semibold">Image</p>
            <label
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-4 text-center sm:flex-row sm:text-left ${drag ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <img src={preview ?? productImage(d.image)} alt="Product preview" className="size-24 rounded-lg border border-border object-cover" />
              <div className="grid gap-1 text-sm">
                <span className="inline-flex w-fit items-center gap-2 rounded-md border border-border px-3 py-1.5 font-semibold"><Upload className="size-4" /> {d.image || preview ? "Replace image" : "Upload image"}</span>
                <span className="text-muted-foreground">{pending ? pending.name : "Drag and drop or choose a file"} · JPG, PNG or WebP, up to 5 MB</span>
                {pending && <span className="text-xs text-muted-foreground">Will upload when you save.</span>}
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={busy} className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold sm:col-span-2">
            {([["is_featured", "Featured"], ["is_bestseller", "Best seller"], ["is_new", "New"], ["is_offer", "Sale"], ["active", "Active (visible)"]] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-primary" checked={d[k]} onChange={(e) => set(k, e.target.checked)} />{l}</label>)}
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save"}</Button></div>
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
    if (next < 0) { toast.error("Stock cannot be negative"); return; }
    const { error } = await supabase.from("products").update({ stock: next }).eq("id", p.id);
    if (error) { toast.error("Could not update"); return; }
    toast.success(delta > 0 ? "Stock received" : "Stock removed"); invalidate("admin-products", "admin-inventory", "products");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {([["all", `All (${products.length})`], ["low", `Low stock ≤ ${low} (${products.filter((p) => p.stock > 0 && p.stock <= low).length})`], ["out", `Out of stock (${products.filter((p) => p.stock === 0).length})`]] as const).map(([k, l]) => <button key={k} type="button" className="chip" data-active={view === k} onClick={() => setView(k)}>{l}</button>)}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Product</th><th>In stock</th><th>Record stock in / out</th></tr></thead>
          <tbody className="divide-y divide-border">{list.map((p) => <InventoryRow key={p.id} p={p} low={low} onAdjust={adjust} />)}</tbody>
        </table>
      </div>
      <div>
        <h2 className="mb-2 font-bold text-primary">Recent inventory activity</h2>
        <ul className="divide-y divide-border rounded-xl border border-border text-sm">
          {moves.map((m) => <li key={m.id} className="flex flex-wrap justify-between gap-2 p-3"><span><strong className={m.kind === "out" ? "text-accent" : "text-success"}>{m.kind === "out" ? "−" : "+"}{m.quantity}</strong> {(m.products as { name: string } | null)?.name ?? "Product"} · {m.reason}</span><span className="text-muted-foreground">Remaining: {m.stock_after} · {m.created_by_email ?? "system"} · {fmt(m.created_at)}</span></li>)}
          {!moves.length && <li className="p-3 text-muted-foreground">No inventory activity.</li>}
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
      <td className="p-3 font-semibold">{localizeProduct(p).name}</td>
      <td><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.stock === 0 ? "bg-accent/10 text-accent" : p.stock <= low ? "bg-surface text-foreground" : "text-success"}`}>{p.stock === 0 ? "Out of stock" : p.stock}</span></td>
      <td className="flex gap-2 py-2"><input type="number" min={1} className="field h-9 w-20" value={qty} onChange={(e) => setQty(e.target.value)} /><Button size="sm" variant="outline" onClick={() => onAdjust(p, n)}>+ Stock in</Button><Button size="sm" variant="outline" onClick={() => onAdjust(p, -n)}>− Stock out</Button></td>
    </tr>
  );
}
