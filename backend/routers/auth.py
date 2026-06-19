import os
import logging
import aiosqlite
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel, EmailStr, field_validator
import bcrypt
from jose import jwt, JWTError

from db import get_pool
from main import JWT_SECRET, JWT_ALGORITHM

logger = logging.getLogger("NovaStock.Auth")
router = APIRouter(prefix="/api/auth", tags=["Auth"])

from slowapi import Limiter
from slowapi.util import get_remote_address
auth_limiter = Limiter(key_func=get_remote_address)

# ── Email template ──────────────────────────────────────────
LOGO_URL = "https://mi-negocio.app/MiNegocio_transparente_real.png"

def _email_html(title: str, body: str, cta_text: str = "", cta_url: str = "") -> str:
    cta_html = f'<a href="{cta_url}" style="display:inline-block;background:linear-gradient(135deg,#14BBA6,#0F8A7D);color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;margin-top:20px">{cta_text}</a>' if cta_text else ""
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#060913;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#060913;padding:40px 0">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#0B1120;border:1px solid rgba(20,187,166,0.1);border-radius:16px;overflow:hidden">
<tr><td style="padding:32px 40px 20px;text-align:center;background:linear-gradient(180deg,rgba(20,187,166,0.05),transparent)">
<img src="{LOGO_URL}" alt="MiNegocio" style="width:120px;height:auto;margin-bottom:8px">
</td></tr>
<tr><td style="padding:8px 40px 28px">
<h1 style="color:#F1F5F9;font-size:20px;font-weight:700;margin:0 0 12px;letter-spacing:-0.2px">{title}</h1>
<div style="color:#94A3B8;font-size:15px;line-height:1.6">{body}</div>
{cta_html}
</td></tr>
<tr><td style="padding:16px 40px;border-top:1px solid rgba(255,255,255,0.04);text-align:center">
<p style="color:#475569;font-size:12px;margin:0">MiNegocio &middot; Sistema de gestion para kioscos</p>
<p style="color:#475569;font-size:12px;margin:4px 0 0">
<a href="https://wa.me/5491144276384" style="color:#14BBA6;text-decoration:none">WhatsApp</a> &middot; 
<a href="https://mi-negocio.app" style="color:#14BBA6;text-decoration:none">mi-negocio.app</a>
</p>
</td></tr>
</table>
</td></tr></table></body></html>"""

class BusinessCreate(BaseModel):
    email: EmailStr
    password: str
    business_name: str = "Mi Negocio"
    name: str = ""
    phone: str = ""
    business_type: str = "kiosco"
    prior_pos: str = ""
    needs_arca: str = ""
    objective: str = ""

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contrasena debe tener al menos 8 caracteres")
        if not any(c.isdigit() for c in v):
            raise ValueError("La contrasena debe contener al menos 1 numero")
        if not any(c.isupper() for c in v):
            raise ValueError("La contrasena debe contener al menos 1 mayuscula")
        return v

class CompleteOnboarding(BaseModel):
    business_name: str
    phone: str
    business_type: str
    prior_pos: str
    needs_arca: str
    objective: str


class BusinessLogin(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contrasena debe tener al menos 8 caracteres")
        if not any(c.isdigit() for c in v):
            raise ValueError("La contrasena debe contener al menos 1 numero")
        if not any(c.isupper() for c in v):
            raise ValueError("La contrasena debe contener al menos 1 mayuscula")
        return v


def create_reset_token(business_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    return jwt.encode(
        {"sub": business_id, "email": email, "type": "reset", "exp": expire},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


async def get_current_business(request: Request) -> dict | None:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


@router.post("/register", summary="Registro de nuevo comercio (SaaS)")
@auth_limiter.limit("3/minute")
async def auth_register(request: Request, body: BusinessCreate) -> dict:
    import random

    pool = await get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id FROM businesses WHERE email = $1",
            body.email.lower().strip(),
        )
        if existing:
            raise HTTPException(status_code=400, detail="El email ya esta registrado")

        hashed_pw = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()

        row = await conn.fetchrow(
            """INSERT INTO businesses (email, password_hash, business_name, plan, phone)
               VALUES ($1, $2, $3, 'trial', $4)
               RETURNING id, email, business_name, plan, status, phone""",
            body.email.lower().strip(),
            hashed_pw,
            body.business_name.strip() or body.name.strip() or "Mi Kiosco",
            body.phone or "",
        )
        biz_id, biz_email, biz_name, biz_plan, biz_status, biz_phone = row

        default_pin = str(random.randint(1000, 9999))
        hashed_pin = bcrypt.hashpw(default_pin.encode(), bcrypt.gensalt()).decode()

        # Crear operador en PostgreSQL (modo cloud) — DENTRO del async with
        await conn.execute(
            "INSERT INTO operators (business_id, name, pin, role) VALUES ($1, $2, $3, 'admin')",
            biz_id, biz_name or "Dueño", hashed_pin
        )

        access_token = jwt.encode(
            {"sub": str(biz_id), "email": biz_email, "type": "access",
             "exp": datetime.now(timezone.utc) + timedelta(minutes=60)},
            JWT_SECRET, algorithm=JWT_ALGORITHM,
        )
        refresh_token = jwt.encode(
            {"sub": str(biz_id), "email": biz_email, "type": "refresh",
             "exp": datetime.now(timezone.utc) + timedelta(days=7)},
            JWT_SECRET, algorithm=JWT_ALGORITHM,
        )

        await conn.execute(
            "INSERT INTO auth_tokens (business_id, token, token_type, expires_at) VALUES ($1, $2, 'refresh', $3)",
            biz_id, refresh_token, datetime.now(timezone.utc) + timedelta(days=7)
        )

    # — Fuera de la conexión PG: inicializar SQLite tenant —
    from core.database import init_db as init_sqlite_db
    import main
    tenant_db_path = os.path.join(main.DATA_DIR, f"novastock_{biz_id}.db")
    await init_sqlite_db(tenant_db_path, logging.getLogger("NovaStock"))

    # Crear operador en SQLite (tenant local, para modo offline)
    try:
        async with aiosqlite.connect(tenant_db_path) as tenant_db:
            await tenant_db.execute(
                "INSERT INTO operators (name, pin, role) VALUES (?, ?, 'admin')",
                (biz_name or "Dueño", hashed_pin)
            )
            await tenant_db.commit()
    except Exception as e:
        logging.getLogger("NovaStock.Auth").warning(f"No se pudo crear operador SQLite: {e}")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "operator_pin": default_pin,
        "business": {
            "id": biz_id,
            "email": biz_email,
            "business_name": biz_name,
            "plan": biz_plan,
            "status": biz_status,
            "phone": biz_phone or "",
        },
    }

@router.post("/complete-onboarding", summary="Completar onboarding del comercio")
async def complete_onboarding(body: CompleteOnboarding, business: dict = Depends(get_current_business)) -> dict:
    if not business:
        raise HTTPException(status_code=401, detail="No autenticado.")
    
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE businesses SET business_name = $1, phone = COALESCE(NULLIF($2, ''), phone) WHERE id = $3",
            body.business_name.strip(), body.phone.strip(), business["sub"]
        )
    
    import main
    import aiosqlite
    tenant_db_path = os.path.join(main.DATA_DIR, f"novastock_{business['sub']}.db")
    async with aiosqlite.connect(tenant_db_path) as db:
        for k, v in [("phone", body.phone), ("business_type", body.business_type), ("prior_pos", body.prior_pos), ("needs_arca", body.needs_arca), ("objective", body.objective)]:
            await db.execute("INSERT INTO business_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (k, str(v)))
        await db.commit()
    
    return {"success": True}




@router.post("/login", summary="Login por email para SaaS")
@auth_limiter.limit("5/minute")
async def auth_login(request: Request, body: BusinessLogin) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, email, business_name, plan, status, password_hash FROM businesses WHERE email = $1",
            body.email.lower().strip(),
        )
    if not row:
        raise HTTPException(status_code=401, detail="Email o contrasena incorrectos")
    biz_id, biz_email, biz_name, biz_plan, biz_status, pw_hash = row

    if not bcrypt.checkpw(body.password.encode(), pw_hash.encode()):
        raise HTTPException(status_code=401, detail="Email o contrasena incorrectos")
    if biz_status == "suspended":
        raise HTTPException(status_code=403, detail="Cuenta suspendida. Contacta a soporte.")
    if biz_status == "expired":
        raise HTTPException(status_code=403, detail="Tu periodo de prueba ha finalizado. Elegi un plan para continuar.")

    access_token = jwt.encode(
        {"sub": str(biz_id), "email": biz_email, "type": "access",
         "exp": datetime.now(timezone.utc) + timedelta(minutes=60)},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )
    refresh_token = jwt.encode(
        {"sub": str(biz_id), "email": biz_email, "type": "refresh",
         "exp": datetime.now(timezone.utc) + timedelta(days=7)},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )
    try:
        await conn.execute(
            "INSERT INTO auth_tokens (business_id, token, token_type, expires_at) VALUES ($1, $2, 'refresh', $3)",
            biz_id, refresh_token, datetime.now(timezone.utc) + timedelta(days=7)
        )
    except Exception:
        pass

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "business": {
            "id": biz_id, "email": biz_email,
            "business_name": biz_name, "plan": biz_plan, "status": biz_status,
        },
    }


@router.post("/refresh", summary="Renovar access token")
@auth_limiter.limit("10/minute")
async def auth_refresh(request: Request, authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Refresh token requerido")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token invalido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Refresh token expirado")

    pool = await get_pool()
    async with pool.acquire() as conn:
        token_row = await conn.fetchrow(
            "SELECT business_id, expires_at FROM auth_tokens WHERE token = $1 AND token_type = 'refresh'",
            token,
        )
        if not token_row:
            raise HTTPException(status_code=401, detail="Token revocado o no encontrado")
        if token_row["expires_at"] < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Refresh token expirado")

        row = await conn.fetchrow(
            "SELECT id, email, plan, status FROM businesses WHERE id = $1",
            payload["sub"],
        )
        if not row:
            raise HTTPException(status_code=404, detail="Comercio no encontrado")
        biz_id, biz_email, biz_plan, biz_status = row
        if biz_status == "suspended":
            raise HTTPException(status_code=403, detail="Cuenta suspendida.")

        new_access = jwt.encode(
            {"sub": str(biz_id), "email": biz_email, "type": "access",
             "exp": datetime.now(timezone.utc) + timedelta(minutes=60)},
            JWT_SECRET, algorithm=JWT_ALGORITHM,
        )
        new_refresh = jwt.encode(
            {"sub": str(biz_id), "email": biz_email, "type": "refresh",
             "exp": datetime.now(timezone.utc) + timedelta(days=7)},
            JWT_SECRET, algorithm=JWT_ALGORITHM,
        )
        await conn.execute(
            "DELETE FROM auth_tokens WHERE token = $1",
            token,
        )
        await conn.execute(
            "INSERT INTO auth_tokens (business_id, token, token_type, expires_at) VALUES ($1, $2, 'refresh', $3)",
            biz_id, new_refresh, datetime.now(timezone.utc) + timedelta(days=7)
        )

    return {"access_token": new_access, "refresh_token": new_refresh, "token_type": "bearer"}


@router.get("/me", summary="Datos del comercio autenticado")
async def auth_me(business: dict = Depends(get_current_business)) -> dict:
    if not business:
        raise HTTPException(status_code=401, detail="No autenticado.")
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, email, business_name, plan, plan_end_date, status, created_at FROM businesses WHERE id = $1",
            business["sub"],
        )
    if not row:
        raise HTTPException(status_code=404, detail="Comercio no encontrado")
    return {
        "id": row["id"], "email": row["email"],
        "business_name": row["business_name"], "plan": row["plan"],
        "plan_end_date": str(row["plan_end_date"]) if row["plan_end_date"] else None,
        "status": row["status"], "created_at": str(row["created_at"]),
    }


@router.post("/logout", summary="Invalidar refresh token")
async def auth_logout(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        return {"message": "Sesion cerrada"}
    token = authorization.split(" ")[1]
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM auth_tokens WHERE token = $1",
                token,
            )
    except Exception:
        pass
    return {"message": "Sesion cerrada correctamente"}


@router.post("/forgot-password", summary="Solicitar recuperacion de contrasena")
@auth_limiter.limit("3/15minutes")
async def forgot_password(request: Request, body: ForgotPasswordRequest) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, email, business_name FROM businesses WHERE email = $1",
            body.email.lower().strip(),
        )

        if row:
            reset_token = create_reset_token(row["id"], row["email"])
            await conn.execute(
                "UPDATE businesses SET reset_token = $1, reset_token_expires = $2, updated_at = now() WHERE id = $3",
                reset_token,
                datetime.now(timezone.utc) + timedelta(hours=1),
                row["id"],
            )
            logger.info(f"Token de reset generado para {row['email']}")

            resend_key = os.getenv("RESEND_API_KEY", "")
            if resend_key:
                try:
                    import httpx
                    reset_url = f"https://mi-negocio.app/reset-password?token={reset_token}"
                    async with httpx.AsyncClient(timeout=10) as client:
                        resp = await client.post(
                            "https://api.resend.com/emails",
                            headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
                            json={
                                "from": "MiNegocio <noreply@mi-negocio.app>",
                                "to": [row["email"]],
                                "subject": "Recupera tu contrasena - MiNegocio",
                                "html": _email_html(
                                    "Recuperar Contrasena",
                                    f'<p>Hola {row["business_name"]},</p><p>Recibimos una solicitud para restablecer tu contrasena. Hace clic en el boton de abajo para crear una nueva:</p><p style="color:#64748B;font-size:13px">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje.</p>',
                                    "Restablecer Contrasena",
                                    f"https://mi-negocio.app/reset-password?token={reset_token}"
                                )
                            }
                        )
                    if resp.status_code == 200:
                        logger.info(f"Email de reset enviado a {row['email']}")
                    else:
                        logger.error(f"Resend error {resp.status_code}: {resp.text[:200]}")
                except Exception as e:
                    logger.error(f"No se pudo enviar email de reset: {e}")
            else:
                logger.info("RESEND_API_KEY no configurada. Token de reset solo en logs.")

    return {"message": "Si el email existe, recibiras instrucciones para restablecer tu contrasena."}


@router.post("/reset-password", summary="Restablecer contrasena con token")
@auth_limiter.limit("3/15minutes")
async def reset_password(request: Request, body: ResetPasswordRequest) -> dict:
    try:
        payload = jwt.decode(body.token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "reset":
            raise HTTPException(status_code=400, detail="Token invalido")
    except JWTError:
        raise HTTPException(status_code=400, detail="Token invalido o expirado")

    biz_id = payload["sub"]

    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT reset_token, reset_token_expires FROM businesses WHERE id = $1",
            biz_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Comercio no encontrado")

        if row["reset_token"] != body.token:
            raise HTTPException(status_code=400, detail="Token invalido o ya utilizado")

        if row["reset_token_expires"] and row["reset_token_expires"] < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="El token expiro. Solicita uno nuevo.")

        hashed_pw = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
        await conn.execute(
            "UPDATE businesses SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = now() WHERE id = $2",
            hashed_pw, biz_id,
        )

    return {"message": "Contrasena restablecida correctamente. Ya podes iniciar sesion."}


@router.post("/forgot-pin", summary="Solicitar nuevo PIN de operador")
@auth_limiter.limit("3/15minutes")
async def forgot_pin(request: Request, body: ForgotPasswordRequest) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, email, business_name FROM businesses WHERE email = $1",
            body.email.lower().strip(),
        )
        if not row:
            return {"message": "Si el email existe, recibiras un nuevo PIN."}

        new_pin = str(__import__('random').randint(1000, 9999))
        hashed_pin = bcrypt.hashpw(new_pin.encode(), bcrypt.gensalt()).decode()

        await conn.execute(
            "UPDATE operators SET pin = $1 WHERE business_id = $2 AND role = 'admin'",
            hashed_pin, row["id"]
        )

        resend_key = os.getenv("RESEND_API_KEY", "")
        if resend_key:
            try:
                import httpx
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
                        json={
                            "from": "MiNegocio <noreply@mi-negocio.app>",
                            "to": [row["email"]],
                            "subject": f"Tu nuevo PIN de acceso - MiNegocio",
                            "html": _email_html(
                                "Nuevo PIN de Acceso",
                                f'<p>Hola {row["business_name"]},</p><p>Tu nuevo PIN para abrir la caja es:</p><p style="font-size:32px;font-weight:800;color:#14BBA6;letter-spacing:6px;text-align:center;background:rgba(20,187,166,0.08);padding:16px;border-radius:10px;margin:16px 0">{new_pin}</p><p style="color:#F87171;font-size:13px"><strong>Este PIN se muestra una sola vez.</strong> Anotalo en un lugar seguro. Si no solicitaste este cambio, contactanos urgente.</p>',
                                "Ir a MiNegocio",
                                "https://mi-negocio.app"
                            )
                        }
                    )
                    if resp.status_code == 200:
                        logger.info(f"Nuevo PIN enviado a {row['email']}")
                    else:
                        logger.error(f"Resend error {resp.status_code}: {resp.text[:200]}")
                        logger.info(f"PIN generado para {row['email']} (NO enviado por email): {new_pin}")
            except Exception as e:
                logger.error(f"No se pudo enviar email de PIN: {e}")
                logger.info(f"PIN generado para {row['email']} (fallback log): {new_pin}")
        else:
            logger.info(f"PIN generado para {row['email']} (sin RESEND_API_KEY): {new_pin}")

    return {"message": "Si el email existe, recibiras un nuevo PIN por correo."}
