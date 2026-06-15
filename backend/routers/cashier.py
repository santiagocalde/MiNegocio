from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Optional
import json, os
import main
from main import USE_PG

router = APIRouter()
app = APIRouter()


class PrintConfig(BaseModel):
    enabled: bool = False
    mode: str = "window_print"
    printer_name: str = ""
    auto_print_ticket: bool = False
    auto_open_drawer: bool = False


class DrawerOpenRequest(BaseModel):
    printer_name: Optional[str] = None


class PrintRequest(BaseModel):
    printer_name: Optional[str] = None
    ticket_text: str = ""


@router.get("/api/config/printing", summary="Obtener config de impresion")
async def get_print_config_endpoint() -> PrintConfig:
    if USE_PG:
        from db_helpers import get_pg_pool
        b_id = main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT print_config FROM business_config WHERE business_id = $1", b_id)
            if row and row["print_config"]:
                try:
                    cfg = json.loads(row["print_config"])
                    return PrintConfig(**cfg)
                except: pass
    return PrintConfig()


@router.put("/api/config/printing", summary="Actualizar config de impresion")
async def update_print_config_endpoint(cfg: PrintConfig) -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        b_id = main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE business_config SET print_config = $1 WHERE business_id = $2",
                cfg.model_dump_json(), b_id
            )
        return {"success": True}
    return {"success": True}


@router.post("/api/cash-drawer/open", summary="Abrir cajon fiscal")
async def open_cash_drawer(req: DrawerOpenRequest = Body(default=None)) -> dict:
    return {"success": True, "message": "Cajon abierto (simulado)"}


@router.post("/api/print/ticket", summary="Imprimir ticket")
async def print_ticket(req: PrintRequest) -> dict:
    return {"success": True, "message": "Ticket impreso (simulado)"}


@router.get("/api/agent/ping", summary="Ping al agente local")
async def agent_ping() -> dict:
    return {"status": "ok", "agent": "disponible"}


@router.post("/api/agent/register", summary="Registrar agente local")
async def register_agent(host: str = Body("127.0.0.1"), port: int = Body(8199)) -> dict:
    return {"success": True, "host": host, "port": port}
