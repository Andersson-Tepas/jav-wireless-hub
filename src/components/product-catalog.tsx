import * as Dialog from "@radix-ui/react-dialog";
import { Check, PackageCheck, ShoppingBag, X } from "lucide-react";
import { products, socialLinks, type Product } from "@/lib/site-data";
import { Button } from "@/components/ui/button";

function ProductCard({ product }: { product: Product }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="group overflow-hidden rounded-lg border border-border bg-card text-left transition duration-300 hover:-translate-y-1 hover:border-product/60 hover:shadow-cyan" aria-label={`Ver detalles de ${product.name}`}>
          <div className="relative aspect-square overflow-hidden bg-surface-deep">
            <img src={product.image} alt={product.name} loading="lazy" width={1024} height={1024} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            {product.badge && <span className={product.badge === "Oferta" ? "badge-offer" : "badge-product"}>{product.badge}</span>}
          </div>
          <div className="p-5">
            <p className="text-xs font-bold uppercase text-product">{product.brand}</p>
            <h3 className="mt-2 text-xl font-bold text-foreground">{product.name}</h3>
            <div className="mt-4 flex items-end justify-between gap-3"><p className="text-2xl font-black text-foreground">${product.price}</p><span className="text-xs text-muted-foreground">{product.capacity}</span></div>
          </div>
        </button>
      </Dialog.Trigger>
      <ProductDialog product={product} />
    </Dialog.Root>
  );
}

function ProductDialog({ product }: { product: Product }) {
  const inquiry = `${socialLinks.whatsapp}?text=${encodeURIComponent(`Hola JAV Wireless, me interesa ${product.name}`)}`;
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 grid max-h-[92vh] w-[calc(100%-1.5rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-background shadow-modal md:grid-cols-[0.9fr_1.1fr]" aria-describedby={`description-${product.id}`}>
        <div className="min-h-72 bg-surface-deep"><img src={product.image} alt={product.name} width={1024} height={1024} className="h-full w-full object-cover" /></div>
        <div className="relative p-6 sm:p-8">
          <Dialog.Close asChild><Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label="Cerrar detalles"><X /></Button></Dialog.Close>
          <p className="pr-12 text-xs font-bold uppercase text-product">{product.brand} · {product.model}</p>
          <Dialog.Title className="mt-2 font-display text-3xl font-black text-foreground">{product.name}</Dialog.Title>
          <Dialog.Description id={`description-${product.id}`} className="mt-3 leading-7 text-muted-foreground">{product.description}</Dialog.Description>
          <div className="mt-5 flex flex-wrap items-center gap-3"><span className="text-3xl font-black text-foreground">${product.price}</span>{product.oldPrice && <span className="text-sm text-muted-foreground line-through">${product.oldPrice}</span>}<span className="stock-pill"><PackageCheck className="size-4" /> {product.stock} disponibles</span></div>
          <dl className="mt-6 grid grid-cols-2 gap-3">
            <div className="detail-box"><dt>Color</dt><dd>{product.color}</dd></div>
            <div className="detail-box"><dt>Capacidad</dt><dd>{product.capacity}</dd></div>
          </dl>
          <h3 className="mt-6 text-sm font-bold text-foreground">Características</h3>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">{product.features.map((feature) => <li key={feature} className="flex items-center gap-2"><Check className="size-4 text-product" />{feature}</li>)}</ul>
          <div className="mt-6 divide-y divide-border border-y border-border">{product.specs.map((spec) => <div key={spec.label} className="grid grid-cols-2 py-3 text-sm"><span className="text-muted-foreground">{spec.label}</span><span className="text-right font-semibold text-foreground">{spec.value}</span></div>)}</div>
          {product.financing && <div className="mt-5 rounded-md border border-finance/30 bg-finance/10 p-4 text-sm text-finance">Financiamiento disponible · {product.financing}</div>}
          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            <Button asChild variant="outline"><a href={inquiry} target="_blank" rel="noreferrer">Consultar</a></Button>
            <Button asChild variant="cyan"><a href={inquiry} target="_blank" rel="noreferrer"><ShoppingBag className="size-4" /> Comprar</a></Button>
            <Button asChild variant="danger"><a href={inquiry} target="_blank" rel="noreferrer">Reservar</a></Button>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function ProductCatalog({ limit }: { limit?: number }) {
  const shown = limit ? products.slice(0, limit) : products;
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{shown.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}