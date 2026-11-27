import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, MapPin, Truck } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageIntro } from "@/components/site-shell";
import { PaymentPicker } from "@/components/payment-picker";
import { createOrder } from "@/lib/commerce.functions";
import { money, useCart, type CartItem } from "@/lib/cart";
import { deliveryLabels, paymentLabels, productImage, statusLabels } from "@/lib/site-data";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — JAV Wireless" }, { name: "description", content: "Enter your information and choose delivery and payment options." }, { property: "og:title", content: "Checkout — JAV Wireless" }, { property: "og:description", content: "Complete your purchase at JAV Wireless." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: CheckoutPage,
});

type Done = { order_number: string; items: CartItem[]; total: number; payment: string; delivery: string; status: string; email: string };

function CheckoutPage() {
  const { items, total, clear } = useCart();
  const submit = useServerFn(createOrder);
  const [form, setForm] = useState({ customer_name: "", email: "", phone: "", address: "", notes: "" });
  const [delivery, setDelivery] = useState<"pickup" | "shipping">("pickup");
  const [payment, setPayment] = useState("card");
  const [reference, setReference] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setSending(true);
    try {
      const r = await submit({ data: { ...form, address: delivery === "shipping" ? form.address : undefined, notes: form.notes || undefined, delivery_method: delivery, payment_method: payment as "card", payment_reference: reference || undefined, return_origin: window.location.origin, items: items.map((i) => ({ id: i.id, quantity: i.quantity })) } });
      if (r.checkout_url) { clear(); window.location.assign(r.checkout_url); return; }
      setDone({ order_number: r.order_number, items, total, payment, delivery, status: payment === "zelle" ? "payment_pending" : "payment_confirmed", email: r.email });
      clear();
    } catch (err) {
      setError(err instanceof Error && err.message.length < 120 ? err.message : "We could not process your order. Please review your information.");
    } finally { setSending(false); }
  }

  if (done) return (
    <section className="section-pad"><div className="container-page max-w-2xl">
      <div className="card-soft p-8 text-center">
        <CheckCircle2 className="mx-auto size-14 text-success" />
        <h1 className="mt-4 font-display text-3xl font-bold text-primary">Thank you for your purchase!</h1>
        <p className="mt-2 text-muted-foreground">Order number</p>
        <p className="font-display text-4xl font-bold text-accent">{done.order_number}</p>
      </div>
      <div className="card-soft mt-6 p-6">
        <ul className="divide-y divide-border">{done.items.map((i) => <li key={i.id} className="flex justify-between py-2 text-sm"><span>{i.quantity} × {i.name}</span><span className="font-semibold">{money(i.price * i.quantity)}</span></li>)}</ul>
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Total</dt><dd className="text-lg font-bold text-primary">{money(done.total)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Payment method</dt><dd className="font-semibold">{paymentLabels[done.payment]}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd className="font-semibold">{deliveryLabels[done.delivery]}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd className="font-semibold text-accent">{statusLabels[done.status]}</dd></div>
        </dl>
        <Link to="/seguimiento" search={{ orden: done.order_number, contacto: done.email }} className={`${buttonVariants()} mt-6 w-full`}>Track my order</Link>
      </div>
    </div></section>
  );

  if (!items.length) return <section className="section-pad"><div className="container-page text-center"><p className="text-lg font-semibold">Your cart is empty.</p><Link to="/productos" className={`${buttonVariants()} mt-6`}>View products</Link></div></section>;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageIntro eyebrow="Checkout" title="Checkout" description="Enter your information, choose delivery, and select a payment method." />
      <section className="section-pad"><form onSubmit={onSubmit} className="container-page grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="card-soft p-6">
            <h2 className="font-display text-xl font-bold text-primary">1. Your information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold">Full name<input required minLength={2} maxLength={100} className="field" value={form.customer_name} onChange={set("customer_name")} /></label>
              <label className="grid gap-1.5 text-sm font-semibold">Phone<input required minLength={7} maxLength={30} type="tel" className="field" value={form.phone} onChange={set("phone")} /></label>
              <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">Email address<input required type="email" maxLength={255} className="field" value={form.email} onChange={set("email")} /></label>
            </div>
          </div>
          <div className="card-soft p-6">
            <h2 className="font-display text-xl font-bold text-primary">2. Delivery</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {([["pickup", MapPin, "In-store pickup", "Free · we’ll notify you when it’s ready"], ["shipping", Truck, "Shipping", "Includes tracking"]] as const).map(([id, Icon, label, sub]) => (
                <label key={id} className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${delivery === id ? "border-primary bg-primary/5" : "border-border"}`}>
                  <input type="radio" name="delivery" className="sr-only" checked={delivery === id} onChange={() => setDelivery(id)} />
                  <Icon className="size-5 text-primary" /><span><span className="block font-semibold">{label}</span><span className="text-xs text-muted-foreground">{sub}</span></span>
                </label>
              ))}
            </div>
            {delivery === "shipping" && <label className="mt-4 grid gap-1.5 text-sm font-semibold">Shipping address<input required minLength={6} maxLength={300} className="field" value={form.address} onChange={set("address")} placeholder="Street, unit number, city, ZIP code" /></label>}
            <label className="mt-4 grid gap-1.5 text-sm font-semibold">Notes (optional)<textarea maxLength={500} className="field h-20 py-2" value={form.notes} onChange={set("notes")} /></label>
          </div>
          <div className="card-soft p-6">
            <h2 className="font-display text-xl font-bold text-primary">3. Payment</h2>
            <div className="mt-4"><PaymentPicker value={payment} onChange={setPayment} reference={reference} onReference={setReference} amount={money(total)} /></div>
          </div>
        </div>
        <aside className="card-soft h-fit p-6 lg:sticky lg:top-28">
          <h2 className="font-display text-xl font-bold text-primary">Your order</h2>
          <ul className="mt-4 space-y-3">{items.map((i) => <li key={i.id} className="flex items-center gap-3 text-sm"><img src={productImage(i.image)} alt="" width={48} height={48} className="size-12 rounded bg-surface object-contain object-center p-1" /><span className="flex-1">{i.quantity} × {i.name}</span><span className="font-semibold">{money(i.price * i.quantity)}</span></li>)}</ul>
          <div className="mt-4 flex justify-between border-t border-border pt-4"><span className="font-bold">Total</span><span className="text-xl font-bold text-primary">{money(total)}</span></div>
          {error && <p className="mt-4 text-sm font-semibold text-destructive">{error}</p>}
          <Button type="submit" variant="accent" className="mt-6 w-full" disabled={sending}>{sending ? "Processing..." : "Confirm and pay"}</Button>
        </aside>
      </form></section>
    </>
  );
}
