import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageIntro } from "@/components/site-shell";
import { money, useCart } from "@/lib/cart";
import { productImage } from "@/lib/site-data";

export const Route = createFileRoute("/carrito")({
  head: () => ({ meta: [{ title: "Carrito de compras — JAV Wireless" }, { name: "description", content: "Revisa los productos de tu carrito y procede al pago." }, { property: "og:title", content: "Carrito — JAV Wireless" }, { property: "og:description", content: "Tu carrito de compras en JAV Wireless." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: CartPage,
});

function CartPage() {
  const { items, total, setQty, remove } = useCart();
  return (
    <>
      <PageIntro eyebrow="Carrito" title="Tu carrito" description="Modifica cantidades o elimina productos antes de pagar." />
      <section className="section-pad"><div className="container-page">
        {!items.length ? (
          <div className="mx-auto max-w-md text-center"><ShoppingCart className="mx-auto size-12 text-muted-foreground" /><p className="mt-4 text-lg font-semibold">Tu carrito está vacío</p><Link to="/productos" className={`${buttonVariants()} mt-6`}>Explorar productos</Link></div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <ul className="divide-y divide-border rounded-xl border border-border">
              {items.map((i) => (
                <li key={i.id} className="flex gap-4 p-4">
                  <img src={productImage(i.image)} alt={i.name} width={96} height={96} className="size-20 rounded-lg bg-surface object-cover sm:size-24" />
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-3"><h3 className="font-bold">{i.name}</h3><span className="font-bold text-primary">{money(i.price * i.quantity)}</span></div>
                    <p className="text-sm text-muted-foreground">{money(i.price)} c/u</p>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex items-center rounded-md border border-border">
                        <button type="button" className="grid size-9 place-items-center hover:text-primary" onClick={() => setQty(i.id, i.quantity - 1)} aria-label="Disminuir"><Minus className="size-4" /></button>
                        <span className="w-8 text-center text-sm font-bold">{i.quantity}</span>
                        <button type="button" className="grid size-9 place-items-center hover:text-primary" onClick={() => setQty(i.id, i.quantity + 1)} aria-label="Aumentar"><Plus className="size-4" /></button>
                      </div>
                      <button type="button" onClick={() => remove(i.id)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /> Eliminar</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <aside className="card-soft h-fit p-6">
              <h2 className="font-display text-xl font-bold text-primary">Resumen</h2>
              <div className="mt-4 flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-semibold">{money(total)}</span></div>
              <div className="mt-2 flex justify-between border-t border-border pt-3"><span className="font-bold">Total</span><span className="text-xl font-bold text-primary">{money(total)}</span></div>
              <Link to="/checkout" className={`${buttonVariants({ variant: "accent" })} mt-6 w-full`}>Proceder al pago</Link>
              <Link to="/productos" className={`${buttonVariants({ variant: "outline" })} mt-2 w-full`}>Continuar comprando</Link>
            </aside>
          </div>
        )}
      </div></section>
    </>
  );
}
