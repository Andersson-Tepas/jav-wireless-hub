import phoneGraphite from "@/assets/phone-graphite.jpg";
import phoneTitanium from "@/assets/phone-titanium.jpg";
import phoneFold from "@/assets/phone-fold.jpg";
import earbuds from "@/assets/earbuds.jpg";
import perfume from "@/assets/perfume.jpg";
import jewelry from "@/assets/jewelry.jpg";
import suit from "@/assets/suit.jpg";
import tools from "@/assets/tools.jpg";
import gift from "@/assets/gift.jpg";
import charger from "@/assets/charger.jpg";

export const navItems = [
  { label: "Home", to: "/" },
  { label: "Products", to: "/productos" },
  { label: "Services", to: "/servicios" },
  { label: "Financing", to: "/financiamiento" },
  { label: "Repairs", to: "/reparaciones" },
  { label: "Tracking", to: "/seguimiento" },
  { label: "About Us", to: "/nosotros" },
  { label: "Contact", to: "/contacto" },
] as const;

// Editable contact data (sample values until the real ones are provided)
export const socialLinks = {
  whatsapp: "https://wa.me/",
  facebook: "https://www.facebook.com/",
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/",
};

export const zelleInfo = {
  recipient: "pagos@javwireless.com",
  name: "JAV Wireless",
};

const localImages: Record<string, string> = {
  "phone-graphite": phoneGraphite,
  "phone-titanium": phoneTitanium,
  "phone-fold": phoneFold,
  earbuds,
  perfume,
  jewelry,
  suit,
  tools,
  gift,
  charger,
};

export function productImage(key: string) {
  return localImages[key] ?? (key.startsWith("http") ? key : phoneGraphite);
}

export const paymentLabels: Record<string, string> = { card: "Debit/credit card", paypal: "PayPal", zelle: "Zelle", store: "Pay in store" };
export const deliveryLabels: Record<string, string> = { pickup: "In-store pickup", shipping: "Shipping" };

export const statusLabels: Record<string, string> = {
  received: "Order received",
  payment_pending: "Payment pending",
  payment_confirmed: "Payment confirmed",
  preparing: "Preparing",
  prepared: "Prepared",
  handed_to_carrier: "Handed to carrier",
  in_transit: "In transit",
  ready_for_pickup: "Ready for pickup",
  picked_up: "Picked up",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const statusFlows: Record<string, string[]> = {
  pickup: ["received", "payment_confirmed", "preparing", "ready_for_pickup", "picked_up"],
  shipping: ["received", "payment_confirmed", "preparing", "handed_to_carrier", "in_transit", "delivered"],
};

export function timelineFor(delivery: string, status: string) {
  const flow = [...(statusFlows[delivery] ?? statusFlows["pickup"] ?? [])];
  if (status === "payment_pending") flow.splice(1, 0, "payment_pending");
  if (status === "prepared") flow.splice(flow.indexOf("preparing") + 1, 0, "prepared");
  return { flow, current: Math.max(0, flow.indexOf(status)) };
}

export const allStatusesFor = (delivery: string) => ["received", "payment_pending", "payment_confirmed", "preparing", "prepared", ...(delivery === "shipping" ? ["handed_to_carrier", "in_transit", "delivered"] : ["ready_for_pickup", "picked_up"]), "cancelled"];

export const serviceStatusLabels: Record<string, string> = { received: "Request received", in_review: "Under review", processing: "In progress", completed: "Completed", cancelled: "Cancelled" };

export type ServiceField = { name: string; label: string; type?: "text" | "number" | "textarea" | "date"; placeholder?: string };
export type Service = { slug: string; name: string; short: string; description: string; requirements: string[]; cost: string; fee?: number; amountField?: boolean; fields: ServiceField[] };

/** Seed reference only — live services are read from the database (servicesQuery). */
export const services: Service[] = [
  { slug: "envios-de-dinero", name: "Envíos de dinero", short: "Remesas nacionales e internacionales (no es envío de productos).", description: "Envía dinero a familiares y amigos de forma rápida y segura. Este servicio es para transferencias de dinero, no para envíos de paquetes.", requirements: ["Identificación oficial vigente", "Full name y teléfono del beneficiario", "País y ciudad de destino"], cost: "Comisión desde $5 según destino y monto", fee: 5, amountField: true, fields: [{ name: "beneficiary", label: "Name del beneficiario" }, { name: "beneficiary_phone", label: "Phone del beneficiario" }, { name: "destination", label: "País y ciudad de destino" }] },
  { slug: "pago-de-bills", name: "Pago de bills", short: "Paga tus facturas en un solo lugar.", description: "Realizamos el pago de tus facturas de teléfono, internet, cable, tarjetas y más.", requirements: ["Número de cuenta o factura", "Name de la compañía", "Amount a pagar"], cost: "Service fee de $2", fee: 2, amountField: true, fields: [{ name: "company", label: "Compañía" }, { name: "account", label: "Número de cuenta" }] },
  { slug: "pago-de-utilidades", name: "Pago de utilidades", short: "Luz, agua y gas sin filas.", description: "Pagamos tus servicios de electricidad, agua y gas de manera inmediata.", requirements: ["Número de cuenta de la utilidad", "Name del titular", "Amount"], cost: "Service fee de $2", fee: 2, amountField: true, fields: [{ name: "utility", label: "Servicio (luz, agua, gas)" }, { name: "account", label: "Número de cuenta" }, { name: "holder", label: "Name del titular" }] },
  { slug: "recargas", name: "Recargas", short: "Recargas nacionales e internacionales.", description: "Recarga saldo a cualquier número y compañía, dentro y fuera del país.", requirements: ["Número de teléfono", "Compañía", "Amount de recarga"], cost: "Sin cargo adicional", amountField: true, fields: [{ name: "number", label: "Número a recargar" }, { name: "carrier", label: "Compañía" }, { name: "country", label: "País" }] },
  { slug: "tickets-de-transito", name: "Pago de tickets de tránsito", short: "Paga multas de tránsito fácilmente.", description: "Te ayudamos a pagar tus multas y tickets de tránsito sin complicaciones.", requirements: ["Número de ticket", "Placa del vehículo", "Licencia de conducir"], cost: "Service fee de $5", fee: 5, amountField: true, fields: [{ name: "ticket", label: "Número de ticket" }, { name: "plate", label: "Placa del vehículo" }] },
  { slug: "financiamiento", name: "Financing", short: "Estrena equipo pagando a tu ritmo.", description: "Solicita financiamiento para teléfonos, joyería y otros productos seleccionados.", requirements: ["Identificación oficial", "Comprobante de ingresos", "Comprobante de domicilio"], cost: "Sujeto a evaluación", fields: [{ name: "product", label: "Producto de interés" }, { name: "income", label: "Ingreso mensual aproximado", type: "number" }] },
  { slug: "reparaciones", name: "Repairs de celulares", short: "Pantallas, baterías, carga y más.", description: "Diagnóstico y reparación de celulares con piezas de calidad y garantía.", requirements: ["Equipo a reparar", "Descripción de la falla"], cost: "Diagnóstico desde $15", fee: 15, fields: [{ name: "device", label: "Brand y modelo" }, { name: "issue", label: "¿Qué le sucede?", type: "textarea" }] },
  { slug: "activaciones", name: "Activaciones", short: "Activa tu línea y conserva tu número.", description: "Activación de líneas nuevas, portabilidad y cambio de plan.", requirements: ["Identificación oficial", "Equipo compatible", "Número a transferir (si aplica)"], cost: "Desde $10 según plan", fee: 10, fields: [{ name: "carrier", label: "Compañía deseada" }, { name: "port_number", label: "Número a transferir (opcional)" }] },
  { slug: "equipos-moviles", name: "Equipos móviles", short: "Asesoría para tu próximo teléfono.", description: "Te ayudamos a elegir el equipo ideal y apartarlo en tienda.", requirements: ["Model de interés o presupuesto"], cost: "Sin costo", fields: [{ name: "model", label: "Model o presupuesto" }] },
  { slug: "accesorios", name: "Accesorios", short: "Fundas, cargadores, audio y más.", description: "Solicita accesorios específicos aunque no estén en el catálogo.", requirements: ["Model de tu equipo", "Tipo de accesorio"], cost: "Según accesorio", fields: [{ name: "device", label: "Model de tu equipo" }, { name: "accessory", label: "Accesorio que buscas" }] },
  { slug: "vuelos", name: "Vuelos", short: "Boletos aéreos al mejor precio.", description: "Cotizamos y reservamos tus boletos de avión nacionales e internacionales.", requirements: ["Pasaporte vigente", "Dates de viaje", "Origen y destino"], cost: "Cotización sin costo", fields: [{ name: "origin", label: "Origen" }, { name: "destination", label: "Destino" }, { name: "date", label: "Date de salida", type: "date" }, { name: "passengers", label: "Pasajeros", type: "number" }] },
  { slug: "joyeria-oro", name: "Joyería / Oro", short: "Compra, venta y encargos de oro.", description: "Piezas de oro, encargos personalizados y valoración de joyería.", requirements: ["Tipo de pieza o encargo", "Quilataje deseado"], cost: "Según peso y quilataje", fields: [{ name: "piece", label: "Pieza o encargo" }, { name: "details", label: "Detalles", type: "textarea" }] },
  { slug: "perfumeria-gift-shop", name: "Perfumería / Gift Shop", short: "Perfumes originales y regalos.", description: "Encarga perfumes y arreglos de regalo personalizados.", requirements: ["Producto o tipo de regalo", "Date deseada"], cost: "Según producto", fields: [{ name: "product", label: "Perfume o regalo" }, { name: "date", label: "Date deseada", type: "date" }] },
];
