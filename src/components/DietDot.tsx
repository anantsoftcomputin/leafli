import type { MenuItem } from "@/lib/types";
import { cx } from "./ui";

/** FSSAI-style veg / egg / non-veg marker. */
export function DietDot({ diet }: { diet: MenuItem["diet"] }) {
  const color = diet === "veg" ? "border-green-600 bg-green-600" : diet === "egg" ? "border-amber-500 bg-amber-500" : "border-red-700 bg-red-700";
  return (
    <span
      title={diet === "veg" ? "Vegetarian" : diet === "egg" ? "Contains egg" : "Non-vegetarian"}
      className={cx("mt-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm border bg-white", color.split(" ")[0])}
    >
      <span className={cx("size-1.5 rounded-full", color.split(" ")[1])} />
    </span>
  );
}
