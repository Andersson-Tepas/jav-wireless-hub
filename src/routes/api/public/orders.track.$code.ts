import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/orders/track/$code")({
  server: {
    handlers: {
      GET: async (c) => (await import("@/lib/api-handlers.server")).trackOrder(c as never),
    },
  },
});
