@echo off
REM Ferma il backend di Focus, in qualunque modo sia stato avviato, e libera
REM le porte.
REM
REM Due casi diversi, e confonderli fa danni:
REM
REM   sorgente (start.bat) -- la porta la tiene node. Si chiude il processo,
REM   e prima i suoi figli: un figlio orfano tiene vivo il socket mentre il
REM   padre risulta gia' morto, e la porta resta occupata da un fantasma.
REM
REM   container (container.bat) -- la porta la pubblica il MOTORE (gvproxy di
REM   podman), non il container. Ucciderlo non spegne Focus: spegne podman, e
REM   con lui ogni altro container della macchina. Il container si ferma per
REM   nome, e basta.
setlocal
cd /d "%~dp0"

REM Senza argomenti ferma TUTTE le modalita': e' quello che ci si aspetta da
REM "stop". Per fermarne una sola: stop.ps1 -Porta 3006
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1" -Tutto
exit /b %ERRORLEVEL%
