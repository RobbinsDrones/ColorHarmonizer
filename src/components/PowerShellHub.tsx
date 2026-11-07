import React, { useState } from 'react';
import { ColorMarker } from '../types';
import { generateCustomPowerShellScript } from '../utils/colorUtils';
import { 
  Terminal, Download, Copy, Check, Play, FileCode, Cpu, 
  HelpCircle, ExternalLink, ShieldCheck, Sparkles, FolderDown,
  Layers, Monitor, Laptop, Globe, CheckCircle2, ChevronRight
} from 'lucide-react';

interface PowerShellHubProps {
  markers: ColorMarker[];
}

export const PowerShellHub: React.FC<PowerShellHubProps> = ({ markers }) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'scripts' | 'simulator' | 'comparison'>('guide');
  const [selectedScript, setSelectedScript] = useState<'gui' | 'webrunner' | 'builder' | 'custom'>('gui');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Terminal simulator state
  const [simLog, setSimLog] = useState<string[]>([
    "PowerShell 7.4.1 (x64) Ready.",
    "Type or select a command below to test the execution flow:"
  ]);
  const [simRunning, setSimRunning] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadFile = (fileName: string, url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDownloadCustomPs1 = () => {
    const content = generateCustomPowerShellScript(markers);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CustomPalette-Preset.ps1';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Run simulation commands
  const runSimCommand = (cmd: string) => {
    setSimRunning(true);
    setSimLog(prev => [...prev, `\n> ${cmd}`]);

    if (cmd.includes('Build-Exe.ps1') || cmd.includes('Invoke-PS2EXE')) {
      setTimeout(() => {
        setSimLog(prev => [
          ...prev,
          "[1/4] Checking for 'ps2exe' compiler module... Installed (v1.0.14)",
          "[2/4] Reading source script 'ColorHarmonyLab-GUI.ps1'...",
          "[3/4] Packaging WinForms, System.Drawing, ColorWheel GDI+ handlers...",
          "[4/4] Applying flags: -noConsole, -DPIAware, -title 'Color Harmony Lab'...",
          "✔ SUCCESS: Generated 'ColorHarmonyLab.exe' (1.85 MB) at .\\ColorHarmonyLab.exe",
          "You can now double-click 'ColorHarmonyLab.exe' to launch without PowerShell!"
        ]);
        setSimRunning(false);
      }, 700);
    } else if (cmd.includes('ColorHarmonyLab-GUI.ps1')) {
      setTimeout(() => {
        setSimLog(prev => [
          ...prev,
          "[+] Initializing Windows Forms Application context...",
          "[+] Loading System.Drawing GDI+ 2D graphics engine...",
          "[+] Color wheel radial gradient cache ready.",
          "[+] Launched Native GUI Window: 'Photo Color Analysis & Harmony Lab'",
          "Listening for photo click events and color sampling pins..."
        ]);
        setSimRunning(false);
      }, 500);
    } else if (cmd.includes('ColorHarmonyLab-WebRunner.ps1')) {
      setTimeout(() => {
        setSimLog(prev => [
          ...prev,
          "[+] Starting System.Net.HttpListener on http://localhost:5050/...",
          "[+] Serving portable offline single-file HTML bundle.",
          "[+] Launching Microsoft Edge in --app=http://localhost:5050 standalone window...",
          "[200 OK] GET / (ColorHarmonyLab-Offline.html)",
          "Server active. Press Ctrl+C in terminal to stop."
        ]);
        setSimRunning(false);
      }, 600);
    } else {
      setTimeout(() => {
        setSimLog(prev => [...prev, "Command completed."]);
        setSimRunning(false);
      }, 300);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-xl shadow-lg shadow-cyan-600/20 text-white">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                PowerShell (pwsh) & Desktop EXE Conversion Hub
              </h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                pwsh 5.1 & 7+
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Run locally on your PC via PowerShell, convert to a standalone Windows <code className="text-indigo-300">.exe</code>, or run cross-platform on the web.
            </p>
          </div>
        </div>

        {/* Quick Download All Files */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleDownloadFile('ColorHarmonyLab-GUI.ps1', '/powershell/ColorHarmonyLab-GUI.ps1')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download GUI .ps1</span>
          </button>

          <button
            onClick={() => handleDownloadFile('Build-Exe.ps1', '/powershell/Build-Exe.ps1')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-lg border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Build-Exe.ps1</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800/80 pb-3">
        <button
          onClick={() => setActiveTab('guide')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'guide'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>EXE Compilation Guide</span>
        </button>

        <button
          onClick={() => setActiveTab('scripts')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'scripts'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Source Code Inspector (.ps1)</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'simulator'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Interactive pwsh Simulator</span>
        </button>

        <button
          onClick={() => setActiveTab('comparison')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'comparison'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Local vs Web vs EXE Matrix</span>
        </button>
      </div>

      {/* Tab 1: Step-by-Step EXE Compilation Guide */}
      {activeTab === 'guide' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Card 1 */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm mb-3 border border-indigo-500/30">
                  1
                </div>
                <h3 className="text-sm font-semibold text-slate-100 mb-1">Download PowerShell Script</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Grab <code className="text-indigo-300">ColorHarmonyLab-GUI.ps1</code>. It uses native .NET Windows Forms and GDI+ Drawing for instant local execution without Node.js.
                </p>
              </div>
              <button
                onClick={() => handleDownloadFile('ColorHarmonyLab-GUI.ps1', '/powershell/ColorHarmonyLab-GUI.ps1')}
                className="mt-4 w-full bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs py-2 rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 font-medium cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Save ColorHarmonyLab-GUI.ps1</span>
              </button>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm mb-3 border border-cyan-500/30">
                  2
                </div>
                <h3 className="text-sm font-semibold text-slate-100 mb-1">Install ps2exe Compiler</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Open your PowerShell terminal and install the official community compiler from the PowerShell Gallery.
                </p>
              </div>
              <div className="mt-4 bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono text-cyan-300">
                <span className="truncate">Install-Module ps2exe -Scope CurrentUser</span>
                <button
                  onClick={() => copyToClipboard('Install-Module -Name ps2exe -Scope CurrentUser -Force', 'inst-cmd')}
                  className="text-slate-400 hover:text-white ml-2 cursor-pointer"
                  title="Copy command"
                >
                  {copiedId === 'inst-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm mb-3 border border-emerald-500/30">
                  3
                </div>
                <h3 className="text-sm font-semibold text-slate-100 mb-1">Compile into Standalone .exe</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Run <code className="text-emerald-300">Invoke-PS2EXE</code> with <code className="text-emerald-300">-noConsole</code> to eliminate terminal windows and launch purely like a desktop application.
                </p>
              </div>
              <div className="mt-4 bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono text-emerald-300">
                <span className="truncate">Invoke-PS2EXE ... -noConsole</span>
                <button
                  onClick={() => copyToClipboard('Invoke-PS2EXE .\\ColorHarmonyLab-GUI.ps1 .\\ColorHarmonyLab.exe -noConsole -title "Color Harmony Lab" -DPIAware', 'comp-cmd')}
                  className="text-slate-400 hover:text-white ml-2 cursor-pointer"
                  title="Copy command"
                >
                  {copiedId === 'comp-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

          </div>

          {/* Detailed Step-by-Step Code Walkthrough */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Full Executable Compilation Script (Automated 1-Click Method)</span>
            </h3>

            <p className="text-xs text-slate-400">
              You can simply download <code className="text-indigo-300">Build-Exe.ps1</code> into the same directory and execute it in PowerShell. It handles execution policy checks, installs the compiler if missing, and produces <code className="text-indigo-300">ColorHarmonyLab.exe</code> automatically:
            </p>

            <div className="relative bg-slate-900/90 rounded-xl p-4 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
              <button
                onClick={() => {
                  const cmd = `# 1. Set Execution Policy (if restricted)
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force

# 2. Run automated builder
.\\Build-Exe.ps1 -Target "GUI" -OutputFile "ColorHarmonyLab.exe"`;
                  copyToClipboard(cmd, 'quick-build-block');
                }}
                className="absolute top-3 right-3 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
              >
                {copiedId === 'quick-build-block' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId === 'quick-build-block' ? 'Copied' : 'Copy Commands'}</span>
              </button>

              <pre className="text-slate-300 leading-relaxed">
{`# 1. Allow local script execution (PowerShell safety prompt)
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force

# 2. Run the automated builder script
.\\Build-Exe.ps1 -Target "GUI" -OutputFile "ColorHarmonyLab.exe"

# Or compile manually with granular flags:
Invoke-PS2EXE \`
    -inputFile .\\ColorHarmonyLab-GUI.ps1 \`
    -outputFile .\\ColorHarmonyLab.exe \`
    -title "Photo Color Analysis & Harmony Lab" \`
    -description "Interactive Photo Color Wheel & Lightroom Grader" \`
    -noConsole \`        # <--- KEY: Prevents the black command prompt window from flashing!
    -DPIAware \`         # <--- Ensures crisp rendering on high-res / 4K displays
    -version "1.0.0.0"`}
              </pre>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80 text-xs">
                <span className="font-semibold text-indigo-300">Why <code className="text-indigo-400">-noConsole</code> is essential:</span>
                <p className="text-slate-400 mt-1">
                  Without this flag, Windows will open an unwanted black console terminal alongside your GUI. With <code className="text-indigo-400">-noConsole</code>, the .exe opens directly as a smooth Windows desktop app.
                </p>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80 text-xs">
                <span className="font-semibold text-emerald-300">Portability & Distribution:</span>
                <p className="text-slate-400 mt-1">
                  The compiled <code className="text-emerald-400">ColorHarmonyLab.exe</code> is completely self-contained. You can copy it to a USB flash drive or email it, and it will run on any Windows 10/11 machine with zero runtime installation.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Source Code Inspector */}
      {activeTab === 'scripts' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setSelectedScript('gui')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  selectedScript === 'gui' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                ColorHarmonyLab-GUI.ps1 (WinForms)
              </button>
              <button
                onClick={() => setSelectedScript('webrunner')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  selectedScript === 'webrunner' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                ColorHarmonyLab-WebRunner.ps1 (Local Server)
              </button>
              <button
                onClick={() => setSelectedScript('builder')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  selectedScript === 'builder' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Build-Exe.ps1 (Compiler)
              </button>
              <button
                onClick={() => setSelectedScript('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  selectedScript === 'custom' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Current Sampled Preset ({markers.length} Pins)
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {selectedScript === 'custom' ? (
                <button
                  onClick={handleDownloadCustomPs1}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Custom Preset (.ps1)</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    const map = {
                      gui: 'ColorHarmonyLab-GUI.ps1',
                      webrunner: 'ColorHarmonyLab-WebRunner.ps1',
                      builder: 'Build-Exe.ps1'
                    };
                    const name = map[selectedScript as keyof typeof map];
                    handleDownloadFile(name, `/powershell/${name}`);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </button>
              )}
            </div>
          </div>

          {/* Script Content Viewer */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs overflow-x-auto max-h-[480px]">
            {selectedScript === 'gui' && (
              <pre className="text-slate-300 leading-relaxed">
{`# ==============================================================================
# Photo Color Analysis & Harmony Lab - Native Desktop GUI
# PowerShell 5.1 & PowerShell 7 (pwsh) + Windows Forms & System.Drawing
# Ready for ps2exe compilation into ColorHarmonyLab.exe
# ==============================================================================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# Global Data
$global:CurrentBitmap = $null
$global:Markers = [System.Collections.ArrayList]::new()
$global:PureHueMode = $false
$global:TargetHarmony = "Auto"
$global:PrimaryHue = 0

# Color Math: RGB to HSL, Hex conversions, Shortest Angular Difference
function Convert-RgbToHsl([int]$r, [int]$g, [int]$b) { ... }
function Calculate-Harmony { ... }
function Get-NudgeShift([int]$currentHue) { ... }

# Native GUI Construction (PictureBox Canvas, 2D Color Wheel GDI+ Paint, Status Strip)
$form = New-Object System.Windows.Forms.Form
$form.Text = "Photo Color Analysis & Harmony Lab (pwsh Native)"
$form.Size = New-Object System.Drawing.Size(1200, 820)
...
# Interactive GDI+ 2D Color Wheel Render:
$picWheel.Add_Paint({
    param($sender, $e)
    # Renders 360-degree radial HSL spectrum, concentric saturation rings,
    # target harmony geometry guides, and numbered color pins!
})
...
[System.Windows.Forms.Application]::Run($form)`}
              </pre>
            )}

            {selectedScript === 'webrunner' && (
              <pre className="text-slate-300 leading-relaxed">
{`# ==============================================================================
# ColorHarmonyLab-WebRunner.ps1 - Cross-Platform PowerShell Local Web Server
# Serves the offline single-file HTML app on localhost:5050 and opens Edge / Browser
# Compatible with: Windows, macOS, Linux pwsh
# ==============================================================================

param(
    [int]$Port = 5050,
    [switch]$NoBrowser,
    [switch]$EdgeAppMode = $true
)

$hostUrl = "http://localhost:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($hostUrl)
$listener.Start()

# Launch browser or Edge in standalone frameless app mode:
if ($IsWindows) {
    Start-Process msedge.exe -ArgumentList "--app=$hostUrl", "--window-size=1280,840"
} elseif ($IsMacOS) {
    Start-Process "open" $hostUrl
} else {
    Start-Process "xdg-open" $hostUrl
}

# Serve requests loop until Ctrl+C...`}
              </pre>
            )}

            {selectedScript === 'builder' && (
              <pre className="text-slate-300 leading-relaxed">
{`# ==============================================================================
# Build-Exe.ps1 - Automated Compiler from .ps1 to Standalone Windows .exe
# ==============================================================================

param(
    [ValidateSet("GUI", "WebRunner")]
    [string]$Target = "GUI",
    [string]$OutputFile = "ColorHarmonyLab.exe"
)

# 1. Install ps2exe from PSGallery if missing
if (-not (Get-Module -ListAvailable -Name ps2exe)) {
    Install-Module -Name ps2exe -Scope CurrentUser -Force
}

# 2. Invoke PS2EXE compiler with high-performance flags
Invoke-PS2EXE \`
    -inputFile .\\ColorHarmonyLab-GUI.ps1 \`
    -outputFile .\\$OutputFile \`
    -title "Photo Color Analysis & Harmony Lab" \`
    -noConsole \`    # Eliminates black terminal window
    -DPIAware       # High-DPI support for 4K monitors`}
              </pre>
            )}

            {selectedScript === 'custom' && (
              <pre className="text-slate-300 leading-relaxed">
                {generateCustomPowerShellScript(markers)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Interactive pwsh Simulator */}
      {activeTab === 'simulator' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              Test how PowerShell executes each command and how the executable is created:
            </span>

            <div className="flex space-x-2">
              <button
                onClick={() => runSimCommand('.\\Build-Exe.ps1 -Target GUI')}
                disabled={simRunning}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Simulate Build-Exe.ps1</span>
              </button>

              <button
                onClick={() => runSimCommand('pwsh .\\ColorHarmonyLab-GUI.ps1')}
                disabled={simRunning}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Simulate Launch GUI</span>
              </button>

              <button
                onClick={() => runSimCommand('pwsh .\\ColorHarmonyLab-WebRunner.ps1')}
                disabled={simRunning}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Simulate Local Web Host</span>
              </button>
            </div>
          </div>

          {/* Terminal Console Box */}
          <div className="bg-black rounded-xl border border-slate-800 p-4 font-mono text-xs text-emerald-400 h-64 overflow-y-auto space-y-1 shadow-inner">
            {simLog.map((line, idx) => (
              <div key={idx} className={line.startsWith('>') ? 'text-cyan-300 font-bold' : line.startsWith('✔') ? 'text-emerald-300 font-bold' : 'text-slate-300'}>
                {line}
              </div>
            ))}
            {simRunning && (
              <div className="animate-pulse text-indigo-400 flex items-center gap-2">
                <span>Executing command...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Local vs Web vs EXE Comparison Matrix */}
      {activeTab === 'comparison' && (
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-300">
                <th className="p-3 font-semibold">Deployment Target</th>
                <th className="p-3 font-semibold">Portability & OS</th>
                <th className="p-3 font-semibold">Requirements</th>
                <th className="p-3 font-semibold">Terminal Visibility</th>
                <th className="p-3 font-semibold">Best Use Case</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              <tr>
                <td className="p-3 font-medium flex items-center gap-2 text-white">
                  <Laptop className="w-4 h-4 text-emerald-400" />
                  <span>Standalone .EXE (ps2exe)</span>
                </td>
                <td className="p-3 text-slate-400">Windows 10/11 (x64/x86)</td>
                <td className="p-3 text-emerald-400 font-semibold">Zero (Self-contained)</td>
                <td className="p-3 text-slate-400">Hidden (<code className="text-indigo-300">-noConsole</code>)</td>
                <td className="p-3 text-slate-300">Ultimate native desktop app for photographers & offline PC workflows.</td>
              </tr>
              <tr>
                <td className="p-3 font-medium flex items-center gap-2 text-white">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <span>ColorHarmonyLab-GUI.ps1</span>
                </td>
                <td className="p-3 text-slate-400">Windows (PowerShell 5.1 / 7+)</td>
                <td className="p-3 text-slate-400">Built-in Windows PowerShell</td>
                <td className="p-3 text-slate-400">Optional (Direct script)</td>
                <td className="p-3 text-slate-300">Inspecting source code, customizing GDI drawing logic, rapid testing.</td>
              </tr>
              <tr>
                <td className="p-3 font-medium flex items-center gap-2 text-white">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span>ColorHarmonyLab-WebRunner.ps1</span>
                </td>
                <td className="p-3 text-slate-400">Windows, macOS, Linux</td>
                <td className="p-3 text-slate-400">PowerShell Core (pwsh)</td>
                <td className="p-3 text-slate-400">Background or Edge <code className="text-cyan-300">--app</code></td>
                <td className="p-3 text-slate-300">Cross-platform local hosting on Mac/Linux or Windows Edge app mode.</td>
              </tr>
              <tr>
                <td className="p-3 font-medium flex items-center gap-2 text-white">
                  <Monitor className="w-4 h-4 text-blue-400" />
                  <span>Web App (Current AI Studio URL)</span>
                </td>
                <td className="p-3 text-slate-400">Any Browser (Mac, PC, iOS, Android)</td>
                <td className="p-3 text-cyan-400 font-semibold">Internet Browser only</td>
                <td className="p-3 text-slate-400">None (Pure Web UI)</td>
                <td className="p-3 text-slate-300">Instant sharing, collaborating, and mobile/tablet touch sampling.</td>
              </tr>
              <tr>
                <td className="p-3 font-medium flex items-center gap-2 text-white">
                  <FileCode className="w-4 h-4 text-amber-400" />
                  <span>ColorHarmonyLab-Offline.html</span>
                </td>
                <td className="p-3 text-slate-400">Any device with any web browser</td>
                <td className="p-3 text-emerald-400 font-semibold">Zero install (Offline file)</td>
                <td className="p-3 text-slate-400">None</td>
                <td className="p-3 text-slate-300">Double click file to open offline in Chrome/Firefox/Safari.</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};
