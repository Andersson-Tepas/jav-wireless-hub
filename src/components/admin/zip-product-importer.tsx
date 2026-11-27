import { useServerFn } from "@tanstack/react-start";
import { FileArchive } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { uploadProductImage } from "@/lib/admin.functions";
import { money } from "@/lib/cart";
import {
  buildProductInsertPayload,
  bytesToBase64,
  parseProductZip,
  productMatchKey,
  type ImportRow,
} from "@/lib/zip-product-import";
import { ZipImageUpdater } from "./zip-image-updater";
import { ZipVariantUpdater } from "./zip-variant-updater";
import { ZipVariantPriceUpdater } from "./zip-variant-price-updater";

type ImporterMode = "new" | "update_images" | "update_variants" | "update_variant_prices";

type CategoryOption = { id: string; name: string };

const statusLabel: Record<ImportRow["status"], string> = {
  ready: "Ready",
  duplicate_db: "Duplicate (in catalog)",
  duplicate_zip: "Duplicate (in ZIP)",
  invalid: "Invalid",
  importing: "Importing...",
  imported: "Imported",
  skipped: "Skipped (exists)",
  failed: "Failed",
};

const statusTone: Record<ImportRow["status"], string> = {
  ready: "bg-primary/10 text-primary",
  duplicate_db: "bg-surface text-muted-foreground",
  duplicate_zip: "bg-surface text-muted-foreground",
  invalid: "bg-accent/10 text-accent",
  importing: "bg-primary/10 text-primary",
  imported: "bg-success/10 text-success",
  skipped: "bg-surface text-muted-foreground",
  failed: "bg-accent/10 text-accent",
};

export function ZipProductImporter({
  cats,
  onClose,
  onImported,
}: {
  cats: CategoryOption[];
  onClose: () => void;
  onImported: () => void;
}) {
  const upload = useServerFn(uploadProductImage);
  const [mode, setMode] = useState<ImporterMode>("new");
  const [imageUpdaterBusy, setImageUpdaterBusy] = useState(false);
  const [variantUpdaterBusy, setVariantUpdaterBusy] = useState(false);
  const [priceUpdaterBusy, setPriceUpdaterBusy] = useState(false);
  const [zipName, setZipName] = useState("");
  const [parseError, setParseError] = useState("");
  const [reading, setReading] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const busy = reading || importing || imageUpdaterBusy || variantUpdaterBusy || priceUpdaterBusy;

  function switchMode(next: ImporterMode) {
    if (busy || next === mode) return;
    setMode(next);
    setZipName("");
    setParseError("");
    setRows([]);
  }

  const catNames = new Map(cats.map((c) => [c.id, c.name]));
  const selectable = (r: ImportRow) => r.status === "ready" || r.status === "failed";
  const selectedRows = rows.filter((r) => r.selected && selectable(r));
  const importedCount = rows.filter((r) => r.status === "imported").length;
  const skippedCount = rows.filter((r) => r.status === "skipped" || r.status === "duplicate_db" || r.status === "duplicate_zip").length;
  const failedCount = rows.filter((r) => r.status === "failed").length;
  const invalidCount = rows.filter((r) => r.status === "invalid").length;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setParseError("");
    setRows([]);
    setZipName(file.name);
    if (!/\.zip$/i.test(file.name) && file.type && !file.type.includes("zip")) {
      setParseError("Please choose a .zip file.");
      return;
    }
    setReading(true);
    try {
      const [{ data: existing, error }, buf] = await Promise.all([
        supabase.from("products").select("name, category_id"),
        file.arrayBuffer(),
      ]);
      if (error) {
        setParseError("Could not read existing products for duplicate checking.");
        return;
      }
      const res = parseProductZip(new Uint8Array(buf), new Set(cats.map((c) => c.id)), existing ?? []);
      if ("error" in res) setParseError(res.error);
      else setRows(res.rows);
    } finally {
      setReading(false);
    }
  }

  function toggleRow(index: number, checked: boolean) {
    setRows((prev) => prev.map((r) => (r.index === index && selectable(r) ? { ...r, selected: checked } : r)));
  }

  function toggleAll(checked: boolean) {
    setRows((prev) => prev.map((r) => (selectable(r) ? { ...r, selected: checked } : r)));
  }

  async function runImport() {
    const targets = rows.filter((r) => r.selected && selectable(r));
    if (!targets.length) return;
    setImporting(true);
    setProgress({ done: 0, total: targets.length });

    const { data: latest, error: fetchErr } = await supabase.from("products").select("name, category_id");
    if (fetchErr) {
      setImporting(false);
      toast.error("Could not refresh existing products before import.");
      return;
    }
    const existingKeys = new Set((latest ?? []).map((p) => productMatchKey(p.name, p.category_id)));
    let ok = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
      const row = targets[i]!;
      if (existingKeys.has(row.key)) {
        skipped += 1;
        setRows((prev) => prev.map((r) => { if (r.index !== row.index) return r; const { importError: _, ...rest } = r; return { ...rest, status: "skipped", selected: false }; }));
        setProgress({ done: i + 1, total: targets.length });
        continue;
      }

      setRows((prev) => prev.map((r) => { if (r.index !== row.index) return r; const { importError: _, ...rest } = r; return { ...rest, status: "importing" }; }));
      try {
        if (!row.imageBytes || !row.imageMime) throw new Error("Missing validated image bytes.");
        const filename = (row.product.image_file.split("/").pop() ?? "image.jpg").slice(0, 120);
        const uploaded = await upload({
          data: { filename, contentType: row.imageMime, base64: bytesToBase64(row.imageBytes) },
        });
        const payload = buildProductInsertPayload(row.product, uploaded.url);
        const { error: insertErr } = await supabase.from("products").insert(payload);
        if (insertErr) throw new Error(insertErr.message || "Could not insert product.");
        existingKeys.add(row.key);
        ok += 1;
        setRows((prev) => prev.map((r) => { if (r.index !== row.index) return r; const { importError: _, ...rest } = r; return { ...rest, status: "imported", selected: false }; }));
      } catch (err) {
        failed += 1;
        const msg = err instanceof Error ? err.message : "Import failed";
        setRows((prev) => prev.map((r) => (r.index === row.index ? { ...r, status: "failed", importError: msg, selected: true } : r)));
      }
      setProgress({ done: i + 1, total: targets.length });
    }

    setImporting(false);
    if (ok > 0) onImported();
    toast.success(`Import finished: ${ok} imported, ${skipped} skipped, ${failed} failed.`);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader><DialogTitle>Import products (ZIP)</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2 border-b border-border pb-3" role="tablist" aria-label="ZIP importer mode">
          <Button type="button" size="sm" role="tab" aria-selected={mode === "new"} variant={mode === "new" ? "default" : "outline"} disabled={busy} onClick={() => switchMode("new")}>
            Import new products
          </Button>
          <Button type="button" size="sm" role="tab" aria-selected={mode === "update_images"} variant={mode === "update_images" ? "default" : "outline"} disabled={busy} onClick={() => switchMode("update_images")}>
            Update existing images
          </Button>
          <Button type="button" size="sm" role="tab" aria-selected={mode === "update_variants"} variant={mode === "update_variants" ? "default" : "outline"} disabled={busy} onClick={() => switchMode("update_variants")}>
            Update existing variants
          </Button>
          <Button type="button" size="sm" role="tab" aria-selected={mode === "update_variant_prices"} variant={mode === "update_variant_prices" ? "default" : "outline"} disabled={busy} onClick={() => switchMode("update_variant_prices")}>
            Update variant prices
          </Button>
        </div>
        {mode === "update_images" ? (
          <ZipImageUpdater cats={cats} onBusyChange={setImageUpdaterBusy} onClose={onClose} onUpdated={onImported} />
        ) : mode === "update_variants" ? (
          <ZipVariantUpdater cats={cats} onBusyChange={setVariantUpdaterBusy} onClose={onClose} onUpdated={onImported} />
        ) : mode === "update_variant_prices" ? (
          <ZipVariantPriceUpdater onBusyChange={setPriceUpdaterBusy} onClose={onClose} onUpdated={onImported} />
        ) : (
          <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
            <div className="space-y-0.5">
              <p className="font-semibold">Select a ZIP archive with <code className="text-xs">products.json</code> (v1) and product images</p>
              <p className="text-xs text-muted-foreground">New products are imported inactive (draft) with provisional price and stock for review. Existing products are never modified.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-semibold">
              <FileArchive className="size-4" /> {zipName ? "Choose another ZIP" : "Choose ZIP"}
              <input type="file" accept=".zip,application/zip" disabled={reading || importing} className="sr-only" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>

          {reading && <p className="text-sm text-muted-foreground">Reading and validating {zipName}...</p>}
          {parseError && <p className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent">{parseError}</p>}

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap gap-3 text-muted-foreground">
                  <span><strong>{rows.length}</strong> in ZIP</span>
                  <span><strong>{selectedRows.length}</strong> selected</span>
                  {importedCount > 0 && <span className="text-success"><strong>{importedCount}</strong> imported</span>}
                  {skippedCount > 0 && <span><strong>{skippedCount}</strong> skipped/duplicate</span>}
                  {invalidCount > 0 && <span className="text-accent"><strong>{invalidCount}</strong> invalid</span>}
                  {failedCount > 0 && <span className="text-accent"><strong>{failedCount}</strong> failed</span>}
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={importing} onClick={() => toggleAll(true)}>Select all ready</Button>
                  <Button type="button" size="sm" variant="outline" disabled={importing} onClick={() => toggleAll(false)}>Deselect all</Button>
                </div>
              </div>

              {importing && (
                <p className="text-sm font-semibold text-primary">Importing {progress.done} of {progress.total}...</p>
              )}

              <div className="max-h-[48vh] overflow-auto rounded-xl border border-border">
                <table className="w-full min-w-[820px] text-xs">
                  <thead className="sticky top-0 bg-surface text-left uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2.5"><span className="sr-only">Select</span></th>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Image file</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Brand</th>
                      <th className="p-2.5">Provisional</th>
                      <th className="p-2.5">Source</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <tr key={r.index} className={r.status === "invalid" || r.status === "duplicate_db" || r.status === "duplicate_zip" ? "opacity-65" : ""}>
                        <td className="p-2.5"><input type="checkbox" aria-label={`Select ${r.product.name || `row ${r.index + 1}`}`} className="size-4 accent-primary" disabled={importing || !selectable(r)} checked={r.selected} onChange={(e) => toggleRow(r.index, e.target.checked)} /></td>
                        <td className="p-2.5 font-semibold">{r.product.name || "—"}</td>
                        <td className="p-2.5 font-mono text-[11px] text-muted-foreground">{r.product.image_file || "—"}</td>
                        <td className="p-2.5">{catNames.get(r.product.category_id) ?? r.product.category_id}</td>
                        <td className="p-2.5">{r.product.brand || "—"}</td>
                        <td className="whitespace-nowrap p-2.5">{money(r.product.price)} · {r.product.stock}</td>
                        <td className="max-w-[160px] truncate p-2.5 text-muted-foreground" title={r.product.source}>{r.product.source || "—"}</td>
                        <td className="p-2.5">
                          <span className={`inline-block rounded-full px-2 py-0.5 font-semibold ${statusTone[r.status]}`}>{statusLabel[r.status]}</span>
                          {r.errors.length > 0 && <p className="mt-1 text-[11px] text-accent">{r.errors.join("; ")}</p>}
                          {r.importError && <p className="mt-1 text-[11px] text-accent">{r.importError}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={importing} onClick={onClose}>Close</Button>
            <Button type="button" disabled={importing || selectedRows.length === 0} onClick={() => void runImport()}>
              {importing ? `Importing (${progress.done}/${progress.total})...` : failedCount > 0 && selectedRows.every((r) => r.status === "failed") ? `Retry failed (${selectedRows.length})` : `Import selected (${selectedRows.length})`}
            </Button>
          </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}