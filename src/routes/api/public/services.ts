import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/services")({
  server: {
    handlers: {
      GET: async (c) => (await import("@/lib/api-handlers.server")).listServices(c as never),
    },
  },
});
