export const SPEND_CATEGORIES = [
  "elektronik",
  "moda",
  "ev",
  "otomotiv",
  "gida",
  "saglik",
  "ulasim",
  "fatura",
  "eglence",
  "diger",
] as const;

export type SpendCategory = (typeof SPEND_CATEGORIES)[number];

export type SpendSector = {
  category: string;
  amount: number;
  count: number;
  share: number;
};

export type SpendSummary = {
  month: string;
  total: number;
  count: number;
  sectors: SpendSector[];
  top?: SpendSector;
};

export function ymKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1 + delta, 1);
  return ymKey(d);
}

export function productMonth(p: { purchase_date?: string | null }) {
  const raw = String(p?.purchase_date || "");
  return raw.length >= 7 ? raw.slice(0, 7) : "";
}

export function spendSummary(products: any[], ym: string): SpendSummary {
  const byCat: Record<string, { amount: number; count: number }> = {};
  let total = 0;
  let count = 0;
  for (const p of products || []) {
    if (productMonth(p) !== ym) continue;
    const category = (SPEND_CATEGORIES as readonly string[]).includes(p.category) ? p.category : "diger";
    const amount = Number(p.price) || 0;
    byCat[category] = byCat[category] || { amount: 0, count: 0 };
    byCat[category].amount += amount;
    byCat[category].count += 1;
    total += amount;
    count += 1;
  }
  const sectors = Object.entries(byCat)
    .map(([category, v]) => ({
      category,
      amount: v.amount,
      count: v.count,
      share: total ? v.amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  return { month: ym, total, count, sectors, top: sectors[0] };
}

export function formatMonthLabel(ym: string, lang: "tr" | "en") {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", { month: "long", year: "numeric" });
}
