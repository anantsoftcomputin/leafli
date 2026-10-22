import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

// Plus Jakarta Sans is the font leafli.in already uses.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["SOFT", "WONK", "opsz"] });

export const metadata: Metadata = {
  title: { default: "Leafli — Fresh bowls. Happy moods.", template: "%s · Leafli" },
  description:
    "Chef-made salads and bowls from the Leafli cloud kitchen. Crisp greens, dressings on the side, weighed to the gram and delivered cold.",
  openGraph: { title: "Leafli — Fresh bowls. Happy moods.", siteName: "Leafli", locale: "en_IN", type: "website" },
};

export const viewport: Viewport = { themeColor: "#bfcd30" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        {/* Lets CSS hide reveal targets only when JS will animate them in */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
