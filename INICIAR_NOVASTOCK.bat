@echo off
title NovaStock - Sistema de Ventas
color 0A

echo.
echo  ╔══════════════════════════════════════╗
echo  ║         NOVASTOCK v1.0               ║
echo  ║    Sistema de Ventas - Kioscos       ║
echo  ╚══════════════════════════════════════╝
echo.
echo  Iniciando servidor...

:: Iniciar backend Python en background
start "NovaStock Backend" /min cmd /c "cd /d "%~dp0backend" && python main.py"

:: Esperar 2 segundos a que el servidor levante
timeout /t 2 /nobreak >nul

:: Iniciar frontend en background
start "NovaStock Frontend" /min cmd /c "cd /d "%~dp0" && npm run dev"

:: Esperar 3 segundos a que Vite compile
timeout /t 3 /nobreak >nul

echo  Servidor iniciado. Abriendo NovaStock...
echo.

:: Abrir el navegador
start http://localhost:5173

echo  ╔══════════════════════════════════════╗
echo  ║  NovaStock abierto en el navegador   ║
echo  ║                                      ║
echo  ║  API Backend: http://localhost:8000  ║
echo  ║  Panel:       http://localhost:5173  ║
echo  ║                                      ║
echo  ║  [X] Cerrar esta ventana para apagar ║
echo  ╚══════════════════════════════════════╝
echo.
echo  NO CERRAR ESTA VENTANA mientras trabaja.
echo.
pause
