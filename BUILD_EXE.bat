@echo off
title Build ColorHarmonyLab.exe
echo ========================================================================
echo    Photo Color Analysis & Harmony Lab - EXE Builder
echo ========================================================================
echo.
echo Launching PowerShell compiler script...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& { cd '%~dp0public\powershell'; .\Build-Exe.ps1 -Target GUI -OutputFile '..\..\ColorHarmonyLab.exe' }"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================================
    echo  [SUCCESS] ColorHarmonyLab.exe is ready in this folder!
    echo ========================================================================
) else (
    echo.
    echo [NOTE] If ps2exe installation required confirmation, run PowerShell as Administrator.
)

echo.
pause
