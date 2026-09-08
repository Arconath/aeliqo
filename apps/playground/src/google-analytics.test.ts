import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Google Analytics public-site boundary", () => {
  const storage = new Map<string, string>();
  let appended: {
    src: string;
    dataset: Record<string, string>;
    onload?: () => void;
  }[];
  let browser: EventTarget & {
    location: {
      hostname: string;
      protocol: string;
      origin: string;
      pathname: string;
      search: string;
      hash: string;
    };
    localStorage: Storage;
  };

  beforeEach(() => {
    vi.resetModules();
    storage.clear();
    appended = [];
    browser = Object.assign(new EventTarget(), {
      location: {
        hostname: "aeliqo.com",
        protocol: "https:",
        origin: "https://aeliqo.com",
        pathname: "/docs",
        search: "?token=private",
        hash: "#secret",
      },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        clear: () => storage.clear(),
        key: () => null,
        length: 0,
      },
    });
    vi.stubGlobal("window", browser);
    vi.stubGlobal("document", {
      querySelector: (selector: string) =>
        appended.find((script) => selector.includes(script.dataset.aeliqoGa)) ??
        null,
      createElement: () => ({ dataset: {} }),
      head: {
        append: (script: {
          src: string;
          dataset: Record<string, string>;
          onload?: () => void;
        }) => appended.push(script),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("does not load before explicit consent or outside public HTTPS origins", async () => {
    const { startGoogleAnalytics } = await import("./google-analytics");
    expect(
      startGoogleAnalytics({ enabled: true, measurementId: "G-8LP3YETZ2Q" }),
    ).toBe(false);
    storage.set("aeliqo:analytics-consent:v1", "granted");
    browser.location.hostname = "preview.aeliqo.com";
    expect(
      startGoogleAnalytics({ enabled: true, measurementId: "G-8LP3YETZ2Q" }),
    ).toBe(false);
    expect(appended).toEqual([]);
  });

  it("uses only the public path after consent and disables ad features", async () => {
    storage.set("aeliqo:analytics-consent:v1", "granted");
    const { startGoogleAnalytics } = await import("./google-analytics");
    expect(
      startGoogleAnalytics({ enabled: true, measurementId: "G-8LP3YETZ2Q" }),
    ).toBe(true);
    expect(appended[0]!.src).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-8LP3YETZ2Q",
    );
    appended[0]!.onload!();
    const queued = (browser as typeof browser & { dataLayer: unknown[][] })
      .dataLayer;
    expect(JSON.stringify(queued)).not.toMatch(/private|secret|\?|#/);
    expect(JSON.stringify(queued)).toContain("allow_google_signals");
    expect(
      startGoogleAnalytics({ enabled: true, measurementId: "G-8LP3YETZ2Q" }),
    ).toBe(true);
    expect(appended).toHaveLength(1);
  });
});
