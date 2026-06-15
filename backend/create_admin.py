import sqlite3
import bcrypt
import uuid
import os

db_path = 'd:/Codigo/SoftwareKioscos/backend/data/novastock.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if admin123 exists
email = 'admin123@kiosco.com'
cursor.execute('SELECT * FROM businesses WHERE email = ?', (email,))
if not cursor.fetchone():
    pwd = b'password123'
    hashed = bcrypt.hashpw(pwd, bcrypt.gensalt()).decode('utf-8')
    
    business_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO businesses (id, email, password_hash, business_name, plan, status) 
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (business_id, email, hashed, 'Kiosco Admin', 'pro', 'active'))
    conn.commit()
    print(f'User {email} created in central DB.')
    
    # Initialize the tenant database
    tenant_db_path = f'd:/Codigo/SoftwareKioscos/backend/data/novastock_{business_id}.db'
    # we don't have init_db easily accessible in synchronous python without importing the fastAPI app, 
    # but we can create the operators table.
    conn2 = sqlite3.connect(tenant_db_path)
    c2 = conn2.cursor()
    c2.execute('''
    CREATE TABLE IF NOT EXISTS operators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        pin TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'operator'
    )
    ''')
    # the PIN screen asks for the pin. Let's make the pin '1234'.
    c2.execute("INSERT INTO operators (name, pin, role) VALUES ('Admin', '1234', 'admin')")
    conn2.commit()
    print('Tenant DB and operator PIN (1234) initialized.')
else:
    print(f'User {email} already exists.')
