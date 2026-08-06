const BUSINESS_FEATURES = {
  kiosco:        { compras: true, proveedores: false, fiados: true,  catalogo: true, auditoria: false, promociones: true,  recomendaciones: true },
  almacen:       { compras: true, proveedores: true,  fiados: true,  catalogo: true, auditoria: false, promociones: true,  recomendaciones: true },
  minimercado:   { compras: true, proveedores: true,  fiados: true,  catalogo: true, auditoria: false, promociones: true,  recomendaciones: true },
  autoservicio:  { compras: true, proveedores: true,  fiados: false, catalogo: true, auditoria: true,  promociones: true,  recomendaciones: true },
  dietetica:     { compras: true, proveedores: true,  fiados: false, catalogo: true, auditoria: false, promociones: false, recomendaciones: true },
  panaderia:     { compras: true, proveedores: true,  fiados: true,  catalogo: true, auditoria: false, promociones: true,  recomendaciones: true },
  ferreteria:    { compras: true, proveedores: true,  fiados: true,  catalogo: true, auditoria: false, promociones: true,  recomendaciones: true },
  libreria:      { compras: true, proveedores: true,  fiados: false, catalogo: true, auditoria: false, promociones: false, recomendaciones: true },
  petshop:       { compras: true, proveedores: true,  fiados: false, catalogo: true, auditoria: false, promociones: true,  recomendaciones: true },
  vineria:       { compras: true, proveedores: true,  fiados: true,  catalogo: true, auditoria: true,  promociones: true,  recomendaciones: true },
  otro:          { compras: true, proveedores: true,  fiados: true,  catalogo: true, auditoria: false, promociones: true,  recomendaciones: true },
};

export const DEFAULT_FEATURES = {
  compras: true, proveedores: true, fiados: true, catalogo: true,
  auditoria: false, promociones: true, recomendaciones: true,
};

export function getBusinessFeatures(businessType) {
  return BUSINESS_FEATURES[businessType] || DEFAULT_FEATURES;
}
