import { useState } from "react";
import {
  analyticsConsentIsDecided,
  setAnalyticsConsent,
} from "./google-analytics";

export function AnalyticsConsent() {
  const [visible, setVisible] = useState(() => !analyticsConsentIsDecided());
  if (!visible) return null;
  const choose = (granted: boolean) => {
    setAnalyticsConsent(granted);
    setVisible(false);
  };
  return (
    <aside
      className="analytics-consent"
      role="dialog"
      aria-label="Analytics preference"
    >
      <p>
        Help us understand aggregate Aeliqo site use with Google Analytics. No
        form content or URL query parameters are sent.
      </p>
      <div>
        <button type="button" onClick={() => choose(false)}>
          Decline
        </button>
        <button type="button" onClick={() => choose(true)}>
          Allow analytics
        </button>
      </div>
    </aside>
  );
}
