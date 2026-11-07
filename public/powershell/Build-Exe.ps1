<#
.SYNOPSIS
    Build-Exe.ps1 - Automated Compiler from PowerShell (.ps1) to Windows Executable (.exe)
.DESCRIPTION
    Converts 'ColorHarmonyLab-GUI.ps1' into a standalone Windows .exe application.
    - Installs or validates the 'ps2exe' PowerShell module
    - Configures '-noConsole' so it runs like a native desktop GUI app without terminal flicker
    - Embeds application metadata, high-DPI support, and clean compilation options
.EXAMPLE
    .\Build-Exe.ps1
    .\Build-Exe.ps1 -Target "WebRunner"
#>

param(
    [ValidateSet("GUI", "WebRunner")]
    [string]$Target = "GUI",
    
    [string]$OutputFile = "ColorHarmonyLab.exe",
    [string]$IconPath = "",
    [switch]$KeepConsole
)

$ErrorActionPreference = "Stop"

Write-Host @"
========================================================================
   🚀 Photo Color Analysis Lab - PowerShell to EXE Compiler
========================================================================
"@ -ForegroundColor Cyan

# 1. Check Execution Policy
$policy = Get-ExecutionPolicy
if ($policy -eq 'Restricted') {
    Write-Warning "PowerShell ExecutionPolicy is currently 'Restricted'."
    Write-Host "Setting ExecutionPolicy to RemoteSigned for CurrentUser..." -ForegroundColor Yellow
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
}

# 2. Check for ps2exe module
Write-Host "[1/4] Checking for 'ps2exe' compiler module..." -ForegroundColor Cyan
if (-not (Get-Module -ListAvailable -Name ps2exe)) {
    Write-Host "      'ps2exe' module not found. Installing from PSGallery..." -ForegroundColor Yellow
    try {
        Install-Module -Name ps2exe -Scope CurrentUser -Force -AllowClobber
        Write-Host "      Successfully installed 'ps2exe'!" -ForegroundColor Green
    } catch {
        Write-Error "Failed to install ps2exe: $($_.Exception.Message). Please run as Administrator or check internet connection."
        return
    }
} else {
    Write-Host "      'ps2exe' module is installed and ready." -ForegroundColor Green
}

# 3. Locate Source Script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$sourceScript = if ($Target -eq "GUI") {
    Join-Path $scriptDir "ColorHarmonyLab-GUI.ps1"
} else {
    Join-Path $scriptDir "ColorHarmonyLab-WebRunner.ps1"
}

if (-not (Test-Path $sourceScript)) {
    Write-Error "Source file '$sourceScript' not found in $scriptDir!"
    return
}

$outputExe = Join-Path $scriptDir $OutputFile
Write-Host "[2/4] Source script: $sourceScript" -ForegroundColor Cyan
Write-Host "      Target binary: $outputExe" -ForegroundColor Cyan

# 4. Assemble Compiler Arguments
Write-Host "[3/4] Configuring compilation flags..." -ForegroundColor Cyan
$compileParams = @{
    inputFile   = $sourceScript
    outputFile  = $outputExe
    title       = "Photo Color Analysis & Harmony Lab"
    description = "Interactive color wheel harmony analyzer and Lightroom grader"
    company     = "Color Harmony Studio"
    product     = "ColorHarmonyLab"
    version     = "1.0.0.0"
    copyright   = "(c) 2026 Color Harmony Lab"
    DPIAware    = $true
}

if (-not $KeepConsole) {
    # Suppress console window so GUI opens natively like a standard Windows app
    $compileParams["noConsole"] = $true
}

if ($IconPath -and (Test-Path $IconPath)) {
    $compileParams["iconFile"] = $IconPath
}

# 5. Invoke PS2EXE
Write-Host "[4/4] Invoking compiler..." -ForegroundColor Cyan
try {
    Invoke-PS2EXE @compileParams
    
    if (Test-Path $outputExe) {
        $fileInfo = Get-Item $outputExe
        $sizeMB = [Math]::Round(($fileInfo.Length / 1MB), 2)
        Write-Host @"
========================================================================
   SUCCESS! Standalone Executable Created:
   📁 $outputExe ($sizeMB MB)
========================================================================
   You can now double-click '$OutputFile' to launch the app!
   No PowerShell prompt required.
========================================================================
"@ -ForegroundColor Green
    }
} catch {
    Write-Error "Compilation failed: $($_.Exception.Message)"
}
