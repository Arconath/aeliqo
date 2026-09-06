export type DensityMode = "compact" | "full";

/** A 16px dead band prevents resize rounding from repeatedly switching modes. */
export function resolveDensity(width: number, previous: DensityMode | null, breakpoint: number, preference?: "compact" | "comfortable"): DensityMode {
  if (preference) return preference === "compact" ? "compact" : "full";
  if (previous === null) return width <= breakpoint ? "compact" : "full";
  if (previous === "compact") return width > breakpoint + 16 ? "full" : "compact";
  return width < breakpoint - 16 ? "compact" : "full";
}
