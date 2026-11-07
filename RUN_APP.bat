@echo off
title Launch Photo Color Harmony Lab
echo ========================================================================
echo    Launching Photo Color Analysis & Harmony Lab (Native Desktop GUI)
echo ========================================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0public\powershell\ColorHarmonyLab-GUI.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Opening portable offline web edition in default browser...
    start "" "%~dp0public\powershell\ColorHarmonyLab-Offline.html"
)
