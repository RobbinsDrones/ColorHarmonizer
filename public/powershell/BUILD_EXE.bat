@echo off
title Build ColorHarmonyLab.exe
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Build-Exe.ps1" -Target GUI -OutputFile "ColorHarmonyLab.exe"
pause
