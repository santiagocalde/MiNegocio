"""
Tests de la lógica de billing/métricas nueva: verificación de firma del webhook
de MercadoPago (seguridad), MRR normalizado y motivos de baja.

Corren sin PostgreSQL ni red: prueban funciones puras del router de billing.
"""
import hashlib
import hmac
import os
import sys
import types

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("SAAS_MODE", "false")
os.environ.setdefault("APP_ENV", "test")

from routers import billing


def _fake_request(headers: dict):
    """Stub mínimo: _verify_mp_signature solo usa request.headers.get(...)."""
    return types.SimpleNamespace(headers=headers)


# ── MRR normalizado ───────────────────────────────────────────

def test_mrr_for_monthly():
    assert billing._mrr_for("simple", "monthly") == 20000
    assert billing._mrr_for("pro", "monthly") == 30000
    assert billing._mrr_for("ia", "monthly") == 40000


def test_mrr_for_yearly_is_normalized_to_month():
    # El plan anual se prorratea a mes (yearly / 12).
    assert billing._mrr_for("simple", "yearly") == round(200000 / 12)
    assert billing._mrr_for("pro", "yearly") == round(300000 / 12)


def test_mrr_for_unknown_plan_is_zero():
    assert billing._mrr_for("desconocido", "monthly") == 0
    assert billing._mrr_for("trial", "monthly") == 0


# ── Verificación de firma del webhook (seguridad) ─────────────

def test_signature_valid(monkeypatch):
    monkeypatch.setattr(billing, "MP_WEBHOOK_SECRET", "s3cr3t")
    monkeypatch.setattr(billing, "APP_ENV", "production")
    data_id, ts, request_id = "12345", "1700000000", "req-abc"
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts}"
    v1 = hmac.new(b"s3cr3t", manifest.encode(), hashlib.sha256).hexdigest()
    req = _fake_request({"x-signature": f"ts={ts},v1={v1}", "x-request-id": request_id})
    assert billing._verify_mp_signature(req, data_id) is True


def test_signature_invalid_is_rejected(monkeypatch):
    monkeypatch.setattr(billing, "MP_WEBHOOK_SECRET", "s3cr3t")
    req = _fake_request({"x-signature": "ts=1,v1=deadbeef", "x-request-id": "r"})
    assert billing._verify_mp_signature(req, "12345") is False


def test_signature_rejected_in_prod_without_secret(monkeypatch):
    """Sin secret en producción, el webhook NO se acepta (evita activaciones falsas)."""
    monkeypatch.setattr(billing, "MP_WEBHOOK_SECRET", "")
    monkeypatch.setattr(billing, "APP_ENV", "production")
    req = _fake_request({})
    assert billing._verify_mp_signature(req, "12345") is False


def test_signature_degrades_outside_prod(monkeypatch):
    """Fuera de producción (dev/test) sí se degrada para poder probar sin secret."""
    monkeypatch.setattr(billing, "MP_WEBHOOK_SECRET", "")
    monkeypatch.setattr(billing, "APP_ENV", "test")
    req = _fake_request({})
    assert billing._verify_mp_signature(req, "12345") is True


# ── Motivos de baja ───────────────────────────────────────────

def test_cancel_reasons_contains_expected():
    assert {"precio", "no_lo_uso", "cambie_sistema", "otro"} <= billing.CANCEL_REASONS
