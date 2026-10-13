import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { PageIntro, SectionHeading } from "@/components/site-shell";
import { ProductGrid, useProducts } from "@/components/product-catalog";
import { categoriesQuery, type Product, servicesQuery } from "@/lib/catalog";
import { productImage, socialLinks } from "@/lib/site-data";
import { getBestSellerProductId } from "@/lib/commerce.functions";

export function HomePage() {
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useQuery(categoriesQuery);

  const {
    data: bestSellerData,
    isLoading: isBestSellerLoading,
  } = useQuery({
    queryKey: ["home-best-seller"],
    queryFn: async () => {
      try {
        return await getBestSellerProductId();
      } catch (error) {
        console.error("Could not load home best seller", error);

        return {
          product_id: null,
          quantity: 0,
        };
      }
    },
    retry: false,
    staleTime: 60 * 1000,
  });

  const featured = products
    .filter((p) => p.is_featured)
    .slice(0, 4);

  const best = products
    .filter((p) => p.is_bestseller)
    .slice(0, 4);

  const fresh = products
    .filter((p) => p.is_new)
    .slice(0, 4);

  const offers = products
    .filter((p) => p.is_offer)
    .slice(0, 4);

  const recommended = [...products]
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 4);

  const catImage = (id: string) =>
    products.find((p) => p.category_id === id)?.image;

  const automaticBestSeller =
    bestSellerData?.product_id
      ? products.find(
          (p) =>
            p.id === bestSellerData.product_id &&
            p.stock > 0,
        )
      : undefined;

  const heroProduct =
    automaticBestSeller ??
    featured.find((p) => p.stock > 0) ??
    best.find((p) => p.stock > 0) ??
    fresh.find((p) => p.stock > 0) ??
    products.find((p) => p.stock > 0) ??
    products[0];

  const heroBadge = automaticBestSeller
    ? "Best seller"
    : heroProduct?.is_featured
      ? "Featured"
      : heroProduct?.is_bestseller
        ? "Best seller"
        : heroProduct?.is_new
          ? "New arrival"
          : "Featured product";

  const heroReady =
    !isLoading &&
    !isBestSellerLoading &&
    !!heroProduct;

  return (
    <>
      <section className="bg-primary text-primary-foreground">
        <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-20">

          {/* Texto principal */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground/70">
              JAV Wireless
            </p>

            <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-6xl">
              Everything you need, all in one place.
            </h1>

            <p className="mt-5 max-w-lg text-lg text-primary-foreground/80">
              Phones, accessories, fragrances, jewelry, and more. Shop online
              for in-store pickup or home delivery.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/productos"
                className={buttonVariants({
                  variant: "accent",
                  size: "lg",
                })}
              >
                View all products
                <ArrowRight />
              </Link>

              <Link
                to="/seguimiento"
                className="inline-flex h-12 items-center rounded-md border border-primary-foreground/30 px-6 font-semibold hover:bg-primary-foreground/10"
              >
                Track order
              </Link>
            </div>
          </div>

          {/* Producto destacado */}
          {heroReady ? (
            <Link
              to="/productos"
              search={{
                categoria: heroProduct.category_id,
              }}
              className="group relative block overflow-hidden rounded-2xl bg-background shadow-lift"
              aria-label={`Shop ${heroProduct.name}`}
            >
              <img
                src={productImage(heroProduct.image)}
                alt={heroProduct.name}
                width={1024}
                height={1024}
                className="aspect-[4/3] w-full object-contain p-6 transition duration-500 group-hover:scale-[1.03] sm:p-8"
              />

              {/* Degradado */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

              {/* Badge */}
              <span className="absolute left-4 top-4 rounded-full bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-accent-foreground shadow-soft">
                {heroBadge}
              </span>

              {/* Product information */}
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-6">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-2xl font-bold text-white sm:text-3xl">
                    {heroProduct.name}
                  </h2>
                </div>

                <span className="inline-flex shrink-0 items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-bold text-primary transition group-hover:bg-accent group-hover:text-accent-foreground">
                  Shop
                  <ArrowRight className="size-4" />
                </span>
              </div>
            </Link>
          ) : (
            <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-white/10 shadow-lift" />
          )}
        </div>
      </section>

      {/* Beneficios */}
      <section className="border-b border-border bg-surface">
        <div className="container-page grid grid-cols-2 gap-4 py-5 text-sm font-semibold text-primary md:grid-cols-4">
          <span className="flex items-center gap-2">
            <Truck className="size-5 text-accent" />
            Trackable shipping
          </span>

          <span className="flex items-center gap-2">
            <MapPin className="size-5 text-accent" />
            In-store pickup
          </span>

          <span className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-accent" />
            Secure checkout
          </span>

          <span className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" />
            Financing
          </span>
        </div>
      </section>

      {/* Categories */}
      <section className="section-pad">
        <div className="container-page">
          <SectionHeading
            eyebrow="Categories"
            title="Shop by category"
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/productos"
                search={{
                  categoria: c.id,
                }}
                className="group relative overflow-hidden rounded-xl border border-border bg-surface"
              >
                {catImage(c.id) ? (
                  <img
                    src={productImage(catImage(c.id)!)}
                    alt=""
                    loading="lazy"
                    width={1024}
                    height={1024}
                    className="aspect-[4/3] w-full object-cover opacity-90 transition group-hover:scale-105"
                  />
                ) : (
                  <div className="aspect-[4/3]" />
                )}

                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-deep/85 to-transparent p-3 font-bold text-primary-foreground">
                  {c.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Productos */}
      {isLoading ? (
        <p className="container-page pb-10 text-muted-foreground">
          Loading products...
        </p>
      ) : (
        <>
          <HomeRow
            eyebrow="Featured"
            title="Featured products"
            items={featured}
          />

          <section className="bg-surface">
            <HomeRow
              eyebrow="Deals"
              title="Deals and promotions"
              items={offers}
            />
          </section>

          <HomeRow
            eyebrow="Popular"
            title="Best sellers"
            items={best}
          />

          <section className="bg-surface">
            <HomeRow
              eyebrow="New arrivals"
              title="New products"
              items={fresh}
            />
          </section>

          <HomeRow
            eyebrow="For you"
            title="Recommended for you"
            items={recommended}
          />
        </>
      )}

      <div className="container-page pb-16 text-center">
        <Link
          to="/productos"
          className={buttonVariants({
            size: "lg",
          })}
        >
          View all products
          <ArrowRight />
        </Link>
      </div>
    </>
  );
}

function HomeRow({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string;
  title: string;
  items: Product[];
}) {
  if (!items.length) return null;

  return (
    <div className="section-pad">
      <div className="container-page">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          action={
            <Link
              to="/productos"
              className="text-sm font-semibold text-primary hover:text-accent"
            >
              View all &rarr;
            </Link>
          }
        />

        <ProductGrid products={items} />
      </div>
    </div>
  );
}