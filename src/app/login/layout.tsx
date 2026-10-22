import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: true }, alternates: { canonical: "/login" } };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
