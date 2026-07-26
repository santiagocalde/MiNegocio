"""
Catálogo inicial por rubro.

Cuando un negocio completa el onboarding, precargamos una base de productos
típicos de su rubro agrupados por categoría. Los precios quedan en 0 para que
el dueño los ajuste a su zona/proveedor — el valor está en tener el esqueleto
del catálogo armado (nombres + categorías) y no arrancar de una pantalla vacía.

Estructura: { tipo_negocio: { "Categoría": ["Producto", ...] } }
"""

STARTER_CATALOG = {
    "kiosco": {
        "Golosinas": ["Chocolate", "Alfajor simple", "Alfajor triple", "Caramelos x unidad", "Chicle", "Turrón", "Bombón"],
        "Galletitas": ["Galletitas dulces", "Galletitas saladas", "Obleas", "Bizcochos"],
        "Bebidas": ["Gaseosa 500ml", "Gaseosa 2.25L", "Agua mineral 500ml", "Agua saborizada", "Jugo en caja", "Energizante"],
        "Cigarrillos": ["Cigarrillos box", "Cigarrillos soft", "Tabaco para armar", "Encendedor"],
        "Snacks": ["Papas fritas", "Palitos salados", "Maní salado", "Chizitos"],
    },
    "almacen": {
        "Almacén": ["Arroz 1kg", "Fideos 500g", "Aceite 900ml", "Azúcar 1kg", "Sal fina 500g", "Harina 1kg", "Yerba 1kg", "Puré de tomate"],
        "Bebidas": ["Gaseosa 2.25L", "Agua mineral 2L", "Vino tinto", "Cerveza lata"],
        "Limpieza": ["Lavandina 1L", "Detergente", "Jabón en polvo", "Papel higiénico x4"],
        "Lácteos": ["Leche 1L", "Queso cremoso", "Manteca 200g", "Yogur"],
        "Panadería y otros": ["Pan francés", "Pan de molde", "Huevos (docena)", "Galletitas surtidas"],
    },
    "minimercado": {
        "Almacén": ["Arroz 1kg", "Fideos 500g", "Aceite 900ml", "Azúcar 1kg", "Yerba 1kg", "Café 250g"],
        "Bebidas": ["Gaseosa 2.25L", "Agua mineral 2L", "Cerveza lata", "Vino tinto", "Jugo en caja"],
        "Lácteos y Fiambres": ["Leche 1L", "Queso cremoso", "Jamón cocido", "Salame"],
        "Limpieza": ["Lavandina 1L", "Detergente", "Papel higiénico x4", "Rollo de cocina"],
        "Golosinas": ["Chocolate", "Alfajor", "Galletitas dulces", "Caramelos"],
    },
    "dietetica": {
        "Frutos secos": ["Almendras", "Nueces", "Maní pelado", "Castañas de cajú", "Pasas de uva"],
        "Cereales": ["Avena", "Granola", "Salvado de avena", "Semillas de chía", "Semillas de lino"],
        "Harinas": ["Harina integral", "Harina de almendras", "Harina de garbanzo", "Premezcla sin TACC"],
        "Infusiones": ["Té verde", "Yerba orgánica", "Mate cocido"],
        "Endulzantes": ["Miel", "Stevia", "Azúcar mascabo"],
        "Suplementos": ["Proteína en polvo", "Creatina", "Colágeno", "BCAA", "Barrita proteica"],
        "Sin TACC": ["Galletitas sin TACC", "Fideos sin TACC", "Premezcla sin TACC", "Pan sin TACC"],
        "Aceites": ["Aceite de coco", "Aceite de oliva extra virgen", "Aceite de sésamo"],
    },
    "panaderia": {
        "Panadería": ["Pan francés (kg)", "Pan de molde", "Facturas x docena", "Medialunas x unidad", "Criollos (kg)"],
        "Pastelería": ["Torta", "Masas finas (kg)", "Pionono", "Budín"],
        "Sándwiches": ["Sándwich de miga (docena)", "Pebete"],
        "Bebidas": ["Gaseosa 500ml", "Agua mineral 500ml"],
    },
    "autoservicio": {
        "Almacén": ["Arroz 1kg", "Fideos 500g", "Aceite 900ml", "Azúcar 1kg", "Sal fina 500g", "Harina 1kg", "Yerba 1kg", "Puré de tomate", "Lentejas 400g", "Polenta 500g"],
        "Bebidas": ["Gaseosa 2.25L", "Agua mineral 2L", "Cerveza lata", "Vino tinto", "Jugo en caja", "Energizante", "Soda 1.5L"],
        "Lácteos y Fiambres": ["Leche 1L", "Queso cremoso", "Manteca 200g", "Yogur", "Dulce de leche", "Jamón cocido", "Queso rallado", "Huevos (docena)"],
        "Limpieza": ["Lavandina 1L", "Detergente", "Jabón en polvo", "Papel higiénico x4", "Rollo de cocina", "Escoba", "Trapo de piso"],
        "Panadería": ["Pan francés", "Pan de molde", "Facturas x docena", "Prepizza", "Pan rallado"],
        "Congelados": ["Patitas de pollo (kg)", "Milanesa de carne (kg)", "Papas fritas congeladas (kg)", "Hamburguesas x6"],
        "Perfumería": ["Shampoo", "Jabón de tocador", "Dentífrico", "Desodorante", "Papel higiénico x4"],
    },
    "ferreteria": {
        "Herramientas": ["Martillo", "Destornillador", "Pinza", "Llave ajustable", "Cinta métrica"],
        "Tornillería": ["Tornillos x100", "Clavos x kg", "Tarugos x100", "Bulones"],
        "Electricidad": ["Lámpara LED", "Cinta aisladora", "Cable x metro", "Zapatilla eléctrica"],
        "Pintura": ["Pintura látex 1L", "Pincel", "Rodillo", "Cinta de papel"],
    },
    "libreria": {
        "Escolar": ["Cuaderno", "Carpeta", "Lápiz", "Goma", "Lapicera", "Resaltador", "Cartuchera"],
        "Oficina": ["Resma A4", "Abrochadora", "Broches", "Cinta scotch", "Tijera"],
        "Arte": ["Témpera", "Plasticola", "Cartulina", "Lápices de colores"],
    },
    "petshop": {
        "Alimento": ["Alimento perro adulto (kg)", "Alimento gato adulto (kg)", "Alimento cachorro (kg)", "Lata de comida"],
        "Higiene": ["Piedras sanitarias", "Shampoo para mascotas", "Bolsas sanitarias"],
        "Accesorios": ["Collar", "Correa", "Juguete", "Comedero"],
        "Farmacia": ["Antiparasitario interno", "Pipeta antipulgas", "Comprimido desparasitante", "Vitaminas", "Shampoo medicado"],
    },
}


def get_starter_products(business_type: str):
    """
    Devuelve una lista de tuplas (categoria, nombre) para el rubro dado.
    Lista vacía si el rubro no tiene catálogo predefinido (ej. 'otro').
    """
    rubro = (business_type or "").strip().lower()
    catalogo = STARTER_CATALOG.get(rubro)
    if not catalogo:
        return []
    productos = []
    for categoria, items in catalogo.items():
        for nombre in items:
            productos.append((categoria, nombre))
    return productos
