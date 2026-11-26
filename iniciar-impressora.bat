@echo off
cd /d "%~dp0"
echo Iniciando Agente de Impressao Mercadinho do Geleia (VOX(U) 1)...
npx tsx server/print-agent.ts
pause
