import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, FileArchive } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { uploadProductImage } from "@/lib/admin.functions";
import { productImage } from "@/lib/site-data";
import {
  buildImageUpdatePayload,
  bytesToBase64,
  parseImageUpdateZip,
  resolveUniqueTargetProduct,
  type ImageUpdateRow,
} from "@/lib/zip-product-import";

type CategoryOption = { id: string; name: string };

const statusLabel: Record<ImageUpdateRow["status"], string> = {
  ready: "Ready",
  missing: "Missing in catalog",
  ambiguous: "Ambiguous match",
  duplicate_zip: "Duplicate (in ZIP)",
  invalid: "Invalid",
  updating: "Updating...",
  updated: "Updated",
  skipped: "Skipped",
  failed: "Failed",
};

const statusTone: Record<ImageUpdateRow["status"], string> = {
  ready: "bg-primary/10 text-primary",
  missing: "bg-surface text-muted-foreground",
  ambiguous: "bg-accent/10 text-accent",
  duplicate_zip: "bg-surface text-muted-foreground",
  invalid: "bg-accent/10 text-accent",
  updating: "bg-primary/10 text-primary",
  updated: "bg-success/10 text-success",
  skipped: "bg-surface text-muted-foreground",
  failed: "bg-accent/10 text-accent",
};

export function ZipImageUpdater({
  cats,
  onBusyChange,
  onClose,
  onUpdated,
}: {
  cats: CategoryOption[];
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const upload = useServerFn(uploadProductImage);
  const [zipName, setZipName] = useState("");
  const [parseError, setParseError] = useState("");
  const [reading, setReading] = useState(false);
  const [rows, setRows] = useState<ImageUpdateRow[]>([]);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const previewUrlsRef = useRef<string[]>([]);

  function revokePreviews() {
    for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
    previewUrlsRef.current = [];
  }

  useEffect(() => () => revokePreviews(), []);
  useEffect(() => { onBusyChange(reading || updating); }, [reading, updating, onBusyChange]);

  const catNames = new Map(cats.map((c) => [c.id, c.name]));
  const selectable = (r: ImageUpdateRow) => r.status === "ready" || r.status === "failed";
  const selectedRows = rows.filter((r) => r.selected && selectable(r));
  const updatedCount = rows.filter((r) => r.status === "updated").length;
  const skippedCount = rows.filter((r) => ["skipped", "missing", "ambiguous", "duplicate_zip"].includes(r.status)).length;
  const failedCount = rows.filter((r) => r.status === "failed").length;
  const invalidCount = rows.filter((r) => r.status === "invalid").length;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    revokePreviews();
    setPreviews({});
    setParseError("");
    setRows([]);
    setConfirming(false);
    setZipName(file.name);
    if (!/\.zip$/i.test(file.name) && file.type && !file.type.includes("zip")) {
      setParseError("Please choose a .zip file.");
      return;
    }
    setReading(true);
    try {
      const [{ data: existing, error }, buf] = await Promise.all([
        supabase.from("products").select("id, name, category_id, image, active"),
        file.arrayBuffer(),
      ]);
      if (error) {
        setParseError("Could not read existing products for matching.");
        return;
      }
      const res = parseImageUpdateZip(new Uint8Array(buf), new Set(cats.map((c) => c.id)), existing ?? []);
      if ("error" in res) {
        setParseError(res.error);
        return;
      }
      const nextPreviews: Record<number, string> = {};
      for (const r of res.rows) {
        if (r.imageBytes && r.imageMime) {
          const url = URL.createObjectURL(new Blob([r.imageBytes.slice()], { type: r.imageMime }));
          nextPreviews[r.index] = url;
          previewUrlsRef.current.push(url);
        }
      }
      setPreviews(nextPreviews);
      setRows(res.rows);
    } finally {
      setReading(false);
    }
  }

  function toggleRow(index: number, checked: boolean) {
    setConfirming(false);
    setRows((prev) => prev.map((r) => (r.index === index && selectable(r) ? { ...r, selected: checked } : r)));
  }

  function toggleAll(checked: boolean) {
    setConfirming(false);
    setRows((prev) => prev.map((r) => (selectable(r) ? { ...r, selected: checked } : r)));
  }

  async function runImageUpdates() {
    const targets = rows.filter((r) => r.selected && selectable(r));
    if (!targets.length) return;
    setConfirming(false);
    setUpdating(true);
    setProgress({ done: 0, total: targets.length });

    const { data: latest, error: fetchErr } = await supabase.from("products").select("id, name, category_id, image, active");
    if (fetchErr) {
      setUpdating(false);
      toast.error("Could not refresh existing products before updating images.");
      return;
    }

    const freshProducts = latest ?? [];
    const usedIds = new Set<string>();
    let ok = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
      const row = targets[i]!;
      const rechecked = resolveUniqueTargetProduct(row.entry, freshProducts);
      if (!rechecked.ok || !row.matchedProduct || rechecked.product.id !== row.matchedProduct.id || usedIds.has(rechecked.product.id)) {
        const reason = !rechecked.ok ? rechecked.reason : usedIds.has(rechecked.product.id) ? "Duplicate target product in batch" : "Matched product changed since preview";
        skipped += 1;
        setRows((prev) => prev.map((r) => {
          if (r.index !== row.index) return r;
          const { updateError: _, ...rest } = r;
          return { ...rest, status: "skipped", errors: [reason], selected: false };
        }));
        setProgress({ done: i + 1, total: targets.length });
        continue;
      }

      setRows((prev) => prev.map((r) => {
        if (r.index !== row.index) return r;
        const { updateError: _, ...rest } = r;
        return { ...rest, status: "updating" };
      }));

      try {
        if (!row.imageBytes || !row.imageMime) throw new Error("Missing validated image bytes.");
        const filename = (row.entry.image_file.split("/").pop() ?? "image.png").slice(0, 120);
        const uploaded = await upload({
          data: { filename, contentType: row.imageMime, base64: bytesToBase64(row.imageBytes) },
        });
        const payload = buildImageUpdatePayload(uploaded.url);
        const { data: updatedRow, error: updateErr } = await supabase
          .from("products")
          .update(payload)
          .eq("id", rechecked.product.id)
          .select("id")
          .single();
        if (updateErr || !updatedRow) throw new Error(updateErr?.message || "Could not update product image.");
        usedIds.add(rechecked.product.id);
        ok += 1;
        setRows((prev) => prev.map((r) => {
          if (r.index !== row.index) return r;
          const { updateError: _, ...rest } = r;
          return {
            ...rest,
            matchedProduct: r.matchedProduct ? { ...r.matchedProduct, image: payload.image } : null,
            status: "updated",
            selected: false,
          };
        }));
      } catch (err) {
        failed += 1;
        const msg = err instanceof Error ? err.message : "Image update failed";
        setRows((prev) => prev.map((r) => (r.index === row.index ? { ...r, status: "failed", updateError: msg, selected: true } : r)));
      }
      setProgress({ done: i + 1, total: targets.length });
    }

    setUpdating(false);
    if (ok > 0) onUpdated();
    toast.success(`Image update finished: ${ok} updated, ${skipped} skipped, ${failed} failed.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
        <div className="space-y-0.5">
          <p className="font-semibold">Select a ZIP archive with <code className="text-xs">products.json</code> (v1) and replacement images</p>
          <p className="text-xs text-muted-foreground">Matches existing products uniquely by name and category. Updates only the image URL; all other fields and previous storage images are preserved. No products are created.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-semibold">
          <FileArchive className="size-4" /> {zipName ? "Choose another ZIP" : "Choose ZIP"}
          <input type="file" accept=".zip,application/zip" disabled={reading || updating} className="sr-only" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>

      {reading && <p className="text-sm text-muted-foreground">Reading and matching {zipName}...</p>}
      {parseError && <p className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent">{parseError}</p>}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap gap-3 text-muted-foreground">
              <span><strong>{rows.length}</strong> in ZIP</span>
              <span><strong>{selectedRows.length}</strong> selected</span>
              {updatedCount > 0 && <span className="text-success"><strong>{updatedCount}</strong> updated</span>}
              {skippedCount > 0 && <span><strong>{skippedCount}</strong> skipped/unmatched</span>}
              {invalidCount > 0 && <span className="text-accent"><strong>{invalidCount}</strong> invalid</span>}
              {failedCount > 0 && <span className="text-accent"><strong>{failedCount}</strong> failed</span>}
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={updating} onClick={() => toggleAll(true)}>Select all ready</Button>
              <Button type="button" size="sm" variant="outline" disabled={updating} onClick={() => toggleAll(false)}>Deselect all</Button>
            </div>
          </div>

          {updating && <p className="text-sm font-semibold text-primary">Updating {progress.done} of {progress.total}...</p>}

          <div className="max-h-[48vh] overflow-auto rounded-xl border border-border">
            <table className="w-full min-w-[860px] text-xs">
              <thead className="sticky top-0 bg-surface text-left uppercase text-muted-foreground">
                <tr>
                  <th className="p-2.5"><span className="sr-only">Select</span></th>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5">Current → New image</th>
                  <th className="p-2.5">Note</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.index} className={!selectable(r) && r.status !== "updated" && r.status !== "updating" ? "opacity-65" : ""}>
                    <td className="p-2.5 align-top">
                      <input type="checkbox" aria-label={`Select ${r.entry.name || `row ${r.index + 1}`}`} className="size-4 accent-primary" disabled={updating || !selectable(r)} checked={r.selected} onChange={(e) => toggleRow(r.index, e.target.checked)} />
                    </td>
                    <td className="p-2.5 align-top">
                      <p className="font-semibold">{r.entry.name || "—"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {catNames.get(r.entry.category_id) ?? r.entry.category_id}
                        {r.matchedProduct ? (r.matchedProduct.active ? " · Active" : " · Draft") : ""}
                      </p>
                    </td>
                    <td className="p-2.5 align-top">
                      <div className="flex items-center gap-2">
                        {r.matchedProduct ? (
                          <img src={productImage(r.matchedProduct.image)} alt="Current" className="size-12 rounded border border-border object-cover" />
                        ) : (
                          <span className="flex size-12 items-center justify-center rounded border border-dashed border-border text-[10px] text-muted-foreground">None</span>
                        )}
                        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                        {previews[r.index] ? (
                          <img src={previews[r.index]} alt="New" className="size-12 rounded border border-border object-cover" />
                        ) : (
                          <span className="flex size-12 items-center justify-center rounded border border-dashed border-border text-[10px] text-muted-foreground">Invalid</span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{r.entry.image_file || "—"}</p>
                    </td>
                    <td className="max-w-[260px] p-2.5 align-top text-muted-foreground whitespace-normal">{r.entry.note || "—"}</td>
                    <td className="p-2.5 align-top">
                      <span className={`inline-block rounded-full px-2 py-0.5 font-semibold ${statusTone[r.status]}`}>{statusLabel[r.status]}</span>
                      {r.errors.length > 0 && <p className="mt-1 text-[11px] text-accent">{r.errors.join("; ")}</p>}
                      {r.updateError && <p className="mt-1 text-[11px] text-accent">{r.updateError}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {confirming && selectedRows.length > 0 && !updating && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
          <p className="font-medium text-foreground">
            Confirm replacing the image URL for <strong>{selectedRows.length}</strong> matched {selectedRows.length === 1 ? "product" : "products"}? Only the <code className="font-mono">image</code> field will be updated; prices, stock, descriptions, active status, and old storage files remain unchanged.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={() => void runImageUpdates()}>Confirm update ({selectedRows.length})</Button>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={updating} onClick={onClose}>Close</Button>
        <Button type="button" disabled={updating || selectedRows.length === 0 || confirming} onClick={() => setConfirming(true)}>
          {updating
            ? `Updating (${progress.done}/${progress.total})...`
            : failedCount > 0 && selectedRows.every((r) => r.status === "failed")
              ? `Retry failed (${selectedRows.length})`
              : `Update selected images (${selectedRows.length})`}
        </Button>
      </div>
    </div>
  );
}