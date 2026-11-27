import { ChevronDown, ChevronUp, FileArchive } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/variant-options";
import { supabase } from "@/integrations/supabase/client";
import { selectionLabel } from "@/lib/variants";
import {
  buildInitialVariantRpcArgs,
  countVariantsByProduct,
  evaluateVariantUpdateMatch,
  isVariantRowSelectable,
  parseVariantUpdateZip,
  type ExistingProductForVariantUpdate,
  type VariantUpdateManifestMeta,
  type VariantUpdateRow,
} from "@/lib/zip-variant-import";
import { useInvalidate } from "./shared";
import { ZipVariantRowEditor } from "./zip-variant-row-editor";

type CategoryOption = { id: string; name: string };

const statusLabel: Record<VariantUpdateRow["status"], string> = {
  ready: "Ready",
  review: "Review",
  skip: "Skip",
  conflict: "Conflict",
  invalid: "Invalid",
  updating: "Updating...",
  updated: "Updated",
  failed: "Failed",
};

const statusTone: Record<VariantUpdateRow["status"], string> = {
  ready: "bg-primary/10 text-primary",
  review: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  skip: "bg-surface text-muted-foreground",
  conflict: "bg-accent/10 text-accent",
  invalid: "bg-accent/10 text-accent",
  updating: "bg-primary/10 text-primary",
  updated: "bg-success/10 text-success",
  failed: "bg-accent/10 text-accent",
};

async function loadCurrentCatalogForVariants() {
  const [productsRes, variantsRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, category_id, stock, active, color_variants_enabled, storage_variants_enabled, colors, capacity"),
    supabase.from("product_variants").select("id, product_id"),
  ]);
  if (productsRes.error || variantsRes.error) {
    throw new Error(productsRes.error?.message || variantsRes.error?.message || "Could not load catalog state.");
  }
  return {
    products: (productsRes.data ?? []) as ExistingProductForVariantUpdate[],
    variants: variantsRes.data ?? [],
  };
}

export function ZipVariantUpdater({
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
  const invalidate = useInvalidate();
  const [zipName, setZipName] = useState("");
  const [parseError, setParseError] = useState("");
  const [reading, setReading] = useState(false);
  const [meta, setMeta] = useState<VariantUpdateManifestMeta | null>(null);
  const [rows, setRows] = useState<VariantUpdateRow[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [bulkConfirmed, setBulkConfirmed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    onBusyChange(reading || updating);
  }, [reading, updating, onBusyChange]);

  const catNames = new Map(cats.map((c) => [c.id, c.name]));
  const selectedRows = rows.filter((r) => r.selected && isVariantRowSelectable(r));
  const readyCount = rows.filter((r) => r.status === "ready").length;
  const reviewCount = rows.filter((r) => r.status === "review").length;
  const confirmedReviewCount = rows.filter((r) => r.status === "review" && r.reviewConfirmed).length;
  const skipCount = rows.filter((r) => r.status === "skip").length;
  const conflictCount = rows.filter((r) => r.status === "conflict").length;
  const invalidCount = rows.filter((r) => r.status === "invalid").length;
  const updatedCount = rows.filter((r) => r.status === "updated").length;
  const failedCount = rows.filter((r) => r.status === "failed").length;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setParseError("");
    setRows([]);
    setMeta(null);
    setExpanded({});
    setBulkConfirmed(false);
    setZipName(file.name);
    if (!/\.zip$/i.test(file.name) && file.type && !file.type.includes("zip")) {
      setParseError("Please choose a .zip file.");
      return;
    }
    setReading(true);
    try {
      const [{ products, variants }, buf] = await Promise.all([loadCurrentCatalogForVariants(), file.arrayBuffer()]);
      const res = parseVariantUpdateZip(new Uint8Array(buf), new Set(cats.map((c) => c.id)), products, variants);
      if ("error" in res) {
        setParseError(res.error);
        return;
      }
      setMeta(res.meta);
      setRows(res.rows);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not read existing catalog for matching.");
    } finally {
      setReading(false);
    }
  }

  function patchRow(index: number, patch: Partial<VariantUpdateRow>) {
    setBulkConfirmed(false);
    setRows((prev) => prev.map((r) => (r.index === index ? { ...r, ...patch } : r)));
  }

  function toggleRow(index: number, checked: boolean) {
    setBulkConfirmed(false);
    setRows((prev) => prev.map((r) => (r.index === index && isVariantRowSelectable(r) ? { ...r, selected: checked } : r)));
  }

  function selectAllReady() {
    setBulkConfirmed(false);
    setRows((prev) => prev.map((r) => (isVariantRowSelectable(r) ? { ...r, selected: true } : r)));
  }

  function deselectAll() {
    setBulkConfirmed(false);
    setRows((prev) => prev.map((r) => (r.selected ? { ...r, selected: false } : r)));
  }

  async function runVariantUpdates() {
    const targets = rows.filter((r) => r.selected && isVariantRowSelectable(r));
    if (!targets.length || !bulkConfirmed) return;
    setUpdating(true);
    setProgress({ done: 0, total: targets.length });

    let fresh: Awaited<ReturnType<typeof loadCurrentCatalogForVariants>>;
    try {
      fresh = await loadCurrentCatalogForVariants();
    } catch {
      setUpdating(false);
      toast.error("Could not refresh catalog state before applying variants.");
      return;
    }

    const productsById = new Map(fresh.products.map((p) => [p.id.toLowerCase(), p]));
    const variantCounts = countVariantsByProduct(fresh.variants);
    let ok = 0;
    let conflicts = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
      const row = targets[i]!;
      const match = evaluateVariantUpdateMatch(row.entry, productsById, variantCounts);
      if (!match.ok) {
        conflicts += 1;
        setRows((prev) =>
          prev.map((r) => {
            if (r.index !== row.index) return r;
            const { updateError: _, ...rest } = r;
            return { ...rest, matchedProduct: match.product, status: "conflict", errors: match.reasons, selected: false };
          }),
        );
        setProgress({ done: i + 1, total: targets.length });
        continue;
      }

      setRows((prev) =>
        prev.map((r) => {
          if (r.index !== row.index) return r;
          const { updateError: _, ...rest } = r;
          return { ...rest, matchedProduct: match.product, status: "updating" };
        }),
      );

      try {
        const rpcArgs = buildInitialVariantRpcArgs({ ...row, matchedProduct: match.product });
        const { error: rpcErr } = await supabase.rpc("configure_initial_product_variants", rpcArgs);
        if (rpcErr) throw new Error(rpcErr.message || "Could not configure variants.");
        variantCounts.set(match.product.id, (variantCounts.get(match.product.id) ?? 0) + rpcArgs._variants.length);
        ok += 1;
        setRows((prev) =>
          prev.map((r) => {
            if (r.index !== row.index) return r;
            const { updateError: _, ...rest } = r;
            return { ...rest, status: "updated", selected: false };
          }),
        );
      } catch (err) {
        failed += 1;
        const msg = err instanceof Error ? err.message : "Variant update failed";
        setRows((prev) => prev.map((r) => (r.index === row.index ? { ...r, status: "failed", updateError: msg, selected: true } : r)));
      }
      setProgress({ done: i + 1, total: targets.length });
    }

    setUpdating(false);
    setBulkConfirmed(false);
    if (ok > 0) {
      invalidate("products", "admin-products", "product-variants", "admin-inventory");
      onUpdated();
    }
    toast.success(`Variant update finished: ${ok} updated, ${conflicts} conflicts, ${failed} failed.`);
  }

  const excludedEntries = meta ? Object.entries(meta.excluded_categories) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
        <div className="space-y-0.5">
          <p className="font-semibold">Select a ZIP archive with <code className="text-xs">variants.json</code> (v1)</p>
          <p className="text-xs text-muted-foreground">
            Matches active products by exact UUID and reconciles initial variants without changing prices, photos, or existing variant configurations. Nothing is selected automatically.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-semibold">
          <FileArchive className="size-4" /> {zipName ? "Choose another ZIP" : "Choose ZIP"}
          <input
            type="file"
            accept=".zip,application/zip"
            disabled={reading || updating}
            className="sr-only"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {reading && <p className="text-sm text-muted-foreground">Reading and matching {zipName}...</p>}
      {parseError && <p className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent">{parseError}</p>}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap gap-3 text-muted-foreground">
              <span><strong>{rows.length}</strong> in ZIP</span>
              <span className="text-primary"><strong>{readyCount}</strong> ready</span>
              <span><strong>{reviewCount}</strong> review{confirmedReviewCount > 0 ? ` (${confirmedReviewCount} confirmed)` : ""}</span>
              <span><strong>{skipCount}</strong> skipped</span>
              {conflictCount > 0 && <span className="text-accent"><strong>{conflictCount}</strong> conflict</span>}
              {invalidCount > 0 && <span className="text-accent"><strong>{invalidCount}</strong> invalid</span>}
              {updatedCount > 0 && <span className="text-success"><strong>{updatedCount}</strong> updated</span>}
              {failedCount > 0 && <span className="text-accent"><strong>{failedCount}</strong> failed</span>}
              <span><strong>{selectedRows.length}</strong> selected</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={updating} onClick={selectAllReady}>Select all ready</Button>
              <Button type="button" size="sm" variant="outline" disabled={updating} onClick={deselectAll}>Deselect all</Button>
            </div>
          </div>

          {meta && (meta.catalog_snapshot || excludedEntries.length > 0) && (
            <p className="text-[11px] text-muted-foreground">
              {meta.catalog_snapshot ? `Snapshot ${meta.catalog_snapshot}` : ""}
              {meta.catalog_total !== null ? ` · Catalog total: ${meta.catalog_total}` : ""}
              {excludedEntries.length > 0
                ? ` · Excluded categories: ${excludedEntries.map(([k, v]) => `${catNames.get(k) ?? k} (${v})`).join(", ")}`
                : ""}
            </p>
          )}

          {updating && <p className="text-sm font-semibold text-primary">Updating {progress.done} of {progress.total}...</p>}

          <div className="max-h-[46vh] overflow-auto rounded-xl border border-border">
            <table className="w-full min-w-[980px] text-xs">
              <thead className="sticky top-0 z-10 bg-surface text-left uppercase text-muted-foreground">
                <tr>
                  <th className="p-2.5"><span className="sr-only">Select</span></th>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5">Existing</th>
                  <th className="p-2.5">Proposed actual variants</th>
                  <th className="p-2.5">Market suggestions (not auto-activated)</th>
                  <th className="p-2.5">Note</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const canSelect = isVariantRowSelectable(r);
                  const isExpanded = !!expanded[r.index];
                  const safeSource = r.entry.market_source && /^https:\/\//i.test(r.entry.market_source) ? r.entry.market_source : null;
                  return (
                    <Fragment key={r.index}>
                      <tr className={!canSelect && r.status !== "updated" && r.status !== "updating" && r.status !== "review" ? "opacity-65" : ""}>
                        <td className="p-2.5 align-top">
                          <input
                            type="checkbox"
                            aria-label={`Select ${r.entry.name || `row ${r.index + 1}`}`}
                            className="size-4 accent-primary"
                            disabled={updating || !canSelect}
                            checked={r.selected}
                            onChange={(e) => toggleRow(r.index, e.target.checked)}
                          />
                        </td>
                        <td className="p-2.5 align-top">
                          <p className="font-semibold">{r.entry.name || "—"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {catNames.get(r.entry.category_id) ?? r.entry.category_id} · Stock: <strong>{r.matchedProduct ? r.matchedProduct.stock : r.entry.expected_stock}</strong>
                          </p>
                        </td>
                        <td className="p-2.5 align-top text-[11px] text-muted-foreground">
                          <p>Colors: {r.entry.existing_colors.length ? r.entry.existing_colors.join(", ") : "—"}</p>
                          <p>Capacity: {r.entry.existing_capacity || "—"}</p>
                        </td>
                        <td className="p-2.5 align-top">
                          {r.draftVariants.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground">None configured</span>
                          ) : (
                            <div className="space-y-1">
                              {r.draftVariants.map((v, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                  {v.color_name && <ColorSwatch name={v.color_name} hex={v.color_hex} />}
                                  <span className="font-medium">
                                    {selectionLabel({ color_snapshot: v.color_name, storage_snapshot: v.storage })}
                                  </span>
                                  <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold">
                                    qty {v.stock}{!v.active ? " (inactive)" : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 align-top">
                          {r.entry.suggested_colors.length === 0 && r.entry.suggested_storage.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          ) : (
                            <div className="space-y-1">
                              {r.entry.suggested_colors.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {r.entry.suggested_colors.map((sc) => (
                                    <span key={sc.name} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px]">
                                      <span className="inline-block size-2.5 rounded-full border border-border" style={{ backgroundColor: sc.hex }} />
                                      {sc.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {r.entry.suggested_storage.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {r.entry.suggested_storage.map((st) => (
                                    <span key={st} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">{st}</span>
                                  ))}
                                </div>
                              )}
                              {safeSource && (
                                <a href={safeSource} target="_blank" rel="noreferrer noopener" className="inline-block text-[10px] text-primary underline">
                                  Market source
                                </a>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="max-w-[200px] whitespace-normal p-2.5 align-top text-[11px] text-muted-foreground">
                          {r.entry.note || "—"}
                        </td>
                        <td className="p-2.5 align-top">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`inline-block rounded-full px-2 py-0.5 font-semibold ${statusTone[r.status]}`}>
                              {r.status === "review" && r.reviewConfirmed ? "Review (confirmed)" : statusLabel[r.status]}
                            </span>
                            {r.status === "review" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[11px]"
                                disabled={updating}
                                onClick={() => setExpanded((prev) => ({ ...prev, [r.index]: !prev[r.index] }))}
                              >
                                {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                                {isExpanded ? "Hide" : "Reconcile"}
                              </Button>
                            )}
                          </div>
                          {r.errors.length > 0 && <p className="mt-1 text-[11px] text-accent">{r.errors.join("; ")}</p>}
                          {r.updateError && <p className="mt-1 text-[11px] text-accent">{r.updateError}</p>}
                        </td>
                      </tr>
                      {r.status === "review" && isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-2.5">
                            <ZipVariantRowEditor row={r} disabled={updating} onChange={(patch) => patchRow(r.index, patch)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs font-medium">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              disabled={updating || selectedRows.length === 0}
              checked={bulkConfirmed}
              onChange={(e) => setBulkConfirmed(e.target.checked)}
            />
            <span>
              I confirm applying the selected actual variant configurations for <strong>{selectedRows.length}</strong>{" "}
              {selectedRows.length === 1 ? "product" : "products"}. Prices, images, descriptions, and existing variant configurations remain untouched.
            </span>
          </label>
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={updating} onClick={onClose}>Close</Button>
        <Button
          type="button"
          disabled={updating || selectedRows.length === 0 || !bulkConfirmed}
          onClick={() => void runVariantUpdates()}
        >
          {updating
            ? `Updating (${progress.done}/${progress.total})...`
            : failedCount > 0 && selectedRows.every((r) => r.status === "failed")
              ? `Retry failed (${selectedRows.length})`
              : `Update selected variants (${selectedRows.length})`}
        </Button>
      </div>
    </div>
  );
}