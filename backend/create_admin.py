"""
Crea (o verifica) una cuenta de superadmin.

Las credenciales se toman de variables de entorno — NUNCA hardcodeadas:
    ADMIN_EMAIL     correo del superadmin
    ADMIN_PASSWORD  contraseña (mínimo 8 caracteres)
    ADMIN_PIN       PIN de operador (4 dígitos, opcional, default aleatorio)

Uso:
    ADMIN_EMAIL=jefe@kiosco.com ADMIN_PASSWORD='unaClaveFuerte' python create_admin.py

Funciona en modo SQLite local (usa DATA_DIR del backend). Para PostgreSQL
en producción, gestioná el superadmin desde el panel de admin.
"""
import os
import sys
import uuid
import secrets
import sqlite3

import bcrypt

EMAIL    = os.getenv("ADMIN_EMAIL", "").strip()
PASSWORD = os.getenv("ADMIN_PASSWORD", "")
PIN      = os.getenv("ADMIN_PIN", "").strip()

if not EMAIL or not PASSWORD:
    sys.exit("✗ Definí ADMIN_EMAIL y ADMIN_PASSWORD como variables de entorno.")
if len(PASSWORD) < 8:
    sys.exit("✗ ADMIN_PASSWORD debe tener al menos 8 caracteres.")
if PIN and (len(PIN) != 4 or not PIN.isdigit()):
    sys.exit("✗ ADMIN_PIN debe ser de 4 dígitos.")
if not PIN:
    PIN = f"{secrets.randbelow(10000):04d}"

# Ruta portable: data/ junto a este script (no rutas absolutas de Windows).
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "minegocio.db")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("SELECT id FROM businesses WHERE email = ?", (EMAIL,))
if cursor.fetchone():
    print(f"El usuario {EMAIL} ya existe.")
    conn.close()
    sys.exit(0)

hashed = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode("utf-8")
business_id = str(uuid.uuid4())
cursor.execute(
    """INSERT INTO businesses (id, email, password_hash, business_name, plan, status)
       VALUES (?, ?, ?, ?, ?, ?)""",
    (business_id, EMAIL, hashed, "Kiosco Admin", "pro", "active"),
)
conn.commit()
print(f"✓ Superadmin {EMAIL} creado en la DB central.")

tenant_db_path = os.path.join(DATA_DIR, f"minegocio_{business_id}.db")
conn2 = sqlite3.connect(tenant_db_path)
c2 = conn2.cursor()
c2.execute(
    """CREATE TABLE IF NOT EXISTS operators (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        pin  TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'operator'
    )"""
)
c2.execute("INSERT INTO operators (name, pin, role) VALUES ('Admin', ?, 'admin')", (PIN,))
conn2.commit()
conn2.close()
conn.close()
print(f"✓ DB del tenant inicializada. PIN de operador: {PIN}")
