/** Curated from official documentation on the retrieval date; intentionally no live ingestion. */
export const snapshotMetadata = Object.freeze({
  version: "ai-landscape-2026-09-06-v1",
  retrievedAt: "2026-09-06",
  scope:
    "Eight representative currently documented text-output models; not an exhaustive or latest-only catalog.",
  pricingBasis:
    "USD per million tokens, standard paid API text pricing, short-context baseline. Excludes batch, tools, storage, taxes and regional premiums. Context limits are capacity, not the amount covered by baseline pricing.",
  history: "One retrieval snapshot. No historical price trend is asserted.",
});
export const sources = Object.freeze({
  openai: "https://developers.openai.com/api/docs/models/gpt-5.4",
  openaiMini: "https://developers.openai.com/api/docs/models/gpt-5.4-mini",
  anthropic: "https://platform.claude.com/docs/en/models/overview",
  google: "https://ai.google.dev/gemini-api/docs/pricing",
  googleFlash: "https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash",
  googleLite:
    "https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite",
  xai: "https://docs.x.ai/developers/pricing",
  grok46: "https://docs.x.ai/developers/models/grok-4.6",
  grok43: "https://docs.x.ai/developers/models/grok-4.3",
  sam: "https://openai.com/residency/",
  dario: "https://www.anthropic.com/company/leadership",
  demis: "https://deepmind.google/about/",
});
