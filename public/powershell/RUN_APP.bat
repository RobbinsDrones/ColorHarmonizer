@echo off
title Launch Photo Color Harmony Lab
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ColorHarmonyLab-GUI.ps1"
if %ERRORLEVEL% NEQ 0 (
    start "" "%~dp0ColorHarmonyLab-Offline.html"
)
