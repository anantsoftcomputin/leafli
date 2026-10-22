import { redirect } from "next/navigation";

// The storefront now lives on the home page.
export default function ShopPage() {
  redirect("/#menu");
}
