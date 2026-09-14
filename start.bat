@echo off
REM Avvia il backend di Focus dal sorgente: "npm install" se manca, poi
REM "npm start" come da README del progetto. E' la via veloce per lavorarci
REM sopra; per la versione in container vedi container.bat.
REM
REM Il frontend (index.html, js/, css/) NON viene servito da questo script:
REM il backend serve i file statici solo se trova una cartella "dist" (vedi
REM server.js), che qui non esiste ancora. Per ora il frontend resta un
REM discorso separato -- questo avvia solo le API.
setlocal
cd /d "%~dp0backend"

REM La 3001 su questa macchina e' gia' contesa (dashboard di LL, "dev" di
REM vulntracker): Focus sta piu' in la', dove nessun altro progetto arriva.
set "PORTA=3005"
if defined FOCUS_PORTA set "PORTA=%FOCUS_PORTA%"

REM Libera la SOLA porta di questo avvio: un'istanza precedente rimasta
REM appesa farebbe fallire il bind con un errore poco leggibile. Il container
REM ha una porta sua e resta acceso: accendere uno non deve spegnere l'altro.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1" -Porta %PORTA% || goto :porta_occupata

if not exist "node_modules" (
    echo [start] dipendenze assenti: eseguo build.bat
    call "%~dp0build.bat" || goto :errore
)

if not exist ".env" if exist ".env.example" (
    echo [start] creo .env da .env.example
    copy /y ".env.example" ".env" >nul
)

echo.
echo [start] Focus backend su http://127.0.0.1:%PORTA%
echo [start] per fermarlo: chiudi questa finestra, o lancia stop.bat (ferma tutto)
echo.

set "PORT=%PORTA%"
call npm start
exit /b %ERRORLEVEL%

:porta_occupata
echo.
echo [start] la porta %PORTA% e' occupata e non si e' liberata: avvio annullato.
exit /b 1

:errore
echo.
echo [start] preparazione fallita: vedi i messaggi di build.bat qui sopra.
exit /b 1
