@echo off
REM Installa le dipendenze del backend. Non avvia niente: e' il passo lento,
REM da fare la prima volta e quando cambia package.json, mentre start.bat
REM resta immediato.
setlocal
cd /d "%~dp0backend"

echo ============================================
echo   Focus - build
echo ============================================

where node >nul 2>&1 || goto :niente_node

echo [build] npm install
call npm install || goto :errore

echo.
echo [build] fatto. Avvia con start.bat
exit /b 0

:niente_node
echo.
echo [build] Node.js non e' installato ^(o non e' nel PATH^).
echo         Scaricalo da https://nodejs.org, oppure usa container.bat
echo         che Node se lo porta dentro l'immagine.
exit /b 1

:errore
echo.
echo [build] BUILD FALLITA.
exit /b 1
