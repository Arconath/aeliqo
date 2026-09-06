import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("packages/react/src/styles.css", "utf8");
describe("scoped Aeliqo CSS contract", () => {
  it("does not select host roots, native controls or universal motion globally", () => {
    expect(css).not.toMatch(/(^|\n)\s*(?::root|html|body|button:focus-visible|input:focus-visible|\*[, {])/);
    expect(css).toContain('[data-aeliqo-theme="light"]');
    expect(css).toContain('[data-aeliqo-theme="dark"]');
    expect(css).not.toMatch(/(^|\n)\[data-theme="dark"\]/);
  });
  it("provides fallbacks, logical edges, native focus and accessibility media policies", () => {
    expect(css).not.toMatch(/var\(--aeliqo-(?:text|surface|border|accent|muted)\)/);
    expect(css).not.toMatch(/(?:text-align:\s*(?:left|right)|(?:padding|border)-left:)/);
    for (const token of ["font-family", "space-panel", "space-control", "space-layout", "focus-width", "focus", "warning", "error", "motion-duration", "motion-easing", "chart-2"]) expect(css).toContain(`--aeliqo-${token}`);
    expect(css).toContain("select, textarea, [tabindex]");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
