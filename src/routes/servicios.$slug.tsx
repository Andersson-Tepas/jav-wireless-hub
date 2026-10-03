import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PaymentPicker } from "@/components/payment-picker";
import { createServiceRequest } from "@/lib/commerce.functions";
import { money } from "@/lib/cart";
import { paymentLabels } from "@/lib/site-data";
import { servicesQuery } from "@/lib/catalog";

export const Route = createFileRoute("/servicios/$slug")({
  loader: async ({ params, context }) => {
    const services = await context.queryClient.ensureQueryData(servicesQuery);
    const service = services.find((s) => s.slug === params.slug);
    if (!service) throw notFound();
    return { service };
  },
  head: ({ loaderData }) => loaderData ? { meta: [{ title: `${loaderData.service.name} — JAV Wireless` }, { name: "description", content: loaderData.service.short }, { property: "og:title", content: `${loaderData.service.name} — JAV Wireless` }, { property: "og:description", content: loaderData.service.description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] } : { meta: [{ title: "Service not found" }, { name: "robots", content: "noindex" }] },
  errorComponent: () => <div className="container-page py-20 text-center"><h1 className="font-display text-3xl font-bold text-primary">We couldn’t load this service</h1><Link to="/servicios" className={`${buttonVariants()} mt-6`}>View services</Link></div>,
  notFoundComponent: () => <div className="container-page py-20 text-center"><h1 className="font-display text-3xl font-bold text-primary">Service not found</h1><Link to="/servicios" className={`${buttonVariants()} mt-6`}>View services</Link></div>,
  component: ServiceDetail,
});

type Step = "form" | "review" | "payment" | "done";

function ServiceDetail() {
  const { service } = Route.useLoaderData();
  const submit = useServerFn(createServiceRequest);
  const [step, setStep] = useState<Step>("form");
  const [contact, setContact] = useState({ customer_name: "", email: "", phone: "" });
  const [details, setDetails] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState("card");
  const [reference, setReference] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const amountNum = amount ? Number(amount) : 0;
  const total = service.amountField || service.fee ? amountNum + (service.fee ?? 0) : null;

  async function send() {
    setError(""); setSending(true);
    try {
      const r = await submit({ data: { ...contact, service_slug: service.slug, service_name: service.name, details, amount: total, payment_method: payment as "card", payment_reference: reference || undefined, return_origin: window.location.origin } });
      if (r.checkout_url) { window.location.assign(r.checkout_url); return; }
      setResult(r.reference); setStep("done");
    } catch { setError("We couldn’t submit your request. Check your information and try again."); }
    finally { setSending(false); }
  }

  const steps: { id: Step; label: string }[] = [{ id: "form", label: "Form" }, { id: "review", label: "Review" }, { id: "payment", label: "Payment" }, { id: "done", label: "Confirmation" }];
  const idx = steps.findIndex((s) => s.id === step);

  return (
    <section className="section-pad"><div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
      <aside>
        <Link to="/servicios" className="text-sm font-semibold text-muted-foreground hover:text-primary">← All services</Link>
        {service.slug === "envios-de-dinero" && <p className="mt-4 w-fit rounded bg-accent/10 px-2 py-1 text-xs font-bold text-accent">Money transfer · not product shipping</p>}
        <h1 className="mt-3 font-display text-4xl font-bold text-primary">{service.name}</h1>
        <p className="mt-4 text-muted-foreground">{service.description}</p>
        <h2 className="mt-8 font-bold text-primary">Requirements</h2>
        <ul className="mt-3 space-y-2">{service.requirements.map((r) => <li key={r} className="flex gap-2 text-sm"><CheckCircle2 className="size-4 shrink-0 text-success" />{r}</li>)}</ul>
        <div className="mt-8 rounded-lg border border-border bg-surface p-4"><p className="text-sm text-muted-foreground">Cost</p><p className="font-bold text-primary">{service.cost}</p></div>
      </aside>

      <div className="card-soft p-6 sm:p-8">
        <ol className="mb-8 grid grid-cols-4 gap-2 text-xs font-semibold">{steps.map((s, i) => <li key={s.id} className={`border-t-4 pt-2 ${i <= idx ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{s.label}</li>)}</ol>

        {step === "form" && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setStep("review"); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name"><input required minLength={2} maxLength={100} className="field" value={contact.customer_name} onChange={(e) => setContact({ ...contact, customer_name: e.target.value })} /></Field>
              <Field label="Phone"><input required minLength={7} maxLength={30} type="tel" className="field" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></Field>
            </div>
            <Field label="Email address"><input required type="email" maxLength={255} className="field" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></Field>
            {service.fields.map((f) => (
              <Field key={f.name} label={f.label}>
                {f.type === "textarea" ? <textarea required maxLength={1000} className="field h-28 py-2" value={details[f.name] ?? ""} onChange={(e) => setDetails({ ...details, [f.name]: e.target.value })} />
                  : <input required={!/(optional|opcional)/i.test(f.label)} type={f.type ?? "text"} maxLength={200} className="field" value={details[f.name] ?? ""} onChange={(e) => setDetails({ ...details, [f.name]: e.target.value })} />}
              </Field>
            ))}
            {service.amountField && <Field label="Amount (USD)"><input required type="number" min={1} max={100000} step="0.01" className="field" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>}
            <Button type="submit" className="w-full">Continue to review</Button>
          </form>
        )}

        {step === "review" && (
          <div>
            <h2 className="font-display text-2xl font-bold text-primary">Review your information</h2>
            <dl className="mt-4 divide-y divide-border text-sm">
              <Row k="Name" v={contact.customer_name} /><Row k="Phone" v={contact.phone} /><Row k="Email" v={contact.email} />
              {service.fields.map((f) => <Row key={f.name} k={f.label} v={details[f.name] || "—"} />)}
              {service.amountField && <Row k="Amount" v={money(amountNum)} />}
              {service.fee ? <Row k="Service fee" v={money(service.fee)} /> : null}
              {total !== null && <Row k="Total" v={money(total)} strong />}
            </dl>
            <div className="mt-6 flex gap-2"><Button variant="outline" onClick={() => setStep("form")}>Edit</Button><Button className="flex-1" onClick={() => setStep("payment")}>Continue to payment</Button></div>
          </div>
        )}

        {step === "payment" && (
          <form onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <h2 className="font-display text-2xl font-bold text-primary">Payment method</h2>
            {total !== null && <p className="mt-1 text-muted-foreground">Total due: <strong className="text-foreground">{money(total)}</strong></p>}
            <div className="mt-4"><PaymentPicker value={payment} onChange={setPayment} reference={reference} onReference={setReference} allowStore amount={total !== null ? money(total) : undefined} /></div>
            {error && <p className="mt-4 text-sm font-semibold text-destructive">{error}</p>}
            <div className="mt-6 flex gap-2"><Button variant="outline" onClick={() => setStep("review")}>Back</Button><Button type="submit" variant="accent" className="flex-1" disabled={sending}>{sending ? "Sending..." : "Submit request"}</Button></div>
          </form>
        )}

        {step === "done" && (
          <div className="text-center">
            <CheckCircle2 className="mx-auto size-14 text-success" />
            <h2 className="mt-4 font-display text-2xl font-bold text-primary">Request submitted!</h2>
            <p className="mt-2 text-muted-foreground">Your reference number is</p>
            <p className="mt-2 font-display text-4xl font-bold text-accent">{result}</p>
            <p className="mt-4 text-sm text-muted-foreground">Payment: {paymentLabels[payment]}. Save this number to check its status in Tracking.</p>
            <Link to="/seguimiento" className={`${buttonVariants()} mt-6`}>Go to tracking</Link>
          </div>
        )}
      </div>
    </div></section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-semibold">{label}{children}</label>; }
function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) { return <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted-foreground">{k}</dt><dd className={strong ? "text-lg font-bold text-primary" : "font-semibold text-right"}>{v}</dd></div>; }
