import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ColorSwatch } from "@/components/variant-options";
import { compareStorageCapacity, compareVariantStorageThenColor, storagePresets, validateAllocation, type VariantDraft } from "@/lib/variants";
import { canConfirmReviewRow, type VariantUpdateRow } from "@/lib/zip-variant-import";

const COLOR_PRESETS = [
  "Black", "White", "Blue", "Red", "Pink", "Green", "Gray", "Silver", "Gold", "Orange", "Purple", "Tan",
];

export function ZipVariantRowEditor({
  row,
  disabled,
  onChange,
}: {
  row: VariantUpdateRow;
  disabled: boolean;
  onChange: (patch: Partial<VariantUpdateRow>) => void;
}) {
  const stock = row.matchedProduct?.stock ?? row.entry.expected_stock;
  const colorEnabled = row.draftColorEnabled;
  const storageEnabled = row.draftStorageEnabled;
  const variants = row.draftVariants;
  const allocation = validateAllocation(variants, colorEnabled, storageEnabled, stock);
  const canConfirm = canConfirmReviewRow(row);

  function updateDraft(patch: Partial<Pick<VariantUpdateRow, "draftColorEnabled" | "draftStorageEnabled" | "draftVariants">>) {
    onChange({ ...patch, reviewConfirmed: false, selected: false });
  }

  function updateVariant(idx: number, patch: Partial<VariantDraft>) {
    updateDraft({
      draftVariants: variants.map((v, i) => (i === idx ? { ...v, ...patch, image: null } : v)),
    });
  }

  function addCombination(preset?: { color_name?: string | null; color_hex?: string | null; storage?: string | null }) {
    if (variants.length >= 200) return;
    const next: VariantDraft = {
      color_name: colorEnabled ? (preset?.color_name ?? null) : null,
      color_hex: colorEnabled ? (preset?.color_hex ?? null) : null,
      storage: storageEnabled ? (preset?.storage ?? null) : null,
      stock: 0,
      image: null,
      active: true,
    };
    updateDraft({ draftVariants: [...variants, next] });
  }

  function removeCombination(idx: number) {
    updateDraft({ draftVariants: variants.filter((_, i) => i !== idx) });
  }

  const colorListId = `zip-var-colors-${row.index}`;
  const storageListId = `zip-var-storage-${row.index}`;
  const allColorNames = Array.from(new Set([...row.entry.suggested_colors.map((c) => c.name), ...COLOR_PRESETS]));
  const allStorageOptions = Array.from(new Set([...row.entry.suggested_storage, ...storagePresets])).sort(compareStorageCapacity);
  const sortedVariantEntries = variants
    .map((variant, index) => ({ variant, index }))
    .sort((a, b) => compareVariantStorageThenColor(a.variant, b.variant) || a.index - b.index);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface/60 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 font-medium">
            <Switch
              checked={colorEnabled}
              disabled={disabled}
              onCheckedChange={(v) => updateDraft({ draftColorEnabled: v })}
            />
            Enable color / finish
          </label>
          <label className="flex items-center gap-2 font-medium">
            <Switch
              checked={storageEnabled}
              disabled={disabled}
              onCheckedChange={(v) => updateDraft({ draftStorageEnabled: v })}
            />
            Enable storage
          </label>
        </div>
        <p className="text-muted-foreground">
          Current stock: <strong className="text-foreground">{stock}</strong> · Active combination total:{" "}
          <strong className={allocation.valid && (colorEnabled || storageEnabled) ? "text-success" : "text-accent"}>
            {allocation.total}
          </strong>
        </p>
      </div>

      {(colorEnabled || storageEnabled) && (
        <>
          <datalist id={colorListId}>{allColorNames.map((n) => <option key={n} value={n} />)}</datalist>
          <datalist id={storageListId}>{allStorageOptions.map((s) => <option key={s} value={s} />)}</datalist>

          {(row.entry.suggested_colors.length > 0 || row.entry.suggested_storage.length > 0) && (
            <div className="space-y-1.5 rounded border border-border/70 bg-background p-2">
              <p className="text-[11px] font-medium text-muted-foreground">
                Quick-add from market suggestions (adds a row with stock 0 — never infers or splits stock):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {colorEnabled && row.entry.suggested_colors.map((sc) => (
                  <Button
                    key={`sc-${sc.name}`}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || variants.length >= 200}
                    className="h-7 gap-1.5 px-2 text-[11px]"
                    onClick={() => addCombination({ color_name: sc.name, color_hex: sc.hex })}
                  >
                    <span className="inline-block size-3 rounded-full border border-border" style={{ backgroundColor: sc.hex }} />
                    + {sc.name}
                  </Button>
                ))}
                {storageEnabled && !colorEnabled && [...row.entry.suggested_storage].sort(compareStorageCapacity).map((st) => (
                  <Button
                    key={`ss-${st}`}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || variants.length >= 200}
                    className="h-7 px-2 text-[11px]"
                    onClick={() => addCombination({ storage: st })}
                  >
                    + {st}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {sortedVariantEntries.map(({ variant: v, index: idx }) => (
              <div key={v.id ?? idx} className="grid items-end gap-2 rounded border border-border bg-background p-2 sm:grid-cols-12">
                {colorEnabled && (
                  <>
                    <label className="grid gap-1 sm:col-span-3">
                      <span className="text-[11px] text-muted-foreground">Color / finish</span>
                      <div className="flex items-center gap-1.5">
                        <ColorSwatch name={v.color_name ?? ""} hex={v.color_hex} />
                        <input
                          className="field h-8 text-xs"
                          list={colorListId}
                          maxLength={80}
                          disabled={disabled}
                          value={v.color_name ?? ""}
                          onChange={(e) => updateVariant(idx, { color_name: e.target.value || null })}
                        />
                      </div>
                    </label>
                    <label className="grid gap-1 sm:col-span-2">
                      <span className="text-[11px] text-muted-foreground">Hex (optional)</span>
                      <input
                        className="field h-8 font-mono text-xs"
                        placeholder="#RRGGBB"
                        maxLength={7}
                        disabled={disabled}
                        value={v.color_hex ?? ""}
                        onChange={(e) => updateVariant(idx, { color_hex: e.target.value || null })}
                      />
                    </label>
                  </>
                )}
                {storageEnabled && (
                  <label className="grid gap-1 sm:col-span-3">
                    <span className="text-[11px] text-muted-foreground">Storage</span>
                    <input
                      className="field h-8 text-xs"
                      list={storageListId}
                      maxLength={80}
                      disabled={disabled}
                      value={v.storage ?? ""}
                      onChange={(e) => updateVariant(idx, { storage: e.target.value || null })}
                    />
                  </label>
                )}
                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-[11px] text-muted-foreground">Stock</span>
                  <input
                    className="field h-8 text-xs"
                    type="number"
                    min={0}
                    max={1000000}
                    step={1}
                    disabled={disabled}
                    value={v.stock}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      updateVariant(idx, { stock: Number.isInteger(n) && n >= 0 ? n : 0 });
                    }}
                  />
                </label>
                <div className="flex items-center justify-end gap-2 sm:col-span-2">
                  <label className="flex items-center gap-1.5 text-[11px]">
                    <Switch checked={v.active} disabled={disabled} onCheckedChange={(active) => updateVariant(idx, { active })} />
                    Active
                  </label>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label={`Remove combination ${idx + 1}`}
                    disabled={disabled}
                    onClick={() => removeCombination(idx)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" size="sm" variant="outline" disabled={disabled || variants.length >= 200} onClick={() => addCombination()}>
              <Plus className="size-3.5" /> Add actual combination
            </Button>
            {!allocation.valid && <p className="text-xs font-medium text-accent">{allocation.error}</p>}
          </div>
        </>
      )}

      <label className="flex items-start gap-2 rounded border border-border bg-background p-2 font-medium">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-primary"
          disabled={disabled || !canConfirm}
          checked={row.reviewConfirmed}
          onChange={(e) => onChange({ reviewConfirmed: e.target.checked, selected: e.target.checked ? row.selected : false })}
        />
        <span>
          I confirm these are actual combinations for <strong>{row.entry.name}</strong> and their stock reconciles to {stock}.
          {!canConfirm && " (Enable a dimension and allocate exact stock to enable confirmation.)"}
        </span>
      </label>
    </div>
  );
}