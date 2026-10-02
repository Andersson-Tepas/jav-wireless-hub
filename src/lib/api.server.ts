import { createClient } from "@supabase/supabase-js";
import { ZodError } from "zod";
import type { Database } from "@/integrations/supabase/types";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const ok = (data: unknown, status = 200) => Response.json({ ok: true, data }, { status, headers: { "cache-control": "no-store" } });
export const fail = (status: number, error: string, details?: unknown) => Response.json({ ok: false, error, ...(details ? { details } : {}) }, { status, headers: { "cache-control": "no-store" } });

/** Wraps a handler so every response has the same { ok, data | error } shape. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try { return await fn(...args); }
    catch (e) {
      if (e instanceof ApiError) return fail(e.status, e.message);
      if (e instanceof ZodError) return fail(400, "Invalid information", e.flatten());
      if (e instanceof Error && e.message && !e.message.includes("supabase")) return fail(400, e.message);
      console.error(e);
      return fail(500, "Internal error");
    }
  };
}

function client(token?: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const publicClient = () => client();

/** Verifies the bearer token AND the admin role server-side. Returns a client that acts as that admin (RLS still applies). */
export async function requireAdmin(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.split(".").length !== 3) throw new ApiError(401, "Not authenticated");
  const supabase = client(token);
  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) throw new ApiError(401, "Invalid session");
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin !== true) throw new ApiError(403, "Administrator access is required");
  return { supabase, userId };
}

export async function readJson(request: Request) {
  try { return await request.json(); } catch { throw new ApiError(400, "Invalid JSON"); }
}
