#!/bin/sh
# Build EXE script for MSYS2 / Git Bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if command -v powershell.exe >/dev/null 2>&1; then
    exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT_DIR/Build-Exe.ps1" -Target GUI -OutputFile "ColorHarmonyLab.exe" "$@"
elif command -v pwsh >/dev/null 2>&1; then
    exec pwsh -NoProfile -File "$SCRIPT_DIR/Build-Exe.ps1" -Target GUI -OutputFile "ColorHarmonyLab.exe" "$@"
else
    echo "Error: powershell.exe or pwsh is required to compile to Windows EXE." >&2
    exit 1
fi
