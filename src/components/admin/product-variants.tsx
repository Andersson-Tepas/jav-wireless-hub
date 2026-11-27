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
import { money } from "@/lib/cart";
import type { Product } from "@/lib/catalog";
import { productImage } from "@/lib/site-data";
import { variantsQuery } from "@/lib/variant-queries";
import {
  effectiveVariantPrice,
  hasVariants,
  normalizeOption,
  normalizePrice,
  parsePriceOverrideInput,
  selectionLabel,
  storagePresets,
  validateAllocation,
  variantSuggestion,
  type Variant,
  type VariantDraft,
} from "@/lib/variants";
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

function VariantEditorForm({ product, initial, onClose, onSaved }: { product: Product; initial: Variant[]; onClose: () => void; onSaved: () => void }) {
  const [color, setColor] = useState(product.color_variants_enabled);
  const [storage, setStorage] = useState(product.storage_variants_enabled);
  const [rows, setRows] = useState<VariantDraft[]>(() =>
    initial.map((v) => ({
      id: v.id,
      color_name: v.color_name,
      color_hex: v.color_hex,
      storage: v.storage,
      stock: v.stock,
      image: v.image,
      active: v.active,
      price_override: normalizePrice(v.price_override),
    })),
  );
  const [priceInputs, setPriceInputs] = useState<string[]>(() =>
    initial.map((v) => {
      const p = normalizePrice(v.price_override);
      return p !== null ? p.toFixed(2) : "";
    }),
  );
  const [bulkStorage, setBulkStorage] = useState("");
  const [bulkPriceInput, setBulkPriceInput] = useState("");
  const [bulkPreview, setBulkPreview] = useState<{ storage: string; value: number | null; count: number } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = useServerFn(uploadProductImage);
  const invalidate = useInvalidate();
  const priceErrors = priceInputs.map((raw) => {
    const res = parsePriceOverrideInput(raw);
    return res.ok ? "" : res.error;
  });
  const hasPriceErrors = priceErrors.some(Boolean);
  const allocation = validateAllocation(rows, color, storage, product.stock);
  const change = (index: number, patch: Partial<VariantDraft>) => { setConfirmed(false); setRows(prev => prev.map((v, i) => i === index ? { ...v, ...patch } : v)); };
  const changePrice = (index: number, raw: string) => {
    setConfirmed(false);
    setPriceInputs((prev) => prev.map((val, i) => (i === index ? raw : val)));
    const parsed = parsePriceOverrideInput(raw);
    if (parsed.ok) {
      setRows((prev) => prev.map((v, i) => (i === index ? { ...v, price_override: parsed.value } : v)));
    }
  };
  const storageChoices = [...new Map(rows.filter((r) => r.storage).map((r) => [normalizeOption(r.storage), r.storage!])).values()];
  const initialById = new Map(initial.map((v) => [v.id, v]));
  const priceOnlyChanges = rows
    .filter((r): r is VariantDraft & { id: string } => !!r.id && initialById.has(r.id))
    .filter((r) => normalizePrice(r.price_override) !== normalizePrice(initialById.get(r.id)!.price_override));
  const structureChanged =
    color !== product.color_variants_enabled ||
    storage !== product.storage_variants_enabled ||
    rows.length !== initial.length ||
    rows.some((r) => {
      if (!r.id) return true;
      const orig = initialById.get(r.id);
      if (!orig) return true;
      return r.stock !== orig.stock || r.active !== orig.active || (r.image ?? null) !== (orig.image ?? null) || (r.color_hex ?? null) !== (orig.color_hex ?? null);
    });

  function previewBulkStoragePrice() {
    setError("");
    if (!bulkStorage) { setError("Select a storage option first."); return; }
    const parsed = parsePriceOverrideInput(bulkPriceInput);
    if (!parsed.ok) { setError(parsed.error); return; }
    const count = rows.filter((r) => normalizeOption(r.storage) === normalizeOption(bulkStorage)).length;
    if (count === 0) { setError("No combinations match the selected storage."); return; }
    setBulkPreview({ storage: bulkStorage, value: parsed.value, count });
  }

  function applyBulkStoragePrice() {
    if (!bulkPreview) return;
    const target = normalizeOption(bulkPreview.storage);
    const nextText = bulkPreview.value !== null ? bulkPreview.value.toFixed(2) : "";
    setConfirmed(false);
    setRows((prev) => prev.map((r) => (normalizeOption(r.storage) === target ? { ...r, price_override: bulkPreview.value } : r)));
    setPriceInputs((prev) => prev.map((txt, idx) => (normalizeOption(rows[idx]?.storage) === target ? nextText : txt)));
    setBulkPreview(null);
  }

  async function savePricesOnly() {
    if (hasPriceErrors || priceOnlyChanges.length === 0) return;
    setBusy(true); setError("");
    const updates = priceOnlyChanges.map((r) => ({
      variant_id: r.id,
      expected_price_override: normalizePrice(initialById.get(r.id)!.price_override),
      price_override: normalizePrice(r.price_override),
    }));
    const { error: err } = await supabase.rpc("update_product_variant_prices", {
      _product_id: product.id,
      _expected_base_price: normalizePrice(product.price) ?? 0,
      _updates: updates,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    invalidate("products", "admin-products", "product-variants");
    toast.success(`Updated ${updates.length} variant price${updates.length === 1 ? "" : "s"}.`);
    onClose(); onSaved();
  }
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
    if (!confirmed || !allocation.valid || hasPriceErrors) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.rpc("configure_product_variants", { _product_id: product.id, _color: color, _storage: storage, _variants: rows, _expected_stock: product.stock });
    setBusy(false);
    if (err) { setError(err.message); return; }
    invalidate("products", "admin-products", "product-variants", "admin-inventory");
    toast.success("Variant configuration saved; inventory total preserved."); onClose(); onSaved();
  }
  return <Dialog open onOpenChange={o => !o && !busy && onClose()}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Variants — {product.name}</DialogTitle></DialogHeader>
    <div className="flex flex-wrap gap-6"><label className="flex items-center gap-2 text-sm"><Switch checked={color} onCheckedChange={v => { setColor(v); setConfirmed(false); }} disabled={busy} />Enable color / finish</label><label className="flex items-center gap-2 text-sm"><Switch checked={storage} onCheckedChange={v => { setStorage(v); setConfirmed(false); }} disabled={busy} />Enable storage</label></div>
    <p className="text-sm">Base price: <strong>{money(Number(product.price))}</strong> · Current product stock: <strong>{product.stock}</strong> · Active combination total: <strong>{allocation.total}</strong></p>
    {storage && storageChoices.length > 0 && (
      <div className="space-y-2 rounded-lg border border-border bg-surface p-3 text-xs">
        <p className="font-semibold text-foreground">Set price for all colors of a storage tier</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1">
            Storage
            <select className="field h-9 min-w-32" value={bulkStorage} onChange={(e) => { setBulkStorage(e.target.value); setBulkPreview(null); }} disabled={busy}>
              <option value="">Choose storage…</option>
              {storageChoices.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            USD price (blank = base {money(Number(product.price))})
            <input className="field h-9 w-40" type="text" inputMode="decimal" placeholder="e.g. 549.99" value={bulkPriceInput} onChange={(e) => { setBulkPriceInput(e.target.value); setBulkPreview(null); }} disabled={busy} />
          </label>
          <Button type="button" size="sm" variant="outline" disabled={busy || !bulkStorage} onClick={previewBulkStoragePrice}>Preview</Button>
        </div>
        {bulkPreview && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-background p-2.5">
            <span>
              Apply <strong>{bulkPreview.value !== null ? money(bulkPreview.value) : `inherit base (${money(Number(product.price))})`}</strong> to <strong>{bulkPreview.count}</strong> combination{bulkPreview.count === 1 ? "" : "s"} with storage <strong>{bulkPreview.storage}</strong>? (You can still adjust individual rows before saving.)
            </span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setBulkPreview(null)}>Cancel</Button>
              <Button type="button" size="sm" onClick={applyBulkStoragePrice}>Apply to rows</Button>
            </div>
          </div>
        )}
      </div>
    )}
    {(color || storage) && <><datalist id="variant-colors">{colorPresets.map(v => <option key={v} value={v} />)}</datalist><datalist id="variant-storage">{storagePresets.map(v => <option key={v} value={v} />)}</datalist>
      <div className="space-y-4">{rows.map((v, index) => <fieldset key={v.id ?? index} disabled={busy} className="grid gap-3 border-b border-border pb-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Combination {index + 1}</legend>
        {color && !v.id && <div className="flex flex-wrap gap-1 sm:col-span-2">{colorPresets.map(name => <Button key={name} type="button" variant="ghost" size="icon" title={name} aria-label={`Use ${name}`} onClick={() => change(index, { color_name: name, color_hex: null })}><ColorSwatch name={name} /></Button>)}</div>}
        {color && <label className="grid gap-1 text-xs">Color / branded finish name<div className="flex items-center gap-2"><ColorSwatch name={v.color_name ?? ""} hex={v.color_hex} /><input className="field" list="variant-colors" maxLength={80} disabled={!!v.id} value={v.color_name ?? ""} onChange={e => change(index, { color_name: e.target.value || null })} /></div></label>}
        {color && <label className="grid gap-1 text-xs">Custom hex (optional)<input className="field" placeholder="#RRGGBB" maxLength={7} value={v.color_hex ?? ""} onChange={e => change(index, { color_hex: e.target.value || null })} /></label>}
        {storage && <label className="grid gap-1 text-xs">Storage (preset or custom)<input className="field" list="variant-storage" maxLength={80} disabled={!!v.id} value={v.storage ?? ""} onChange={e => change(index, { storage: e.target.value || null })} /></label>}
        <label className="grid gap-1 text-xs">Stock<input className="field" type="number" min={0} max={1000000} step={1} value={v.stock} onChange={e => change(index, { stock: Number(e.target.value) })} /></label>
        <label className="grid gap-1 text-xs">
          <span>Price override USD (blank = inherit base {money(Number(product.price))})</span>
          <input className="field" type="text" inputMode="decimal" placeholder={`Base: ${Number(product.price).toFixed(2)}`} value={priceInputs[index] ?? ""} onChange={e => changePrice(index, e.target.value)} />
          <span className="text-[11px] text-muted-foreground">
            Effective: <strong className="text-foreground">{money(effectiveVariantPrice(product.price, v))}</strong> ({v.price_override != null ? "custom override" : "inherited base"})
          </span>
          {priceErrors[index] && <span className="text-[11px] text-destructive">{priceErrors[index]}</span>}
        </label>
        <label className="grid gap-1 text-xs sm:col-span-2">Variant image URL (optional)<input className="field" maxLength={4000} value={v.image ?? ""} placeholder="https://…" onChange={e => change(index, { image: e.target.value || null })} /></label>
        <div className="flex items-center gap-3"><img alt="Variant preview" className="size-12 bg-surface object-contain" src={productImage(v.image || product.image)} /><label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold"><Upload className="size-4" />Upload image<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { void uploadImage(index, e.target.files?.[0]); e.target.value = ""; }} /></label></div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={v.active} onCheckedChange={active => change(index, { active })} />Active combination</label>
        {!v.id && <Button type="button" size="sm" variant="ghost" onClick={() => { setConfirmed(false); setRows(prev => prev.filter((_, i) => i !== index)); setPriceInputs(prev => prev.filter((_, i) => i !== index)); }}><Trash2 />Remove unsaved combination</Button>}
      </fieldset>)}</div>
      <Button type="button" variant="outline" disabled={busy || rows.length >= 200} onClick={() => { setConfirmed(false); setRows(prev => [...prev, { color_name: null, color_hex: null, storage: null, stock: 0, image: null, active: true, price_override: null }]); setPriceInputs(prev => [...prev, ""]); }}><Plus />Add actual combination</Button>
      {!allocation.valid && <p className="text-sm text-destructive">{allocation.error}</p>}
    </>}
    {!color && !storage && hasVariants(product) && <p className="text-sm text-muted-foreground">Disabling keeps the current {product.stock} units as product stock. Variant records and inventory history are retained, not deleted.</p>}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-primary" checked={confirmed} disabled={busy || !allocation.valid} onChange={e => setConfirmed(e.target.checked)} />I confirm these are actual combinations and their allocation reconciles to the current {product.stock} units without adding or removing inventory.</label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
      {!structureChanged && priceOnlyChanges.length > 0 && (
        <Button type="button" variant="outline" disabled={busy || hasPriceErrors} onClick={() => void savePricesOnly()}>
          {busy ? "Saving..." : `Save prices only (${priceOnlyChanges.length})`}
        </Button>
      )}
      <Button type="button" disabled={busy || !confirmed || !allocation.valid || hasPriceErrors} onClick={() => void save()}>{busy ? "Saving..." : "Save reconciled variants"}</Button>
    </div>
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