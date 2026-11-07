# 🎨 Photo Color Analysis & Harmony Lab

A color analysis tool for photographers, designers, and digital artists. Sample photo colors, evaluate harmonies on a 2D polar color wheel, get Lightroom/Photoshop grading nudge suggestions, and export palettes.

---

## ⚡ Quick Start: What to do with the downloaded ZIP

### Step 1: Extract the ZIP
1. Right-click the downloaded `.zip` file on your computer.
2. Select **"Extract All..."** (or unzip with 7-Zip / WinRAR).
3. Open the extracted folder.

---

### Step 2: Choose How You Want to Run It

You have **3 instant options**:

#### 🚀 Option A: Run the Native Windows Desktop App (PowerShell)
- Simply **double-click `RUN_APP.bat`** (or right-click `public/powershell/ColorHarmonyLab-GUI.ps1` and choose **"Run with PowerShell"**).
- This opens the native desktop GUI with zero dependencies needed.

#### 🌐 Option B: Run in Your Browser Completely Offline (0 Install)
- Double-click **`public/powershell/ColorHarmonyLab-Offline.html`**.
- It immediately opens in your default web browser (Chrome, Edge, Firefox, Safari) and works 100% offline with full interactivity!

#### 💻 Option C: Run the Full React Web App Locally
If you have Node.js installed on your computer:
```bash
npm install
npm run dev
```
Then open `http://localhost:3000` in your browser.

---

### Step 3: Convert it to a Standalone Windows `.exe`

To turn this into a permanent standalone executable that you can double-click anywhere without needing PowerShell:

#### Method 1: The 1-Click Batch File
- Double-click **`BUILD_EXE.bat`**.
- It automatically installs the community compiler `ps2exe` (if needed) and generates **`ColorHarmonyLab.exe`** right in your folder!

#### Method 2: In PowerShell Terminal
1. Open PowerShell on your computer.
2. Navigate to the extracted folder:
   ```powershell
   cd .\public\powershell
   ```
3. Allow script execution (if your Windows policy is restricted):
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
   ```
4. Install `ps2exe` and compile:
   ```powershell
   Install-Module -Name ps2exe -Scope CurrentUser -Force
   Invoke-PS2EXE .\ColorHarmonyLab-GUI.ps1 .\ColorHarmonyLab.exe -noConsole -DPIAware -title "Color Harmony Lab"
   ```
5. Done! You will now see **`ColorHarmonyLab.exe`**. You can double-click it to run, pin it to your taskbar, or move it to another computer.

---

### 📂 File Directory Overview

| File / Folder | Purpose |
|---|---|
| `RUN_APP.bat` | 1-Click launcher for the native desktop GUI |
| `BUILD_EXE.bat` | 1-Click compiler to build `ColorHarmonyLab.exe` |
| `public/powershell/ColorHarmonyLab-GUI.ps1` | Native PowerShell WinForms GUI script |
| `public/powershell/Build-Exe.ps1` | Automated PowerShell to EXE compilation script |
| `public/powershell/ColorHarmonyLab-WebRunner.ps1` | Cross-platform local web server script |
| `public/powershell/ColorHarmonyLab-Offline.html` | Portable single-file offline HTML web app |
| `src/` | Complete modern React 19 + TypeScript web app source code |
