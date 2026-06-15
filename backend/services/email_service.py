import httpx
import os
import logging

logger = logging.getLogger("NovaStock")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")

# Dirección de correo verificada en Resend (Sender)
# IMPORTANTE: Si la cuenta es gratuita y el dominio no está verificado,
# solo podrás enviar correos a la dirección de correo con la que creaste Resend.
FROM_EMAIL = "onboarding@resend.dev"

async def send_email(to_email: str, subject: str, html_content: str):
    """
    Envía un email usando la API REST de Resend mediante HTTPX.
    No requiere instalar dependencias extra (usa httpx que ya está en FastAPI).
    """
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
            response.raise_for_status()
            logger.info(f"Email enviado exitosamente a {to_email}: {subject}")
            return response.json()
    except Exception as e:
        logger.error(f"Error enviando email a {to_email}: {e}")
        return {"status": "error", "message": str(e)}

async def send_trial_reminder(to_email: str, business_name: str, days_left: int):
    """Envía un recordatorio de que el período de prueba está por terminar."""
    subject = f"⏳ Quedan {days_left} días de tu prueba en MiNegocio"
    
    logo_url = "https://mi-negocio.app/MiNegocio_transparente_real.png"
    header = f'<div style="text-align: center; margin-bottom: 20px;"><img src="{logo_url}" alt="MiNegocio Logo" width="200" style="max-width: 100%; height: auto;"></div>'
    
    if days_left <= 0:
        subject = "🚫 Tu período de prueba ha finalizado"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            {header}
            <h2 style="color: #1E3A5F;">¡Hola {business_name}!</h2>
            <p>Esperamos que hayas disfrutado tu semana probando <strong>MiNegocio</strong>.</p>
            <p><strong>Tu período de prueba gratuito ha finalizado.</strong> Para seguir usando el sistema y no perder acceso a tu inventario y reportes, por favor suscribite a uno de nuestros planes.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://mi-negocio.app/planes" style="background-color: #14BBA6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Ver Planes y Suscribirme</a>
            </div>
            <p>Si necesitás ayuda, respondé a este correo o contactanos por WhatsApp.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">© 2026 MiNegocio App</p>
        </div>
        """
    else:
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            {header}
            <h2 style="color: #1E3A5F;">¡Hola {business_name}!</h2>
            <p>Esperamos que estés aprovechando al máximo <strong>MiNegocio</strong> para gestionar tu kiosco.</p>
            <p>Te escribimos para avisarte que te quedan <strong>{days_left} días</strong> de prueba gratuita.</p>
            <p>Podés suscribirte en cualquier momento para asegurar que tu sistema siga funcionando sin interrupciones una vez que finalice la prueba.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://mi-negocio.app/planes" style="background-color: #14BBA6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Ver Planes</a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">© 2026 MiNegocio App</p>
        </div>
        """
        
    return await send_email(to_email, subject, html)
