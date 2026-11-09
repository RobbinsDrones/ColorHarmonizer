@echo off
title Photo Color Harmony Lab - Full Offline Desktop Launcher
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ColorHarmonyLab-WebRunner.ps1"
if %ERRORLEVEL% NEQ 0 (
    start "" "%~dp0web\index.html"
)
