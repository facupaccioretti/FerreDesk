@echo off
echo Iniciando servidor Next.js...
cd /d "%~dp0"
start http://localhost:3000
npm run dev
pause 