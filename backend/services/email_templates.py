"""
Templates de email unificados para MiNegocio.
Usado por email_service.py, auth.py, y system.py.
"""
import os
import html as _html

def _e(value: str) -> str:
    """Escapa HTML para uso seguro en templates de email."""
    return _html.escape(str(value) if value else "", quote=True)

LOGO_URL = "https://mi-negocio.app/MiNegocio_transparente_real.png"
WHATSAPP_NUMBER = "5491144276384"
WHATSAPP_LINK = f"https://wa.me/{WHATSAPP_NUMBER}"
APP_URL = "https://mi-negocio.app"
PLANS_URL = "https://mi-negocio.app/#planes"

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = os.environ.get("RESEND_FROM", "MiNegocio <noreply@mi-negocio.app>")


def base_template(title: str, content: str, cta_text: str = "", cta_url: str = "", show_whatsapp: bool = True) -> str:
    cta = f"""
    <table cellpadding="0" cellspacing="0" style="margin:24px auto 0">
      <tr>
        <td align="center" style="background:linear-gradient(135deg,#14BBA6,#0F8A7D);border-radius:10px">
          <a href="{cta_url}" style="display:inline-block;color:#fff;padding:14px 36px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.2px">{cta_text}</a>
        </td>
      </tr>
    </table>
    """ if cta_text else ""

    whatsapp = f"""
    <table cellpadding="0" cellspacing="0" style="margin-top:20px">
      <tr>
        <td style="padding:14px 20px;background:rgba(37,211,102,0.08);border:1px solid rgba(37,211,102,0.15);border-radius:10px">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:20px;padding-right:10px">&#x1F4AC;</td>
              <td>
                <p style="color:#E2E8F0;font-size:13px;font-weight:600;margin:0 0 3px">Tenes alguna duda?</p>
                <p style="color:#94A3B8;font-size:12px;margin:0">Escribinos por WhatsApp al <a href="{WHATSAPP_LINK}" style="color:#25D366;text-decoration:none;font-weight:700">{WHATSAPP_NUMBER}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    """ if show_whatsapp else ""

    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#050812;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050812;padding:40px 0">
  <tr>
    <td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0B1120;border:1px solid rgba(20,187,166,0.08);border-radius:18px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.3)">
        
        <tr>
          <td style="padding:36px 40px 22px;text-align:center;background:linear-gradient(180deg,rgba(20,187,166,0.06),transparent 80%)">
            <img src="{LOGO_URL}" alt="MiNegocio" style="width:130px;height:auto;margin-bottom:4px">
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px 6px">
            <h1 style="color:#F1F5F9;font-size:21px;font-weight:700;margin:0;letter-spacing:-0.3px;line-height:1.3">{title}</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:8px 40px 28px">
            <div style="color:#CBD5E1;font-size:15px;line-height:1.65">
              {content}
            </div>
            {cta}
            {whatsapp}
          </td>
        </tr>

        <tr>
          <td style="padding:18px 40px;border-top:1px solid rgba(255,255,255,0.04);text-align:center">
            <p style="color:#475569;font-size:11.5px;margin:0;line-height:1.5">
              MiNegocio &middot; Sistema POS para kioscos<br>
              <a href="{APP_URL}" style="color:#14BBA6;text-decoration:none">{APP_URL}</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body></html>"""


def trial_welcome_template(business_name: str) -> str:
    return base_template(
        "Bienvenido a MiNegocio!",
        f"""
        <p style="margin:0 0 14px">Hola <strong style="color:#F1F5F9">{_e(business_name)}</strong>,</p>
        <p style="margin:0 0 14px">Tu periodo de prueba de <strong style="color:#14BBA6">7 dias</strong> ya esta activo. Podes usar todas las funciones sin restricciones.</p>
        <p style="margin:0 0 6px;color:#94A3B8;font-size:14px">Que incluye:</p>
        <table cellpadding="0" cellspacing="0" style="margin-bottom:18px">
          <tr><td style="padding:5px 10px 5px 0;color:#CBD5E1;font-size:14px">&#x2705;</td><td style="color:#CBD5E1;font-size:14px">Punto de venta completo</td></tr>
          <tr><td style="padding:5px 10px 5px 0;color:#CBD5E1;font-size:14px">&#x2705;</td><td style="color:#CBD5E1;font-size:14px">Control de stock y alertas</td></tr>
          <tr><td style="padding:5px 10px 5px 0;color:#CBD5E1;font-size:14px">&#x2705;</td><td style="color:#CBD5E1;font-size:14px">Registro de ventas y fiados</td></tr>
          <tr><td style="padding:5px 10px 5px 0;color:#CBD5E1;font-size:14px">&#x2705;</td><td style="color:#CBD5E1;font-size:14px">Hasta 50 productos</td></tr>
        </table>
        <p style="margin:0;color:#94A3B8;font-size:13px">Cuando estes listo, podes elegir un plan pago para seguir usando el sistema sin interrupciones.</p>
        """,
        "Ver Planes",
        PLANS_URL
    )


def trial_reminder_template(business_name: str, days_left: int) -> str:
    if days_left <= 0:
        return base_template(
            "Tu prueba gratuita ha finalizado",
            f"""
            <p style="margin:0 0 14px">Hola <strong style="color:#F1F5F9">{_e(business_name)}</strong>,</p>
            <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15);border-radius:10px;padding:14px 18px;margin-bottom:18px">
              <p style="color:#FCA5A5;font-size:14px;font-weight:600;margin:0">Tu periodo de prueba gratuito de 7 dias ha finalizado.</p>
            </div>
            <p style="margin:0 0 14px;color:#CBD5E1">Para seguir usando MiNegocio y no perder tu inventario ni reportes, necesitas elegir un plan pago.</p>
            <p style="margin:0;color:#94A3B8;font-size:13px">Tenemos planes desde $20.000/mes. Elige el que mejor se adapte a tu negocio.</p>
            """,
            "Ver Planes",
            PLANS_URL
        )
    else:
        urgency_color = "#F59E0B" if days_left <= 2 else "#14BBA6"
        return base_template(
            f"Quedan {days_left} dias de tu prueba",
            f"""
            <p style="margin:0 0 14px">Hola <strong style="color:#F1F5F9">{_e(business_name)}</strong>,</p>
            <div style="background:rgba({ '245,158,11' if days_left <= 2 else '20,187,166' },0.08);border:1px solid rgba({ '245,158,11' if days_left <= 2 else '20,187,166' },0.15);border-radius:10px;padding:14px 18px;margin-bottom:18px">
              <p style="color:{urgency_color};font-size:16px;font-weight:700;margin:0">Te quedan <span style="font-size:22px">{days_left}</span> dia{"s" if days_left != 1 else ""} de prueba gratuita.</p>
            </div>
            <p style="margin:0 0 14px;color:#CBD5E1">Aprovecha para probar todas las funciones antes de que termine. Cuando quieras, podes suscribirte a un plan pago para seguir usando el sistema sin interrupciones.</p>
            """,
            "Ver Planes",
            PLANS_URL
        )


def plan_activated_template(business_name: str, plan_name: str, plan_features: list[str], is_yearly: bool = False) -> str:
    period = "anual" if is_yearly else "mensual"
    features_html = "".join(f'<tr><td style="padding:5px 10px 5px 0;color:#14BBA6;font-size:14px">&#x2714;</td><td style="color:#CBD5E1;font-size:14px">{f}</td></tr>' for f in plan_features)
    return base_template(
        f"Plan {plan_name} activado!",
        f"""
        <p style="margin:0 0 14px">Hola <strong style="color:#F1F5F9">{_e(business_name)}</strong>,</p>
        <div style="background:rgba(20,187,166,0.08);border:1px solid rgba(20,187,166,0.15);border-radius:10px;padding:14px 18px;margin-bottom:18px">
          <p style="color:#14BBA6;font-size:16px;font-weight:700;margin:0">Tu suscripcion <strong>Plan {_e(plan_name)}</strong> ({_e(period)}) esta activa.</p>
        </div>
        <p style="margin:0 0 10px;color:#CBD5E1">Estos son tus beneficios:</p>
        <table cellpadding="0" cellspacing="0" style="margin-bottom:18px">
          {features_html}
        </table>
        <p style="margin:0;color:#94A3B8;font-size:13px">Gracias por confiar en MiNegocio. Estamos para ayudarte a hacer crecer tu negocio.</p>
        """,
        "Ir a Mi Panel",
        f"{APP_URL}/panel"
    )
