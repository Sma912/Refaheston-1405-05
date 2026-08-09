export function formatPrice(amount: number | bigint | string): string {
  const value = typeof amount === "bigint" ? Number(amount) : Number(amount);
  if (Number.isNaN(value)) return "۰";
  return new Intl.NumberFormat("fa-IR").format(value);
}

export function formatPriceToman(amount: number | bigint | string): string {
  return `${formatPrice(amount)} تومان`;
}

export function parsePriceString(raw: string): number {
  const cleaned = raw.replace(/[^\d]/g, "");
  return Number(cleaned) || 0;
}
