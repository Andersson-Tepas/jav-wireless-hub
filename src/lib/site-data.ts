import phoneGraphite from "@/assets/phone-graphite.jpg";
import phoneTitanium from "@/assets/phone-titanium.jpg";
import phoneFold from "@/assets/phone-fold.jpg";
import earbuds from "@/assets/earbuds.jpg";

export const navItems = [
  { label: "Inicio", to: "/" },
  { label: "Servicios", to: "/servicios" },
  { label: "Productos", to: "/productos" },
  { label: "Financiamiento", to: "/financiamiento" },
  { label: "Reparaciones", to: "/reparaciones" },
  { label: "Nosotros", to: "/nosotros" },
  { label: "Contacto", to: "/contacto" },
] as const;

export const socialLinks = {
  whatsapp: "https://wa.me/",
  facebook: "https://www.facebook.com/",
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/",
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  model: string;
  price: number;
  oldPrice?: number;
  stock: number;
  color: string;
  capacity: string;
  description: string;
  features: string[];
  specs: { label: string; value: string }[];
  financing?: string;
  image: string;
  badge?: string;
};

export const products: Product[] = [
  {
    id: "nova-x-pro",
    name: "Nova X Pro",
    brand: "Nova",
    model: "X Pro 5G",
    price: 899,
    oldPrice: 999,
    stock: 8,
    color: "Grafito",
    capacity: "256 GB",
    description: "Potencia de nivel profesional, cámara avanzada y batería para todo el día.",
    features: ["Pantalla OLED 120 Hz", "Cámara triple 48 MP", "Carga rápida 45 W"],
    specs: [
      { label: "Pantalla", value: "6.7 pulgadas OLED" },
      { label: "Memoria", value: "12 GB RAM" },
      { label: "Red", value: "5G / eSIM" },
    ],
    financing: "Desde $79 al mes por 12 meses",
    image: phoneGraphite,
    badge: "Oferta",
  },
  {
    id: "axis-ultra",
    name: "Axis Ultra",
    brand: "Axis",
    model: "Ultra S24",
    price: 1099,
    stock: 5,
    color: "Titanio",
    capacity: "512 GB",
    description: "Rendimiento premium con acabados en titanio y fotografía nocturna excepcional.",
    features: ["Zoom óptico 5×", "Cuerpo de titanio", "Video 8K"],
    specs: [
      { label: "Pantalla", value: "6.8 pulgadas AMOLED" },
      { label: "Memoria", value: "12 GB RAM" },
      { label: "Batería", value: "5,000 mAh" },
    ],
    financing: "Desde $96 al mes por 12 meses",
    image: phoneTitanium,
    badge: "Nuevo",
  },
  {
    id: "flex-one",
    name: "Flex One",
    brand: "Flex",
    model: "One Flip",
    price: 749,
    stock: 3,
    color: "Azul eléctrico",
    capacity: "256 GB",
    description: "Diseño plegable compacto con pantalla exterior inteligente y estilo inconfundible.",
    features: ["Formato plegable", "Pantalla exterior", "Modo manos libres"],
    specs: [
      { label: "Pantalla", value: "6.9 pulgadas flexible" },
      { label: "Memoria", value: "8 GB RAM" },
      { label: "Peso", value: "187 g" },
    ],
    financing: "Desde $66 al mes por 12 meses",
    image: phoneFold,
    badge: "Pocas unidades",
  },
  {
    id: "air-beats-pro",
    name: "Air Beats Pro",
    brand: "Air Beats",
    model: "Pro ANC",
    price: 179,
    oldPrice: 219,
    stock: 14,
    color: "Blanco",
    capacity: "30 h de batería",
    description: "Audio envolvente con cancelación activa de ruido y ajuste cómodo.",
    features: ["Cancelación activa", "Audio espacial", "Carga inalámbrica"],
    specs: [
      { label: "Conexión", value: "Bluetooth 5.3" },
      { label: "Resistencia", value: "IPX4" },
      { label: "Autonomía", value: "Hasta 30 horas" },
    ],
    image: earbuds,
    badge: "Oferta",
  },
];