export type AeliqoDirection = "ltr" | "rtl";

export interface AeliqoLocaleContext {
  readonly locale: string;
  readonly direction: AeliqoDirection;
}

export interface AeliqoLocaleOptions {
  readonly direction?: AeliqoDirection;
}

/** Languages whose default writing direction is right-to-left. */
export const AELIQO_RTL_LANGUAGE_CODES = ["ar", "fa", "he", "ur"] as const;

const rtlLanguageCodes = new Set<string>(AELIQO_RTL_LANGUAGE_CODES);

function languageCode(locale: string): string {
  return locale.trim().toLowerCase().split("-")[0] ?? "";
}

/** Resolve direction from an explicit host choice or a BCP 47 language tag. */
export function resolveAeliqoDirection(
  locale: string,
  direction?: AeliqoDirection,
): AeliqoDirection {
  if (direction !== undefined) return direction;
  return rtlLanguageCodes.has(languageCode(locale)) ? "rtl" : "ltr";
}

/** Create immutable locale metadata for a component or an application scope. */
export function createAeliqoLocaleContext(
  locale = "en-US",
  options: AeliqoLocaleOptions = {},
): AeliqoLocaleContext {
  const normalizedLocale = locale.trim() || "en-US";
  return Object.freeze({
    locale: normalizedLocale,
    direction: resolveAeliqoDirection(normalizedLocale, options.direction),
  });
}

/** Attributes that may be reflected onto a host without mutating document state. */
export function aeliqoLocaleAttributes(context: AeliqoLocaleContext): Readonly<{
  lang: string;
  dir: AeliqoDirection;
}> {
  return {lang: context.locale, dir: context.direction};
}
