import { createFileRoute, notFound } from "@tanstack/react-router";
import { Categories, Promotions, Requests, ServicesAdmin, Settings } from "@/components/admin/admin-misc";
import { Customers, Orders, Payments, Tracking } from "@/components/admin/admin-orders";
import { Inventory, Products } from "@/components/admin/admin-products";

const sections: Record<string, { title: string; C: () => React.ReactNode }> = {
  productos: { title: "Products", C: Products },
  categorias: { title: "Categories", C: Categories },
  inventario: { title: "Inventory", C: Inventory },
  pedidos: { title: "Orders", C: Orders },
  clientes: { title: "Customers", C: Customers },
  servicios: { title: "Services", C: ServicesAdmin },
  solicitudes: { title: "Service requests", C: Requests },
  pagos: { title: "Payments", C: Payments },
  promociones: { title: "Promotions", C: Promotions },
  seguimiento: { title: "Tracking and notifications", C: Tracking },
  configuracion: { title: "Settings", C: Settings },
};
// English aliases so /panel/products and /panel/requests also work.
sections["products"] = sections["productos"]!;
sections["requests"] = sections["solicitudes"]!;

export const Route = createFileRoute("/_authenticated/panel/$seccion")({
  beforeLoad: ({ params }) => { if (!sections[params.seccion]) throw notFound(); },
  head: ({ params }) => ({ meta: [{ title: `${sections[params.seccion]?.title ?? "Panel"} — JAV Wireless Admin` }, { name: "description", content: `Manage ${sections[params.seccion]?.title.toLowerCase() ?? "your store"} at JAV Wireless.` }, { property: "og:title", content: `${sections[params.seccion]?.title ?? "Panel"} — JAV Wireless Admin` }, { property: "og:description", content: `JAV Wireless ${sections[params.seccion]?.title.toLowerCase() ?? "store"} administration.` }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  notFoundComponent: () => <p className="text-muted-foreground">Section not found.</p>,
  component: Section,
});

function Section() {
  const { seccion } = Route.useParams();
  const s = sections[seccion]!;
  return <div><h1 className="mb-6 font-display text-3xl font-bold text-primary">{s.title}</h1><s.C /></div>;
}
