"""
Agente Local NovaStock para Cajón Fiscal + Impresión Térmica
============================================================
Reemplazo ligero de QZ Tray. Corre en la misma PC que el kiosco.
Expone un mini HTTP API en http://localhost:8199 para:
  POST /open-drawer   → Abre el cajón de dinero (ESC/POS raw)
  POST /print         → Imprime ticket en ticketera térmica
  GET  /ping          → Health check

Modo de uso:
  python agent.py                     # Puerto 8199 por defecto
  python agent.py --port 9199         # Puerto custom
  python agent.py --printer "EPSON"   # Nombre parcial de impresora

Requiere Python 3.8+ y win32print (built-in en Windows)
"""

import http.server
import json
import os
import sys
import socket
import argparse

HOST = "127.0.0.1"
PORT = 8199
PRINTER_NAME = None

ESC = b'\x1b'
OPEN_DRAWER = ESC + b'p\x00\x19\xfa'
OPEN_DRAWER_ALT = ESC + b'p\x01\x19\xfa'
CUT_PAPER = ESC + b'm'
INIT_PRINTER = ESC + b'@'

def find_printer(hint=None):
    try:
        import win32print
        printers = win32print.EnumPrinters(2)
        if hint:
            for p in printers:
                if hint.lower() in p[2].lower():
                    return p[2]
        if printers:
            return printers[0][2]
    except ImportError:
        pass
    return None

def send_raw_to_printer(printer_name, data):
    try:
        import win32print
        hprinter = win32print.OpenPrinter(printer_name)
        try:
            hjob = win32print.StartDocPrinter(hprinter, 1, ("NovaStock Ticket", None, "RAW"))
            try:
                win32print.StartPagePrinter(hprinter)
                win32print.WritePrinter(hprinter, data)
                win32print.EndPagePrinter(hprinter)
            finally:
                win32print.EndDocPrinter(hprinter)
        finally:
            win32print.ClosePrinter(hprinter)
        return True
    except Exception as e:
        print(f"[agent] Error enviando a impresora: {e}", file=sys.stderr)
        return False

class AgentHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[agent] {args[0]} {args[1]} {args[2]}")

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/ping":
            return self._json(200, {"status": "ok", "agent": "novastock-agent"})
        self._json(404, {"error": "not found"})

    def do_POST(self):
        body_len = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(body_len)) if body_len else {}

        if self.path == "/open-drawer":
            printer = body.get("printer") or PRINTER_NAME or find_printer()
            if not printer:
                return self._json(400, {"error": "No se encontró impresora térmica"})
            ok = send_raw_to_printer(printer, INIT_PRINTER + OPEN_DRAWER)
            result = {"status": "ok" if ok else "error", "printer": printer}
            self._json(200 if ok else 500, result)

        elif self.path == "/print":
            printer = body.get("printer") or PRINTER_NAME or find_printer()
            text = body.get("text", "")
            if not printer:
                return self._json(400, {"error": "No se encontró impresora térmica"})
            if not text:
                return self._json(400, {"error": "No hay texto para imprimir"})
            raw = INIT_PRINTER + text.encode("latin-1", errors="replace") + b'\n\n\n' + CUT_PAPER
            ok = send_raw_to_printer(printer, raw)
            self._json(200 if ok else 500, {"status": "ok" if ok else "error", "printer": printer})

        elif self.path == "/find-printers":
            printers = []
            try:
                import win32print
                for p in win32print.EnumPrinters(2):
                    printers.append({"name": p[2], "driver": p[3], "port": p[4]})
            except ImportError:
                pass
            self._json(200, {"printers": printers})

        else:
            self._json(404, {"error": "not found"})

def main():
    global PORT, PRINTER_NAME
    parser = argparse.ArgumentParser(description="NovaStock Local Agent - Cajón + Impresión")
    parser.add_argument("--port", type=int, default=8199, help="Puerto (default: 8199)")
    parser.add_argument("--printer", type=str, default=None, help="Nombre parcial de impresora")
    args = parser.parse_args()
    PORT = args.port
    PRINTER_NAME = args.printer

    detected = find_printer(PRINTER_NAME)
    if detected:
        print(f"[agent] Impresora detectada: {detected}")
    else:
        print(f"[agent] Advertencia: No se detectó impresora térmica")

    server = http.server.HTTPServer((HOST, PORT), AgentHandler)
    print(f"[agent] NovaStock Agent corriendo en http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[agent] Cerrando...")
        server.server_close()

if __name__ == "__main__":
    main()
