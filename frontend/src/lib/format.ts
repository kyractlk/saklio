import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const CURRENCY_SYMBOL: Record<string, string> = {
  TL: "₺", TRY: "₺", USD: "$", EUR: "€", SEK: "kr", DKK: "kr",
};

let _prefCurrency = "TL";
let _rates: Record<string, number> | null = null; // per USD
let _lang: "tr" | "en" = "tr";

export function setLangConfig(lang: "tr" | "en") {
  _lang = lang;
}

export function setMoneyConfig(pref: string, rates: Record<string, number> | null) {
  _prefCurrency = pref || "TL";
  if (rates) _rates = rates;
}

export function getPrefCurrency() {
  return _prefCurrency;
}

function fxKey(c: string) {
  return c === "TL" ? "TRY" : c;
}

export function formatPrice(amount?: number | null, currency = "TL"): string {
  if (amount === null || amount === undefined) return "—";
  let value = amount;
  const from = fxKey(currency);
  const to = fxKey(_prefCurrency);
  if (_rates && from !== to && _rates[from] && _rates[to]) {
    const usd = amount / _rates[from];
    value = usd * _rates[to];
  }
  const sym = CURRENCY_SYMBOL[_prefCurrency] || _prefCurrency;
  const n = Math.round(value);
  const s = n.toLocaleString(_lang === "en" ? "en-US" : "tr-TR");
  return `${s} ${sym}`;
}

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const MONTHS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (_lang === "en") return `${MONTHS_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return "—";
  }
}

export function daysLabel(days?: number | null): string {
  if (days === null || days === undefined) return "—";
  if (_lang === "en") {
    if (days < 0) return "Expired";
    if (days === 0) return "Last day";
    return `${days} days left`;
  }
  if (days < 0) return "Süresi doldu";
  if (days === 0) return "Son gün";
  return `${days} gün kaldı`;
}

export const haptic = {
  light: () => Platform.OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => Platform.OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  heavy: () => Platform.OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  success: () => Platform.OS !== "web" && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => Platform.OS !== "web" && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => Platform.OS !== "web" && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
