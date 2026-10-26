"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { kitchenStatus, type KitchenStatus, type OrderingHours } from "@/lib/hours";
import type { MenuItem } from "@/lib/types";
import { storagePhoto } from "./DishImage";

export type PublicItem = Pick<MenuItem, "id" | "name" | "description" | "category" | "price" | "imageUrl" | "available" | "diet" | "allergens"> & {
  slug?: string;
  photoUrl?: string | null;
  nutrition?: MenuItem["nutrition"] | null;
};
export interface PublicMenu {
  /** Effective "can order now" on the client (manual switch AND ordering hours). */
  acceptingOrders: boolean;
  orderingHours?: OrderingHours | null;
  razorpayKeyId?: string | null;
  gstRate: number;
  packagingChargePerOrder: number;
  deliveryCharge: number;
  items: PublicItem[];
}

// Shown while the menu loads, or if the API is unreachable, so the page never looks empty.
const FALLBACK: PublicMenu = {
  acceptingOrders: false,
  gstRate: 5,
  packagingChargePerOrder: 0,
  deliveryCharge: 0,
  items: [
    { id: "chicken-caesar", name: "Classic Chicken Caesar Salad", category: "Protein Salads", price: 550, diet: "nonveg", available: true, imageUrl: storagePhoto("chicken-caesar") ?? null, nutrition: { calories: 645 }, allergens: ["egg", "milk", "mustard", "gluten"], description: "Grilled chicken steak, hard-boiled eggs, crisp lettuce, cherry tomatoes, shaved parmesan and crunchy garlic croutons tossed in a signature Caesar dressing." },
    { id: "asian-rice-noodle", name: "Asian Noodle Salad", category: "Fresh Salads", price: 460, diet: "veg", available: true, imageUrl: storagePhoto("asian-rice-noodle") ?? null, nutrition: { calories: 435 }, allergens: ["soy", "sesame", "peanuts"], description: "Rice noodles, shredded purple cabbage, carrots, sliced onions, crunchy peanuts, fresh mint and coriander in a toasted sesame-soy vinaigrette." },
    { id: "chana-moong", name: "Desi Mango & Sprout Salad", category: "Fresh Salads", price: 460, diet: "veg", available: true, imageUrl: storagePhoto("chana-moong") ?? null, nutrition: { calories: 435, protein: 8 }, allergens: [], description: "Protein-packed chana and moong sprouts tossed with fresh mango, cucumber, tomatoes, chaat masala and a sweet-spicy mango-jalapeño dressing." },
    { id: "caprese", name: "Salad Caprese", category: "Fresh Salads", price: 550, diet: "veg", available: true, imageUrl: storagePhoto("caprese") ?? null, nutrition: { calories: 650, protein: 28 }, allergens: ["milk", "tree nuts (walnut, pine nut)"], description: "Fresh buffalo mozzarella, ripe tomatoes, peppery arugula and basil, drizzled with walnut-basil pesto, balsamic glaze and toasted nuts." },
    { id: "potato-apple", name: "Roasted Potato & Apple Salad", category: "Fresh Salads", price: 370, diet: "egg", available: true, imageUrl: storagePhoto("potato-apple") ?? null, nutrition: { calories: 270, protein: 8 }, allergens: ["egg", "tree nuts (walnut)", "milk", "mustard"], description: "Herb-roasted potatoes, crisp apples, lettuce, cherry tomatoes and walnuts folded in a tangy French egg gribiche sauce with capers and gherkins." },
    { id: "chocolate-fruit-bowl", name: "Dark Chocolate Fruit Bowl", category: "Fruit & Dessert Bowls", price: 370, diet: "veg", available: true, imageUrl: storagePhoto("chocolate-fruit-bowl") ?? null, nutrition: { calories: 400, protein: 9 }, allergens: ["milk", "gluten (granola)", "nuts (granola — check label)"], description: "Velvety hung curd blended with dark chocolate compound, cocoa, orange zest and honey, topped with seasonal exotic fruits and granola or nuts." },
  ],
};

interface SiteState {
  menu: PublicMenu;
  /** Open/closed right now, with the message to show when closed. */
  kitchen: KitchenStatus;
  live: boolean; // true once the real menu has loaded
  cart: Record<string, number>;
  count: number;
  add: (id: string, delta?: number) => void;
  clear: () => void;
  cartOpen: boolean;
  setCartOpen: (o: boolean) => void;
  /** Element the "fly to cart" animation targets. */
  cartTarget: HTMLElement | null;
  setCartTarget: (el: HTMLElement | null) => void;
}

const Ctx = createContext<SiteState | null>(null);
const CART_KEY = "leafli-cart";

export function SiteProvider({ children, initialMenu }: { children: React.ReactNode; initialMenu?: PublicMenu | null }) {
  // The server passes the live menu so pages render complete HTML (SEO) with no flash.
  const [menu, setMenu] = useState<PublicMenu>(initialMenu?.items.length ? initialMenu : FALLBACK);
  const [live, setLive] = useState(!!initialMenu?.items.length);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [cartTarget, setCartTarget] = useState<HTMLElement | null>(null);
  // Pages are cached HTML, so the clock is only read in the browser (null until mounted),
  // and re-checked every 30 s so the menu closes on time for someone already browsing.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const kitchen = useMemo<KitchenStatus>(
    () => (now ? kitchenStatus(menu, now) : { open: menu.acceptingOrders, message: menu.acceptingOrders ? "" : kitchenStatus(menu).message }),
    [menu, now],
  );

  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem(CART_KEY) ?? "{}"));
    } catch {}
    fetch("/api/public/menu")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((m: PublicMenu) => {
        if (m.items?.length) {
          setMenu(m);
          setLive(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart]);

  const add = useCallback((id: string, delta = 1) => {
    setCart((c) => {
      const q = (c[id] ?? 0) + delta;
      const next = { ...c };
      if (q <= 0) delete next[id];
      else next[id] = Math.min(q, 20);
      return next;
    });
  }, []);

  const value = useMemo<SiteState>(
    () => ({
      menu: kitchen.open === menu.acceptingOrders ? menu : { ...menu, acceptingOrders: kitchen.open },
      kitchen,
      live,
      cart,
      count: Object.values(cart).reduce((a, b) => a + b, 0),
      add,
      clear: () => setCart({}),
      cartOpen,
      setCartOpen,
      cartTarget,
      setCartTarget,
    }),
    [menu, kitchen, live, cart, add, cartOpen, cartTarget],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSite() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSite must be used inside SiteProvider");
  return v;
}
