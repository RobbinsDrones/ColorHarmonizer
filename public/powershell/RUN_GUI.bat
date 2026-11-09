@echo off
title Photo Color Harmony Lab - WinForms Desktop GUI
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ColorHarmonyLab-GUI.ps1"
if %ERRORLEVEL% NEQ 0 (
    pause
)
