import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/cuenta")({
  head: () => ({ meta: [{ title: "My Account — JAV Wireless" }, { name: "description", content: "Your JAV Wireless customer account information." }, { property: "og:title", content: "My Account — JAV Wireless" }, { property: "og:description", content: "Your customer account." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { user } = Route.useRouteContext();
  const meta = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
  const name = meta.full_name || meta.name || "Customer";
  const avatar = meta.avatar_url || meta.picture;
  return (
    <section className="section-pad"><div className="container-page max-w-xl">
      <div className="card-soft p-8">
        <p className="eyebrow">My account</p>
        <div className="mt-4 flex items-center gap-4">
          {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" className="size-16 rounded-full object-cover" /> : <span className="grid size-16 place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">{name.charAt(0)}</span>}
          <div><h1 className="font-display text-2xl font-bold text-primary">{name}</h1><p className="text-sm text-muted-foreground">{user.email}</p></div>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">Customer since {new Date(user.created_at).toLocaleDateString("es")}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/mis-pedidos" className={buttonVariants()}>My orders</Link>
          <Link to="/seguimiento" className={buttonVariants({ variant: "outline" })}>Tracking</Link>
        </div>
      </div>
    </div></section>
  );
}
