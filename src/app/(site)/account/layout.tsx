import type { Metadata } from "next";

// Private pages — keep them out of search results.
export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <main className="pt-28 pb-24">{children}</main>;
}
