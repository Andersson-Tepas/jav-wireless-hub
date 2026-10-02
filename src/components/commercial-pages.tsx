import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, MapPin, MessageCircle, ShieldCheck, Sparkles, Truck, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageIntro, SectionHeading } from "@/components/site-shell";
import { ProductGrid, useProducts } from "@/components/product-catalog";
import { categoriesQuery } from "@/lib/catalog";
import { productImage, services, socialLinks } from "@/lib/site-data";
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
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-6xl">Todo lo que buscas, en un solo lugar.</h1>
            <p className="mt-5 max-w-lg text-lg text-primary-foreground/80">Teléfonos, accesorios, perfumes, joyería y más. Compra en línea y recoge en tienda o recíbelo en casa.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/productos" className={buttonVariants({ variant: "accent", size: "lg" })}>Ver todos los productos <ArrowRight /></Link>
              <Link to="/seguimiento" className="inline-flex h-12 items-center rounded-md border border-primary-foreground/30 px-6 font-semibold hover:bg-primary-foreground/10">Rastrear pedido</Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl bg-background shadow-lift"><img src={heroPhone} alt="Teléfono destacado en JAV Wireless" width={1024} height={1024} className="aspect-[4/3] w-full object-cover" /></div>
        </div>
      </section>

      <section className="border-b border-border bg-surface"><div className="container-page grid grid-cols-2 gap-4 py-5 text-sm font-semibold text-primary md:grid-cols-4">
        <span className="flex items-center gap-2"><Truck className="size-5 text-accent" /> Envío con seguimiento</span>
        <span className="flex items-center gap-2"><MapPin className="size-5 text-accent" /> Recogida en tienda</span>
        <span className="flex items-center gap-2"><ShieldCheck className="size-5 text-accent" /> Compra segura</span>
        <span className="flex items-center gap-2"><Sparkles className="size-5 text-accent" /> Financiamiento</span>
      </div></section>

      <section className="section-pad"><div className="container-page">
        <SectionHeading eyebrow="Categorías" title="Compra por categoría" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categories.map((c) => (
            <Link key={c.id} to="/productos" search={{ categoria: c.id }} className="group relative overflow-hidden rounded-xl border border-border bg-surface">
              {catImage(c.id) ? <img src={productImage(catImage(c.id)!)} alt="" loading="lazy" width={1024} height={1024} className="aspect-[4/3] w-full object-cover opacity-90 transition group-hover:scale-105" /> : <div className="aspect-[4/3]" />}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-deep/85 to-transparent p-3 font-bold text-primary-foreground">{c.name}</span>
            </Link>
          ))}
        </div>
      </div></section>

      {isLoading ? <p className="container-page pb-10 text-muted-foreground">Cargando productos...</p> : <>
        <HomeRow eyebrow="Selección" title="Productos destacados" items={featured} />
        <section className="bg-surface"><HomeRow eyebrow="Ofertas" title="Ofertas y promociones" items={offers} /></section>
        <HomeRow eyebrow="Populares" title="Más vendidos" items={best} />
        <section className="bg-surface"><HomeRow eyebrow="Recién llegados" title="Nuevos productos" items={fresh} /></section>
        <HomeRow eyebrow="Para ti" title="Te recomendamos" items={recommended} />
      </>}
      <div className="container-page pb-16 text-center"><Link to="/productos" className={buttonVariants({ size: "lg" })}>Ver todos los productos <ArrowRight /></Link></div>
    </>
  );
}

function HomeRow({ eyebrow, title, items }: { eyebrow: string; title: string; items: ReturnType<typeof useProducts>["data"] & object }) {
  if (!items.length) return null;
  return <div className="section-pad"><div className="container-page"><SectionHeading eyebrow={eyebrow} title={title} action={<Link to="/productos" className="text-sm font-semibold text-primary hover:text-accent">Ver todo →</Link>} /><ProductGrid products={items} /></div></div>;
}

export function ServicesPage() {
  return (
    <>
      <PageIntro eyebrow="Servicios" title="Servicios JAV Wireless" description="Elige un servicio, completa el formulario, selecciona cómo pagar y recibe tu número de referencia." />
      <section className="section-pad"><div className="container-page grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <Link key={s.slug} to="/servicios/$slug" params={{ slug: s.slug }} className="card-soft group flex flex-col p-6 transition hover:border-primary hover:shadow-lift">
            {s.slug === "envios-de-dinero" && <span className="mb-3 w-fit rounded bg-accent/10 px-2 py-1 text-xs font-bold text-accent">Transferencia de dinero</span>}
            <h2 className="text-xl font-bold text-primary">{s.name}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.short}</p>
            <p className="mt-4 text-sm font-semibold text-foreground">{s.cost}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:text-accent">Solicitar <ArrowRight className="size-4" /></span>
          </Link>
        ))}
      </div></section>
    </>
  );
}

export function FinancingPage() {
  const steps = ["Elige tu producto", "Completa la solicitud", "Recibe tu aprobación", "Estrena y paga a tu ritmo"];
  return <><PageIntro eyebrow="Financiamiento" title="Estrena hoy, paga a tu ritmo." description="Planes flexibles en teléfonos, joyería y productos seleccionados." /><section className="section-pad"><div className="container-page"><div className="grid gap-4 md:grid-cols-4">{steps.map((s, i) => <div key={s} className="card-soft p-6"><span className="font-display text-3xl font-bold text-accent">{i + 1}</span><h3 className="mt-3 font-bold text-primary">{s}</h3></div>)}</div><p className="mt-8 max-w-2xl text-muted-foreground">La aprobación, el pago inicial y las cuotas dependen del producto y la evaluación correspondiente.</p><Link to="/servicios/$slug" params={{ slug: "financiamiento" }} className={`${buttonVariants({ variant: "accent" })} mt-6`}>Solicitar financiamiento</Link></div></section></>;
}

export function RepairsPage() {
  const repairs = ["Pantalla y cristal", "Batería y puerto de carga", "Cámara, audio y micrófono", "Diagnóstico general"];
  return <><PageIntro eyebrow="Reparaciones" title="Reparación de celulares con garantía." description="Revisamos tu equipo, te explicamos el problema y confirmamos el costo antes de comenzar." /><section className="section-pad"><div className="container-page grid gap-10 lg:grid-cols-2"><div className="space-y-3">{repairs.map((r) => <div key={r} className="flex items-center gap-3 rounded-lg border border-border p-4"><CheckCircle2 className="size-5 text-success" /><span className="font-semibold">{r}</span></div>)}</div><div className="card-soft p-8"><h2 className="font-display text-2xl font-bold text-primary">Solicita tu reparación</h2><p className="mt-2 text-muted-foreground">Completa el formulario en línea y recibe un número de referencia para darle seguimiento.</p><Link to="/servicios/$slug" params={{ slug: "reparaciones" }} className={`${buttonVariants()} mt-6`}>Iniciar solicitud</Link></div></div></section></>;
}

export function AboutPage() {
  return <><PageIntro eyebrow="Nosotros" title="Atención cercana, productos confiables." description="JAV Wireless reúne tecnología, regalos y servicios esenciales para tu comunidad." /><section className="section-pad"><div className="container-page grid gap-6 md:grid-cols-3">{[{ icon: ShieldCheck, t: "Confianza", d: "Información clara y respaldo en cada compra." }, { icon: Users, t: "Cercanía", d: "Atención humana, en tienda y en línea." }, { icon: Sparkles, t: "Calidad", d: "Productos y servicios seleccionados." }].map((v) => <div key={v.t} className="card-soft p-6"><v.icon className="size-7 text-accent" /><h3 className="mt-4 text-lg font-bold text-primary">{v.t}</h3><p className="mt-2 text-muted-foreground">{v.d}</p></div>)}</div></section></>;
}

export function ContactPage() {
  return <><PageIntro eyebrow="Contacto" title="Estamos para ayudarte." description="Escríbenos para consultar productos, servicios o el estado de tu pedido." /><section className="section-pad"><div className="container-page grid gap-6 md:grid-cols-3"><a href={socialLinks.whatsapp} target="_blank" rel="noreferrer" className="card-soft p-6 hover:border-primary"><MessageCircle className="size-7 text-success" /><h3 className="mt-4 font-bold text-primary">WhatsApp</h3><p className="mt-1 text-sm text-muted-foreground">Respuesta directa</p></a><div className="card-soft p-6"><MapPin className="size-7 text-accent" /><h3 className="mt-4 font-bold text-primary">Visítanos</h3><p className="mt-1 text-sm text-muted-foreground">Dirección disponible al consultar</p></div><Link to="/seguimiento" className="card-soft p-6 hover:border-primary"><Truck className="size-7 text-primary" /><h3 className="mt-4 font-bold text-primary">Mi pedido</h3><p className="mt-1 text-sm text-muted-foreground">Consulta el estado de tu compra</p></Link></div></section></>;
}
