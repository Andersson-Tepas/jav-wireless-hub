import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/products/$id/inventory")({
  server: { handlers: {
    PATCH: async c => (await import("@/lib/variants-api.server")).adminAdjustInventory(c),
  } },
});