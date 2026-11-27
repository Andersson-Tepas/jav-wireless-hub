import { Button } from "@/components/ui/button";
import { compareStorageCapacity, displayVariantOption, normalizeOption, type Variant } from "@/lib/variants";

export function ColorSwatch({ name, hex }: { name: string; hex?: string | null }) {
  const preset = /^(black|white|blue|red|pink|green|gray|grey|silver|gold|orange|purple|tan|graphite|yellow gold|rose gold)$/.test(normalizeOption(name));
  return <span aria-hidden="true" data-color={normalizeOption(name)} className="variant-swatch block size-6 shrink-0 rounded-full border border-border bg-muted" style={hex && /^#[\da-f]{6}$/i.test(hex) ? { backgroundColor: hex } : undefined}>{!hex && !preset && <span className="grid h-full place-items-center text-[10px] text-foreground">{name.slice(0, 1)}</span>}</span>;
}

export function VariantOptions({ variants, colorEnabled, storageEnabled, color, storage, onColor, onStorage }: {
  variants: Variant[]; colorEnabled: boolean; storageEnabled: boolean; color: string | null; storage: string | null;
  onColor: (color: string | null) => void; onStorage: (storage: string | null) => void;
}) {
  const colors = [...new Map(variants.filter(v => v.active && v.color_name).map(v => [normalizeOption(v.color_name), v])).values()];
  const storages = [...new Map(variants.filter(v => v.active && v.storage).map(v => [normalizeOption(v.storage), v.storage!])).values()].sort(compareStorageCapacity);
  return <div className="mt-4 space-y-3">
    {colorEnabled && <fieldset><legend className="mb-2 text-sm font-semibold">Color{color ? `: ${displayVariantOption(color)}` : " — select"}</legend><div className="flex flex-wrap gap-2">{colors.map(v => {
      const configured = variants.some(x => x.active && normalizeOption(x.color_name) === normalizeOption(v.color_name) && (!storage || normalizeOption(x.storage) === normalizeOption(storage)));
      const available = configured && variants.some(x => x.active && normalizeOption(x.color_name) === normalizeOption(v.color_name) && (!storage || normalizeOption(x.storage) === normalizeOption(storage)) && x.stock > 0);
      const selected = normalizeOption(color) === normalizeOption(v.color_name);
      const label = displayVariantOption(v.color_name);
      const status = available ? "" : " — Confirm availability";
      return <Button key={v.id} type="button" variant="outline" size="icon" disabled={!configured} title={`${label}${status}`} aria-label={`Color ${label}${status}`} aria-pressed={selected} className={`size-10 rounded-full p-1.5 ${selected ? "ring-2 ring-primary ring-offset-2" : ""} ${available ? "" : "border-dashed"}`} onClick={() => onColor(selected ? null : v.color_name)}><ColorSwatch name={label} hex={v.color_hex} /></Button>;
    })}</div></fieldset>}
    {storageEnabled && <fieldset><legend className="mb-2 text-sm font-semibold">Storage{storage ? `: ${displayVariantOption(storage)}` : " — select"}</legend><div className="flex flex-wrap gap-2">{storages.map(s => {
      const configured = variants.some(v => v.active && normalizeOption(v.storage) === normalizeOption(s) && (!color || normalizeOption(v.color_name) === normalizeOption(color)));
      const available = configured && variants.some(v => v.active && normalizeOption(v.storage) === normalizeOption(s) && (!color || normalizeOption(v.color_name) === normalizeOption(color)) && v.stock > 0);
      const label = displayVariantOption(s);
      return <Button key={s} type="button" variant={normalizeOption(storage) === normalizeOption(s) ? "default" : "outline"} size="sm" disabled={!configured} aria-pressed={normalizeOption(storage) === normalizeOption(s)} className={`h-auto min-h-9 rounded-full ${available ? "" : "border-dashed"}`} onClick={() => onStorage(storage === s ? null : s)}>{label}{configured && !available ? " — Confirm availability" : ""}</Button>;
    })}</div></fieldset>}
    {(color || storage) && <Button type="button" size="sm" variant="ghost" onClick={() => { onColor(null); onStorage(null); }}>Clear selection</Button>}
  </div>;
}