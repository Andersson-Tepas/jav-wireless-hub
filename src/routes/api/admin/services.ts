import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/services")({
  server: {
    handlers: {
      GET: async (c) => (await import("@/lib/api-handlers.server")).adminListServices(c as never),
      POST: async (c) => (await import("@/lib/api-handlers.server")).adminCreateService(c as never),
    },
  },
});
