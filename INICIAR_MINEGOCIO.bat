@echo off
title MiNegocio - Sistema de Ventas
color 0A

echo.
echo  ╔══════════════════════════════════════╗
echo  ║         MINEGOCIO v1.0               ║
echo  ║    Sistema de Ventas - Kioscos       ║
echo  ╚══════════════════════════════════════╝
echo.
echo  PASO 1: Verificando Python...
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  ERROR: Python no esta instalado.
    echo.
    echo  Para instalar: https://www.python.org/downloads/
    echo  Marcar "Add Python to PATH" durante la instalacion.
    echo.
    pause
    exit /b 1
)
echo  Python encontrado. Iniciando backend...
echo.

:: Iniciar backend Python en background
start "MiNegocio Backend" /min cmd /c "title MiNegocio Backend && cd /d "%~dp0backend" && python -m uvicorn main:app --host 0.0.0.0 --port 8005"

:: Esperar 5 segundos a que el servidor levante
echo  Esperando 5 segundos para que el backend arranque...
timeout /t 5 /nobreak >nul

:: Verificar que el backend responda
echo  Verificando conexion con el backend...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8005/api/health' -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ADVERTENCIA: El backend no responde en http://localhost:8005
    echo  Posibles causas:
    echo    - Python no tiene las dependencias (fastapi, uvicorn, aiosqlite)
    echo    - El puerto 8005 esta ocupado por otro programa
    echo    - La base de datos (.db) esta corrupta
    echo.
    echo  Solucion rapida:
    echo    1. Abri una terminal nueva
    echo    2. Navega a: %~dp0backend
    echo    3. Ejecuta: pip install fastapi uvicorn aiosqlite
    echo    4. Ejecuta: python main.py (para ver errores en pantalla)
    echo.
    echo  El sistema seguira intentando iniciar el frontend...
    echo.
) else (
    echo  Backend OK!
)
echo.

echo  PASO 2: Iniciando frontend...
start "MiNegocio Frontend" /min cmd /c "title MiNegocio Frontend && cd /d "%~dp0frontend" && npm run dev"

:: Esperar 5 segundos a que Vite compile
timeout /t 5 /nobreak >nul

echo.
echo  ╔══════════════════════════════════════╗
echo  ║  MiNegocio abierto en el navegador   ║
echo  ║                                      ║
echo  ║  API Backend: http://localhost:8005  ║
echo  ║  Panel:       http://localhost:5175  ║
echo  ║                                      ║
echo  ║  SI NO SE ABRE SOLO:                ║
echo  ║  Abri el navegador y anda a         ║
echo  ║  http://localhost:5175              ║
echo  ║                                      ║
echo  ║  [X] Cerrar esta ventana = apagar    ║
echo  ╚══════════════════════════════════════╝
echo.

:: Abrir el navegador
start http://localhost:5175

echo.
echo  ══════════════════════════════════════════
echo  🛑 NO CERRAR ESTA VENTANA mientras trabaja
echo  ══════════════════════════════════════════
echo.
echo  Si el sistema no anda:
echo    1. Cerra esta ventana (apaga todo)
echo    2. Abri INICIAR_MINEGOCIO.bat de vuelta
echo    3. Si persiste: abri cmd en backend\ y corre:
echo       pip install fastapi uvicorn aiosqlite
echo       python main.py
echo.
echo  Para ayuda: preguntale a quien te instalo el sistema
echo.
pause
