import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ColorSwatch } from "@/components/variant-options";
import { supabase } from "@/integrations/supabase/client";
import { uploadProductImage } from "@/lib/admin.functions";
import type { Product } from "@/lib/catalog";
import { productImage } from "@/lib/site-data";
import { variantsQuery } from "@/lib/variant-queries";
import { hasVariants, selectionLabel, storagePresets, validateAllocation, variantSuggestion, type VariantDraft } from "@/lib/variants";
import { useInvalidate } from "./shared";

const colorPresets = ["Black", "White", "Blue", "Red", "Pink", "Green", "Gray", "Silver", "Gold", "Orange", "Purple", "Tan"];

export function ProductVariants({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return <div className="space-y-2"><p className="text-sm font-semibold">Selectable variants</p><p className="text-xs text-muted-foreground">{variantSuggestion(product.category_id)}</p><Button type="button" variant="outline" onClick={() => setOpen(true)}>Configure colors / storage</Button>{open && <VariantEditor product={product} onClose={() => setOpen(false)} onSaved={onSaved} />}</div>;
}

function VariantEditor({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const { data, isPending, isError } = useQuery(variantsQuery(product.id));
  const current = useQuery({ queryKey: ["variant-current-product", product.id], staleTime: 0, queryFn: async () => { const r = await supabase.from("products").select("*").eq("id", product.id).single(); if (r.error) throw r.error; return r.data; } });
  if (isPending || isError || current.isPending || current.isError) return <Dialog open onOpenChange={o => !o && onClose()}><DialogContent><DialogHeader><DialogTitle>Product variants</DialogTitle></DialogHeader><p>{isError || current.isError ? "Could not load variants. Close and retry." : "Loading variants..."}</p></DialogContent></Dialog>;
  return <VariantEditorForm product={current.data} initial={data} onClose={onClose} onSaved={onSaved} />;
}

function VariantEditorForm({ product, initial, onClose, onSaved }: { product: Product; initial: VariantDraft[]; onClose: () => void; onSaved: () => void }) {
  const [color, setColor] = useState(product.color_variants_enabled);
  const [storage, setStorage] = useState(product.storage_variants_enabled);
  const [rows, setRows] = useState<VariantDraft[]>(initial);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = useServerFn(uploadProductImage);
  const invalidate = useInvalidate();
  const allocation = validateAllocation(rows, color, storage, product.stock);
  const change = (index: number, patch: Partial<VariantDraft>) => { setConfirmed(false); setRows(prev => prev.map((v, i) => i === index ? { ...v, ...patch } : v)); };
  async function uploadImage(index: number, file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5_000_000) { toast.error("Choose a JPG, PNG or WebP up to 5 MB."); return; }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer()); let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const result = await upload({ data: { filename: file.name.slice(0, 120), contentType: file.type as "image/jpeg" | "image/png" | "image/webp", base64: btoa(binary) } });
      change(index, { image: result.url });
    } catch { toast.error("Image upload failed; the existing URL was preserved."); } finally { setBusy(false); }
  }
  async function save() {
    if (!confirmed || !allocation.valid) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.rpc("configure_product_variants", { _product_id: product.id, _color: color, _storage: storage, _variants: rows, _expected_stock: product.stock });
    setBusy(false);
    if (err) { setError(err.message); return; }
    invalidate("products", "admin-products", "product-variants", "admin-inventory");
    toast.success("Variant configuration saved; inventory total preserved."); onClose(); onSaved();
  }
  return <Dialog open onOpenChange={o => !o && !busy && onClose()}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Variants — {product.name}</DialogTitle></DialogHeader>
    <div className="flex flex-wrap gap-6"><label className="flex items-center gap-2 text-sm"><Switch checked={color} onCheckedChange={v => { setColor(v); setConfirmed(false); }} disabled={busy} />Enable color / finish</label><label className="flex items-center gap-2 text-sm"><Switch checked={storage} onCheckedChange={v => { setStorage(v); setConfirmed(false); }} disabled={busy} />Enable storage</label></div>
    <p className="text-sm">Current product stock: <strong>{product.stock}</strong> · Active combination total: <strong>{allocation.total}</strong></p>
    {(color || storage) && <><datalist id="variant-colors">{colorPresets.map(v => <option key={v} value={v} />)}</datalist><datalist id="variant-storage">{storagePresets.map(v => <option key={v} value={v} />)}</datalist>
      <div className="space-y-4">{rows.map((v, index) => <fieldset key={v.id ?? index} disabled={busy} className="grid gap-3 border-b border-border pb-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Combination {index + 1}</legend>
        {color && !v.id && <div className="flex flex-wrap gap-1 sm:col-span-2">{colorPresets.map(name => <Button key={name} type="button" variant="ghost" size="icon" title={name} aria-label={`Use ${name}`} onClick={() => change(index, { color_name: name, color_hex: null })}><ColorSwatch name={name} /></Button>)}</div>}
        {color && <label className="grid gap-1 text-xs">Color / branded finish name<div className="flex items-center gap-2"><ColorSwatch name={v.color_name ?? ""} hex={v.color_hex} /><input className="field" list="variant-colors" maxLength={80} disabled={!!v.id} value={v.color_name ?? ""} onChange={e => change(index, { color_name: e.target.value || null })} /></div></label>}
        {color && <label className="grid gap-1 text-xs">Custom hex (optional)<input className="field" placeholder="#RRGGBB" maxLength={7} value={v.color_hex ?? ""} onChange={e => change(index, { color_hex: e.target.value || null })} /></label>}
        {storage && <label className="grid gap-1 text-xs">Storage (preset or custom)<input className="field" list="variant-storage" maxLength={80} disabled={!!v.id} value={v.storage ?? ""} onChange={e => change(index, { storage: e.target.value || null })} /></label>}
        <label className="grid gap-1 text-xs">Stock<input className="field" type="number" min={0} max={1000000} step={1} value={v.stock} onChange={e => change(index, { stock: Number(e.target.value) })} /></label>
        <label className="grid gap-1 text-xs sm:col-span-2">Variant image URL (optional)<input className="field" maxLength={4000} value={v.image ?? ""} placeholder="https://…" onChange={e => change(index, { image: e.target.value || null })} /></label>
        <div className="flex items-center gap-3"><img alt="Variant preview" className="size-12 bg-surface object-contain" src={productImage(v.image || product.image)} /><label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold"><Upload className="size-4" />Upload image<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { void uploadImage(index, e.target.files?.[0]); e.target.value = ""; }} /></label></div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={v.active} onCheckedChange={active => change(index, { active })} />Active combination</label>
        {!v.id && <Button type="button" size="sm" variant="ghost" onClick={() => { setConfirmed(false); setRows(prev => prev.filter((_, i) => i !== index)); }}><Trash2 />Remove unsaved combination</Button>}
      </fieldset>)}</div>
      <Button type="button" variant="outline" disabled={busy || rows.length >= 200} onClick={() => { setConfirmed(false); setRows(prev => [...prev, { color_name: null, color_hex: null, storage: null, stock: 0, image: null, active: true }]); }}><Plus />Add actual combination</Button>
      {!allocation.valid && <p className="text-sm text-destructive">{allocation.error}</p>}
    </>}
    {!color && !storage && hasVariants(product) && <p className="text-sm text-muted-foreground">Disabling keeps the current {product.stock} units as product stock. Variant records and inventory history are retained, not deleted.</p>}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-primary" checked={confirmed} disabled={busy || !allocation.valid} onChange={e => setConfirmed(e.target.checked)} />I confirm these are actual combinations and their allocation reconciles to the current {product.stock} units without adding or removing inventory.</label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="button" disabled={busy || !confirmed || !allocation.valid} onClick={() => void save()}>{busy ? "Saving..." : "Save reconciled variants"}</Button></div>
  </DialogContent></Dialog>;
}

export function VariantInventory({ product }: { product: Product }) {
  const { data = [], isError } = useQuery(variantsQuery(product.id));
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidate();
  async function adjust(id: string, stock: number, delta: number) {
    setBusy(true);
    const { error } = await supabase.rpc("adjust_product_inventory", { _product_id: product.id, _variant_id: id, _delta: delta, _expected_stock: stock });
    setBusy(false);
    if (error) toast.error(error.message); else invalidate("product-variants", "products", "admin-products", "admin-inventory");
  }
  return <div className="space-y-2">{isError && <p className="text-destructive">Could not load variants</p>}{data.filter(v => v.active).map(v => <VariantStockRow key={v.id} label={selectionLabel({ color_snapshot: v.color_name, storage_snapshot: v.storage })} stock={v.stock} busy={busy} onAdjust={delta => void adjust(v.id, v.stock, delta)} />)}</div>;
}

function VariantStockRow({ label, stock, busy, onAdjust }: { label: string; stock: number; busy: boolean; onAdjust: (delta: number) => void }) {
  const [qty, setQty] = useState("1"); const n = Number(qty); const valid = Number.isInteger(n) && n > 0 && n <= 1000000;
  return <div className="flex flex-wrap items-center gap-2 text-sm"><span className="min-w-32">{label} · {stock}</span><input aria-label={`Adjustment ${label}`} className="field h-9 w-20" type="number" min={1} step={1} value={qty} onChange={e => setQty(e.target.value)} /><Button type="button" size="sm" variant="outline" disabled={busy || !valid} onClick={() => onAdjust(n)}>+ Stock in</Button><Button type="button" size="sm" variant="outline" disabled={busy || !valid || n > stock} onClick={() => onAdjust(-n)}>− Stock out</Button></div>;
}