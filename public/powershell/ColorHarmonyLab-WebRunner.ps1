<#
.SYNOPSIS
    Photo Color Analysis & Harmony Lab - Local Web Server & Desktop Launcher
    Cross-Platform PowerShell (pwsh) Edition (Windows, macOS, Linux)
.DESCRIPTION
    Launches a lightweight, embedded local web server via System.Net.HttpListener
    that hosts the full React Photo Color Analysis & Harmony Lab locally with zero external
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
   PowerShell / pwsh Full React Offline Engine
========================================================================
   - Listening on: $hostUrl
   - Cross-Platform: Windows, macOS, Linux pwsh
   - Zero Dependencies: No Node.js, npm, or Python required
   - Press Ctrl+C in this terminal window to stop the server
========================================================================
"@ -ForegroundColor Cyan

# Locate web root containing full React app
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

$potentialRoots = @(
    (Join-Path $scriptDir "web"),
    (Join-Path $scriptDir "dist"),
    (Join-Path (Join-Path $scriptDir "..") "dist"),
    $scriptDir
)

$webRoot = $null
foreach ($pr in $potentialRoots) {
    if (Test-Path (Join-Path $pr "index.html")) {
        $webRoot = $pr
        break
    }
}

if ($null -eq $webRoot) {
    # Fallback to offline HTML if web folder not yet built
    $webRoot = $scriptDir
}

Write-Host "[+] Serving Web Root: $webRoot" -ForegroundColor Green

# Start HttpListener
$listenerUrl = "http://*:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($listenerUrl)

try {
    $listener.Start()
    Write-Host "[+] Local HTTP Listener started on port $Port" -ForegroundColor Green
} catch {
    Write-Warning "Could not start on port $Port ($($_.Exception.Message)). Trying port 5051..."

    $Port = 5051
    $hostUrl = "http://localhost:$Port/"
    $listenerUrl = "http://*:$Port/"

    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($listenerUrl)
    $listener.Start()

    Write-Host "[+] Local HTTP Listener started on port $Port" -ForegroundColor Green
}

# Helper: Get MIME Content-Type from file extension
function Get-MimeType([string]$filePath) {
    $ext = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
    switch ($ext) {
        ".html"   { return "text/html; charset=utf-8" }
        ".htm"    { return "text/html; charset=utf-8" }
        ".js"     { return "application/javascript; charset=utf-8" }
        ".mjs"    { return "application/javascript; charset=utf-8" }
        ".css"    { return "text/css; charset=utf-8" }
        ".json"   { return "application/json; charset=utf-8" }
        ".svg"    { return "image/svg+xml" }
        ".png"    { return "image/png" }
        ".jpg"    { return "image/jpeg" }
        ".jpeg"   { return "image/jpeg" }
        ".webp"   { return "image/webp" }
        ".gif"    { return "image/gif" }
        ".ico"    { return "image/x-icon" }
        ".woff2"  { return "font/woff2" }
        ".woff"   { return "font/woff" }
        ".ttf"    { return "font/ttf" }
        ".xmp"    { return "application/xml; charset=utf-8" }
        ".xml"    { return "application/xml; charset=utf-8" }
        default   { return "application/octet-stream" }
    }
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
        $chromePaths = @(
            "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
            "$env:ProgramFiles (x86)\Google\Chrome\Application\chrome.exe",
            "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
        )
        $browserLaunched = $false

        if ($EdgeAppMode) {
            foreach ($ep in $edgePaths) {
                if (Test-Path $ep) {
                    Start-Process -FilePath $ep -ArgumentList "--app=$hostUrl", "--window-size=1400,900"
                    $browserLaunched = $true
                    Write-Host "[+] Launched Microsoft Edge in Standalone App Window Mode" -ForegroundColor Magenta
                    break
                }
            }
            if (-not $browserLaunched) {
                foreach ($cp in $chromePaths) {
                    if (Test-Path $cp) {
                        Start-Process -FilePath $cp -ArgumentList "--app=$hostUrl", "--window-size=1400,900"
                        $browserLaunched = $true
                        Write-Host "[+] Launched Google Chrome in Standalone App Window Mode" -ForegroundColor Magenta
                        break
                    }
                }
            }
        }

        if (-not $browserLaunched) {
            Start-Process $hostUrl
            Write-Host "[+] Opened in default web browser" -ForegroundColor Magenta
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

        $urlPath = [System.Uri]::UnescapeDataString($request.Url.LocalPath.TrimStart('/'))
        if ([string]::IsNullOrWhiteSpace($urlPath)) {
            $urlPath = "index.html"
        }

        $targetFile = Join-Path $webRoot $urlPath

        # If file not found, try index.html for SPA routes or check for fallback
        if (-not (Test-Path $targetFile -PathType Leaf)) {
            $spaFallback = Join-Path $webRoot "index.html"
            if (Test-Path $spaFallback) {
                $targetFile = $spaFallback
            } elseif (Test-Path (Join-Path $scriptDir "ColorHarmonyLab-Offline.html")) {
                $targetFile = Join-Path $scriptDir "ColorHarmonyLab-Offline.html"
            }
        }

        if (Test-Path $targetFile -PathType Leaf) {
            try {
                $bytes = [System.IO.File]::ReadAllBytes($targetFile)
                $response.ContentType = Get-MimeType $targetFile
                $response.ContentLength64 = $bytes.Length
                $response.StatusCode = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                $response.StatusCode = 500
            }
        } else {
            $msg = "<h1>Photo Color Harmony Lab</h1><p>File not found: $urlPath</p>"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
            $response.ContentType = "text/html; charset=utf-8"
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
