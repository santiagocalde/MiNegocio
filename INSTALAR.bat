@echo off
title MiNegocio - Instalacion
color 0A
echo.
echo  ╔══════════════════════════════════════╗
echo  ║       MINEGOCIO - INSTALACION        ║
echo  ║    Sistema de Ventas para Kioscos    ║
echo  ╚══════════════════════════════════════╝
echo.
echo  Verificando Python...

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Python no encontrado.
    echo  Por favor descarga Python desde: https://www.python.org/downloads/
    echo  IMPORTANTE: Tildar "Add Python to PATH" durante la instalacion.
    echo.
    pause
    exit /b 1
)

echo  [OK] Python encontrado.
echo.
echo  Instalando dependencias del servidor...
echo  (Esto puede tardar 2-3 minutos la primera vez)
echo.

cd /d "%~dp0backend"
pip install -r requirements.txt --quiet

if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] No se pudieron instalar las dependencias.
    echo  Verificar conexion a internet e intentar de nuevo.
    pause
    exit /b 1
)

echo.
echo  Instalando dependencias del panel de ventas...
echo.

cd /d "%~dp0"
call npm install --silent

if %errorlevel% neq 0 (
    echo.
    echo  [ADVERTENCIA] npm no encontrado. El panel visual puede no funcionar.
    echo  Descarga Node.js desde: https://nodejs.org/
    echo.
)

echo.
echo  ╔══════════════════════════════════════╗
echo  ║     INSTALACION COMPLETADA  ✓        ║
echo  ║                                      ║
echo  ║  Ahora ejecuta: INICIAR_MINEGOCIO.bat║
echo  ╚══════════════════════════════════════╝
echo.
pause
