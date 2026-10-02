import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/payments")({
  server: {
    handlers: {
      GET: async (c) => (await import("@/lib/api-handlers.server")).adminListPayments(c as never),
    },
  },
});
