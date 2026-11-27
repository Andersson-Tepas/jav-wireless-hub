import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cartIdentity } from "./variants";

export type CartItem = { id: string; name: string; price: number; image: string; quantity: number; stock: number; variant_id?: string | null; color_snapshot?: string | null; storage_snapshot?: string | null };
type CartCtx = {
  items: CartItem[];
  count: number;
  total: number;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  syncItems: (updater: (prev: CartItem[]) => CartItem[]) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "jav-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setItems(JSON.parse(raw)); } catch { /* ignore */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(items)); }, [items, ready]);

  const value = useMemo<CartCtx>(() => ({
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    total: items.reduce((n, i) => n + i.quantity * i.price, 0),
    add: (item, qty = 1) => {
      if (item.stock <= 0) { toast.error("Product is out of stock"); return; }
      setItems((prev) => {
        const found = prev.find((i) => cartIdentity(i) === cartIdentity(item));
        if (found) return prev.map((i) => cartIdentity(i) === cartIdentity(item) ? { ...item, quantity: Math.min(item.stock, i.quantity + qty) } : i);
        return [...prev, { ...item, quantity: Math.min(item.stock, qty) }];
      });
      toast.success(`${item.name} added to cart`);
    },
    setQty: (id, qty) => setItems((prev) => prev.map((i) => cartIdentity(i) === id ? { ...i, quantity: Math.max(1, Math.min(i.stock, qty)) } : i)),
    remove: (id) => setItems((prev) => prev.filter((i) => cartIdentity(i) !== id)),
    syncItems: (updater) => setItems((prev) => updater(prev)),
    clear: () => setItems([]),
  }), [items]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
