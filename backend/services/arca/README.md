# Facturación Electrónica ARCA — MiNegocio

Servicio de factura electrónica con **delegación multi-cliente**: un único
certificado (el del representante — la SRL/RI de MiNegocio) factura en nombre de
todos los comercios. El comercio **nunca sube certificados**: solo autoriza
nuestro CUIT una vez desde su portal ARCA.

Es el mismo modelo que usan Frambuesa, Colppy y Xubio. Escala a miles de
comercios sin agregar infraestructura por comercio.

---

## Por qué este modelo escala

| | Certificado por comercio | **Delegación (este servicio)** |
|---|---|---|
| Onboarding del comercio | Genera CSR, sube .key y .crt | Autoriza nuestro CUIT (3 min) |
| Certificados a guardar | 1 por comercio (cifrados) | **0** |
| Vencimientos a gestionar | 1 por comercio | Solo el nuestro (cada 2 años) |
| Ticket de Acceso (TA) | 1 por comercio | **1 solo** para todos |

La clave técnica: en la llamada a WSFEv1, el bloque `Auth` lleva **nuestro**
token+sign (del TA del representante), pero el campo `Auth.Cuit` es el **CUIT del
comercio representado**. ARCA verifica que ese comercio nos haya delegado el
servicio `wsfe` y autoriza. Un mismo TA sirve para todos: solo cambia el `Cuit`.

---

## Arquitectura

```
services/arca/
├── config.py        Variables de entorno, endpoints homo/prod, carga de cert
├── errors.py        ArcaRejected (no reintentar) vs ArcaTransientError (reintentar)
├── mapping.py       Reglas fiscales PURAS: A/B/C, CondicionIVAReceptorId, importes
├── wsaa.py          Autenticación: firma CMS del Login Ticket + cache del TA
├── token_store.py   Persistencia del TA en BD (dual SQL) con lock anti-concurrencia
├── wsfev1.py        Facturación: último autorizado, solicitar CAE, consultar
└── __init__.py      API pública: arca.emitir(), arca.health(), arca.esta_configurado()
```

### Tablas (SQLite + PostgreSQL)

- **`arca_tokens`** — cache del TA (uno por servicio+ambiente). Persistente:
  ARCA rechaza pedir un TA nuevo si ya hay uno válido, y sin cache un reinicio
  nos dejaría bloqueados hasta 12h.
- **`arca_config`** — config por negocio: CUIT, punto de venta, condición IVA,
  si ya delegó, ambiente.
- **`arca_invoices`** — comprobantes emitidos o en cola (`pending`/`issued`/
  `error`/`rejected`), con CAE, número y datos para reimprimir.

---

## Configuración (variables de entorno)

Nunca hardcodear (ver CLAUDE.md). En el `.env` del servidor:

```bash
ARCA_CUIT=30xxxxxxxxx7          # CUIT del representante (SRL/RI), solo dígitos
ARCA_ENV=testing               # 'testing' (homologación) o 'production'
# Certificado y clave: por ruta a archivo...
ARCA_CERT_PATH=/run/secrets/arca.crt
ARCA_KEY_PATH=/run/secrets/arca.key
# ...o inline (útil para Docker secrets):
# ARCA_CERT_PEM="-----BEGIN CERTIFICATE----- ..."
# ARCA_KEY_PEM="-----BEGIN PRIVATE KEY----- ..."
```

**Arrancar SIEMPRE en `testing`** (ambiente de homologación de ARCA). No emite
comprobantes fiscales reales. Recién pasar a `production` con todo probado.

---

## Onboarding: tramitar el certificado del representante (una sola vez)

Lo hace el dueño del CUIT representante (la SRL o el RI). Toma ~10 minutos.

1. Entrar a **arca.gob.ar** con clave fiscal (nivel 3).
2. Ir a **Administración de Certificados Digitales**.
3. Crear un alias (ej. `minegocio-prod`) y generar/subir el CSR.
   - El backend puede generar la clave y el CSR; solo subís el CSR a ARCA.
4. ARCA devuelve el **certificado (.crt)**. Guardarlo junto a la **clave (.key)**
   en el servidor y apuntar `ARCA_CERT_PATH` / `ARCA_KEY_PATH`.
5. Vincular el certificado al **web service `wsfe`** (Administrador de
   Relaciones → Nueva relación → Facturación Electrónica).

Verificar con `await arca.health()` (llama a `FEDummy`; no requiere delegación).

---

## Onboarding de cada comercio (delegación) — el flujo fácil

El comercio hace esto una vez, guiado por el wizard del panel (Etapa 3):

1. Entra a **arca.gob.ar** con su clave fiscal.
2. **Administrador de Relaciones** → **Nueva Relación**.
3. Servicio: **Facturación Electrónica (wsfe)**.
4. Representante: **nuestro CUIT** (`ARCA_CUIT`).
5. Confirmar.

Listo. Desde ese momento MiNegocio puede emitir facturas A/B/C en su nombre.

---

## Uso

```python
from services import arca

# Emitir (Etapa 2 lo llama desde un worker async, no bloquea la caja)
res = await arca.emitir(
    cuit_representado="20111111112",     # CUIT del comercio
    emisor_condicion="Monotributista",   # condición IVA del comercio
    punto_venta=1,
    total=1500.0,
    receptor_condicion="Consumidor Final",
    receptor_doc="",                     # opcional (CUIT/DNI)
    iva_rate="21",
)
# → {"cae": "...", "cae_vto": "20260830", "numero": 43, "tipo_cbte": 11, ...}
```

- `ArcaRejected` → datos a corregir (mostrar `.detalle()` al usuario). No reintentar.
- `ArcaTransientError` → reintentar luego. El servicio YA verificó que la factura
  **no** se emitió (protección anti doble-emisión).

---

## Estado de implementación

- [x] **Etapa 1 (este commit)** — núcleo: config, mapping fiscal, WSAA + firma CMS,
  cache del TA, WSFEv1 con anti doble-emisión, esquema dual SQL, tests unitarios.
- [ ] **Etapa 2** — router (`/api/arca/*`), worker async encolado desde `sales.py`
  (la caja no espera a ARCA), reintentos con backoff, ticket con "CAE pendiente".
- [ ] **Etapa 3** — wizard de onboarding en el panel + estado de comprobantes.
- [ ] **Homologación** — probar contra el ambiente de pruebas de ARCA con el
  certificado real antes de `production`.

---

## Notas de seguridad y correctitud

- **Numeración**: nunca llevamos contador propio. Siempre `FECompUltimoAutorizado`
  antes de emitir.
- **Anti doble-emisión**: ante error transitorio, se re-consulta el último
  autorizado; si avanzó, se recupera el CAE en vez de reintentar.
- **Campos obligatorios 2025** (RG 5616): `CondicionIVAReceptorId` y
  `CanMisMonExt` van en cada emisión. Sin el primero, ARCA rechaza (error 10242).
- **Factura C** (monotributo): no discrimina IVA (sin bloque `<Iva>`, `ImpIVA=0`).
