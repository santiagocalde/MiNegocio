export function findProductByAnyCode(productsDB, code) {
  if (!code || !Array.isArray(productsDB)) return null;
  const direct = productsDB.find(p => p.code === code);
  if (direct) return direct;
  return (
    productsDB.find(p => Array.isArray(p.extra_codes) && p.extra_codes.includes(code)) ||
    null
  );
}
