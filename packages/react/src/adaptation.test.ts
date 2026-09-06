import { expect, it } from "vitest";
import { resolveDensity } from "./adaptation";
it("holds presentation stable through threshold jitter and honors explicit preferences", () => {
  let mode = resolveDensity(380, null, 390);
  for (const width of [389, 391, 390, 395, 389]) {
    mode = resolveDensity(width, mode, 390);
    expect(mode).toBe("compact");
  }
  expect(resolveDensity(420, mode, 390)).toBe("full");
  expect(resolveDensity(380, "full", 390)).toBe("full");
  expect(resolveDensity(100, "compact", 390, "comfortable")).toBe("full");
  expect(resolveDensity(900, "full", 390, "compact")).toBe("compact");
});
