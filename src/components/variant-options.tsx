import { Button } from "@/components/ui/button";
import { compareStorageCapacity, normalizeOption, type Variant } from "@/lib/variants";

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
    {colorEnabled && <fieldset><legend className="mb-2 text-sm font-semibold">Color{color ? `: ${color}` : " — select"}</legend><div className="flex flex-wrap gap-2">{colors.map(v => {
      const available = variants.some(x => x.active && normalizeOption(x.color_name) === normalizeOption(v.color_name) && (!storage || normalizeOption(x.storage) === normalizeOption(storage)) && x.stock > 0);
      const selected = normalizeOption(color) === normalizeOption(v.color_name);
      return <Button key={v.id} type="button" variant="outline" size="icon" disabled={!available} title={`${v.color_name}${available ? "" : " — unavailable"}`} aria-label={`Color ${v.color_name}${available ? "" : " — unavailable"}`} aria-pressed={selected} className={`size-10 rounded-full p-1.5 ${selected ? "ring-2 ring-primary ring-offset-2" : ""}`} onClick={() => onColor(selected ? null : v.color_name)}><ColorSwatch name={v.color_name ?? ""} hex={v.color_hex} /></Button>;
    })}</div></fieldset>}
    {storageEnabled && <fieldset><legend className="mb-2 text-sm font-semibold">Storage{storage ? `: ${storage}` : " — select"}</legend><div className="flex flex-wrap gap-2">{storages.map(s => {
      const available = variants.some(v => v.active && normalizeOption(v.storage) === normalizeOption(s) && (!color || normalizeOption(v.color_name) === normalizeOption(color)) && v.stock > 0);
      return <Button key={s} type="button" variant={normalizeOption(storage) === normalizeOption(s) ? "default" : "outline"} size="sm" disabled={!available} aria-pressed={normalizeOption(storage) === normalizeOption(s)} className={`rounded-full ${available ? "" : "line-through"}`} onClick={() => onStorage(storage === s ? null : s)}>{s}</Button>;
    })}</div></fieldset>}
    {(color || storage) && <Button type="button" size="sm" variant="ghost" onClick={() => { onColor(null); onStorage(null); }}>Clear selection</Button>}
  </div>;
}