#!/bin/sh
# Launcher for MSYS2 / Git Bash / Cygwin / WSL
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if command -v powershell.exe >/dev/null 2>&1; then
    exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT_DIR/ColorHarmonyLab-GUI.ps1" "$@"
elif command -v pwsh >/dev/null 2>&1; then
    exec pwsh -NoProfile -File "$SCRIPT_DIR/ColorHarmonyLab-GUI.ps1" "$@"
elif command -v powershell >/dev/null 2>&1; then
    exec powershell -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT_DIR/ColorHarmonyLab-GUI.ps1" "$@"
else
    echo "Neither powershell.exe nor pwsh was found in your PATH."
    echo "Opening offline web runner in your default browser..."
    if command -v start >/dev/null 2>&1; then
        start "$SCRIPT_DIR/ColorHarmonyLab-Offline.html"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$SCRIPT_DIR/ColorHarmonyLab-Offline.html"
    elif command -v open >/dev/null 2>&1; then
        open "$SCRIPT_DIR/ColorHarmonyLab-Offline.html"
    fi
fi
