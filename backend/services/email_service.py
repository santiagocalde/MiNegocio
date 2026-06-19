import httpx
import os
import logging
from services.email_templates import (
    RESEND_API_KEY, FROM_EMAIL, trial_reminder_template, trial_welcome_template, plan_activated_template
)

logger = logging.getLogger("NovaStock")

async def send_email(to_email: str, subject: str, html_content: str):
    if not RESEND_API_KEY:
        logger.warning(f"Simulando email a {to_email} (RESEND_API_KEY no configurado): {subject}")
        return {"status": "simulated", "to": to_email}

    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html_content
    }
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post("https://api.resend.com/emails", json=payload, headers=headers, timeout=10.0)
            if response.status_code == 200:
                logger.info(f"Email enviado a {to_email}: {subject}")
                return response.json()
            else:
                logger.error(f"Resend error {response.status_code}: {response.text[:200]}")
                return {"status": "error", "detail": response.text[:200]}
    except Exception as e:
        logger.error(f"Error enviando email a {to_email}: {e}")
        return {"status": "error", "message": str(e)}


async def send_trial_reminder(to_email: str, business_name: str, days_left: int):
    subject = f"MiNegocio — Quedan {days_left} dias de prueba" if days_left > 0 else "MiNegocio — Prueba finalizada"
    html = trial_reminder_template(business_name, days_left)
    return await send_email(to_email, subject, html)


async def send_trial_welcome(to_email: str, business_name: str):
    subject = "MiNegocio — Bienvenido! Tu prueba de 7 dias esta activa"
    html = trial_welcome_template(business_name)
    return await send_email(to_email, subject, html)


async def send_plan_activated(to_email: str, business_name: str, plan_name: str, is_yearly: bool = False):
    features_map = {
        "simple": ["Hasta 3.500 productos", "Clientes y ventas", "Soporta cortes de internet", "Manejo de fiados", "Manejo de proveedores", "Lector laser e impresoras", "Hasta 2 usuarios"],
        "pro": ["Todo lo de Simple", "Hasta 7.000 productos", "Catalogo web online QR", "Reportes de ventas detallados", "Hasta 5 usuarios"],
        "ia": ["Todo lo de Pro", "Hasta 10.000 productos", "Escanner de facturas IA", "Asesor de precios inteligente", "Reportes de rentabilidad", "Hasta 10 usuarios"],
    }
    features = features_map.get(plan_name, [f"Plan {plan_name}"])
    subject = f"MiNegocio — Plan {plan_name} activado!"
    html = plan_activated_template(business_name, plan_name, features, is_yearly)
    return await send_email(to_email, subject, html)
