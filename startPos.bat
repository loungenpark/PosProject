@echo off
title PosProject - Restaurant POS System
echo ==========================================
echo Starting PosProject...
echo Configuration: Loaded from .env.local
echo ==========================================

:: Navigate to the directory where this script is located
cd /d "%~dp0"

:: Run the project (starts both backend and frontend)
call npm run dev

:: Keep the window open if the server stops or crashes
pause