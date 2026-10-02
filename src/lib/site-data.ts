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

export const categoryNames: Record<string, string> = {
  telefonos: "Phones", accesorios: "Accessories", perfumes: "Fragrances", joyeria: "Jewelry",
  trajes: "Suits", herramientas: "Tools", "gift-shop": "Gift Shop", otros: "Other",
};

export const productNames: Record<string, string> = {
  "Cargador Rápido 45W": "45W Fast Charger", "Set de Regalo Deluxe": "Deluxe Gift Set",
  "Cadena Oro 14K": "14K Gold Chain", "Traje Clásico Slim": "Classic Slim Suit",
  "Taladro Inalámbrico 20V": "20V Cordless Drill",
};

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
  { slug: "envios-de-dinero", name: "Money Transfers", short: "Domestic and international transfers (not product shipping).", description: "Send money to family and friends quickly and securely. This service is for money transfers, not package shipping.", requirements: ["Valid government-issued ID", "Recipient’s full name and phone number", "Destination country and city"], cost: "Fees start at $5, depending on destination and amount", fee: 5, amountField: true, fields: [{ name: "beneficiary", label: "Recipient’s name" }, { name: "beneficiary_phone", label: "Recipient’s phone" }, { name: "destination", label: "Destination country and city" }] },
  { slug: "pago-de-bills", name: "Bill Payment", short: "Pay all your bills in one place.", description: "We process payments for phone, internet, cable, credit card, and other bills.", requirements: ["Account or bill number", "Company name", "Payment amount"], cost: "$2 service fee", fee: 2, amountField: true, fields: [{ name: "company", label: "Company" }, { name: "account", label: "Account number" }] },
  { slug: "pago-de-utilidades", name: "Utility Payments", short: "Pay electric, water, and gas bills without waiting in line.", description: "We process your electricity, water, and gas payments right away.", requirements: ["Utility account number", "Account holder’s name", "Payment amount"], cost: "$2 service fee", fee: 2, amountField: true, fields: [{ name: "utility", label: "Utility (electric, water, or gas)" }, { name: "account", label: "Account number" }, { name: "holder", label: "Account holder’s name" }] },
  { slug: "recargas", name: "Mobile Top-Ups", short: "Domestic and international mobile top-ups.", description: "Add prepaid credit to any phone number and carrier, in the U.S. or abroad.", requirements: ["Phone number", "Carrier", "Top-up amount"], cost: "No additional fee", amountField: true, fields: [{ name: "number", label: "Phone number to top up" }, { name: "carrier", label: "Carrier" }, { name: "country", label: "Country" }] },
  { slug: "tickets-de-transito", name: "Traffic Ticket Payments", short: "Pay traffic tickets easily.", description: "We help you pay traffic fines and tickets without the hassle.", requirements: ["Ticket number", "Vehicle license plate", "Driver’s license"], cost: "$5 service fee", fee: 5, amountField: true, fields: [{ name: "ticket", label: "Ticket number" }, { name: "plate", label: "Vehicle license plate" }] },
  { slug: "financiamiento", name: "Financing", short: "Get a new device and pay over time.", description: "Apply for financing on phones, jewelry, and other select products.", requirements: ["Government-issued ID", "Proof of income", "Proof of address"], cost: "Subject to approval", fields: [{ name: "product", label: "Product of interest" }, { name: "income", label: "Approximate monthly income", type: "number" }] },
  { slug: "reparaciones", name: "Phone Repairs", short: "Screens, batteries, charging issues, and more.", description: "Phone diagnostics and repairs using quality parts and backed by a warranty.", requirements: ["Device to be repaired", "Description of the issue"], cost: "Diagnostics starting at $15", fee: 15, fields: [{ name: "device", label: "Brand and model" }, { name: "issue", label: "What’s wrong with the device?", type: "textarea" }] },
  { slug: "activaciones", name: "Wireless Activations", short: "Activate your line and keep your number.", description: "New line activations, number transfers, and plan changes.", requirements: ["Government-issued ID", "Compatible device", "Number to transfer, if applicable"], cost: "Starting at $10, depending on the plan", fee: 10, fields: [{ name: "carrier", label: "Preferred carrier" }, { name: "port_number", label: "Number to transfer (optional)" }] },
  { slug: "equipos-moviles", name: "Mobile Devices", short: "Expert help choosing your next phone.", description: "We’ll help you choose the right device and reserve it for in-store pickup.", requirements: ["Preferred model or budget"], cost: "Free", fields: [{ name: "model", label: "Preferred model or budget" }] },
  { slug: "accesorios", name: "Accessories", short: "Cases, chargers, audio, and more.", description: "Request specific accessories, even if they are not currently in our catalog.", requirements: ["Your device model", "Type of accessory"], cost: "Varies by accessory", fields: [{ name: "device", label: "Your device model" }, { name: "accessory", label: "Accessory you need" }] },
  { slug: "vuelos", name: "Flights", short: "Airline tickets at competitive prices.", description: "We provide quotes and book domestic and international flights.", requirements: ["Valid passport", "Travel dates", "Origin and destination"], cost: "Free quote", fields: [{ name: "origin", label: "Origin" }, { name: "destination", label: "Destination" }, { name: "date", label: "Departure date", type: "date" }, { name: "passengers", label: "Passengers", type: "number" }] },
  { slug: "joyeria-oro", name: "Jewelry & Gold", short: "Gold purchases, sales, and special orders.", description: "Gold pieces, custom orders, and jewelry appraisals.", requirements: ["Type of piece or special order", "Preferred karat"], cost: "Based on weight and karat", fields: [{ name: "piece", label: "Piece or special order" }, { name: "details", label: "Details", type: "textarea" }] },
  { slug: "perfumeria-gift-shop", name: "Fragrances & Gifts", short: "Authentic fragrances and gifts.", description: "Order fragrances and customized gift arrangements.", requirements: ["Product or gift type", "Preferred date"], cost: "Varies by product", fields: [{ name: "product", label: "Fragrance or gift" }, { name: "date", label: "Preferred date", type: "date" }] },
];

export const serviceCopy = Object.fromEntries(services.map((service) => [service.slug, service])) as Record<string, Service>;
