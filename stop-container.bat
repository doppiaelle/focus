@echo off
REM Ferma SOLO il container, lasciando acceso il server dal sorgente.
REM
REM Serve perche' "podman run" in primo piano e' un client: uccidere quel
REM processo chiude la finestra, non il container, che resta acceso e tiene la
REM porta. Il container si ferma per nome.
setlocal
cd /d "%~dp0"

set "PORTA=3006"
if defined FOCUS_PORTA_CONTAINER set "PORTA=%FOCUS_PORTA_CONTAINER%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1" -Porta %PORTA% -SoloContainer
exit /b %ERRORLEVEL%
