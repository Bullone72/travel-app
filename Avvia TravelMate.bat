@echo off
title TravelMate - Gestione Viaggi
echo.
echo  ================================
echo   TravelMate - Gestione Viaggi
echo  ================================
echo.
echo  Avvio del server in corso...
echo  Chiudi questa finestra per fermare il server.
echo.

cd /d "%~dp0"

"C:\Program Files\nodejs\npm.cmd" run dev

pause
