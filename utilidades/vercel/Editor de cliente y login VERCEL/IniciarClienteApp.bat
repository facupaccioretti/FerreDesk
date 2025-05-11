@echo off
title Sistema de Clientes
color 0A
echo ===================================
echo    Iniciando Sistema de Clientes
echo ===================================
echo.
cd /d "%~dp0"
start http://localhost:3000
echo Iniciando servidor...
npm run dev
pause 