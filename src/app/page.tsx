"use client";

import { BowlsShowcase } from "@/components/site/BowlsShowcase";
import { CartDrawer } from "@/components/site/CartDrawer";
import { FloatingCart } from "@/components/site/FloatingCart";
import { ClosingCta, Footer } from "@/components/site/Footer";
import { Hero } from "@/components/site/Hero";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Intro } from "@/components/site/Intro";
import { Marquee } from "@/components/site/Marquee";
import { MenuSection } from "@/components/site/MenuSection";
import { PromiseSection } from "@/components/site/Promise";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteProvider } from "@/components/site/SiteContext";

export default function Home() {
  return (
    <SiteProvider>
      <div className="site overflow-x-clip">
        <Intro />
        <SiteHeader />
        <main>
          <Hero />
          <Marquee />
          <BowlsShowcase />
          <PromiseSection />
          <HowItWorks />
          <MenuSection />
          <ClosingCta />
        </main>
        <Footer />
        <CartDrawer />
        <FloatingCart />
      </div>
    </SiteProvider>
  );
}
