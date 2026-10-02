import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/orders")({
  server: {
    handlers: {
      POST: async (c) => (await import("@/lib/api-handlers.server")).postOrder(c as never),
    },
  },
});
