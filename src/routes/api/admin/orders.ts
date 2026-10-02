import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/orders")({
  server: {
    handlers: {
      GET: async (c) => (await import("@/lib/api-handlers.server")).adminListOrders(c as never),
    },
  },
});
