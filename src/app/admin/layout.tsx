import type { Metadata } from "next";
import { StaffShell } from "@/components/StaffShell";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}

export const metadata: Metadata = { title: "Kitchen admin", robots: { index: false, follow: false } };
