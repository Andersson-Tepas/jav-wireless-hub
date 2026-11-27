import * as Dialog from "@radix-ui/react-dialog";

import { useQuery } from "@tanstack/react-query";

import { Check, Search, ShoppingCart, X } from "lucide-react";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import { categoriesQuery, productsQuery, specsOf, type Product } from "@/lib/catalog";

import { money, useCart } from "@/lib/cart";

import { productImage, socialLinks } from "@/lib/site-data";


function useAddToCart() {
  const { add } = useCart();

  return (p: Product) =>
    add({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      image: p.image,
      stock: p.stock,
    });
}


function Availability({ stock }: { stock: number }) {
  if (stock <= 0)
    return (
      <span className="text-xs font-semibold text-destructive">
        Out of stock
      </span>
    );

  if (stock <= 5)
    return (
      <span className="text-xs font-semibold text-accent">
        Only {stock} left
      </span>
    );

  return (
    <span className="text-xs font-semibold text-success">
      In stock
    </span>
  );
}


export function ProductCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: () => void;
}) {
  const addToCart = useAddToCart();

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-lift">

      <button
        type="button"
        onClick={onOpen}
        className="relative aspect-square overflow-hidden bg-surface"
        aria-label={`View details for ${product.name}`}
      >
        <img
          src={productImage(product.image)}
          alt={product.name}
          loading="lazy"
          width={1024}
          height={1024}
          className="h-full w-full object-contain object-center p-3"
        />

        <div className="absolute left-3 top-3 flex flex-col gap-1">
          {product.is_offer && (
            <span className="rounded bg-accent px-2 py-1 text-[11px] font-bold uppercase text-accent-foreground">
              Sale
            </span>
          )}

          {product.is_new && (
            <span className="rounded bg-primary px-2 py-1 text-[11px] font-bold uppercase text-primary-foreground">
              New
            </span>
          )}
        </div>
      </button>

      <div className="flex flex-1 flex-col p-4">

        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {product.brand}
        </p>

        <h3 className="mt-1 line-clamp-1 font-bold text-foreground">
          {product.name}
        </h3>

        <div className="mt-2 flex items-baseline gap-2">

          <span className="text-xl font-extrabold text-primary">
            {money(Number(product.price))}
          </span>

          {product.old_price && (
            <span className="text-sm text-muted-foreground line-through">
              {money(Number(product.old_price))}
            </span>
          )}

        </div>

        <div className="mt-1">
          <Availability stock={product.stock} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">

          <Button
            variant="outline"
            size="sm"
            onClick={onOpen}
            className="min-w-0 h-auto min-h-9 px-2 text-center text-xs leading-tight whitespace-normal sm:px-3 sm:text-sm sm:whitespace-nowrap"
          >
            View details
          </Button>

          <Button
            size="sm"
            disabled={product.stock <= 0}
            onClick={() => addToCart(product)}
          >
            <ShoppingCart />
            Add
          </Button>

        </div>

      </div>

    </article>
  );
}


function ProductDialog({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const addToCart = useAddToCart();

  return (
    <Dialog.Root
      open={!!product}
      onOpenChange={(o) => !o && onClose()}
    >
      <Dialog.Portal>

        <Dialog.Overlay
          onClick={onClose}
          className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=open]:fade-in"
        />

        {product && (
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 grid max-h-[92vh] w-[calc(100%-1.5rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-background shadow-lift md:grid-cols-2"
          >

            <div className="flex min-w-0 items-center justify-center bg-surface p-4 sm:p-6">
              <img
                src={productImage(product.image)}
                alt={product.name}
                width={1024}
                height={1024}
                className="max-h-[45vh] w-full object-contain object-center sm:max-h-[65vh]"
              />
            </div>

            <div className="p-6 md:p-8">

              <Dialog.Close
                className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-background/90 text-foreground shadow-soft hover:text-accent"
                aria-label="Close"
              >
                <X className="size-5" />
              </Dialog.Close>

              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {product.brand} · {product.model}
              </p>

              <Dialog.Title className="mt-2 font-display text-3xl font-bold text-foreground">
                {product.name}
              </Dialog.Title>

              <div className="mt-3 flex items-baseline gap-3">

                <span className="text-3xl font-extrabold text-primary">
                  {money(Number(product.price))}
                </span>

                {product.old_price && (
                  <span className="text-muted-foreground line-through">
                    {money(Number(product.old_price))}
                  </span>
                )}

              </div>

              <div className="mt-1">
                <Availability stock={product.stock} />
              </div>

              <p className="mt-4 leading-7 text-muted-foreground">
                {product.description}
              </p>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">

                <div className="rounded-lg bg-surface p-3">
                  <dt className="text-muted-foreground">
                    Colors
                  </dt>
                  <dd className="font-semibold">
                    {product.colors.join(", ") || "—"}
                  </dd>
                </div>

                <div className="rounded-lg bg-surface p-3">
                  <dt className="text-muted-foreground">
                    Capacity / Size
                  </dt>
                  <dd className="font-semibold">
                    {product.capacity || "—"}
                  </dd>
                </div>

                <div className="rounded-lg bg-surface p-3">
                  <dt className="text-muted-foreground">
                    Stock
                  </dt>
                  <dd className="font-semibold">
                    {product.stock} units
                  </dd>
                </div>

                <div className="rounded-lg bg-surface p-3">
                  <dt className="text-muted-foreground">
                    Model
                  </dt>
                  <dd className="font-semibold">
                    {product.model || "—"}
                  </dd>
                </div>

              </dl>

              {product.features.length > 0 && (
                <>
                  <h4 className="mt-6 font-bold">
                    Features
                  </h4>

                  <ul className="mt-2 space-y-1.5">
                    {product.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="size-4 text-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {specsOf(product).length > 0 && (
                <>
                  <h4 className="mt-6 font-bold">
                    Specifications
                  </h4>

                  <dl className="mt-2 divide-y divide-border text-sm">
                    {specsOf(product).map((s) => (
                      <div
                        key={s.label}
                        className="flex justify-between py-2"
                      >
                        <dt className="text-muted-foreground">
                          {s.label}
                        </dt>

                        <dd className="font-semibold">
                          {s.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}

              {product.financing && (
                <p className="mt-5 rounded-lg border border-border bg-surface p-3 text-sm">
                  <strong className="text-primary">
                    Financing:
                  </strong>{" "}
                  {product.financing}
                </p>
              )}

              <div className="mt-6 grid gap-2 sm:grid-cols-2">

                <Button
                  disabled={product.stock <= 0}
                  onClick={() => {
                    addToCart(product);
                    onClose();
                  }}
                >
                  <ShoppingCart />
                  Add to cart
                </Button>

                <a
                  className="inline-flex h-11 items-center justify-center rounded-md border border-input px-5 text-sm font-semibold hover:border-primary hover:text-primary"
                  href={`${socialLinks.whatsapp}?text=${encodeURIComponent(
                    `Hello JAV Wireless, I’m interested in ${product.name}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ask about this item
                </a>

              </div>

            </div>

          </Dialog.Content>
        )}

      </Dialog.Portal>
    </Dialog.Root>
  );
}


export function ProductGrid({
  products,
  columns = "lg:grid-cols-4",
}: {
  products: Product[];
  columns?: string;
}) {
  const [selected, setSelected] = useState<Product | null>(null);

  if (!products.length)
    return (
      <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
        No matching products found.
      </p>
    );

  return (
    <>
      <div
        className={`grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 ${columns}`}
      >
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            onOpen={() => setSelected(p)}
          />
        ))}
      </div>

      <ProductDialog
        product={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}


export function useProducts() {
  return useQuery(productsQuery);
}


export function ProductBrowser({
  initialCategory = "",
}: {
  initialCategory?: string;
}) {
  const { data: products = [], isLoading } = useProducts();

  const { data: categories = [] } = useQuery(categoriesQuery);

  const [category, setCategory] = useState(initialCategory);

  const [q, setQ] = useState("");

  const [brand, setBrand] = useState("");

  const [maxPrice, setMaxPrice] = useState("");

  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const [sort, setSort] = useState("featured");


  const brands = useMemo(
    () =>
      [
        ...new Set(
          products
            .filter((p) => !category || p.category_id === category)
            .map((p) => p.brand)
        ),
      ].sort(),
    [products, category]
  );


  const list = useMemo(() => {

    const term = q.trim().toLowerCase();

    const r = products.filter(
      (p) =>
        (!category || p.category_id === category) &&
        (!term ||
          `${p.name} ${p.brand} ${p.model}`
            .toLowerCase()
            .includes(term)) &&
        (!brand || p.brand === brand) &&
        (!maxPrice || Number(p.price) <= Number(maxPrice)) &&
        (!onlyAvailable || p.stock > 0)
    );

    const s = [...r];

    if (sort === "price-asc")
      s.sort(
        (a, b) =>
          Number(a.price) - Number(b.price)
      );

    if (sort === "price-desc")
      s.sort(
        (a, b) =>
          Number(b.price) - Number(a.price)
      );

    if (sort === "new")
      s.sort(
        (a, b) =>
          Number(b.is_new) -
            Number(a.is_new) ||
          b.created_at.localeCompare(a.created_at)
      );

    if (sort === "featured")
      s.sort(
        (a, b) =>
          Number(b.is_featured) -
          Number(a.is_featured)
      );

    return s;

  }, [
    products,
    category,
    q,
    brand,
    maxPrice,
    onlyAvailable,
    sort,
  ]);


  return (
    <div>

      <div className="flex gap-2 overflow-x-auto pb-2">

        <button
          type="button"
          className="chip shrink-0"
          data-active={!category}
          onClick={() => {
            setCategory("");
            setBrand("");
          }}
        >
          All
        </button>

        {categories.map((c) => (
          <button
            type="button"
            key={c.id}
            className="chip shrink-0"
            data-active={category === c.id}
            onClick={() => {
              setCategory(c.id);
              setBrand("");
            }}
          >
            {c.name}
          </button>
        ))}

      </div>


      <div className="mt-4 grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">

        <label className="relative">

          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <input
            className="field pl-9"
            placeholder="Search products..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search"
          />

        </label>


        <select
          className="field"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          aria-label="Brand"
        >

          <option value="">
            All brands
          </option>

          {brands.map((b) => (
            <option key={b}>
              {b}
            </option>
          ))}

        </select>


        <select
          className="field"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          aria-label="Price"
        >

          <option value="">
            Any price
          </option>

          <option value="50">
            Up to $50
          </option>

          <option value="200">
            Up to $200
          </option>

          <option value="500">
            Up to $500
          </option>

          <option value="1000">
            Up to $1,000
          </option>

        </select>


        <select
          className="field"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort"
        >

          <option value="featured">
            Featured
          </option>

          <option value="new">
            Newest
          </option>

          <option value="price-asc">
            Price: low to high
          </option>

          <option value="price-desc">
            Price: high to low
          </option>

        </select>


        <label className="flex items-center gap-2 text-sm font-semibold">

          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) =>
              setOnlyAvailable(e.target.checked)
            }
            className="size-4 accent-primary"
          />

          In stock

        </label>

      </div>


      <p className="my-5 text-sm text-muted-foreground">
        {isLoading
          ? "Loading products..."
          : `${list.length} product${
              list.length === 1 ? "" : "s"
            }`}
      </p>


      {!isLoading && (
        <ProductGrid products={list} />
      )}

    </div>
  );
}