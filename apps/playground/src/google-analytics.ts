const consentKey = "aeliqo:analytics-consent:v1";
const consentEvent = "aeliqo:analytics-consent";
const measurementIdPattern = /^G-[A-Z0-9]{6,}$/;

type AnalyticsConfig = { enabled?: boolean; measurementId?: string };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function hasConsent() {
  try {
    return window.localStorage.getItem(consentKey) === "granted";
  } catch {
    return false;
  }
}

export function setAnalyticsConsent(granted: boolean) {
  try {
    window.localStorage.setItem(consentKey, granted ? "granted" : "denied");
  } catch {
    /* Keep analytics off. */
  }
  window.dispatchEvent(new Event(consentEvent));
}

export function analyticsConsentIsDecided() {
  try {
    return ["granted", "denied"].includes(
      window.localStorage.getItem(consentKey) ?? "",
    );
  } catch {
    return false;
  }
}

export function startGoogleAnalytics(config: AnalyticsConfig) {
  if (
    !config.enabled ||
    !measurementIdPattern.test(config.measurementId ?? "") ||
    !["aeliqo.com", "www.aeliqo.com"].includes(window.location.hostname) ||
    window.location.protocol !== "https:" ||
    !hasConsent()
  )
    return false;
  if (
    document.querySelector(`script[data-aeliqo-ga="${config.measurementId}"]`)
  )
    return true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.measurementId!)}`;
  script.dataset.aeliqoGa = config.measurementId!;
  script.onload = () => {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
    window.gtag("js", new Date());
    const pageLocation = `${window.location.origin}${window.location.pathname}`;
    window.gtag("config", config.measurementId!, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      anonymize_ip: true,
    });
    window.gtag("event", "page_view", {
      page_location: pageLocation,
      page_path: window.location.pathname,
    });
  };
  document.head.append(script);
  return true;
}

export function prepareGoogleAnalytics(config: AnalyticsConfig) {
  const start = () => startGoogleAnalytics(config);
  start();
  window.addEventListener(consentEvent, start, { once: true });
}
