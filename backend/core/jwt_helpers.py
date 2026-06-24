"""
Helpers de JWT: creación de tokens y dependencia get_current_business.
"""
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Header, HTTPException
from jose import JWTError, jwt

JWT_SECRET    = os.getenv("JWT_SECRET", "dev-insecure-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS   = 7


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload.update({"exp": expire, "type": "access"})
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload.update({"exp": expire, "type": "refresh"})
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_business(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Dependencia FastAPI: valida JWT y enriquece payload con el plan desde DB."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token invalido")
        try:
            from db import get_pool
            pool = await get_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow("SELECT plan FROM businesses WHERE id = $1", payload["sub"])
            payload["plan"] = row["plan"] if row else "trial"
        except Exception:
            payload["plan"] = "trial"
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expirado o inválido")
