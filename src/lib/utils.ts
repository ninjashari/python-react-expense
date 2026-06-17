import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatCurrency(value: number | string, currency = "INR") {
  const num = typeof value === "string" ? Number(value) : value;
  let fmt = currencyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(currency, fmt);
  }
  return fmt.format(Number.isFinite(num) ? num : 0);
}

export function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Convert HSL (h in degrees, s and l as 0–100 percentages) to a #rrggbb hex string. */
/** Split an array into consecutive chunks of at most `size` items. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** Convert HSL (h in degrees, s and l as 0–100 percentages) to a #rrggbb hex string. */
function hslToHex(h: number, s: number, l: number) {
  const sFrac = s / 100;
  const lFrac = l / 100;
  const a = sFrac * Math.min(lFrac, 1 - lFrac);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lFrac - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generate `count` distinct, vibrant hex colours. Hues are spread evenly around
 * the wheel with a random starting offset, and saturation/lightness are jittered
 * so repeated runs produce a fresh palette while staying visually distinct.
 */
export function randomDistinctColors(count: number): string[] {
  if (count <= 0) return [];
  const colors = new Set<string>();
  const offset = Math.random() * 360;
  const golden = 137.508; // golden-angle spacing keeps adjacent hues far apart
  let i = 0;
  while (colors.size < count) {
    const hue = (offset + i * golden) % 360;
    const sat = 60 + Math.random() * 25; // 60–85%
    const light = 45 + Math.random() * 15; // 45–60%
    colors.add(hslToHex(hue, sat, light));
    i++;
    if (i > count * 50) break; // safety valve against an impossible run
  }
  return [...colors];
}
