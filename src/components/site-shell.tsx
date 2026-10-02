import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Lock, Menu, MessageCircle, ShoppingCart, X } from "lucide-react";
import { useState } from "react";
import { navItems, socialLinks } from "@/lib/site-data";
import { useCart } from "@/lib/cart";

function Brand({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="JAV Wireless, inicio">
      <span className="grid size-9 place-items-center rounded-md bg-primary font-display text-lg font-bold text-primary-foreground">J</span>
      <span className={`font-display text-xl font-bold ${light ? "text-primary-foreground" : "text-primary"}`}>JAV <span className="text-accent">Wireless</span></span>
    </Link>
  );
}

function CartLink({ onClick }: { onClick?: () => void }) {
  const { count } = useCart();
  return (
    <Link to="/carrito" onClick={onClick} className="relative inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:border-primary hover:text-primary" aria-label={`Carrito (${count})`}>
      <ShoppingCart className="size-4" /> <span className="hidden sm:inline">Carrito</span>
      <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-accent-foreground">{count}</span>
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="bg-primary text-primary-foreground"><p className="container-page py-1.5 text-center text-xs font-medium">Envíos con seguimiento · Recogida en tienda · Financiamiento disponible</p></div>
      <div className="container-page flex h-16 items-center gap-3">
        <Brand />
        <nav className="ml-auto hidden items-center xl:flex" aria-label="Navegación principal">
          {navItems.map((item) => <Link key={item.to} to={item.to} activeOptions={{ exact: item.to === "/" }} className="nav-link">{item.label}</Link>)}
        </nav>
        <div className="ml-auto flex items-center gap-2 xl:ml-2">
          <CartLink />
          <Link to="/panel" className="hidden h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-navy-deep sm:inline-flex"><Lock className="size-4" /> Panel</Link>
          <button type="button" className="grid size-10 place-items-center rounded-md hover:bg-muted xl:hidden" onClick={() => setOpen((v) => !v)} aria-label={open ? "Cerrar menú" : "Abrir menú"}>{open ? <X /> : <Menu />}</button>
        </div>
      </div>
      {open && (
        <nav className="grid gap-1 border-t border-border bg-background p-4 xl:hidden" aria-label="Navegación móvil">
          {navItems.map((item) => <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 font-semibold hover:bg-muted">{item.label}</Link>)}
          <Link to="/panel" onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 font-semibold text-primary hover:bg-muted">Panel administrativo</Link>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-10 bg-navy-deep text-primary-foreground">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2"><Brand light /><p className="mt-4 max-w-md text-sm leading-6 opacity-75">Teléfonos, accesorios, perfumes, joyería y servicios para tu día a día, con atención cercana y confiable.</p>
          <div className="mt-5 flex gap-2">
            <SocialLink href={socialLinks.whatsapp} label="WhatsApp"><MessageCircle /></SocialLink>
            <SocialLink href={socialLinks.facebook} label="Facebook"><Facebook /></SocialLink>
            <SocialLink href={socialLinks.instagram} label="Instagram"><Instagram /></SocialLink>
            <SocialLink href={socialLinks.tiktok} label="TikTok"><span className="text-xs font-bold">TikTok</span></SocialLink>
          </div>
        </div>
        <div><h3 className="font-bold">Tienda</h3><ul className="mt-3 space-y-2 text-sm opacity-80"><li><Link to="/productos">Productos</Link></li><li><Link to="/carrito">Carrito</Link></li><li><Link to="/seguimiento">Seguimiento de pedido</Link></li></ul></div>
        <div><h3 className="font-bold">Empresa</h3><ul className="mt-3 space-y-2 text-sm opacity-80"><li><Link to="/servicios">Servicios</Link></li><li><Link to="/nosotros">Nosotros</Link></li><li><Link to="/contacto">Contacto</Link></li></ul></div>
      </div>
      <div className="border-t border-primary-foreground/10 py-4 text-center text-xs opacity-70">© 2026 JAV Wireless. Todos los derechos reservados.</div>
    </footer>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className="grid h-10 min-w-10 place-items-center rounded-md border border-primary-foreground/20 px-2 transition hover:bg-primary-foreground/10 [&>svg]:size-4">{children}</a>;
}

export function WhatsAppFloat() {
  return <a href={socialLinks.whatsapp} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp" className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-success text-success-foreground shadow-lift transition hover:-translate-y-0.5"><MessageCircle className="size-6" /></a>;
}

export function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="border-b border-border bg-surface"><div className="container-page py-12 lg:py-16"><p className="eyebrow">{eyebrow}</p><h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-tight text-primary sm:text-5xl">{title}</h1><p className="mt-4 max-w-2xl text-muted-foreground sm:text-lg">{description}</p></div></section>;
}

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 className="mt-2 font-display text-3xl font-bold text-primary">{title}</h2>{description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}</div>{action}</div>;
}
