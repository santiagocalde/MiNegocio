# DEPRECATED - This module is no longer used.
# All auth/db functions moved to main.py.
# Keep file temporarily to avoid breaking `from core.dependencies import` until
# all callers (ai.py) are updated.
# Scheduled for removal: next deploy cycle.

import os
import aiosqlite
from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import Request, HTTPException
from typing import Optional

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.abspath(os.path.join(DATA_DIR, "novastock.db"))
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-change-me-in-production")
JWT_ALGORITHM = "HS256"

def row_to_dict(row, description):
    if not row: return None
    return {description[i][0]: value for i, value in enumerate(row)}

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_business(request: Request) -> Optional[dict]:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access": return None
        return payload
    except JWTError:
        return None
