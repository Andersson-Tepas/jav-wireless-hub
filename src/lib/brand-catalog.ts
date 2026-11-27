import {
  siAcer,
  siApple,
  siDior,
  siHp,
  siMotorola,
  siNokia,
  siSamsung,
  siToshiba,
} from "simple-icons";

export type VerifiedBrandLogo = {
  title: string;
  path: string;
  layout: "wordmark" | "mark" | "mark-with-name";
};

export type HomeBrand = {
  name: string;
  logoPath?: string;
  logo?: VerifiedBrandLogo;
};

export type BrandProductInput = {
  brand: string;
  category_id?: string | null;
  active?: boolean | null;
};

const PLACEHOLDER_BRANDS = new Set([
  "",
  "-",
  "unbranded",
  "to be confirmed",
  "tbc",
  "tbd",
  "unknown",
  "generic",
  "none",
  "n/a",
  "na",
  "other",
  "no brand",
  "sin marca",
  "por confirmar",
]);

// Exact verified matches from the locally bundled simple-icons package only.
export const VERIFIED_BRAND_LOGOS: Record<string, VerifiedBrandLogo> = {
  apple: { title: siApple.title, path: siApple.path, layout: "mark-with-name" },
  samsung: { title: siSamsung.title, path: siSamsung.path, layout: "wordmark" },
  motorola: { title: siMotorola.title, path: siMotorola.path, layout: "mark-with-name" },
  nokia: { title: siNokia.title, path: siNokia.path, layout: "wordmark" },
  hp: { title: siHp.title, path: siHp.path, layout: "mark" },
  acer: { title: siAcer.title, path: siAcer.path, layout: "wordmark" },
  toshiba: { title: siToshiba.title, path: siToshiba.path, layout: "wordmark" },
  dior: { title: siDior.title, path: siDior.path, layout: "wordmark" },
};

// Recognizable brands interleaved across phones, tools, computers, fragrances, and accessories.
const PRIORITY_ORDER = [
  "apple",
  "samsung",
  "dewalt",
  "dior",
  "hp",
  "milwaukee",
  "versace",
  "motorola",
  "microsoft",
  "makita",
  "giorgio armani",
  "amazon",
  "nokia",
  "ridgid",
  "calvin klein",
  "acer",
  "ralph lauren",
  "toshiba",
  "ryobi",
  "michael kors",
  "tcl",
  "boss",
  "carolina herrera",
  "lancôme",
  "disney",
  "nautica",
  "cricket",
  "jimmy choo",
  "moschino",
  "rabanne",
  "hurley",
  "swann",
  "ariana grande",
  "armaf",
  "lattafa",
  "hypergear",
  "monster smart",
  "prodigee",
  "naztech",
  "mycharge",
  "dialn",
  "paris hilton",
  "eyfel",
  "v.v. love",
  "sim",
];

const PRIORITY_RANK = new Map(PRIORITY_ORDER.map((key, index) => [key, index]));

export function normalizeBrandKey(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isPlaceholderBrand(raw: string): boolean {
  return PLACEHOLDER_BRANDS.has(normalizeBrandKey(raw));
}

export function deriveCatalogBrands(products: readonly BrandProductInput[]): HomeBrand[] {
  const buckets = new Map<string, { counts: Map<string, number>; total: number }>();

  for (const product of products) {
    if (product.active === false) continue;
    const cleaned = product.brand.trim().replace(/\s+/g, " ");
    const key = cleaned.toLowerCase();
    if (PLACEHOLDER_BRANDS.has(key)) continue;

    let entry = buckets.get(key);
    if (!entry) {
      entry = { counts: new Map(), total: 0 };
      buckets.set(key, entry);
    }
    entry.total += 1;
    entry.counts.set(cleaned, (entry.counts.get(cleaned) ?? 0) + 1);
  }

  const resolved = Array.from(buckets.entries()).map(([key, entry]) => {
    let displayName = "";
    let bestCount = -1;
    for (const [variant, count] of entry.counts.entries()) {
      if (count > bestCount || (count === bestCount && variant.localeCompare(displayName) < 0)) {
        displayName = variant;
        bestCount = count;
      }
    }
    const logo = VERIFIED_BRAND_LOGOS[key];
    const brand: HomeBrand = logo ? { name: displayName, logo } : { name: displayName };
    return { key, total: entry.total, brand };
  });

  resolved.sort((a, b) => {
    const rankA = PRIORITY_RANK.get(a.key);
    const rankB = PRIORITY_RANK.get(b.key);
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;
    if (b.total !== a.total) return b.total - a.total;
    return a.brand.name.localeCompare(b.brand.name);
  });

  return resolved.map((item) => item.brand);
}