import { z } from "zod";

export const productInput = z.object({
  name: z.string().trim().min(1).max(150),
  brand: z.string().trim().max(80).default(""),
  model: z.string().trim().max(80).default(""),
  category_id: z.string().trim().min(1).max(60),
  price: z.number().min(0).max(1000000),
  old_price: z.number().min(0).max(1000000).nullable().optional(),
  stock: z.number().int().min(0).max(1000000),
  colors: z.array(z.string().max(40)).max(30).default([]),
  capacity: z.string().max(80).default(""),
  description: z.string().max(4000).default(""),
  features: z.array(z.string().max(200)).max(40).default([]),
  specs: z.array(z.object({ label: z.string().max(80), value: z.string().max(200) })).max(40).default([]),
  financing: z.string().max(300).nullable().optional(),
  image: z.string().max(2000).default(""),
  is_featured: z.boolean().default(false),
  is_bestseller: z.boolean().default(false),
  is_new: z.boolean().default(false),
  is_offer: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const categoryInput = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]+$/).max(60).optional(),
  name: z.string().trim().min(1).max(80),
  sort: z.number().int().min(0).max(1000).optional(),
  active: z.boolean().optional(),
});

export const serviceInput = z.object({
  name: z.string().trim().min(1).max(100),
  short: z.string().max(300),
  description: z.string().max(3000),
  requirements: z.array(z.string().max(200)).max(30),
  cost: z.string().max(200),
  fee: z.number().min(0).max(100000).nullable(),
  amount_field: z.boolean(),
  fields: z.array(z.object({ name: z.string().regex(/^[a-z0-9_]+$/).max(40), label: z.string().max(100), type: z.enum(["text", "number", "textarea", "date"]).optional() })).max(30),
  active: z.boolean(),
  sort: z.number().int().min(0).max(1000).optional(),
});

export const orderStatuses = ["received", "payment_pending", "payment_confirmed", "preparing", "prepared", "ready_for_pickup", "handed_to_carrier", "in_transit", "delivered", "picked_up", "cancelled"] as const;
export const orderStatusInput = z.object({
  status: z.enum(orderStatuses).optional(),
  payment_status: z.enum(["pending", "confirmed", "rejected"]).optional(),
  tracking_number: z.string().max(80).nullable().optional(),
  carrier: z.string().max(80).nullable().optional(),
  archived: z.boolean().optional(),
});
