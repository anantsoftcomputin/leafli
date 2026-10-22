"use client";

import { CartDrawer } from "@/components/site/CartDrawer";
import { FloatingCart } from "@/components/site/FloatingCart";
import { Footer } from "@/components/site/Footer";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteProvider } from "@/components/site/SiteContext";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteProvider>
      <div className="site flex min-h-screen flex-col">
        <SiteHeader solid />
        <main className="flex-1 pt-28 pb-24">{children}</main>
        <Footer />
        <CartDrawer />
        <FloatingCart />
      </div>
    </SiteProvider>
  );
}
