export interface AeliqoLocalizedDecimal {
  readonly canonical: string | undefined;
  readonly valid: boolean;
}

/** Keep parsing/formatting work bounded even when values come from a host. */
export const MAX_LOCALIZED_DECIMAL_LENGTH = 4096;

function numberFormat(locale: string): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(locale || "en-US");
  } catch {
    return new Intl.NumberFormat("en-US");
  }
}

function digitMap(formatter: Intl.NumberFormat): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (let digit = 0; digit <= 9; digit += 1) {
    const part = formatter.formatToParts(digit).find((candidate) => candidate.type === "integer");
    if (part !== undefined) map.set(part.value, String(digit));
  }
  return map;
}

/** Parse a locale-formatted decimal without converting through IEEE-754. */
export function parseLocalizedDecimal(text: string, locale = "en-US"): AeliqoLocalizedDecimal {
  const trimmed = text.trim();
  if (trimmed.length === 0) return {canonical: undefined, valid: true};
  if (trimmed.length > MAX_LOCALIZED_DECIMAL_LENGTH) return {canonical: undefined, valid: false};
  const formatter = numberFormat(locale);
  const parts = formatter.formatToParts(-12345.6);
  const group = parts.find((part) => part.type === "group")?.value;
  const decimal = parts.find((part) => part.type === "decimal")?.value ?? ".";
  const minus = parts.find((part) => part.type === "minusSign")?.value ?? "-";
  const literals = new Set(parts.filter((part) => part.type === "literal").map((part) => part.value));
  const digits = digitMap(formatter);
  let normalized = "";
  for (const character of trimmed) {
    const mapped = digits.get(character);
    if (mapped !== undefined) normalized += mapped;
    else if (group !== undefined && character === group) normalized += "|";
    else if (character === decimal) normalized += ".";
    else if (character === minus || character === "−") normalized += "-";
    else if (character === "+") normalized += "+";
    else if (literals.has(character)) continue;
    else normalized += character;
  }
  const sign = normalized.startsWith("-") || normalized.startsWith("+") ? normalized.slice(0, 1) : "";
  const unsigned = sign.length > 0 ? normalized.slice(1) : normalized;
  const decimalParts = unsigned.split(".");
  if (decimalParts.length > 2) return {canonical: undefined, valid: false};
  const integerWithGroups = decimalParts[0] ?? "";
  const fraction = decimalParts.length === 2 ? decimalParts[1] : undefined;
  if (fraction !== undefined && !/^\d+$/u.test(fraction)) return {canonical: undefined, valid: false};
  if (integerWithGroups.includes("|")) {
    if (group === undefined || !validGrouping(integerWithGroups, formatter)) return {canonical: undefined, valid: false};
  } else if (integerWithGroups.length > 0 && !/^\d+$/u.test(integerWithGroups)) {
    return {canonical: undefined, valid: false};
  }
  if (integerWithGroups.length === 0 && fraction === undefined) return {canonical: undefined, valid: false};
  const integer = integerWithGroups.replaceAll("|", "");
  const canonicalInteger = (integer || "0").replace(/^0+(?=\d)/u, "");
  const canonical = `${sign === "-" ? "-" : ""}${canonicalInteger}${fraction === undefined ? "" : `.${fraction}`}`;
  return {canonical, valid: true};
}

export function formatLocalizedDecimal(canonical: string, locale = "en-US"): string {
  if (canonical.length > MAX_LOCALIZED_DECIMAL_LENGTH) return canonical;
  const parsed = parseLocalizedDecimal(canonical, "en-US");
  if (!parsed.valid || parsed.canonical === undefined) return canonical;
  const formatter = numberFormat(locale);
  const negative = parsed.canonical.startsWith("-");
  const unsigned = parsed.canonical.replace(/^[+-]/u, "");
  const [integer = "0", fraction] = unsigned.split(".");
  const sample = formatter.formatToParts(1234567890123);
  const integerParts = sample.filter((part) => part.type === "integer" || part.type === "group");
  const integerChunks = integerParts.filter((part) => part.type === "integer").map((part) => part.value);
  const group = sample.find((part) => part.type === "group")?.value;
  const decimal = formatter.formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";
  const minus = formatter.formatToParts(-1).find((part) => part.type === "minusSign")?.value ?? "-";

  // Derive the locale's grouping pattern from a safe integer sample, then
  // apply it to the original digits without ever converting through Number.
  let localizedInteger = integer;
  if (group !== undefined && integer.length > 3) {
    const rightGroupSize = integerChunks.at(-1)?.length ?? 3;
    const repeatingGroupSize = integerChunks.at(-2)?.length ?? rightGroupSize;
    const chunks: string[] = [];
    let remaining = integer;
    const takeRight = (size: number): void => {
      const split = Math.max(0, remaining.length - size);
      chunks.unshift(remaining.slice(split));
      remaining = remaining.slice(0, split);
    };
    takeRight(rightGroupSize);
    while (remaining.length > repeatingGroupSize) takeRight(repeatingGroupSize);
    if (remaining.length > 0) chunks.unshift(remaining);
    localizedInteger = chunks.join(group);
  }
  const sign = negative ? minus : "";
  return `${sign}${localizedInteger}${fraction === undefined ? "" : `${decimal}${fraction}`}`;
}

function validGrouping(integerWithGroups: string, formatter: Intl.NumberFormat): boolean {
  const chunks = formatter.formatToParts(1234567890123)
    .filter((part) => part.type === "integer")
    .map((part) => part.value);
  if (chunks.length < 2) return false;
  const groups = integerWithGroups.split("|");
  if (groups.length < 2 || groups.some((chunk) => chunk.length === 0 || !/^\d+$/u.test(chunk))) return false;
  const rightSize = chunks.at(-1)?.length ?? 0;
  const repeatingSize = chunks.at(-2)?.length ?? rightSize;
  const firstMaximum = Math.max(repeatingSize, chunks[0]?.length ?? repeatingSize);
  if (groups.at(-1)?.length !== rightSize) return false;
  for (let index = groups.length - 2; index > 0; index -= 1) {
    if (groups[index]?.length !== repeatingSize) return false;
  }
  return (groups[0]?.length ?? 0) >= 1 && (groups[0]?.length ?? 0) <= firstMaximum;
}

export function dateOnly(value: string | undefined): string | undefined {
  if (value === undefined || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return undefined;
  const [yearText = "", monthText = "", dayText = ""] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return value;
}

export function compareDateOnly(left: string | undefined, right: string | undefined): number {
  if (left === right) return 0;
  if (left === undefined) return -1;
  if (right === undefined) return 1;
  return left < right ? -1 : 1;
}
