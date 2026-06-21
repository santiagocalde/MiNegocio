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
    },
    "panaderia": {
        "Panadería": ["Pan francés (kg)", "Pan de molde", "Facturas x docena", "Medialunas x unidad", "Criollos (kg)"],
        "Pastelería": ["Torta", "Masas finas (kg)", "Pionono", "Budín"],
        "Sándwiches": ["Sándwich de miga (docena)", "Pebete"],
        "Bebidas": ["Gaseosa 500ml", "Agua mineral 500ml"],
    },
    "carniceria": {
        "Vacuno": ["Asado (kg)", "Carne picada (kg)", "Milanesa (kg)", "Nalga (kg)", "Bife de chorizo (kg)", "Roast beef (kg)"],
        "Cerdo": ["Bondiola (kg)", "Costilla de cerdo (kg)", "Matambre de cerdo (kg)"],
        "Pollo": ["Pollo entero (kg)", "Pechuga (kg)", "Pata muslo (kg)"],
        "Embutidos": ["Chorizo (kg)", "Morcilla (kg)", "Salchicha parrillera (kg)"],
    },
    "verduleria": {
        "Verduras": ["Papa (kg)", "Cebolla (kg)", "Tomate (kg)", "Lechuga", "Zanahoria (kg)", "Zapallo (kg)", "Morrón (kg)"],
        "Frutas": ["Banana (kg)", "Manzana (kg)", "Naranja (kg)", "Mandarina (kg)", "Pera (kg)", "Uva (kg)"],
        "Huevos y otros": ["Huevos (docena)", "Papa frita congelada"],
    },
    "fiambreria": {
        "Fiambres": ["Jamón cocido (kg)", "Jamón crudo (kg)", "Salame (kg)", "Mortadela (kg)", "Bondiola (kg)", "Lomo (kg)"],
        "Quesos": ["Queso cremoso (kg)", "Queso de máquina (kg)", "Queso rallado", "Provolone (kg)", "Roquefort (kg)"],
        "Picada": ["Maní", "Aceitunas", "Papas fritas"],
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
