@echo off
title IRIS - copiloto desktop
cd /d "%~dp0..\.."
set VERA_ACCESS_TOKEN=dev-token
set ALLOW_DEV_SESSION=1
set VERA_API_ORIGIN=http://localhost:3000
echo.
echo  A abrir a IRIS (overlay flutuante)...
echo  Deixa ESTA janela aberta. Fecha a IRIS pela bandeja (tray) ^> "Sair".
echo.
call pnpm --filter desktop exec electron .
echo.
echo  (a IRIS fechou)
pause
