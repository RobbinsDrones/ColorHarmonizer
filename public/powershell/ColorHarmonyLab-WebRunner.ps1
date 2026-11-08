<#
.SYNOPSIS
    Photo Color Analysis & Harmony Lab - Local Web Server & Desktop Launcher
    Cross-Platform PowerShell (pwsh) Edition (Windows, macOS, Linux)
.DESCRIPTION
    Launches a lightweight, embedded local web server via System.Net.HttpListener
    that hosts the portable Photo Color Analysis & Harmony Lab locally with zero external
    dependencies or Node.js required. Automatically opens your default web browser
    or Microsoft Edge in native standalone application mode (--app).
    
    Can also be converted into a standalone .exe with ps2exe:
        Install-Module ps2exe -Scope CurrentUser
        Invoke-PS2EXE .\ColorHarmonyLab-WebRunner.ps1 .\ColorHarmonyLab-App.exe -noConsole -title "Color Harmony Lab"
#>

param(
    [int]$Port = 5050,
    [switch]$NoBrowser,
    [switch]$EdgeAppMode = $true
)

$hostUrl = "http://localhost:$Port/"

Write-Host @"
========================================================================
   [+] Photo Color Analysis & Harmony Lab - Local Desktop Host
   PowerShell / pwsh Local Host Engine
========================================================================
   - Listening on: $hostUrl
   - Cross-Platform: Windows, macOS, Linux pwsh
   - Press Ctrl+C in this terminal window to stop the server
========================================================================
"@ -ForegroundColor Cyan

# Locate offline HTML file
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$htmlPath = Join-Path $scriptDir "ColorHarmonyLab-Offline.html"

if (-not (Test-Path $htmlPath)) {
    # If not in same folder, look in parent or current dir
    $htmlPath = "ColorHarmonyLab-Offline.html"
}

# Start HttpListener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($hostUrl)

try {
    $listener.Start()
    Write-Host "[+] Local HTTP Listener started on port $Port" -ForegroundColor Green
} catch {
    Write-Warning "Could not start on port $Port ($($_.Exception.Message)). Trying port 5051..."
    $Port = 5051
    $hostUrl = "http://localhost:$Port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($hostUrl)
    $listener.Start()
    Write-Host "[+] Local HTTP Listener started on port $Port" -ForegroundColor Green
}

# Open browser or Edge App mode
if (-not $NoBrowser) {
    Start-Sleep -Milliseconds 400
    if ($IsWindows -or ($env:OS -like "*Windows*")) {
        $edgePaths = @(
            "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe",
            "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
            "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
        )
        $edgeFound = $false
        if ($EdgeAppMode) {
            foreach ($ep in $edgePaths) {
                if (Test-Path $ep) {
                    Start-Process -FilePath $ep -ArgumentList "--app=$hostUrl", "--window-size=1280,840"
                    $edgeFound = $true
                    Write-Host "[+] Launched Microsoft Edge in Standalone App Window Mode" -ForegroundColor Magenta
                    break
                }
            }
        }
        if (-not $edgeFound) {
            Start-Process $hostUrl
        }
    } elseif ($IsMacOS) {
        Start-Process "open" $hostUrl
    } else {
        # Linux
        Start-Process "xdg-open" $hostUrl
    }
}

# Serve requests loop
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        Write-Host "[$([DateTime]::Now.ToString('HH:mm:ss'))] HTTP $($request.HttpMethod) $urlPath" -ForegroundColor DarkGray

        if (Test-Path $htmlPath) {
            $bytes = [System.IO.File]::ReadAllBytes($htmlPath)
            $response.ContentType = "text/html; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $msg = "<h1>Photo Color Harmony Lab</h1><p>Embedded offline file not found at: $htmlPath</p>"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
            $response.ContentType = "text/html"
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 404
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
    Write-Host "`n[+] Local HTTP server stopped cleanly." -ForegroundColor Yellow
}
