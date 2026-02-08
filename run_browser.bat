@echo off
cd /d %~dp0
echo Starting ComfyUI Image Browser...
echo Opening http://localhost:18001

:: Open browser automatically handled by app.py

:: Start the server
python app.py

pause
