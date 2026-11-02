import { getProduct, getShop } from './catalog';
import type { CartLine, FC, Product, Shop } from './types';

/** Flat delivery fee per seller parcel (one courier mission per seller). */
export const DELIVERY_FEE_PER_SELLER: FC = 5_000;

export interface Promo {
  code: string;
  /** Percentage of the items total. */
  percent: number;
  /** Maximum discount in FC. */
  cap: FC;
}

export const PROMOS: Record<string, Promo> = {
  YAYO10: { code: 'YAYO10', percent: 10, cap: 20_000 },
};

export interface CartGroupLine extends CartLine {
  product: Product;
  lineTotal: FC;
}

export interface CartGroup {
  shop: Shop;
  lines: CartGroupLine[];
  itemsTotal: FC;
}

export interface CartSummary {
  groups: CartGroup[];
  itemsCount: number;
  itemsTotal: FC;
  deliveryTotal: FC;
  discount: FC;
  total: FC;
  promo?: Promo;
}

export function promoDiscount(itemsTotal: FC, promo?: Promo): FC {
  if (!promo || itemsTotal <= 0) return 0;
  return Math.min(Math.round((itemsTotal * promo.percent) / 100), promo.cap);
}

/** Groups the cart by seller (C1) and computes the totals shown everywhere in checkout. */
export function summarizeCart(lines: CartLine[], promoCode?: string): CartSummary {
  const byShop = new Map<string, CartGroup>();
  for (const line of lines) {
    const product = getProduct(line.productId);
    const group = byShop.get(product.shopId) ?? { shop: getShop(product.shopId), lines: [], itemsTotal: 0 };
    const lineTotal = product.price * line.qty;
    group.lines.push({ ...line, product, lineTotal });
    group.itemsTotal += lineTotal;
    byShop.set(product.shopId, group);
  }
  const groups = [...byShop.values()];
  const itemsTotal = groups.reduce((s, g) => s + g.itemsTotal, 0);
  const itemsCount = lines.reduce((s, l) => s + l.qty, 0);
  const deliveryTotal = groups.length * DELIVERY_FEE_PER_SELLER;
  const promo = promoCode ? PROMOS[promoCode] : undefined;
  const discount = promoDiscount(itemsTotal, promo);
  return { groups, itemsCount, itemsTotal, deliveryTotal, discount, total: itemsTotal + deliveryTotal - discount, promo };
}

/**
 * Splits a checkout-wide discount across seller orders, proportionally to
 * their items total. The sum of the parts is always exactly `discount`, so
 * the sum of order totals always equals the amount the buyer paid.
 */
export function splitDiscount(itemsTotals: FC[], discount: FC): FC[] {
  const sum = itemsTotals.reduce((a, b) => a + b, 0);
  if (sum === 0 || discount === 0) return itemsTotals.map(() => 0);
  const parts = itemsTotals.map((t) => Math.floor((discount * t) / sum));
  const rest = discount - parts.reduce((a, b) => a + b, 0);
  parts[parts.length - 1] = (parts[parts.length - 1] ?? 0) + rest;
  return parts;
}
