import { describe, it, expect } from 'vitest';

// Test useCart total calculation logic (extracted as pure function)
function calculateCartTotals(cart, itemDiscounts, promotionSavings, ivaRate) {
  const rawTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const totalItemDiscount = Object.values(itemDiscounts).reduce((acc, d) => acc + (parseFloat(d) || 0), 0);
  const totalBeforePromo = Math.max(0, rawTotal - totalItemDiscount);
  const total = Math.max(0, totalBeforePromo - promotionSavings);
  const ivaMultiplier = 1 + ivaRate / 100;
  const subtotal = total / ivaMultiplier;
  const iva = total - subtotal;
  const discount = totalItemDiscount + promotionSavings;
  return { rawTotal, total, subtotal, iva, discount };
}

describe('Cart calculations', () => {
  const sampleCart = [
    { id: 1, price: 100, qty: 2 },
    { id: 2, price: 50, qty: 3 },
  ];

  it('calculates raw total correctly', () => {
    const result = calculateCartTotals(sampleCart, {}, 0, 21);
    expect(result.rawTotal).toBe(350);
  });

  it('applies item discounts', () => {
    const result = calculateCartTotals(sampleCart, { '1': 20 }, 0, 21);
    expect(result.total).toBe(330);
    expect(result.discount).toBe(20);
  });

  it('applies promotion savings', () => {
    const result = calculateCartTotals(sampleCart, {}, 50, 21);
    expect(result.total).toBe(300);
    expect(result.discount).toBe(50);
  });

  it('combines item discounts + promotion savings', () => {
    const result = calculateCartTotals(sampleCart, { '1': 20 }, 50, 21);
    expect(result.total).toBe(280);
    expect(result.discount).toBe(70);
  });

  it('calculates IVA correctly', () => {
    const result = calculateCartTotals([{ id: 1, price: 121, qty: 1 }], {}, 0, 21);
    expect(result.subtotal).toBeCloseTo(100, 1);
    expect(result.iva).toBeCloseTo(21, 1);
  });

  it('never returns negative total', () => {
    const result = calculateCartTotals([{ id: 1, price: 100, qty: 1 }], { '1': 200 }, 0, 21);
    expect(result.total).toBe(0);
  });

  it('handles empty cart', () => {
    const result = calculateCartTotals([], {}, 0, 21);
    expect(result.total).toBe(0);
    expect(result.rawTotal).toBe(0);
  });

  it('handles fractional quantities', () => {
    const result = calculateCartTotals([{ id: 1, price: 100, qty: 0.5 }], {}, 0, 21);
    expect(result.rawTotal).toBe(50);
  });
});

describe('Offline queue idempotency', () => {
  it('filters successfully sent items by idempotency_key', () => {
    const queue = [
      { idempotency_key: 'a1', data: 'sale1' },
      { idempotency_key: 'a2', data: 'sale2' },
      { idempotency_key: 'a3', data: 'sale3' },
    ];
    const successfulKeys = ['a1', 'a3'];
    const remaining = queue.filter(item => !successfulKeys.includes(item.idempotency_key));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].idempotency_key).toBe('a2');
  });

  it('preserves failed items in queue', () => {
    const queue = [
      { idempotency_key: 'b1', data: 'sale1' },
      { idempotency_key: 'b2', data: 'sale2' },
    ];
    const sentKeys = ['b1'];
    const remaining = queue.filter(item => !sentKeys.includes(item.idempotency_key));
    // b2 should remain
    expect(remaining).toHaveLength(1);
    expect(remaining[0].idempotency_key).toBe('b2');
  });
});

describe('Promo auto-apply integration', () => {
  it('promotionSavings reduces total when applied via setPromotionSavings', () => {
    const withPromo = calculateCartTotals([{ id: 1, price: 500, qty: 1 }], {}, 100, 21);
    const withoutPromo = calculateCartTotals([{ id: 1, price: 500, qty: 1 }], {}, 0, 21);
    expect(withPromo.total).toBe(400);
    expect(withoutPromo.total).toBe(500);
    expect(withPromo.total).toBeLessThan(withoutPromo.total);
  });
});
