const BUSINESS_FEATURES = {
  kiosco:        { compras: true, proveedores: false, fiados: true,  catalogo: true, auditoria: false, promociones: true,  recomendaciones: false },
  almacen:       { compras: true, proveedores: true,  fiados: true,  catalogo: true, auditoria: false, promociones: true,  recomendaciones: false },
  minimercado:   { compras: true, proveedores: true,  fiados: true,  catalogo: true, auditoria: false, promociones: true,  recomendaciones: false },
  autoservicio:  { compras: true, proveedores: true,  fiados: false, catalogo: true, auditoria: true,  promociones: true,  recomendaciones: false },
  dietetica:     { compras: true, proveedores: true,  fiados: false, catalogo: true, auditoria: false, promociones: false, recomendaciones: false },
  panaderia:     { compras: true, proveedores: true,  fiados: true,  catalogo: true, auditoria: false, promociones: true,  recomendaciones: false },
  ferreteria:    { compras: true, proveedores: true,  fiados: true,  catalogo: true, auditoria: false, promociones: true,  recomendaciones: false },
  libreria:      { compras: true, proveedores: true,  fiados: false, catalogo: true, auditoria: false, promociones: false, recomendaciones: false },
  petshop:       { compras: true, proveedores: true,  fiados: false, catalogo: true, auditoria: false, promociones: true,  recomendaciones: false },
  otro:          { compras: true, proveedores: true,  fiados: true,  catalogo: true, auditoria: false, promociones: true,  recomendaciones: false },
};

export const DEFAULT_FEATURES = {
  compras: true, proveedores: true, fiados: true, catalogo: true,
  auditoria: false, promociones: true, recomendaciones: false,
};

export function getBusinessFeatures(businessType) {
  return BUSINESS_FEATURES[businessType] || DEFAULT_FEATURES;
}
