@echo off
title TravelMate - Backup Monitor (Resilio Sync)
echo.
echo  ==============================================
echo   TravelMate - Backup Monitor per Resilio Sync
echo  ==============================================
echo.
echo  Monitora la cartella Downloads per i file
echo  travelmate-backup-*.json e li copia nella
echo  cartella Resilio Sync.
echo.
echo  Chiudi questa finestra per fermare il monitor.
echo.

set "SOURCE=%USERPROFILE%\Downloads"
set "DEST=C:\Users\alexb\OneDrive\Documenti\Travel Mate backup"

if not exist "%DEST%" (
    echo  Errore: cartella Resilio Sync non trovata: %DEST%
    echo  Modifica il file "Avvia Backup Monitor.bat" e imposta il percorso corretto.
    pause
    exit /b 1
)

echo  Cartella sorgente: %SOURCE%
echo  Cartella backup:  %DEST%
echo.
echo  Backup automatico ATTIVO.
echo.

:loop
if exist "%SOURCE%\travelmate-backup-*.json" (
    for %%f in ("%SOURCE%\travelmate-backup-*.json") do (
        if not exist "%DEST%\%%~nxf" (
            copy "%%f" "%DEST%\" >nul
            if %errorlevel%==0 (
                echo  [%date% %time%] Backup copiato: %%~nxf
                del "%%f"
            )
        ) else (
            del "%%f"
        )
    )
)
timeout /t 5 /nobreak >nul
goto loop
