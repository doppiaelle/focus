@echo off
REM Avvia il backend di Focus nel container, con i dati nel volume
REM "focus-data" invece che nel file locale backend\data\focus.db. Il
REM filesystem di un container e' usa-e-getta: senza volume ogni riavvio
REM cancellerebbe il database.
REM
REM Gira in primo piano di proposito: chiudere la finestra ferma il server,
REM come per ogni altra modalita'. Il volume resta, quindi i dati no.
setlocal
cd /d "%~dp0"

REM Porta diversa da start.bat, cosi' sorgente e container possono stare
REM accesi insieme. Dentro il container il server ascolta sempre sulla 3001
REM (vedi Containerfile) -- qui si cambia solo la mappatura esterna, e si
REM sceglie 3006 per restare fuori dalla fascia 3001-3003 gia' affollata
REM (LL, vulntracker).
set "PORTA=3006"
if defined FOCUS_PORTA_CONTAINER set "PORTA=%FOCUS_PORTA_CONTAINER%"
set "VOLUME=focus-data"
set "IMMAGINE=focus-backend"

echo ============================================
echo   Focus - container (dati persistenti)
echo ============================================

where podman >nul 2>&1 || goto :niente_podman

REM Ferma solo un container omonimo rimasto acceso: il server dal sorgente ha
REM una porta sua e non c'entra niente.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1" -Porta %PORTA% -SoloContainer || goto :porta_occupata

echo [container] volume %VOLUME%
podman volume exists %VOLUME%
if errorlevel 1 (
    podman volume create %VOLUME% || goto :errore
) else (
    echo [container] gia' presente, lo riuso.
)

echo [container] build dell'immagine %IMMAGINE% ^(la prima volta ci mette qualche minuto^)
podman build -t %IMMAGINE% -f Containerfile . || goto :errore
echo [container] immagine pronta.

echo.
echo [container] avvio su http://127.0.0.1:%PORTA%
echo [container] per fermarlo: chiudi questa finestra
echo.
REM --replace: un container omonimo gia' esistente ma spento (per esempio
REM avviato a mano con -d, che non si cancella da solo) farebbe fallire il
REM run con 'name already in use'. Qui lo si sostituisce, invece di dare un
REM errore che non spiega cosa fare.
podman run --rm --replace --name focus -p %PORTA%:3001 -v %VOLUME%:/app/data %IMMAGINE%
exit /b %ERRORLEVEL%

:niente_podman
echo.
echo [container] podman non e' installato ^(o non e' nel PATH^).
echo             Installalo, oppure usa start.bat per la versione dal sorgente.
exit /b 1

:porta_occupata
echo.
echo [container] la porta %PORTA% e' occupata e non si e' liberata: avvio annullato.
exit /b 1

:errore
echo.
echo [container] preparazione fallita: i messaggi qui sopra dicono cosa e' andato storto.
exit /b 1
