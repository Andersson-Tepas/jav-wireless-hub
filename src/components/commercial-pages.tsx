import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, MapPin, MessageCircle, ShieldCheck, Sparkles, Truck, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageIntro, SectionHeading } from "@/components/site-shell";
import { ProductGrid, useProducts } from "@/components/product-catalog";
import { categoriesQuery, type Product } from "@/lib/catalog";
import { productImage, socialLinks } from "@/lib/site-data";
import { servicesQuery } from "@/lib/catalog";
import { useQuery as useServicesQuery } from "@tanstack/react-query";
import heroPhone from "@/assets/phone-titanium.jpg";
import { money } from "@/lib/cart";
import { getBestSellerProductId } from "@/lib/commerce.functions";
export function HomePage() {
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useQuery(categoriesQuery);
  const { data: bestSellerData } = useQuery({
    queryKey: ["home-best-seller"],
    queryFn: async () => {
      try {
        return await getBestSellerProductId();
      } catch (error) {
        console.error("Could not load home best seller", error);
        return { product_id: null, quantity: 0 };
      }
    },
    retry: false,
    staleTime: 60 * 1000,
  });
  const featured = products.filter((p) => p.is_featured).slice(0, 4);
  const best = products.filter((p) => p.is_bestseller).slice(0, 4);
  const fresh = products.filter((p) => p.is_new).slice(0, 4);
  const offers = products.filter((p) => p.is_offer).slice(0, 4);
  const recommended = [...products]
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 4);
  const catImage = (id: string) =>
    products.find((p) => p.category_id === id)?.image;
  const automaticBestSeller =
    bestSellerData?.product_id
      ? products.find(
          (p) => p.id === bestSellerData.product_id && p.stock > 0,
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
                View all products <ArrowRight />
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
          {heroProduct ? (
            <Link
              to="/productos"
              search={{ categoria: heroProduct.category_id }}
              className="group relative block overflow-hidden rounded-2xl bg-background shadow-lift"
              aria-label={`Shop ${heroProduct.name}`}
            >
              <img
                src={productImage(heroProduct.image)}
                alt={heroProduct.name}
                width={1024}
                height={1024}
                className="aspect-[4/3] w-full object-contain p-6 sm:p-8 transition duration-500 group-hover:scale-[1.03]"
              />
              {/* Degradado para lectura */}
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
            <div className="overflow-hidden rounded-2xl bg-background shadow-lift">
              <img
                src={heroPhone}
                alt="Featured phone at JAV Wireless"
                width={1024}
                height={1024}
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
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
                search={{ categoria: c.id }}
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
          className={buttonVariants({ size: "lg" })}
        >
          View all products <ArrowRight />
        </Link>
      </div>
    </>
  );
}
function HomeRow({ eyebrow, title, items }: { eyebrow: string; title: string; items: Product[] }) {
  if (!items.length) return null;
  return <div className="section-pad"><div className="container-page"><SectionHeading eyebrow={eyebrow} title={title} action={<Link to="/productos" className="text-sm font-semibold text-primary hover:text-accent">View all &rarr;</Link>} /><ProductGrid products={items} /></div></div>;
}
export function ServicesPage() {
  const { data: services = [] } = useServicesQuery(servicesQuery);

  const publicServiceSlugs = new Set([
    "envios-de-dinero",
    "pago-de-bills",
    "pago-de-utilidades",
    "recargas",
    "tickets-de-transito",
    "financiamiento",
    "reparaciones",
    "vuelos",
  ]);

  const visibleServices = services.filter((service) =>
    publicServiceSlugs.has(service.slug),
  );

  return (
    <>
      <PageIntro
        eyebrow="Services"
        title="JAV Wireless Services"
        description="Choose a service, complete the form, select a payment method, and receive your reference number."
      />

      <section className="section-pad">
        <div className="container-page grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleServices.map((service) => (
            <Link
              key={service.slug}
              to="/servicios/$slug"
              params={{ slug: service.slug }}
              className="card-soft group flex flex-col p-6 transition hover:border-primary hover:shadow-lift"
            >
              {service.slug === "envios-de-dinero" && (
                <span className="mb-3 w-fit rounded bg-accent/10 px-2 py-1 text-xs font-bold text-accent">
                  Money transfer
                </span>
              )}

              <h2 className="text-xl font-bold text-primary">
                {service.name}
              </h2>

              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                {service.short}
              </p>

              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:text-accent">
                Request service
                <ArrowRight className="size-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
export function FinancingPage() {
  const steps = ["Choose your product", "Complete the application", "Get approved", "Get it now and pay over time"];
  return <><PageIntro eyebrow="Financing" title="Get it today. Pay over time." description="Flexible plans for phones, jewelry, and select products." /><section className="section-pad"><div className="container-page"><div className="grid gap-4 md:grid-cols-4">{steps.map((s, i) => <div key={s} className="card-soft p-6"><span className="font-display text-3xl font-bold text-accent">{i + 1}</span><h3 className="mt-3 font-bold text-primary">{s}</h3></div>)}</div><p className="mt-8 max-w-2xl text-muted-foreground">Approval, down payment, and installment terms depend on the product and eligibility review.</p><Link to="/servicios/$slug" params={{ slug: "financiamiento" }} className={`${buttonVariants({ variant: "accent" })} mt-6`}>Apply for financing</Link></div></section></>;
}
export function RepairsPage() {
  const repairs = ["Screen and glass", "Battery and charging port", "Camera, audio, and microphone", "General diagnostics"];
  return <><PageIntro eyebrow="Repairs" title="Phone repairs backed by a warranty." description="We inspect your device, explain the issue, and confirm the cost before work begins." /><section className="section-pad"><div className="container-page grid gap-10 lg:grid-cols-2"><div className="space-y-3">{repairs.map((r) => <div key={r} className="flex items-center gap-3 rounded-lg border border-border p-4"><CheckCircle2 className="size-5 text-success" /><span className="font-semibold">{r}</span></div>)}</div><div className="card-soft p-8"><h2 className="font-display text-2xl font-bold text-primary">Request a repair</h2><p className="mt-2 text-muted-foreground">Complete the online form and receive a reference number to track your request.</p><Link to="/servicios/$slug" params={{ slug: "reparaciones" }} className={`${buttonVariants()} mt-6`}>Start request</Link></div></div></section></>;
}
export function AboutPage() {
  return (
    <>
      <PageIntro
        eyebrow="About Us"
        title="JAV Wireless Offers the Services and Products You Need, All in One Place"
        description="From money transfers and bill payments to phone repairs, financing, flights, mobile top-ups, technology, accessories, fragrances, jewelry, and more, JAV Wireless makes it easier to find the products and services you need in one place."
      />

      <section className="section-pad">
        <div className="container-page">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                t: "Convenient Services",
                d: "Money transfers, bill payments, mobile top-ups, financing, flights, repairs, and more.",
              },
              {
                icon: Users,
                t: "Personal Attention",
                d: "Friendly assistance in-store and online to help you with your everyday needs.",
              },
              {
                icon: Sparkles,
                t: "Everything in One Place",
                d: "Technology, accessories, fragrances, jewelry, services, and essential solutions for the community.",
              },
            ].map((v) => (
              <div key={v.t} className="card-soft p-6">
                <v.icon className="size-7 text-accent" />

                <h3 className="mt-4 text-lg font-bold text-primary">
                  {v.t}
                </h3>

                <p className="mt-2 text-muted-foreground">
                  {v.d}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-border bg-surface p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="size-6 text-accent" />

                  <h2 className="font-display text-2xl font-bold text-primary">
                    Visit Us
                  </h2>
                </div>

                <p className="mt-3 text-muted-foreground">
                  61 Pine Aire Dr, Bay Shore, NY 11706
                </p>

                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Visit JAV Wireless for products, services, repairs, financing,
                  money transfers, bill payments, and more.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="https://www.google.com/maps/search/?api=1&query=61+Pine+Aire+Dr%2C+Bay+Shore%2C+NY+11706"
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline" })}
                >
                  <MapPin className="size-4" />
                  Get Directions
                </a>

                <a
                  href={socialLinks.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "accent" })}
                >
                  <MessageCircle className="size-4" />
                  Contact Us
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
export function ContactPage() {
return (
  <>
    <PageIntro
      eyebrow="Contact"
      title="We're here to help."
      description="Contact us with questions about products, services, or your order status."
    />
    <section className="section-pad">
      <div className="container-page grid gap-6 md:grid-cols-3">
        <a
          href={socialLinks.whatsapp}
          target="_blank"
          rel="noreferrer"
          className="card-soft p-6 hover:border-primary"
        >
          <MessageCircle className="size-7 text-success" />
          <h3 className="mt-4 font-bold text-primary">
            WhatsApp
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Direct support
          </p>
        </a>
        <a
          href="https://www.google.com/maps/search/?api=1&query=61+Pine+Aire+Dr%2C+Bay+Shore%2C+NY+11706"
          target="_blank"
          rel="noreferrer"
          className="card-soft p-6 hover:border-primary"
        >
          <MapPin className="size-7 text-accent" />
          <h3 className="mt-4 font-bold text-primary">
            Visit us
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            61 Pine Aire Dr, Bay Shore, NY 11706
          </p>
        </a>
        <Link
          to="/seguimiento"
          className="card-soft p-6 hover:border-primary"
        >
          <Truck className="size-7 text-primary" />
          <h3 className="mt-4 font-bold text-primary">
            My order
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Check your order status
          </p>
        </Link>
      </div>
    </section>
  </>
);}
