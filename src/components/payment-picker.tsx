import { CreditCard, Store, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { zelleInfo } from "@/lib/site-data";
import { settingsQuery } from "@/lib/catalog";

const options = [
  { id: "card", label: "Tarjeta de débito/crédito", icon: CreditCard },
  { id: "paypal", label: "PayPal", icon: Wallet },
  { id: "zelle", label: "Zelle", icon: Wallet },
] as const;

export function PaymentPicker({ value, onChange, reference, onReference, allowStore, amount }: { value: string; onChange: (v: string) => void; reference: string; onReference: (v: string) => void; allowStore?: boolean | undefined; amount?: string | undefined }) {
  const { data: settings } = useQuery(settingsQuery);
  const zelle = { recipient: settings?.["zelle_recipient"] || zelleInfo.recipient, name: settings?.["zelle_name"] || zelleInfo.name };
  const list = allowStore ? [...options, { id: "store", label: "Pagar en tienda", icon: Store } as const] : options;
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((o) => (
          <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-semibold transition ${value === o.id ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/50"}`}>
            <input type="radio" name="payment" className="sr-only" checked={value === o.id} onChange={() => onChange(o.id)} />
            <o.icon className="size-5" /> {o.label}
          </label>
        ))}
      </div>
      {value === "card" && (
        <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
          <p className="text-xs text-muted-foreground sm:col-span-2">Pago de demostración: no se realizará ningún cobro real.</p>
          <input className="field sm:col-span-2" placeholder="Número de tarjeta" inputMode="numeric" maxLength={19} />
          <input className="field" placeholder="MM/AA" maxLength={5} />
          <input className="field" placeholder="CVC" maxLength={4} inputMode="numeric" />
        </div>
      )}
      {value === "paypal" && <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">Pago de demostración con PayPal: al confirmar se simulará la aprobación del pago.</p>}
      {value === "zelle" && (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4 text-sm">
          <p className="font-semibold text-foreground">Instrucciones para pagar con Zelle</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Abre Zelle desde la app de tu banco.</li>
            <li>Envía {amount ? <strong className="text-foreground">{amount}</strong> : "el monto total"} a <strong className="text-foreground">{zelle.recipient}</strong> ({zelle.name}).</li>
            <li>Copia el número de confirmación y escríbelo abajo.</li>
          </ol>
          <input className="field" placeholder="Número de confirmación de Zelle" value={reference} onChange={(e) => onReference(e.target.value)} maxLength={120} required />
          <p className="text-xs text-muted-foreground">JAV Wireless verificará el pago antes de procesar tu solicitud.</p>
        </div>
      )}
      {value === "store" && <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">Pagarás al visitar la tienda. Tu solicitud quedará registrada con un número de referencia.</p>}
    </div>
  );
}
