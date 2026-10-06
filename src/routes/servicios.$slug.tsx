import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PaymentPicker } from "@/components/payment-picker";
import { createServiceRequest, uploadBillImage, uploadTrafficTicketImage } from "@/lib/commerce.functions";
import { money } from "@/lib/cart";
import { paymentLabels } from "@/lib/site-data";
import { servicesQuery } from "@/lib/catalog";
import { billCarrierFees } from "@/lib/commerce.schemas";

type FormField = { name: string; label: string; type?: string; options?: string[] };
const f = (name: string, label: string, extra: Partial<FormField> = {}): FormField => ({ name, label, ...extra });

function transferFields(d: Record<string, string>): FormField[] {
  const list: FormField[] = [
    f("first_time", "Is this your first time sending money with us?", { options: ["Yes", "No"] }),
    f("platform", "Platform", { options: ["Barri", "Western Union / Vigo"] }),
  ];
  const wu = d["platform"] === "Western Union / Vigo";
  if (!d["first_time"] || !d["platform"]) return list;
  if (d["first_time"] === "No") list.push(f("sender_phone", "Registered Phone Number", { type: "tel" }), f("sender_name", "Sender Name"));
  else if (wu) list.push(f("sender_phone", "Phone Number", { type: "tel" }), f("sender_full_name", "Full Name"), f("sender_dob", "Date of Birth", { type: "date" }), f("sender_country", "Country of Residence"), f("sender_street", "Street and Number"), f("sender_zip", "ZIP Code"), f("sender_state", "State"), f("sender_city", "City"));
  else list.push(f("sender_phone", "Phone Number", { type: "tel" }), f("sender_first_name", "First Name"), f("sender_last_name", "Last Name"), f("sender_city", "City"), f("sender_zip", "ZIP Code"), f("sender_address", "Valid Address (street number + street name)"));
  if (wu) list.push(f("destination_country", "Destination Country"), f("destination_city", "Destination State / City"), f("recipient_first_name", "Recipient First Name"), f("recipient_second_name", "Recipient Second Name (optional)"), f("recipient_paternal_last_name", "Paternal Last Name"), f("recipient_maternal_last_name", "Maternal Last Name"), f("recipient_phone_code", "Recipient Phone Country Code"), f("recipient_phone", "Recipient Phone Number", { type: "tel" }), f("delivery_type", "Delivery / Service Type (optional, when applicable)"));
  else list.push(f("recipient_first_name", "Recipient First Name"), f("recipient_last_name", "Last Name"), f("recipient_second_last_name", "Second Last Name"), f("recipient_country", "Country"), f("recipient_state", "State"), f("recipient_phone", "Recipient Phone Number", { type: "tel" }), f("destination_country", "Destination Country"), f("delivery_method", "Delivery Method"), f("payer", "Payer"), f("currency", "Currency"));
  return list;
}
function repairFields(d: Record<string, string>): FormField[] {
  const list: FormField[] = [f("device_type", "Device Type", { options: ["Cell Phone", "Television", "Laptop", "Tablet", "Other"] })];
  if (d["device_type"] === "Other") list.push(f("specify_device", "Specify Device"));
  list.push(f("brand", "Brand"), f("model", "Model"), f("issue", "Problem / Issue Description", { type: "textarea" }));
  return list;
}
function topUpFields(d: Record<string, string>): FormField[] {
  const list: FormField[] = [f("topup_kind", "Top-Up", { options: ["International Top-Up", "U.S. Local Top-Up"] })];
  if (d["topup_kind"] === "International Top-Up") list.push(f("country", "Country"), f("number", "Phone Number", { type: "tel" }), f("carrier", "Carrier", { options: ["Tigo", "Claro", "Movistar", "Digicel"] }), f("topup_type", "Top-Up Type", { options: ["Regular Top-Up", "Super Package"] }));
  else if (d["topup_kind"] === "U.S. Local Top-Up") list.push(f("number", "Phone Number", { type: "tel" }));
  return list;
}
const utilityFields: FormField[] = [f("bill_image", "Upload Bill Image", { type: "file" }), f("po_box", "Company P.O. Box"), f("account", "Customer Account Number")];
const billFields: FormField[] = [f("carrier", "Company / Carrier", { options: Object.keys(billCarrierFees) })];

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
  const [payment, setPayment] = useState(service.amountField || service.fee ? "card" : "store");
  const [reference, setReference] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const isTransfer = service.slug === "envios-de-dinero";
  const isBill = service.slug === "pago-de-bills";
  const isTopUp = service.slug === "recargas";
    const isUtility = service.slug === "pago-de-utilidades";
  const isTrafficTicket = service.slug === "tickets-de-transito";
  const upload = useServerFn(uploadBillImage);
  const uploadTicket = useServerFn(uploadTrafficTicketImage);
  const [ticketImageNames, setTicketImageNames] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  async function pickBill(file?: File) {
    setFileError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setFileError("Use a JPG, PNG or WebP image."); return; }
    if (file.size > 5 * 1024 * 1024) { setFileError("The image must be 5 MB or smaller."); return; }
    setUploading(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer()); let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const r = await upload({ data: { contentType: file.type as "image/png", base64: btoa(bin) } });
      setDetails((d) => ({ ...d, bill_image: r.url, bill_image_name: file.name }));
    } catch (e) { console.error(e); setFileError("We couldn’t upload the image. Try again."); }
    finally { setUploading(false); }
  }
    async function pickTrafficTickets(files: FileList | null) {
    setFileError("");
    if (!files?.length) return;
    const selected = Array.from(files);
    if (selected.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setFileError("Use JPG, PNG or WebP images."); return; }
    if (selected.some((file) => file.size > 5 * 1024 * 1024)) { setFileError("Each image must be 5 MB or smaller."); return; }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of selected) {
        const buf = new Uint8Array(await file.arrayBuffer()); let bin = "";
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        const r = await uploadTicket({ data: { contentType: file.type as "image/png", base64: btoa(bin) } });
        urls.push(r.url);
      }
      setDetails((d) => ({ ...d, ticket_images: JSON.stringify(urls) }));
      setTicketImageNames(selected.map((file) => file.name));
    } catch (e) { console.error(e); setFileError("We couldn’t upload the images. Try again."); }
    finally { setUploading(false); }
  }
  const fields: FormField[] = isTrafficTicket ? [{ name: "ticket_images", label: "Upload Ticket Images", type: "file" }] : isTransfer ? transferFields(details) : isBill ? billFields : isTopUp ? topUpFields(details) : isUtility ? utilityFields : service.fields;
  const fee = isBill ? billCarrierFees[details["carrier"] ?? ""] ?? 0 : isUtility ? 2.5 : service.fee ?? 0;
  const amountLabel = isBill || isUtility ? "Bill Amount" : isTopUp ? "Amount" : isTransfer && details["platform"] === "Western Union / Vigo" ? "Amount to Send" : "Amount (USD)";
  const amountNum = amount ? Number(amount) : 0;
  const total = service.amountField || service.fee ? amountNum + fee : null;
  const sentDetails = Object.fromEntries(fields.map((x) => [x.name, details[x.name] ?? ""]));

  async function send() {
    setError("");
    if (payment === "zelle" && reference.trim().length < 3) { setError("Enter your Zelle confirmation number to continue."); return; }
    setSending(true);
    try {
      const r = await submit({ data: { ...contact, service_slug: service.slug, service_name: service.name, details: sentDetails, amount: total, payment_method: payment as "card", payment_reference: payment === "zelle" ? reference.trim() || undefined : undefined, return_origin: window.location.origin } });
      if (r.checkout_url) { window.location.assign(r.checkout_url); return; }
      setResult(r.reference); setStep("done");
    } catch (e) { setError(payment === "card" || payment === "paypal" ? "Online payment isn’t available for this request. Choose Zelle or Pay in store." : "We couldn’t submit your request. Check your information and try again."); console.error(e); }
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
            {fields.map((f) => (
              <Field key={f.name} label={f.label}>
                {f.type === "file" ? <div><input type="file" accept="image/jpeg,image/png,image/webp" multiple={isTrafficTicket} required={!details[f.name]} className="field py-2" onChange={(e) => isTrafficTicket ? void pickTrafficTickets(e.target.files) : void pickBill(e.target.files?.[0])} />{uploading && <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>}{isTrafficTicket ? ticketImageNames.length > 0 && !uploading && <p className="mt-1 text-xs text-success">Uploaded: {ticketImageNames.join(", ")}</p> : details["bill_image_name"] && !uploading && <p className="mt-1 text-xs text-success">Uploaded: {details["bill_image_name"]}</p>}{fileError && <p className="mt-1 text-xs text-destructive">{fileError}</p>}</div>
                  : f.options ? <select required className="field" value={details[f.name] ?? ""} onChange={(e) => setDetails({ ...details, [f.name]: e.target.value })}><option value="" disabled>Select…</option>{f.options.map((o) => <option key={o} value={o}>{o}{isBill ? ` (+${money(billCarrierFees[o]!)} fee)` : ""}</option>)}</select>
                  : f.type === "textarea" ? <textarea required maxLength={1000} className="field h-28 py-2" value={details[f.name] ?? ""} onChange={(e) => setDetails({ ...details, [f.name]: e.target.value })} />
                  : <input required={!/(optional|opcional)/i.test(f.label)} type={f.type ?? "text"} maxLength={200} className="field" value={details[f.name] ?? ""} onChange={(e) => setDetails({ ...details, [f.name]: e.target.value })} />}
              </Field>
            ))}
            {service.amountField && <Field label={amountLabel}><input required type="number" min={1} max={100000} step="0.01" className="field" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>}
            <Button type="submit" className="w-full" disabled={uploading}>Continue to review</Button>
          </form>
        )}

        {step === "review" && (
          <div>
            <h2 className="font-display text-2xl font-bold text-primary">Review your information</h2>
            <dl className="mt-4 divide-y divide-border text-sm">
              <Row k="Name" v={contact.customer_name} /><Row k="Phone" v={contact.phone} /><Row k="Email" v={contact.email} />
              {fields.map((f) => <Row key={f.name} k={f.label} v={isTrafficTicket && f.name === "ticket_images" ? ticketImageNames.join(", ") || "—" : f.type === "file" ? details["bill_image_name"] || "—" : details[f.name] || "—"} />)}
              {service.amountField && <Row k={amountLabel} v={money(amountNum)} />}
              {fee ? <Row k={isBill ? "Company fee" : "Service fee"} v={money(fee)} /> : null}
              {total !== null && <Row k="Total" v={money(total)} strong />}
            </dl>
            <div className="mt-6 flex gap-2"><Button variant="outline" onClick={() => setStep("form")}>Edit</Button><Button className="flex-1" onClick={() => setStep("payment")}>Continue to payment</Button></div>
          </div>
        )}

        {step === "payment" && (
          <form onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <h2 className="font-display text-2xl font-bold text-primary">Payment method</h2>
            {total !== null && <p className="mt-1 text-muted-foreground">Total due: <strong className="text-foreground">{money(total)}</strong></p>}
            <div className="mt-4"><PaymentPicker value={payment} onChange={(v) => { setPayment(v); setError(""); }} reference={reference} onReference={setReference} allowStore amount={total !== null ? money(total) : undefined} /></div>
            {error && <p className="mt-4 text-sm font-semibold text-destructive">{error}</p>}
            <div className="mt-6 flex gap-2"><Button type="button" variant="outline" onClick={() => setStep("review")}>Back</Button><Button type="submit" variant="accent" className="flex-1" disabled={sending}>{sending ? "Sending..." : "Submit request"}</Button></div>
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
