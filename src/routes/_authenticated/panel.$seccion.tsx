import { createFileRoute, notFound } from "@tanstack/react-router";
import { Categories, Promotions, Requests, ServicesAdmin, Settings } from "@/components/admin/admin-misc";
import { Customers, Orders, Payments, Tracking } from "@/components/admin/admin-orders";
import { Inventory, Products } from "@/components/admin/admin-products";

const sections: Record<string, { title: string; C: () => React.ReactNode }> = {
  productos: { title: "Productos", C: Products },
  categorias: { title: "Categorías", C: Categories },
  inventario: { title: "Inventario", C: Inventory },
  pedidos: { title: "Pedidos", C: Orders },
  clientes: { title: "Clientes", C: Customers },
  servicios: { title: "Servicios", C: ServicesAdmin },
  solicitudes: { title: "Solicitudes de servicio", C: Requests },
  pagos: { title: "Pagos", C: Payments },
  promociones: { title: "Promociones", C: Promotions },
  seguimiento: { title: "Seguimiento y avisos", C: Tracking },
  configuracion: { title: "Configuración", C: Settings },
};

export const Route = createFileRoute("/_authenticated/panel/$seccion")({
  beforeLoad: ({ params }) => { if (!sections[params.seccion]) throw notFound(); },
  head: ({ params }) => ({ meta: [{ title: `${sections[params.seccion]?.title ?? "Panel"} — Panel JAV Wireless` }, { name: "robots", content: "noindex" }] }),
  notFoundComponent: () => <p className="text-muted-foreground">Sección no encontrada.</p>,
  component: Section,
});

function Section() {
  const { seccion } = Route.useParams();
  const s = sections[seccion]!;
  return <div><h1 className="mb-6 font-display text-3xl font-bold text-primary">{s.title}</h1><s.C /></div>;
}
