import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check, Circle } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/site-shell";
import { lookupOrder, lookupServiceRequest } from "@/lib/commerce.functions";
import { money } from "@/lib/cart";
import {
  deliveryLabels,
  paymentLabels,
  productImage,
  serviceStatusLabels,
  statusLabels,
  timelineFor,
} from "@/lib/site-data";

export const Route = createFileRoute("/seguimiento")({
  validateSearch: zodValidator(
    z.object({
      orden: fallback(z.string(), "").default(""),
      contacto: fallback(z.string(), "").default(""),
    })
  ),
  head: () => ({
    meta: [
      { title: "Order Tracking — JAV Wireless" },
      {
        name: "description",
        content:
          "Check the status of your order or service request using its reference number.",
      },
      { property: "og:title", content: "Order Tracking — JAV Wireless" },
      {
        property: "og:description",
        content: "See the current status of your purchase.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackingPage,
});

const fmt = (d: string) =>
  new Date(d).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const serviceNameInEnglish = (name: string) => {
  const translations: Record<string, string> = {
    Financiamiento: "Financing",
    Reparaciones: "Repairs",
    Reparación: "Repair",
    "Envíos de dinero": "Money Transfers",
    "Pago de bills": "Bill Payments",
    Recargas: "Mobile Top-Ups",
  };

  return translations[name] ?? name;
};

function TrackingPage() {
  const search = Route.useSearch();

  const [orderNo, setOrderNo] = useState(search.orden);
  const [contact, setContact] = useState(search.contacto);

  const [query, setQuery] = useState(
    search.orden && search.contacto
      ? { n: search.orden, c: search.contacto }
      : null
  );

  const lookup = useServerFn(lookupOrder);
  const lookupSr = useServerFn(lookupServiceRequest);

  const isService = query?.n.toUpperCase().startsWith("SR-");

  const { data, isFetching, isError } = useQuery({
    queryKey: ["tracking", query],
    enabled: !!query,
    retry: false,
    refetchInterval: (q) => (q.state.data?.r.found ? 5000 : false),
    refetchOnWindowFocus: true,

    queryFn: async () => {
      try {
        return isService
          ? {
              kind: "service" as const,
              r: await lookupSr({
                data: {
                  reference: query!.n,
                  contact: query!.c,
                },
              }),
            }
          : {
              kind: "order" as const,
              r: await lookup({
                data: {
                  order_number: query!.n,
                  contact: query!.c,
                },
              }),
            };
      } catch (e) {
        console.error("Tracking lookup failed", e);

        return {
          kind: "none" as const,
          r: { found: false as const },
        };
      }
    },
  });

  return (
    <>
      <PageIntro
        eyebrow="Tracking"
        title="My orders"
        description="Enter your order number (JW-...) or service request number (SR-...) along with your phone or email. No account is required."
      />

      <section className="section-pad">
        <div className="container-page max-w-3xl">
          <form
            className="card-soft grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();

              setQuery({
                n: orderNo.trim(),
                c: contact.trim(),
              });
            }}
          >
            <input
              required
              className="field"
              placeholder="Order number, e.g. JW-1001"
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              maxLength={20}
              aria-label="Order number"
            />

            <input
              required
              className="field"
              placeholder="Phone or email"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={255}
              aria-label="Phone or email"
            />

            <Button type="submit">Search</Button>
          </form>

          {query && isFetching && !data && !isError && (
            <p className="mt-6 text-muted-foreground">Searching...</p>
          )}

          {query &&
            !isFetching &&
            (isError || (data && !data.r.found)) && (
              <p className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm">
                <strong>No order or service request found.</strong> Check the
                reference number (JW-... or SR-...) and the phone or email used.
              </p>
            )}

          {data?.kind === "service" && data.r.found && (
            <div className="card-soft mt-6 p-6">
              <p className="text-sm text-muted-foreground">
                Service request · {data.r.request.customer_name}
              </p>

              <h2 className="font-display text-2xl font-bold text-primary">
                {data.r.request.reference} ·{" "}
                {serviceNameInEnglish(data.r.request.service_name)}
              </h2>

              <p className="mt-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                {serviceStatusLabels[data.r.request.status] ??
                  data.r.request.status}
              </p>

              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Date</dt>
                  <dd className="font-semibold">
                    {fmt(data.r.request.created_at)}
                  </dd>
                </div>

                <div>
                  <dt className="text-muted-foreground">Last updated</dt>
                  <dd className="font-semibold">
                    {fmt(data.r.request.updated_at)}
                  </dd>
                </div>

                <div>
                  <dt className="text-muted-foreground">Payment</dt>
                  <dd className="font-semibold">
                    {paymentLabels[data.r.request.payment_method]}
                  </dd>
                </div>

                {data.r.request.amount !== null && (
                  <div>
                    <dt className="text-muted-foreground">Total</dt>
                    <dd className="font-semibold">
                      {money(data.r.request.amount)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {data?.kind === "order" &&
            data.r.found &&
            (() => {
              const { order, items, history } = data.r;

              const { flow, current } = timelineFor(
                order.delivery_method,
                order.status
              );

              const at = (s: string) =>
                history.find((h) => h.status === s)?.created_at;

              return (
                <div className="mt-6 space-y-6">
                  <div className="card-soft p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Product order · {order.customer_name}
                        </p>

                        <h2 className="font-display text-3xl font-bold text-primary">
                          #{order.order_number}
                        </h2>
                      </div>

                      <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-bold text-accent">
                        {statusLabels[order.status]}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      Last updated: {fmt(order.updated_at)} · updates
                      automatically
                    </p>

                    {order.status === "cancelled" && (
                      <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                        This order was cancelled. Contact us if you have
                        questions.
                      </p>
                    )}

                    <ol
                      className={`mt-6 space-y-0 ${
                        order.status === "cancelled" ? "hidden" : ""
                      }`}
                    >
                      {flow.map((s, i) => {
                        const state =
                          i < current
                            ? "done"
                            : i === current
                              ? "current"
                              : "todo";

                        return (
                          <li
                            key={s}
                            className="relative flex gap-4 pb-6 last:pb-0"
                          >
                            {i < flow.length - 1 && (
                              <span
                                className={`absolute left-[13px] top-7 h-full w-0.5 ${
                                  i < current ? "bg-success" : "bg-border"
                                }`}
                              />
                            )}

                            <span
                              className={`relative z-10 grid size-7 shrink-0 place-items-center rounded-full ${
                                state === "done"
                                  ? "bg-success text-success-foreground"
                                  : state === "current"
                                    ? "bg-accent text-accent-foreground ring-4 ring-accent/20"
                                    : "border-2 border-border bg-background text-muted-foreground"
                              }`}
                            >
                              {state === "done" ? (
                                <Check className="size-4" />
                              ) : (
                                <Circle
                                  className={`size-2.5 ${
                                    state === "current" ? "fill-current" : ""
                                  }`}
                                />
                              )}
                            </span>

                            <div>
                              <p
                                className={`font-semibold ${
                                  state === "todo"
                                    ? "text-muted-foreground"
                                    : "text-foreground"
                                }`}
                              >
                                {statusLabels[s]}
                              </p>

                              {at(s) && state !== "todo" && (
                                <p className="text-xs text-muted-foreground">
                                  {fmt(at(s)!)}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>

                    <p className="mt-4 text-xs text-muted-foreground">
                      This page updates automatically.
                    </p>
                  </div>

                  <div className="card-soft p-6">
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">Purchase date</dt>
                        <dd className="font-semibold">
                          {fmt(order.created_at)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-muted-foreground">Last updated</dt>
                        <dd className="font-semibold">
                          {fmt(order.updated_at)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-muted-foreground">
                          Payment method
                        </dt>
                        <dd className="font-semibold">
                          {paymentLabels[order.payment_method]}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-muted-foreground">Delivery</dt>
                        <dd className="font-semibold">
                          {deliveryLabels[order.delivery_method]}
                        </dd>
                      </div>

                      {order.tracking_number && (
                        <div className="sm:col-span-2">
                          <dt className="text-muted-foreground">
                            Tracking number
                          </dt>
                          <dd className="font-semibold">
                            {order.carrier ? `${order.carrier} · ` : ""}
                            {order.tracking_number}
                          </dd>
                        </div>
                      )}
                    </dl>

                    <ul className="mt-5 divide-y divide-border border-t border-border">
                      {items.map((i, k) => (
                        <li
                          key={k}
                          className="flex items-center gap-3 py-3 text-sm"
                        >
                          {i.image && (
                            <img
                              src={productImage(i.image)}
                              alt=""
                              width={48}
                              height={48}
                              className="size-12 rounded bg-surface object-cover"
                            />
                          )}

                          <span className="flex-1">
                            {i.quantity} × {i.name}
                          </span>

                          <span className="font-semibold">
                            {money(i.price * i.quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex justify-between border-t border-border pt-3">
                      <span className="font-bold">Total</span>
                      <span className="text-lg font-bold text-primary">
                        {money(order.total)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      </section>
    </>
  );
}