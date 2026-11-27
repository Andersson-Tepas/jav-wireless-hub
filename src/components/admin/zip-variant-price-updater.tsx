import { Download, FileArchive } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/variant-options";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/cart";
import { normalizePrice, selectionLabel } from "@/lib/variants";
import {
  buildVariantPriceTemplateZip,
  parseVariantPriceZip,
  VARIANT_PRICE_MANIFEST_FILENAME,
  VARIANT_PRICE_SAMPLE_JSON,
  type ExistingProductForPriceUpdate,
  type ExistingVariantForPriceUpdate,
  type VariantPriceUpdateRow,
} from "@/lib/zip-variant-price-import";
import { useInvalidate } from "./shared";

const statusLabel: Record<VariantPriceUpdateRow["status"], string> = {
  ready: "Ready",
  unchanged: "Unchanged",
  conflict: "Conflict",
  invalid: "Invalid",
  updating: "Updating...",
  updated: "Updated",
  failed: "Failed",
};

const statusTone: Record<VariantPriceUpdateRow["status"], string> = {
  ready: "bg-primary/10 text-primary",
  unchanged: "bg-surface text-muted-foreground",
  conflict: "bg-accent/10 text-accent",
  invalid: "bg-accent/10 text-accent",
  updating: "bg-primary/10 text-primary",
  updated: "bg-success/10 text-success",
  failed: "bg-accent/10 text-accent",
};

async function fetchCatalogPricingSnapshot() {
  const [{ data: products, error: pErr }, { data: variants, error: vErr }] = await Promise.all([
    supabase.from("products").select("id,name,category_id,price,active,color_variants_enabled,storage_variants_enabled"),
    supabase.from("product_variants").select("id,product_id,color_name,color_hex,storage,stock,active,price_override").limit(5000),
  ]);
  if (pErr || vErr) throw new Error("Could not load catalog products and variants.");
  return {
    products: (products ?? []).map((p) => ({ ...p, price: Number(p.price) })) as ExistingProductForPriceUpdate[],
    variants: (variants ?? []).map((v) => ({ ...v, price_override: normalizePrice(v.price_override) })) as ExistingVariantForPriceUpdate[],
  };
}

export function ZipVariantPriceUpdater({
  onBusyChange,
  onClose,
  onUpdated,
}: {
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const invalidate = useInvalidate();
  const [zipName, setZipName] = useState("");
  const [parseError, setParseError] = useState("");
  const [reading, setReading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [rows, setRows] = useState<VariantPriceUpdateRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const busy = reading || updating || downloading;
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);

  const selectable = (r: VariantPriceUpdateRow) => r.status === "ready" || r.status === "failed";
  const selectedRows = rows.filter((r) => r.selected && selectable(r));
  const readyCount = rows.filter((r) => r.status === "ready").length;
  const updatedCount = rows.filter((r) => r.status === "updated").length;
  const unchangedCount = rows.filter((r) => r.status === "unchanged").length;
  const conflictCount = rows.filter((r) => r.status === "conflict").length;
  const invalidCount = rows.filter((r) => r.status === "invalid").length;
  const failedCount = rows.filter((r) => r.status === "failed").length;

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      const { products, variants } = await fetchCatalogPricingSnapshot();
      const bytes = buildVariantPriceTemplateZip(products, variants);
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const blob = new Blob([copy], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "jav-variant-prices-template.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate template.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setParseError("");
    setRows([]);
    setConfirmed(false);
    setZipName(file.name);
    if (!/\.zip$/i.test(file.name) && file.type && !file.type.includes("zip")) {
      setParseError("Please choose a .zip file.");
      return;
    }
    setReading(true);
    try {
      const [snapshot, buf] = await Promise.all([fetchCatalogPricingSnapshot(), file.arrayBuffer()]);
      const res = parseVariantPriceZip(new Uint8Array(buf), snapshot.products, snapshot.variants);
      if ("error" in res) setParseError(res.error);
      else setRows(res.rows);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not read ZIP file.");
    } finally {
      setReading(false);
    }
  }

  function toggleRow(index: number, checked: boolean) {
    setConfirmed(false);
    setRows((prev) => prev.map((r) => (r.index === index && selectable(r) ? { ...r, selected: checked } : r)));
  }

  function toggleAll(checked: boolean) {
    setConfirmed(false);
    setRows((prev) => prev.map((r) => (selectable(r) ? { ...r, selected: checked } : r)));
  }

  async function runUpdate() {
    const targets = rows.filter((r) => r.selected && selectable(r));
    if (!targets.length || !confirmed) return;
    setUpdating(true);
    setProgress({ done: 0, total: targets.length });

    let freshProducts: Map<string, ExistingProductForPriceUpdate>;
    let freshVariants: Map<string, ExistingVariantForPriceUpdate>;
    try {
      const snap = await fetchCatalogPricingSnapshot();
      freshProducts = new Map(snap.products.map((p) => [p.id.toLowerCase(), p]));
      freshVariants = new Map(snap.variants.map((v) => [v.id.toLowerCase(), v]));
    } catch {
      setUpdating(false);
      toast.error("Could not refresh current catalog prices before writing.");
      return;
    }

    const byProduct = new Map<string, VariantPriceUpdateRow[]>();
    for (const row of targets) {
      const pid = row.entry.product_id.toLowerCase();
      const list = byProduct.get(pid) ?? [];
      list.push(row);
      byProduct.set(pid, list);
    }

    let okCount = 0;
    let failCount = 0;
    let doneCount = 0;

    for (const [pid, group] of byProduct.entries()) {
      const idxSet = new Set(group.map((g) => g.index));
      setRows((prev) => prev.map((r) => (idxSet.has(r.index) ? { ...r, status: "updating" } : r)));

      const prod = freshProducts.get(pid);
      const expectedBase = group[0]?.entry.expected_base_price;
      if (!prod || !prod.active || expectedBase === null || expectedBase === undefined || normalizePrice(prod.price) !== expectedBase) {
        failCount += group.length;
        doneCount += group.length;
        setRows((prev) => prev.map((r) => (idxSet.has(r.index) ? { ...r, status: "failed", updateError: "Product inactive or base price changed since preview.", selected: true } : r)));
        setProgress({ done: doneCount, total: targets.length });
        continue;
      }

      const missingOrStale = group.find((g) => {
        const v = freshVariants.get(g.entry.variant_id.toLowerCase());
        return !v || !v.active || v.product_id.toLowerCase() !== pid || normalizePrice(v.price_override) !== g.entry.expected_price_override;
      });
      if (missingOrStale) {
        failCount += group.length;
        doneCount += group.length;
        setRows((prev) => prev.map((r) => (idxSet.has(r.index) ? { ...r, status: "failed", updateError: "One or more variant prices changed since preview. Reload ZIP.", selected: true } : r)));
        setProgress({ done: doneCount, total: targets.length });
        continue;
      }

      const updates = group.map((g) => ({
        variant_id: g.entry.variant_id,
        expected_price_override: g.entry.expected_price_override,
        price_override: g.entry.price_override,
      }));

      const { error } = await supabase.rpc("update_product_variant_prices", {
        _product_id: prod.id,
        _expected_base_price: expectedBase,
        _updates: updates,
      });

      doneCount += group.length;
      if (error) {
        failCount += group.length;
        setRows((prev) => prev.map((r) => (idxSet.has(r.index) ? { ...r, status: "failed", updateError: error.message, selected: true } : r)));
      } else {
        okCount += group.length;
        setRows((prev) => prev.map((r) => (idxSet.has(r.index) ? { ...r, status: "updated", selected: false } : r)));
      }
      setProgress({ done: doneCount, total: targets.length });
    }

    setUpdating(false);
    setConfirmed(false);
    if (okCount > 0) {
      invalidate("products", "admin-products", "product-variants");
      onUpdated();
    }
    toast.success(`Variant prices finished: ${okCount} updated, ${failCount} failed.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
        <div className="space-y-0.5">
          <p className="font-semibold">
            Select a ZIP archive with <code className="text-xs">{VARIANT_PRICE_MANIFEST_FILENAME}</code> (v1)
          </p>
          <p className="text-xs text-muted-foreground">
            Updates only <code className="text-[11px]">price_override</code> on matched active variants (null = inherit product base price). Never changes stock, images, products, or categories.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setShowSample((s) => !s)}>
            {showSample ? "Hide format" : "JSON format"}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void handleDownloadTemplate()}>
            <Download className="size-4" /> {downloading ? "Building..." : "Download template"}
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-semibold">
            <FileArchive className="size-4" /> {zipName ? "Choose another ZIP" : "Choose ZIP"}
            <input type="file" accept=".zip,application/zip" disabled={busy} className="sr-only" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      </div>

      {showSample && (
        <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-surface p-3 text-xs">{VARIANT_PRICE_SAMPLE_JSON}</pre>
      )}

      {reading && <p className="text-sm text-muted-foreground">Reading and validating {zipName}...</p>}
      {parseError && <p className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent">{parseError}</p>}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap gap-3 text-muted-foreground">
              <span><strong>{rows.length}</strong> in ZIP</span>
              <span><strong>{readyCount}</strong> ready</span>
              <span><strong>{selectedRows.length}</strong> selected</span>
              {updatedCount > 0 && <span className="text-success"><strong>{updatedCount}</strong> updated</span>}
              {unchangedCount > 0 && <span><strong>{unchangedCount}</strong> unchanged</span>}
              {conflictCount > 0 && <span className="text-accent"><strong>{conflictCount}</strong> conflict</span>}
              {invalidCount > 0 && <span className="text-accent"><strong>{invalidCount}</strong> invalid</span>}
              {failedCount > 0 && <span className="text-accent"><strong>{failedCount}</strong> failed</span>}
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={updating} onClick={() => toggleAll(true)}>Select all ready</Button>
              <Button type="button" size="sm" variant="outline" disabled={updating} onClick={() => toggleAll(false)}>Deselect all</Button>
            </div>
          </div>

          {updating && <p className="text-sm font-semibold text-primary">Updating {progress.done} of {progress.total}...</p>}

          <div className="max-h-[44vh] overflow-auto rounded-xl border border-border">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="sticky top-0 bg-surface text-left uppercase text-muted-foreground">
                <tr>
                  <th className="p-2.5"><span className="sr-only">Select</span></th>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5">Variant</th>
                  <th className="p-2.5">Base price</th>
                  <th className="p-2.5">Current effective</th>
                  <th className="p-2.5">Proposed price</th>
                  <th className="p-2.5">Note</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const vLabel = r.matchedVariant
                    ? selectionLabel({ color_snapshot: r.matchedVariant.color_name, storage_snapshot: r.matchedVariant.storage })
                    : r.entry.variant_id.slice(0, 8) || "—";
                  return (
                    <tr key={r.index} className={r.status === "invalid" || r.status === "conflict" || r.status === "unchanged" ? "opacity-65" : ""}>
                      <td className="p-2.5">
                        <input type="checkbox" aria-label={`Select ${r.matchedProduct?.name ?? "row"} ${vLabel}`} className="size-4 accent-primary" disabled={updating || !selectable(r)} checked={r.selected} onChange={(e) => toggleRow(r.index, e.target.checked)} />
                      </td>
                      <td className="p-2.5 font-semibold">{(r.matchedProduct?.name ?? r.entry.product_id.slice(0, 8)) || "—"}</td>
                      <td className="p-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          {r.matchedVariant?.color_name && <ColorSwatch name={r.matchedVariant.color_name} hex={r.matchedVariant.color_hex} />}
                          <span>{vLabel}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap p-2.5">{r.matchedProduct ? money(r.matchedProduct.price) : "—"}</td>
                      <td className="whitespace-nowrap p-2.5">
                        {r.currentEffectivePrice !== null ? (
                          <>
                            {money(r.currentEffectivePrice)}{" "}
                            <span className="text-[11px] text-muted-foreground">({r.matchedVariant?.price_override !== null ? "custom" : "base"})</span>
                          </>
                        ) : "—"}
                      </td>
                      <td className="whitespace-nowrap p-2.5 font-semibold text-primary">
                        {r.proposedEffectivePrice !== null ? (
                          <>
                            {money(r.proposedEffectivePrice)}{" "}
                            <span className="text-[11px] font-normal text-muted-foreground">({r.entry.price_override !== null ? "override" : "inherit base"})</span>
                          </>
                        ) : "—"}
                      </td>
                      <td className="max-w-[140px] truncate p-2.5 text-muted-foreground" title={r.entry.note}>{r.entry.note || "—"}</td>
                      <td className="p-2.5">
                        <span className={`inline-block rounded-full px-2 py-0.5 font-semibold ${statusTone[r.status]}`}>{statusLabel[r.status]}</span>
                        {r.errors.length > 0 && <p className="mt-1 text-[11px] text-accent">{r.errors.join("; ")}</p>}
                        {r.updateError && <p className="mt-1 text-[11px] text-accent">{r.updateError}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={confirmed} disabled={updating || selectedRows.length === 0} onChange={(e) => setConfirmed(e.target.checked)} />
            I confirm these variant price updates ({selectedRows.length} selected). Only variant price overrides will be updated; stock, images, and base product fields stay unchanged.
          </label>
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button>
        <Button type="button" disabled={busy || selectedRows.length === 0 || !confirmed} onClick={() => void runUpdate()}>
          {updating
            ? `Updating (${progress.done}/${progress.total})...`
            : failedCount > 0 && selectedRows.every((r) => r.status === "failed")
              ? `Retry failed (${selectedRows.length})`
              : `Update selected prices (${selectedRows.length})`}
        </Button>
      </div>
    </div>
  );
}