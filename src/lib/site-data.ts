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
  { label: "Inicio", to: "/" },
  { label: "Productos", to: "/productos" },
  { label: "Servicios", to: "/servicios" },
  { label: "Financiamiento", to: "/financiamiento" },
  { label: "Reparaciones", to: "/reparaciones" },
  { label: "Seguimiento", to: "/seguimiento" },
  { label: "Nosotros", to: "/nosotros" },
  { label: "Contacto", to: "/contacto" },
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

export const paymentLabels: Record<string, string> = { card: "Tarjeta de débito/crédito", paypal: "PayPal", zelle: "Zelle", store: "Pago en tienda" };
export const deliveryLabels: Record<string, string> = { pickup: "Recogida en tienda", shipping: "Envío por paquetería" };

export const statusLabels: Record<string, string> = {
  received: "Pedido recibido",
  payment_pending: "Pago pendiente",
  payment_confirmed: "Pago confirmado",
  preparing: "Preparando pedido",
  prepared: "Pedido preparado",
  handed_to_carrier: "Entregado a paquetería",
  in_transit: "En camino",
  ready_for_pickup: "Listo para recoger",
  picked_up: "Recogido",
  delivered: "Entregado",
  cancelled: "Cancelado",
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

export const serviceStatusLabels: Record<string, string> = { received: "Solicitud recibida", in_review: "En revisión", processing: "En proceso", completed: "Completada", cancelled: "Cancelada" };

export type ServiceField = { name: string; label: string; type?: "text" | "number" | "textarea" | "date"; placeholder?: string };
export type Service = { slug: string; name: string; short: string; description: string; requirements: string[]; cost: string; fee?: number; amountField?: boolean; fields: ServiceField[] };

/** Seed reference only — live services are read from the database (servicesQuery). */
export const services: Service[] = [
  { slug: "envios-de-dinero", name: "Envíos de dinero", short: "Remesas nacionales e internacionales (no es envío de productos).", description: "Envía dinero a familiares y amigos de forma rápida y segura. Este servicio es para transferencias de dinero, no para envíos de paquetes.", requirements: ["Identificación oficial vigente", "Nombre completo y teléfono del beneficiario", "País y ciudad de destino"], cost: "Comisión desde $5 según destino y monto", fee: 5, amountField: true, fields: [{ name: "beneficiary", label: "Nombre del beneficiario" }, { name: "beneficiary_phone", label: "Teléfono del beneficiario" }, { name: "destination", label: "País y ciudad de destino" }] },
  { slug: "pago-de-bills", name: "Pago de bills", short: "Paga tus facturas en un solo lugar.", description: "Realizamos el pago de tus facturas de teléfono, internet, cable, tarjetas y más.", requirements: ["Número de cuenta o factura", "Nombre de la compañía", "Monto a pagar"], cost: "Cargo por servicio de $2", fee: 2, amountField: true, fields: [{ name: "company", label: "Compañía" }, { name: "account", label: "Número de cuenta" }] },
  { slug: "pago-de-utilidades", name: "Pago de utilidades", short: "Luz, agua y gas sin filas.", description: "Pagamos tus servicios de electricidad, agua y gas de manera inmediata.", requirements: ["Número de cuenta de la utilidad", "Nombre del titular", "Monto"], cost: "Cargo por servicio de $2", fee: 2, amountField: true, fields: [{ name: "utility", label: "Servicio (luz, agua, gas)" }, { name: "account", label: "Número de cuenta" }, { name: "holder", label: "Nombre del titular" }] },
  { slug: "recargas", name: "Recargas", short: "Recargas nacionales e internacionales.", description: "Recarga saldo a cualquier número y compañía, dentro y fuera del país.", requirements: ["Número de teléfono", "Compañía", "Monto de recarga"], cost: "Sin cargo adicional", amountField: true, fields: [{ name: "number", label: "Número a recargar" }, { name: "carrier", label: "Compañía" }, { name: "country", label: "País" }] },
  { slug: "tickets-de-transito", name: "Pago de tickets de tránsito", short: "Paga multas de tránsito fácilmente.", description: "Te ayudamos a pagar tus multas y tickets de tránsito sin complicaciones.", requirements: ["Número de ticket", "Placa del vehículo", "Licencia de conducir"], cost: "Cargo por servicio de $5", fee: 5, amountField: true, fields: [{ name: "ticket", label: "Número de ticket" }, { name: "plate", label: "Placa del vehículo" }] },
  { slug: "financiamiento", name: "Financiamiento", short: "Estrena equipo pagando a tu ritmo.", description: "Solicita financiamiento para teléfonos, joyería y otros productos seleccionados.", requirements: ["Identificación oficial", "Comprobante de ingresos", "Comprobante de domicilio"], cost: "Sujeto a evaluación", fields: [{ name: "product", label: "Producto de interés" }, { name: "income", label: "Ingreso mensual aproximado", type: "number" }] },
  { slug: "reparaciones", name: "Reparaciones de celulares", short: "Pantallas, baterías, carga y más.", description: "Diagnóstico y reparación de celulares con piezas de calidad y garantía.", requirements: ["Equipo a reparar", "Descripción de la falla"], cost: "Diagnóstico desde $15", fee: 15, fields: [{ name: "device", label: "Marca y modelo" }, { name: "issue", label: "¿Qué le sucede?", type: "textarea" }] },
  { slug: "activaciones", name: "Activaciones", short: "Activa tu línea y conserva tu número.", description: "Activación de líneas nuevas, portabilidad y cambio de plan.", requirements: ["Identificación oficial", "Equipo compatible", "Número a transferir (si aplica)"], cost: "Desde $10 según plan", fee: 10, fields: [{ name: "carrier", label: "Compañía deseada" }, { name: "port_number", label: "Número a transferir (opcional)" }] },
  { slug: "equipos-moviles", name: "Equipos móviles", short: "Asesoría para tu próximo teléfono.", description: "Te ayudamos a elegir el equipo ideal y apartarlo en tienda.", requirements: ["Modelo de interés o presupuesto"], cost: "Sin costo", fields: [{ name: "model", label: "Modelo o presupuesto" }] },
  { slug: "accesorios", name: "Accesorios", short: "Fundas, cargadores, audio y más.", description: "Solicita accesorios específicos aunque no estén en el catálogo.", requirements: ["Modelo de tu equipo", "Tipo de accesorio"], cost: "Según accesorio", fields: [{ name: "device", label: "Modelo de tu equipo" }, { name: "accessory", label: "Accesorio que buscas" }] },
  { slug: "vuelos", name: "Vuelos", short: "Boletos aéreos al mejor precio.", description: "Cotizamos y reservamos tus boletos de avión nacionales e internacionales.", requirements: ["Pasaporte vigente", "Fechas de viaje", "Origen y destino"], cost: "Cotización sin costo", fields: [{ name: "origin", label: "Origen" }, { name: "destination", label: "Destino" }, { name: "date", label: "Fecha de salida", type: "date" }, { name: "passengers", label: "Pasajeros", type: "number" }] },
  { slug: "joyeria-oro", name: "Joyería / Oro", short: "Compra, venta y encargos de oro.", description: "Piezas de oro, encargos personalizados y valoración de joyería.", requirements: ["Tipo de pieza o encargo", "Quilataje deseado"], cost: "Según peso y quilataje", fields: [{ name: "piece", label: "Pieza o encargo" }, { name: "details", label: "Detalles", type: "textarea" }] },
  { slug: "perfumeria-gift-shop", name: "Perfumería / Gift Shop", short: "Perfumes originales y regalos.", description: "Encarga perfumes y arreglos de regalo personalizados.", requirements: ["Producto o tipo de regalo", "Fecha deseada"], cost: "Según producto", fields: [{ name: "product", label: "Perfume o regalo" }, { name: "date", label: "Fecha deseada", type: "date" }] },
];
