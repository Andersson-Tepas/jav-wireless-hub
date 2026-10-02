import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, LayoutDashboard, Menu, MessageCircle, Radio, X } from "lucide-react";
import { useState } from "react";
import { navItems, socialLinks } from "@/lib/site-data";
import { Button } from "@/components/ui/button";

function Brand() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="JAV Wireless, inicio">
      <span className="grid size-10 place-items-center rounded-md border border-primary/50 bg-primary/10 text-primary shadow-glow">
        <Radio className="size-5" />
      </span>
      <span className="font-display text-lg font-black tracking-normal text-foreground">JAV <span className="text-primary">WIRELESS</span></span>
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto grid h-18 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 lg:flex lg:px-6">
        <Brand />
        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} activeOptions={{ exact: item.to === "/" }} className="nav-link">
              {item.label}
            </Link>
          ))}
          <Button asChild size="sm" variant="outline"><Link to="/dashboard"><LayoutDashboard className="size-4" /> Panel</Link></Button>
        </nav>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((value) => !value)} aria-label={open ? "Cerrar menú" : "Abrir menú"}>
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <nav className="grid gap-1 border-t border-border bg-background p-4 lg:hidden" aria-label="Navegación móvil">
          {navItems.map((item) => <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="nav-link-mobile">{item.label}</Link>)}
          <Link to="/dashboard" onClick={() => setOpen(false)} className="nav-link-mobile text-primary">Dashboard</Link>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-deep">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1fr_auto] md:items-end lg:px-6">
        <div><Brand /><p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">Tecnología, conectividad y soporte para mantenerte siempre cerca de lo que importa.</p></div>
        <div className="flex items-center gap-2">
          <SocialLink href={socialLinks.whatsapp} label="WhatsApp"><MessageCircle /></SocialLink>
          <SocialLink href={socialLinks.facebook} label="Facebook"><Facebook /></SocialLink>
          <SocialLink href={socialLinks.instagram} label="Instagram"><Instagram /></SocialLink>
          <SocialLink href={socialLinks.tiktok} label="TikTok"><span className="text-sm font-black">TT</span></SocialLink>
        </div>
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">© 2026 JAV Wireless. Todos los derechos reservados.</div>
    </footer>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className="grid size-10 place-items-center rounded-md border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-primary [&>svg]:size-4">{children}</a>;
}

export function WhatsAppFloat() {
  return <a href={socialLinks.whatsapp} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp" title="WhatsApp" className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-shipping text-shipping-foreground shadow-green transition hover:-translate-y-1"><MessageCircle className="size-6" /></a>;
}

export function PageIntro({ eyebrow, title, description, tone = "primary" }: { eyebrow: string; title: string; description: string; tone?: "primary" | "product" | "offer" | "finance" | "repair" | "shipping" }) {
  return <section className={`page-intro tone-${tone}`}><div className="mx-auto max-w-7xl px-4 py-16 lg:px-6 lg:py-24"><p className="eyebrow">{eyebrow}</p><h1 className="mt-4 max-w-4xl font-display text-4xl font-black leading-tight tracking-normal text-foreground sm:text-6xl">{title}</h1><p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{description}</p></div></section>;
}

export function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className="mb-8"><p className="eyebrow">{eyebrow}</p><h2 className="mt-3 font-display text-3xl font-black tracking-normal text-foreground sm:text-4xl">{title}</h2>{description && <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">{description}</p>}</div>;
}