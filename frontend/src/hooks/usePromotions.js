import { useState, useEffect } from 'react';
import { apiPost } from '../services/apiClient';

export default function usePromotions(cart) {
  const [activePromotions, setActivePromotions] = useState([]);

  useEffect(() => {
    const evaluate = async () => {
      if (cart.length === 0) { setActivePromotions([]); return; }
      try {
        const res = await apiPost('/promotions/evaluate', {
          items: cart.map(i => ({ product_id: i.id, name: i.name, quantity: i.qty, price: i.price }))
        });
        if (res.ok) {
          const data = await res.json();
          setActivePromotions(Array.isArray(data) ? data : []);
        }
      } catch (e) { console.error(e) }
    };
    evaluate();
  }, [cart]);

  const promotionSavings = activePromotions.reduce((acc, p) => acc + (p.savings || p.discount_amount || 0), 0);

  return { activePromotions, setActivePromotions, promotionSavings };
}
