"""
Enriquecer productos con su foto real desde Open Food Facts (OFF).

OFF es una base ABIERTA y legal de productos, con foto por código de barras (EAN).
Para cada producto con un código EAN válido y sin image_url, busca la foto en OFF
y guarda la URL de la versión chica (footprint mínimo, la sirve la CDN de OFF).

Uso (dentro del contenedor backend, con DATABASE_URL seteado → PostgreSQL):
    python scripts/populate_product_images.py                 # todos los negocios
    python scripts/populate_product_images.py --business-id <ID>
    python scripts/populate_product_images.py --dry-run       # no escribe, solo reporta
    python scripts/populate_product_images.py --overwrite      # re-hace los que ya tienen

Sin DATABASE_URL usa SQLite (modo local): --db-path data/minegocio.db

No genera imágenes con IA: solo usa fotos reales publicadas en Open Food Facts.
"""
import argparse
import asyncio
import os
import re
import sys
import unicodedata

import httpx

OFF_BARCODE_API = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
OFF_SEARCH_API = "https://world.openfoodfacts.org/cgi/search.pl"
OFF_FIELDS = "image_front_small_url,image_small_url,image_front_url,image_url"
# OFF pide un User-Agent identificable en cada request.
USER_AGENT = "MiNegocioPOS/1.0 (https://mi-negocio.app) - enriquecimiento de catalogo"
# OFF limita más fuerte la búsqueda por texto (cgi/search.pl es lento y a veces
# devuelve HTML en vez de JSON bajo carga). Vamos lento y con reintentos.
DELAY_SEARCH = 4.0
TIMEOUT = 25
MAX_RETRIES = 3

EAN_RE = re.compile(r"^\d{8}$|^\d{12,14}$")
# Ruido a sacar del nombre para buscar (unidades, tamaños sueltos).
_NOISE_RE = re.compile(r"\b\d+\s?(?:g|gr|grs|kg|ml|cc|l|lts?|u|un|und|x\d+)\b", re.IGNORECASE)


def _looks_like_barcode(code: str) -> bool:
    """True si el código parece un EAN/UPC real (no un código interno tipo K0001)."""
    return bool(code and EAN_RE.match(str(code).strip()))


def _clean_name(name: str) -> str:
    """Nombre simplificado para buscar: saca unidades/tamaños y espacios de más."""
    n = _NOISE_RE.sub(" ", name or "")
    n = re.sub(r"\s+", " ", n).strip()
    return n or (name or "").strip()


def _pick_image(product: dict) -> str:
    """Elige la mejor URL de foto disponible priorizando la versión chica."""
    for key in ("image_front_small_url", "image_small_url", "image_front_url", "image_url"):
        url = product.get(key)
        if url:
            return url
    return ""


async def _get_json(client: httpx.AsyncClient, url: str, params: dict):
    """GET con reintentos y parseo tolerante. OFF a veces devuelve HTML (rate-limit)
    en vez de JSON; en ese caso reintenta con backoff. Devuelve dict o None."""
    for attempt in range(MAX_RETRIES):
        try:
            resp = await client.get(
                url, params=params,
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
                timeout=TIMEOUT,
            )
            if resp.status_code == 429:
                await asyncio.sleep(5 * (attempt + 1))
                continue
            if resp.status_code == 200:
                try:
                    return resp.json()
                except Exception:
                    # respondió HTML (throttle): backoff y reintento
                    await asyncio.sleep(3 * (attempt + 1))
                    continue
            return None
        except Exception:
            await asyncio.sleep(2 * (attempt + 1))
    return None


async def _off_by_barcode(client: httpx.AsyncClient, barcode: str) -> str:
    data = await _get_json(client, OFF_BARCODE_API.format(barcode=barcode), {"fields": OFF_FIELDS})
    if data and data.get("status") == 1 and isinstance(data.get("product"), dict):
        return _pick_image(data["product"])
    return ""


_STOP = {"de", "la", "el", "con", "y", "x", "sin", "los", "las", "para"}
# Palabras que indican que el producto es una BEBIDA (para no matchear un snack).
_BEV_WORDS = {"coca", "cola", "sprite", "fanta", "pepsi", "agua", "gaseosa", "gaseosas",
              "jugo", "cepita", "monster", "speed", "energizante", "energy", "cerveza",
              "lata", "bebida", "shake", "chocolatada", "uvasal", "retornable", "mini"}
_BEV_CATS = ("beverage", "soda", "drink", "water", "juice", "energy", "cola")
_SNACK_CATS = ("snack", "chips", "crisp", "biscuit", "cookie", "cracker", "candy", "confection")
# Fields de búsqueda: además de imágenes, traemos nombre/marca/categorías para puntuar.
_SEARCH_FIELDS = "product_name,brands,categories_tags,image_front_small_url,image_small_url,image_front_url,image_url"


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9 ]", " ", s.lower())


def _tokens(name: str) -> list:
    toks = [t for t in _norm(_clean_name(name)).split() if t and t not in _STOP and not t.isdigit()]
    return toks


def _tok_in(t: str, ctoks: set) -> bool:
    """Match de token tolerante a plural/posesivo (lays≈lay, cola≈colas)."""
    return t in ctoks or t.rstrip("s") in ctoks or (t + "s") in ctoks


def _score(our_tokens: list, cand: dict) -> float:
    """Puntúa qué tan bien un candidato de OFF representa nuestro producto."""
    ctoks = set(_norm(f"{cand.get('product_name','')} {cand.get('brands','') or ''}").split())
    if not ctoks:
        return -1.0
    overlap = sum(1 for t in our_tokens if _tok_in(t, ctoks))
    if overlap == 0:
        return -1.0
    score = overlap / max(1, len(our_tokens))
    # La marca (primer token significativo) debería aparecer.
    if our_tokens and not _tok_in(our_tokens[0], ctoks):
        score -= 0.4
    cats = " ".join(cand.get("categories_tags") or [])
    if any(t in _BEV_WORDS for t in our_tokens):   # nuestro producto es bebida
        if any(b in cats for b in _BEV_CATS):
            score += 0.5
        if any(s in cats for s in _SNACK_CATS):
            score -= 0.7                            # penaliza snack cuando buscamos bebida
    return score


async def _off_by_name(client: httpx.AsyncClient, name: str, delay: float) -> str:
    """Busca por nombre y elige el candidato mejor puntuado (marca + categoría),
    no el primero. Devuelve '' si ninguno supera el umbral (mejor sin foto que
    con la foto equivocada)."""
    our = _tokens(name)
    if not our:
        return "", True
    # Término de búsqueda: marca + tipo (primeros 2-3 tokens) da mejor recall.
    term = " ".join(our[:3])
    data = await _get_json(client, OFF_SEARCH_API, {
        "search_terms": term, "search_simple": 1, "action": "process",
        "json": 1, "page_size": 10, "fields": _SEARCH_FIELDS,
    })
    responded = data is not None   # False = throttle/red (no borrar la foto actual)
    best_url, best_score = "", 0.34   # umbral: exige un match razonable
    if data:
        for p in data.get("products", []):
            url = _pick_image(p)
            if not url:
                continue
            s = _score(our, p)
            if s > best_score:
                best_score, best_url = s, url
    return best_url, responded


async def fetch_off_image(client: httpx.AsyncClient, barcode: str, name: str = "", delay: float = DELAY_SEARCH) -> tuple[str, str, bool]:
    """Devuelve (url, metodo, responded). responded=False cuando OFF no respondió
    (throttle/red): en ese caso NO se debe borrar la foto actual en modo overwrite."""
    try:
        if _looks_like_barcode(barcode):
            url = await _off_by_barcode(client, barcode)
            if url:
                return url, "codigo", True
        if name:
            url, responded = await _off_by_name(client, name, delay)
            if url:
                return url, "nombre", True
            return "", "", responded
    except Exception as e:
        print(f"    [warn] {barcode or name}: {e}")
    return "", "", False


async def _load_products_pg(dsn: str, business_id, overwrite: bool):
    import asyncpg
    conn = await asyncpg.connect(dsn=dsn)
    try:
        where = "WHERE is_active = 1"
        args = []
        if not overwrite:
            where += " AND COALESCE(image_url, '') = ''"
        if business_id:
            args.append(business_id)
            where += f" AND business_id = ${len(args)}"
        rows = await conn.fetch(f"SELECT id, code, name FROM products {where}", *args)
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def _update_pg(dsn: str, updates):
    import asyncpg
    conn = await asyncpg.connect(dsn=dsn)
    try:
        await conn.executemany("UPDATE products SET image_url = $1 WHERE id = $2", updates)
    finally:
        await conn.close()


async def _load_products_sqlite(db_path: str, business_id, overwrite: bool):
    import aiosqlite
    where = "WHERE is_active = 1"
    args = []
    if not overwrite:
        where += " AND COALESCE(image_url, '') = ''"
    if business_id:
        where += " AND business_id = ?"
        args.append(business_id)
    async with aiosqlite.connect(db_path) as db:
        cur = await db.execute(f"SELECT id, code, name FROM products {where}", args)
        rows = await cur.fetchall()
        return [{"id": r[0], "code": r[1], "name": r[2]} for r in rows]


async def _update_sqlite(db_path: str, updates):
    import aiosqlite
    async with aiosqlite.connect(db_path) as db:
        await db.executemany("UPDATE products SET image_url = ? WHERE id = ?", updates)
        await db.commit()


async def main():
    parser = argparse.ArgumentParser(description="Poblar image_url de productos desde Open Food Facts")
    parser.add_argument("--business-id", default=None, help="Solo este negocio (default: todos)")
    parser.add_argument("--db-path", default=os.getenv("DB_PATH", "data/minegocio.db"), help="Ruta SQLite si no hay DATABASE_URL")
    parser.add_argument("--limit", type=int, default=0, help="Máximo de productos a procesar (0 = todos)")
    parser.add_argument("--dry-run", action="store_true", help="No escribe, solo reporta qué haría")
    parser.add_argument("--overwrite", action="store_true", help="Re-procesa los que ya tienen image_url")
    parser.add_argument("--delay", type=float, default=DELAY_SEARCH, help=f"Segundos entre productos (default {DELAY_SEARCH})")
    args = parser.parse_args()

    dsn = os.getenv("DATABASE_URL", "")
    use_pg = bool(dsn)
    engine = "PostgreSQL" if use_pg else f"SQLite ({args.db_path})"
    print(f"== Enriquecimiento de fotos (Open Food Facts) — motor: {engine} ==")

    if use_pg:
        products = await _load_products_pg(dsn, args.business_id, args.overwrite)
    else:
        products = await _load_products_sqlite(args.db_path, args.business_id, args.overwrite)

    # Procesamos todos: se intenta por código de barras (si es EAN válido) y si no,
    # por nombre. Solo se descartan los que no tienen nombre buscable.
    candidates = [p for p in products if (p.get("name") or "").strip()]
    skipped = len(products) - len(candidates)
    if args.limit:
        candidates = candidates[: args.limit]

    print(f"Productos a evaluar: {len(candidates)}  |  sin nombre: {skipped}")

    updates = []
    found = 0
    cleared = 0
    by_method = {"codigo": 0, "nombre": 0}
    async with httpx.AsyncClient() as client:
        for i, p in enumerate(candidates, 1):
            barcode = str(p["code"]).strip()
            url, method, responded = await fetch_off_image(client, barcode, p["name"], args.delay)
            if url:
                found += 1
                by_method[method] = by_method.get(method, 0) + 1
                updates.append((url, p["id"]))
                status = f"OK ({method})"
            elif args.overwrite and responded:
                # OFF respondió pero ningún candidato convence → limpiar la foto
                # (posiblemente equivocada) en vez de dejar una incorrecta.
                updates.append(("", p["id"]))
                cleared += 1
                status = "limpiada (sin match confiable)"
            else:
                status = "sin foto"
            print(f"  [{i}/{len(candidates)}] {p['name'][:42]:42}  -> {status}")
            await asyncio.sleep(args.delay)

    print(f"\nFotos encontradas: {found}/{len(candidates)}  (codigo: {by_method.get('codigo',0)}, nombre: {by_method.get('nombre',0)})  |  limpiadas: {cleared}")

    if args.dry_run:
        print("(dry-run: no se escribió nada)")
        return
    if not updates:
        print("Nada para actualizar.")
        return

    if use_pg:
        await _update_pg(dsn, updates)
    else:
        await _update_sqlite(args.db_path, updates)
    print(f"Actualizados {len(updates)} productos con su foto.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(1)
