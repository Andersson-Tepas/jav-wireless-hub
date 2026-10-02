import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/orders/$id/status")({
  server: {
    handlers: {
      PUT: async (c) => (await import("@/lib/api-handlers.server")).adminUpdateOrderStatus(c as never),
    },
  },
});
