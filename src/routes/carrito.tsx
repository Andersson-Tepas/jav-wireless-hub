import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageIntro } from "@/components/site-shell";
import { cartIdentity, selectionLabel } from "@/lib/variants";
import { money, useCart } from "@/lib/cart";
import { productImage } from "@/lib/site-data";

export const Route = createFileRoute("/carrito")({
  head: () => ({ meta: [{ title: "Shopping Cart — JAV Wireless" }, { name: "description", content: "Review the items in your cart and proceed to checkout." }, { property: "og:title", content: "Cart — JAV Wireless" }, { property: "og:description", content: "Your JAV Wireless shopping cart." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: CartPage,
});

function CartPage() {
  const { items, total, setQty, remove } = useCart();
  return (
    <>
      <PageIntro eyebrow="Cart" title="Your cart" description="Update quantities or remove products before checkout." />
      <section className="section-pad"><div className="container-page">
        {!items.length ? (
          <div className="mx-auto max-w-md text-center"><ShoppingCart className="mx-auto size-12 text-muted-foreground" /><p className="mt-4 text-lg font-semibold">Your cart is empty</p><Link to="/productos" className={`${buttonVariants()} mt-6`}>Browse products</Link></div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <ul className="divide-y divide-border rounded-xl border border-border">
              {items.map((i) => (
                <li key={cartIdentity(i)} className="flex gap-4 p-4">
                  <img src={productImage(i.image)} alt={i.name} width={96} height={96} className="size-20 rounded-lg bg-surface object-contain object-center p-1.5 sm:size-24" />
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-3"><h3 className="font-bold">{i.name}</h3><span className="font-bold text-primary">{money(i.price * i.quantity)}</span></div>
                    <p className="text-sm text-muted-foreground">{selectionLabel(i)}</p><p className="text-sm text-muted-foreground">{money(i.price)} each</p>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex items-center rounded-md border border-border">
                        <button type="button" className="grid size-9 place-items-center hover:text-primary" onClick={() => setQty(cartIdentity(i), i.quantity - 1)} aria-label="Decrease"><Minus className="size-4" /></button>
                        <span className="w-8 text-center text-sm font-bold">{i.quantity}</span>
                        <button type="button" className="grid size-9 place-items-center hover:text-primary" onClick={() => setQty(cartIdentity(i), i.quantity + 1)} aria-label="Increase"><Plus className="size-4" /></button>
                      </div>
                      <button type="button" onClick={() => remove(cartIdentity(i))} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /> Delete</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <aside className="card-soft h-fit p-6">
              <h2 className="font-display text-xl font-bold text-primary">Summary</h2>
              <div className="mt-4 flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-semibold">{money(total)}</span></div>
              <div className="mt-2 flex justify-between border-t border-border pt-3"><span className="font-bold">Total</span><span className="text-xl font-bold text-primary">{money(total)}</span></div>
              <Link to="/checkout" className={`${buttonVariants({ variant: "accent" })} mt-6 w-full`}>Proceed to checkout</Link>
              <Link to="/productos" className={`${buttonVariants({ variant: "outline" })} mt-2 w-full`}>Continue shopping</Link>
            </aside>
          </div>
        )}
      </div></section>
    </>
  );
}
