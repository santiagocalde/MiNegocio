// Formateadores compartidos para mantener consistencia en toda la app.

/** Formatea un número como pesos argentinos. Por defecto sin decimales
 *  (los precios de kiosco son enteros). Pasá decimals=2 para montos con centavos. */
export function formatMoney(n, decimals = 0) {
  return '$' + Number(n || 0).toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
