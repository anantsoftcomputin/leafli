import { CartDrawer } from "@/components/site/CartDrawer";
import { FloatingCart } from "@/components/site/FloatingCart";
import { Footer } from "@/components/site/Footer";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteProvider } from "@/components/site/SiteContext";
import { getPublicMenu, getPublicSettings } from "@/lib/server/content";

// Public pages are statically rendered and refreshed when admins edit content.
export const revalidate = 300;

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [menu, settings] = await Promise.all([getPublicMenu().catch(() => null), getPublicSettings().catch(() => null)]);
  return (
    <SiteProvider initialMenu={menu}>
      <div className="site flex min-h-screen flex-col overflow-x-clip">
        <a href="#main" className="sr-only z-50 rounded bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
          Skip to content
        </a>
        <SiteHeader />
        <div id="main" className="flex-1">{children}</div>
        <Footer settings={settings} />
        <CartDrawer />
        <FloatingCart />
      </div>
    </SiteProvider>
  );
}
