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

export function HomePage() {
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useQuery(categoriesQuery);
  const featured = products.filter((p) => p.is_featured).slice(0, 4);
  const best = products.filter((p) => p.is_bestseller).slice(0, 4);
  const fresh = products.filter((p) => p.is_new).slice(0, 4);
  const offers = products.filter((p) => p.is_offer).slice(0, 4);
  const recommended = [...products].sort((a, b) => b.stock - a.stock).slice(0, 4);
  const catImage = (id: string) => products.find((p) => p.category_id === id)?.image;

  return (
    <>
      <section className="bg-primary text-primary-foreground">
        <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground/70">JAV Wireless</p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-6xl">Everything you need, all in one place.</h1>
            <p className="mt-5 max-w-lg text-lg text-primary-foreground/80">Phones, accessories, fragrances, jewelry, and more. Shop online for in-store pickup or home delivery.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/productos" className={buttonVariants({ variant: "accent", size: "lg" })}>View all products <ArrowRight /></Link>
              <Link to="/seguimiento" className="inline-flex h-12 items-center rounded-md border border-primary-foreground/30 px-6 font-semibold hover:bg-primary-foreground/10">Track order</Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl bg-background shadow-lift"><img src={heroPhone} alt="Featured phone at JAV Wireless" width={1024} height={1024} className="aspect-[4/3] w-full object-cover" /></div>
        </div>
      </section>

      <section className="border-b border-border bg-surface"><div className="container-page grid grid-cols-2 gap-4 py-5 text-sm font-semibold text-primary md:grid-cols-4">
        <span className="flex items-center gap-2"><Truck className="size-5 text-accent" /> Trackable shipping</span>
        <span className="flex items-center gap-2"><MapPin className="size-5 text-accent" /> In-store pickup</span>
        <span className="flex items-center gap-2"><ShieldCheck className="size-5 text-accent" /> Secure checkout</span>
        <span className="flex items-center gap-2"><Sparkles className="size-5 text-accent" /> Financing</span>
      </div></section>

      <section className="section-pad"><div className="container-page">
        <SectionHeading eyebrow="Categories" title="Shop by category" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categories.map((c) => (
            <Link key={c.id} to="/productos" search={{ categoria: c.id }} className="group relative overflow-hidden rounded-xl border border-border bg-surface">
              {catImage(c.id) ? <img src={productImage(catImage(c.id)!)} alt="" loading="lazy" width={1024} height={1024} className="aspect-[4/3] w-full object-cover opacity-90 transition group-hover:scale-105" /> : <div className="aspect-[4/3]" />}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-deep/85 to-transparent p-3 font-bold text-primary-foreground">{c.name}</span>
            </Link>
          ))}
        </div>
      </div></section>

      {isLoading ? <p className="container-page pb-10 text-muted-foreground">Loading products...</p> : <>
        <HomeRow eyebrow="Featured" title="Featured products" items={featured} />
        <section className="bg-surface"><HomeRow eyebrow="Deals" title="Deals and promotions" items={offers} /></section>
        <HomeRow eyebrow="Popular" title="Best sellers" items={best} />
        <section className="bg-surface"><HomeRow eyebrow="New arrivals" title="New products" items={fresh} /></section>
        <HomeRow eyebrow="For you" title="Recommended for you" items={recommended} />
      </>}
      <div className="container-page pb-16 text-center"><Link to="/productos" className={buttonVariants({ size: "lg" })}>View all products <ArrowRight /></Link></div>
    </>
  );
}

function HomeRow({ eyebrow, title, items }: { eyebrow: string; title: string; items: Product[] }) {
  if (!items.length) return null;
  return <div className="section-pad"><div className="container-page"><SectionHeading eyebrow={eyebrow} title={title} action={<Link to="/productos" className="text-sm font-semibold text-primary hover:text-accent">View all →</Link>} /><ProductGrid products={items} /></div></div>;
}

export function ServicesPage() {
  const { data: services = [] } = useServicesQuery(servicesQuery);
  return (
    <>
      <PageIntro eyebrow="Services" title="JAV Wireless Services" description="Choose a service, complete the form, select a payment method, and receive your reference number." />
      <section className="section-pad"><div className="container-page grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <Link key={s.slug} to="/servicios/$slug" params={{ slug: s.slug }} className="card-soft group flex flex-col p-6 transition hover:border-primary hover:shadow-lift">
            {s.slug === "envios-de-dinero" && <span className="mb-3 w-fit rounded bg-accent/10 px-2 py-1 text-xs font-bold text-accent">Money transfer</span>}
            <h2 className="text-xl font-bold text-primary">{s.name}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.short}</p>
            <p className="mt-4 text-sm font-semibold text-foreground">{s.cost}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:text-accent">Request service <ArrowRight className="size-4" /></span>
          </Link>
        ))}
      </div></section>
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
  return <><PageIntro eyebrow="About Us" title="Friendly service. Dependable products." description="JAV Wireless brings technology, gifts, and essential services to your community." /><section className="section-pad"><div className="container-page grid gap-6 md:grid-cols-3">{[{ icon: ShieldCheck, t: "Trust", d: "Clear information and support with every purchase." }, { icon: Users, t: "Personal service", d: "Personal attention in store and online." }, { icon: Sparkles, t: "Quality", d: "Carefully selected products and services." }].map((v) => <div key={v.t} className="card-soft p-6"><v.icon className="size-7 text-accent" /><h3 className="mt-4 text-lg font-bold text-primary">{v.t}</h3><p className="mt-2 text-muted-foreground">{v.d}</p></div>)}</div></section></>;
}

export function ContactPage() {
  return <><PageIntro eyebrow="Contact" title="We’re here to help." description="Contact us with questions about products, services, or your order status." /><section className="section-pad"><div className="container-page grid gap-6 md:grid-cols-3"><a href={socialLinks.whatsapp} target="_blank" rel="noreferrer" className="card-soft p-6 hover:border-primary"><MessageCircle className="size-7 text-success" /><h3 className="mt-4 font-bold text-primary">WhatsApp</h3><p className="mt-1 text-sm text-muted-foreground">Direct support</p></a><div className="card-soft p-6"><MapPin className="size-7 text-accent" /><h3 className="mt-4 font-bold text-primary">Visit us</h3><p className="mt-1 text-sm text-muted-foreground">Address available upon request</p></div><Link to="/seguimiento" className="card-soft p-6 hover:border-primary"><Truck className="size-7 text-primary" /><h3 className="mt-4 font-bold text-primary">My order</h3><p className="mt-1 text-sm text-muted-foreground">Check your order status</p></Link></div></section></>;
}
