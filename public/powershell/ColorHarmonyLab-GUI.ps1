<#
.SYNOPSIS
    Photo Color Analysis & Harmony Lab - Native Desktop GUI
    PowerShell + Windows Forms / System.Drawing Edition
.DESCRIPTION
    A complete desktop color analysis tool for photographers, designers, and digital artists.
    Allows sampling photo colors, plotting them on an interactive 2D color wheel,
    detecting color harmony rules, and generating Lightroom/Photoshop grading nudge suggestions.
    
    Can be run directly in PowerShell 5.1 or PowerShell 7 (pwsh), and can be compiled
    into a standalone Windows .exe using ps2exe:
        Install-Module ps2exe -Scope CurrentUser
        Invoke-PS2EXE .\ColorHarmonyLab-GUI.ps1 .\ColorHarmonyLab.exe -noConsole -title "Color Harmony Lab"
.NOTES
    Compatible with: Windows PowerShell 5.1, PowerShell 7+ on Windows
    Framework: .NET WinForms & GDI+ Drawing
#>

# Ensure WinForms and Drawing are loaded
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

# Global Data Structures
$global:CurrentBitmap = $null
$global:DisplayImage = $null
$global:Markers = [System.Collections.ArrayList]::new()
$global:PureHueMode = $false
$global:TargetHarmony = "Auto"
$global:DetectedHarmony = "None"
$global:PrimaryHue = 0

# Helper Functions: Color Conversions
function Convert-RgbToHex([int]$r, [int]$g, [int]$b) {
    return "#{0:X2}{1:X2}{2:X2}" -f $r, $g, $b
}

function Convert-RgbToHsl([int]$r, [int]$g, [int]$b) {
    $rf = $r / 255.0
    $gf = $g / 255.0
    $bf = $b / 255.0

    $max = [Math]::Max($rf, [Math]::Max($gf, $bf))
    $min = [Math]::Min($rf, [Math]::Min($gf, $bf))
    $l = ($max + $min) / 2.0
    $h = 0.0
    $s = 0.0

    if ($max -eq $min) {
        $h = 0.0
        $s = 0.0
    } else {
        $d = $max - $min
        $s = if ($l -gt 0.5) { $d / (2.0 - $max - $min) } else { $d / ($max + $min) }
        
        if ($max -eq $rf) {
            $h = (($gf - $bf) / $d) + (if ($gf -lt $bf) { 6.0 } else { 0.0 })
        } elseif ($max -eq $gf) {
            $h = (($bf - $rf) / $d) + 2.0
        } else {
            $h = (($rf - $gf) / $d) + 4.0
        }
        $h /= 6.0
    }

    return [PSCustomObject]@{
        H = [int][Math]::Round($h * 360)
        S = [int][Math]::Round($s * 100)
        L = [int][Math]::Round($l * 100)
    }
}

function Get-AngleDiff([int]$a, [int]$b) {
    $diff = ($b - $a + 180) % 360 - 180
    if ($diff -lt -180) { return $diff + 360 }
    return $diff
}

function Calculate-Harmony {
    if ($global:Markers.Count -lt 2) {
        if ($global:Markers.Count -eq 1) {
            $global:PrimaryHue = $global:Markers[0].Hsl.H
        } else {
            $global:PrimaryHue = 0
        }
        $global:DetectedHarmony = "Monochromatic"
        return
    }

    $hues = $global:Markers | ForEach-Object { $_.Hsl.H } | Sort-Object
    $global:PrimaryHue = $hues[0]

    # Calculate maximum angular gap
    $maxGap = 0
    for ($i = 0; $i -lt $hues.Count; $i++) {
        $next = $hues[($i + 1) % $hues.Count]
        $gap = ($next - $hues[$i] + 360) % 360
        if ($gap -gt $maxGap) { $maxGap = $gap }
    }
    $totalSpread = 360 - $maxGap

    $hasOpposite = $false
    foreach ($h1 in $hues) {
        foreach ($h2 in $hues) {
            $diff = [Math]::Abs((Get-AngleDiff $h1 $h2))
            if ($diff -ge 140 -and $diff -le 220) {
                $hasOpposite = $true
                break
            }
        }
        if ($hasOpposite) { break }
    }

    if ($totalSpread -le 35) {
        $global:DetectedHarmony = "Monochromatic"
    } elseif ($totalSpread -le 75) {
        $global:DetectedHarmony = "Analogous"
    } elseif ($hasOpposite -and $totalSpread -gt 150 -and $totalSpread -lt 210) {
        $global:DetectedHarmony = "Complementary"
    } elseif ($totalSpread -gt 200 -and $totalSpread -lt 260) {
        $global:DetectedHarmony = "Triadic"
    } elseif ($hasOpposite -and $totalSpread -ge 210) {
        $global:DetectedHarmony = "Split-Complementary"
    } else {
        $global:DetectedHarmony = "Tetradic / Multi-Tone"
    }
}

function Get-NudgeShift([int]$currentHue) {
    $base = $global:PrimaryHue
    $rule = if ($global:TargetHarmony -eq "Auto") { $global:DetectedHarmony } else { $global:TargetHarmony }
    
    $targets = @($base)
    if ($rule -like "*Complementary*" -and $rule -notlike "*Split*") {
        $targets = @($base, ($base + 180) % 360)
    } elseif ($rule -like "*Split-Complementary*") {
        $targets = @($base, ($base + 150) % 360, ($base + 210) % 360)
    } elseif ($rule -like "*Triadic*") {
        $targets = @($base, ($base + 120) % 360, ($base + 240) % 360)
    } elseif ($rule -like "*Analogous*") {
        $targets = @((($base - 30 + 360) % 360), $base, (($base + 30) % 360))
    } elseif ($rule -like "*Tetradic*") {
        $targets = @($base, ($base + 90) % 360, ($base + 180) % 360, ($base + 270) % 360)
    }

    $bestTarget = $targets[0]
    $minDiff = [Math]::Abs((Get-AngleDiff $currentHue $targets[0]))
    foreach ($t in $targets) {
        $d = [Math]::Abs((Get-AngleDiff $currentHue $t))
        if ($d -lt $minDiff) {
            $minDiff = $d
            $bestTarget = $t
        }
    }

    $shift = Get-AngleDiff $currentHue $bestTarget
    return [PSCustomObject]@{
        TargetHue = $bestTarget
        Shift = $shift
        IsAligned = ([Math]::Abs($shift) -le 5)
    }
}

# --- Create Main Window Form ---
$form = New-Object System.Windows.Forms.Form
$form.Text = "Photo Color Analysis & Harmony Lab (pwsh Native)"
$form.Size = New-Object System.Drawing.Size(1200, 820)
$form.StartPosition = "CenterScreen"
$form.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42) # Slate-900
$form.ForeColor = [System.Drawing.Color]::FromArgb(241, 245, 249) # Slate-100
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)

# --- Top ToolBar Panel ---
$topPanel = New-Object System.Windows.Forms.Panel
$topPanel.Dock = [System.Windows.Forms.DockStyle]::Top
$topPanel.Height = 65
$topPanel.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$form.Controls.Add($topPanel)

$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = "Photo Color Harmony Lab"
$titleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$titleLabel.ForeColor = [System.Drawing.Color]::White
$titleLabel.Location = New-Object System.Drawing.Point(16, 12)
$titleLabel.AutoSize = $true
$topPanel.Controls.Add($titleLabel)

$subtitleLabel = New-Object System.Windows.Forms.Label
$subtitleLabel.Text = "Sample photo pins • 2D Color Wheel • Lightroom Nudge Guide • Standalone EXE Ready"
$subtitleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
$subtitleLabel.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$subtitleLabel.Location = New-Object System.Drawing.Point(18, 36)
$subtitleLabel.AutoSize = $true
$topPanel.Controls.Add($subtitleLabel)

# Buttons on Top Panel
$btnOpen = New-Object System.Windows.Forms.Button
$btnOpen.Text = "📂 Open Photo"
$btnOpen.Location = New-Object System.Drawing.Point(620, 15)
$btnOpen.Size = New-Object System.Drawing.Size(115, 36)
$btnOpen.BackColor = [System.Drawing.Color]::FromArgb(79, 70, 229) # Indigo-600
$btnOpen.ForeColor = [System.Drawing.Color]::White
$btnOpen.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnOpen.FlatAppearance.BorderSize = 0
$btnOpen.Cursor = [System.Windows.Forms.Cursors]::Hand
$topPanel.Controls.Add($btnOpen)

$btnSample = New-Object System.Windows.Forms.Button
$btnSample.Text = "🎨 Demo Photo"
$btnSample.Location = New-Object System.Drawing.Point(745, 15)
$btnSample.Size = New-Object System.Drawing.Size(110, 36)
$btnSample.BackColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$btnSample.ForeColor = [System.Drawing.Color]::White
$btnSample.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnSample.FlatAppearance.BorderSize = 0
$btnSample.Cursor = [System.Windows.Forms.Cursors]::Hand
$topPanel.Controls.Add($btnSample)

$btnReset = New-Object System.Windows.Forms.Button
$btnReset.Text = "🔄 Reset Pins"
$btnReset.Location = New-Object System.Drawing.Point(865, 15)
$btnReset.Size = New-Object System.Drawing.Size(100, 36)
$btnReset.BackColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$btnReset.ForeColor = [System.Drawing.Color]::FromArgb(248, 113, 113)
$btnReset.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnReset.FlatAppearance.BorderSize = 0
$btnReset.Cursor = [System.Windows.Forms.Cursors]::Hand
$topPanel.Controls.Add($btnReset)

$btnExport = New-Object System.Windows.Forms.Button
$btnExport.Text = "💾 Export JSON"
$btnExport.Location = New-Object System.Drawing.Point(975, 15)
$btnExport.Size = New-Object System.Drawing.Size(110, 36)
$btnExport.BackColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
$btnExport.ForeColor = [System.Drawing.Color]::White
$btnExport.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnExport.FlatAppearance.BorderSize = 0
$btnExport.Cursor = [System.Windows.Forms.Cursors]::Hand
$topPanel.Controls.Add($btnExport)

# --- Bottom Status Strip ---
$statusStrip = New-Object System.Windows.Forms.StatusStrip
$statusStrip.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$statusStrip.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$form.Controls.Add($statusStrip)

$statusLabel = New-Object System.Windows.Forms.ToolStripStatusLabel
$statusLabel.Text = "Ready. Click on the photo to drop color sample pins (up to 10 points)."
$statusStrip.Items.Add($statusLabel) | Out-Null

# --- Main Split Container ---
$splitContainer = New-Object System.Windows.Forms.SplitContainer
$splitContainer.Dock = [System.Windows.Forms.DockStyle]::Fill
$splitContainer.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$splitContainer.SplitterDistance = 680
$splitContainer.SplitterWidth = 6
$form.Controls.Add($splitContainer)

# ==================== LEFT PANEL (Photo & Markers) ====================
$leftPanel = New-Object System.Windows.Forms.Panel
$leftPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
$leftPanel.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$leftPanel.Padding = New-Object System.Windows.Forms.Padding(12)
$splitContainer.Panel1.Controls.Add($leftPanel)

# Photo Canvas PictureBox
$picPhoto = New-Object System.Windows.Forms.PictureBox
$picPhoto.Dock = [System.Windows.Forms.DockStyle]::Top
$picPhoto.Height = 440
$picPhoto.BackColor = [System.Drawing.Color]::FromArgb(2, 6, 23)
$picPhoto.SizeMode = [System.Windows.Forms.PictureBoxSizeMode]::Zoom
$picPhoto.Cursor = [System.Windows.Forms.Cursors]::Cross
$leftPanel.Controls.Add($picPhoto)

# Markers List Header
$markersHeader = New-Object System.Windows.Forms.Label
$markersHeader.Text = "SAMPLED COLOR PALETTE (Click photo to add points)"
$markersHeader.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$markersHeader.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$markersHeader.Dock = [System.Windows.Forms.DockStyle]::Top
$markersHeader.Height = 28
$leftPanel.Controls.Add($markersHeader)

# Markers ListView
$lstMarkers = New-Object System.Windows.Forms.ListView
$lstMarkers.Dock = [System.Windows.Forms.DockStyle]::Fill
$lstMarkers.View = [System.Windows.Forms.View]::Details
$lstMarkers.FullRowSelect = $true
$lstMarkers.GridLines = $true
$lstMarkers.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$lstMarkers.ForeColor = [System.Drawing.Color]::White
$lstMarkers.Columns.Add("#", 35) | Out-Null
$lstMarkers.Columns.Add("Color", 60) | Out-Null
$lstMarkers.Columns.Add("Label", 120) | Out-Null
$lstMarkers.Columns.Add("HEX", 85) | Out-Null
$lstMarkers.Columns.Add("RGB", 110) | Out-Null
$lstMarkers.Columns.Add("HSL (Hue/Sat/Lum)", 130) | Out-Null
$lstMarkers.Columns.Add("Coords", 90) | Out-Null
$leftPanel.Controls.Add($lstMarkers)

# ==================== RIGHT PANEL (Color Wheel & Analytics) ====================
$rightPanel = New-Object System.Windows.Forms.Panel
$rightPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
$rightPanel.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$rightPanel.Padding = New-Object System.Windows.Forms.Padding(12)
$splitContainer.Panel2.Controls.Add($rightPanel)

# Wheel Controls Bar (Pure Hue toggle + Target Rule)
$wheelBar = New-Object System.Windows.Forms.Panel
$wheelBar.Dock = [System.Windows.Forms.DockStyle]::Top
$wheelBar.Height = 40
$rightPanel.Controls.Add($wheelBar)

$chkPureHue = New-Object System.Windows.Forms.CheckBox
$chkPureHue.Text = "Pure Hue Mode"
$chkPureHue.Location = New-Object System.Drawing.Point(4, 8)
$chkPureHue.AutoSize = $true
$chkPureHue.ForeColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
$wheelBar.Controls.Add($chkPureHue)

$lblRule = New-Object System.Windows.Forms.Label
$lblRule.Text = "Target Rule:"
$lblRule.Location = New-Object System.Drawing.Point(160, 10)
$lblRule.AutoSize = $true
$lblRule.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$wheelBar.Controls.Add($lblRule)

$cboHarmony = New-Object System.Windows.Forms.ComboBox
$cboHarmony.Location = New-Object System.Drawing.Point(245, 6)
$cboHarmony.Size = New-Object System.Drawing.Size(180, 26)
$cboHarmony.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
$cboHarmony.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$cboHarmony.ForeColor = [System.Drawing.Color]::White
$cboHarmony.Items.AddRange(@("Auto", "Complementary", "Split-Complementary", "Analogous", "Triadic", "Tetradic"))
$cboHarmony.SelectedIndex = 0
$wheelBar.Controls.Add($cboHarmony)

# Color Wheel PictureBox
$picWheel = New-Object System.Windows.Forms.PictureBox
$picWheel.Dock = [System.Windows.Forms.DockStyle]::Top
$picWheel.Height = 280
$picWheel.BackColor = [System.Drawing.Color]::FromArgb(2, 6, 23)
$rightPanel.Controls.Add($picWheel)

# Harmony Summary Card
$pnlSummary = New-Object System.Windows.Forms.Panel
$pnlSummary.Dock = [System.Windows.Forms.DockStyle]::Top
$pnlSummary.Height = 50
$pnlSummary.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$pnlSummary.Padding = New-Object System.Windows.Forms.Padding(8)
$rightPanel.Controls.Add($pnlSummary)

$lblDetected = New-Object System.Windows.Forms.Label
$lblDetected.Text = "Natural Harmony: Monochromatic | Base Hue: 0°"
$lblDetected.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$lblDetected.ForeColor = [System.Drawing.Color]::FromArgb(129, 140, 248) # Indigo-400
$lblDetected.Dock = [System.Windows.Forms.DockStyle]::Fill
$lblDetected.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$pnlSummary.Controls.Add($lblDetected)

# Nudge & Lightroom Advice Tabs
$tabAnalytics = New-Object System.Windows.Forms.TabControl
$tabAnalytics.Dock = [System.Windows.Forms.DockStyle]::Fill
$tabAnalytics.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$tabAnalytics.ForeColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$rightPanel.Controls.Add($tabAnalytics)

$tabNudge = New-Object System.Windows.Forms.TabPage
$tabNudge.Text = "🎯 Hue Nudge Shifts"
$tabAnalytics.TabPages.Add($tabNudge)

$lstNudge = New-Object System.Windows.Forms.ListView
$lstNudge.Dock = [System.Windows.Forms.DockStyle]::Fill
$lstNudge.View = [System.Windows.Forms.View]::Details
$lstNudge.FullRowSelect = $true
$lstNudge.GridLines = $true
$lstNudge.Columns.Add("Point", 80) | Out-Null
$lstNudge.Columns.Add("Current Hue", 90) | Out-Null
$lstNudge.Columns.Add("Target Hue", 90) | Out-Null
$lstNudge.Columns.Add("Recommended Shift", 130) | Out-Null
$tabNudge.Controls.Add($lstNudge)

$tabTips = New-Object System.Windows.Forms.TabPage
$tabTips.Text = "🎛️ Lightroom / Grading Strategy"
$tabAnalytics.TabPages.Add($tabTips)

$txtTips = New-Object System.Windows.Forms.TextBox
$txtTips.Dock = [System.Windows.Forms.DockStyle]::Fill
$txtTips.Multiline = $true
$txtTips.ReadOnly = $true
$txtTips.ScrollBars = [System.Windows.Forms.ScrollBars]::Vertical
$txtTips.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$txtTips.ForeColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
$txtTips.Font = New-Object System.Drawing.Font("Consolas", 9.5)
$tabTips.Controls.Add($txtTips)

# ==================== DRAWING & EVENT LOGIC ====================

# Color Wheel Paint Handler
$picWheel.Add_Paint({
    param($sender, $e)
    $g = $e.Graphics
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $w = $picWheel.Width
    $h = $picWheel.Height
    $cx = $w / 2.0
    $cy = $h / 2.0
    $radius = [Math]::Min($cx, $cy) - 24

    # 1. Draw Hue Spectrum Radial Sweep
    for ($angle = 0; $angle -lt 360; $angle += 2) {
        $rad1 = ($angle - 1.2) * [Math]::PI / 180.0
        $rad2 = ($angle + 1.2) * [Math]::PI / 180.0

        # Calculate HSL color for this angle
        $c = ColorFromHSL $angle 0.85 0.5

        $pts = @(
            (New-Object System.Drawing.PointF($cx, $cy)),
            (New-Object System.Drawing.PointF(($cx + $radius * [Math]::Cos($rad1)), ($cy + $radius * [Math]::Sin($rad1)))),
            (New-Object System.Drawing.PointF(($cx + $radius * [Math]::Cos($rad2)), ($cy + $radius * [Math]::Sin($rad2))))
        )
        $brush = New-Object System.Drawing.SolidBrush($c)
        $g.FillPolygon($brush, $pts)
        $brush.Dispose()
    }

    # Overlay inner white gradient to emulate saturation
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(($cx - $radius), ($cy - $radius), ($radius * 2), ($radius * 2))
    $pbr = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
    $pbr.CenterColor = [System.Drawing.Color]::FromArgb(220, 255, 255, 255)
    $pbr.SurroundingColors = @([System.Drawing.Color]::FromArgb(0, 255, 255, 255))
    $g.FillEllipse($pbr, ($cx - $radius), ($cy - $radius), ($radius * 2), ($radius * 2))
    $pbr.Dispose()
    $path.Dispose()

    # 2. Concentric Saturation Rings
    $penGrid = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 255, 255, 255), 1)
    $penGrid.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    foreach ($ratio in @(0.33, 0.66, 1.0)) {
        $r = $radius * $ratio
        $g.DrawEllipse($penGrid, ($cx - $r), ($cy - $r), ($r * 2), ($r * 2))
    }

    # Radial Hue spokes
    for ($a = 0; $a -lt 360; $a += 45) {
        $rad = $a * [Math]::PI / 180.0
        $px = $cx + $radius * [Math]::Cos($rad)
        $py = $cy + $radius * [Math]::Sin($rad)
        $g.DrawLine($penGrid, $cx, $cy, $px, $py)
    }
    $penGrid.Dispose()

    # 3. Target Harmony Overlay Lines
    $rule = if ($global:TargetHarmony -eq "Auto") { $global:DetectedHarmony } else { $global:TargetHarmony }
    if ($global:Markers.Count -gt 0) {
        $base = $global:PrimaryHue
        $penGuide = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 59, 130, 246), 2)
        $penGuide.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dot

        $drawSpoke = {
            param([int]$hueAngle, [System.Drawing.Color]$color)
            $p = New-Object System.Drawing.Pen($color, 2)
            $p.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
            $rad = $hueAngle * [Math]::PI / 180.0
            $x = $cx + $radius * [Math]::Cos($rad)
            $y = $cy + $radius * [Math]::Sin($rad)
            $g.DrawLine($p, $cx, $cy, $x, $y)
            $p.Dispose()
        }

        if ($rule -like "*Complementary*" -and $rule -notlike "*Split*") {
            &$drawSpoke $base ([System.Drawing.Color]::Cyan)
            &$drawSpoke (($base + 180) % 360) ([System.Drawing.Color]::Crimson)
        } elseif ($rule -like "*Split-Complementary*") {
            &$drawSpoke $base ([System.Drawing.Color]::Cyan)
            &$drawSpoke (($base + 150) % 360) ([System.Drawing.Color]::SpringGreen)
            &$drawSpoke (($base + 210) % 360) ([System.Drawing.Color]::Gold)
        } elseif ($rule -like "*Triadic*") {
            &$drawSpoke $base ([System.Drawing.Color]::DeepPink)
            &$drawSpoke (($base + 120) % 360) ([System.Drawing.Color]::MediumPurple)
            &$drawSpoke (($base + 240) % 360) ([System.Drawing.Color]::Cyan)
        } elseif ($rule -like "*Analogous*") {
            &$drawSpoke (($base - 30 + 360) % 360) ([System.Drawing.Color]::LightGray)
            &$drawSpoke $base ([System.Drawing.Color]::Cyan)
            &$drawSpoke (($base + 30) % 360) ([System.Drawing.Color]::LightGray)
        }
        $penGuide.Dispose()
    }

    # 4. Plot Sampled Markers on Color Wheel
    $fontId = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
    foreach ($m in $global:Markers) {
        $angleRad = $m.Hsl.H * [Math]::PI / 180.0
        $dist = if ($global:PureHueMode) { $radius } else { ($m.Hsl.S / 100.0) * $radius }

        $px = $cx + $dist * [Math]::Cos($angleRad)
        $py = $cy + $dist * [Math]::Sin($angleRad)

        $c = [System.Drawing.Color]::FromArgb($m.R, $m.G, $m.B)
        $br = New-Object System.Drawing.SolidBrush($c)
        $g.FillEllipse($br, ($px - 9), ($py - 9), 18, 18)
        $br.Dispose()

        $penDot = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 2)
        $g.DrawEllipse($penDot, ($px - 9), ($py - 9), 18, 18)
        $penDot.Dispose()

        $textColor = if ($m.Hsl.L -gt 60) { [System.Drawing.Color]::Black } else { [System.Drawing.Color]::White }
        $brText = New-Object System.Drawing.SolidBrush($textColor)
        $textFormat = New-Object System.Drawing.StringFormat
        $textFormat.Alignment = [System.Drawing.StringAlignment]::Center
        $textFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
        $g.DrawString($m.Id.ToString(), $fontId, $brText, $px, $py, $textFormat)
        $brText.Dispose()
    }
    $fontId.Dispose()
})

# Helper HSL to Color for Wheel GDI
function ColorFromHSL([double]$h, [double]$s, [double]$l) {
    $c = (1.0 - [Math]::Abs(2.0 * $l - 1.0)) * $s
    $hp = $h / 60.0
    $x = $c * (1.0 - [Math]::Abs(($hp % 2.0) - 1.0))
    $m = $l - $c / 2.0

    $r1 = 0; $g1 = 0; $b1 = 0
    if ($hp -lt 1) { $r1 = $c; $g1 = $x }
    elseif ($hp -lt 2) { $r1 = $x; $g1 = $c }
    elseif ($hp -lt 3) { $g1 = $c; $b1 = $x }
    elseif ($hp -lt 4) { $g1 = $x; $b1 = $c }
    elseif ($hp -lt 5) { $r1 = $x; $b1 = $c }
    else { $r1 = $c; $b1 = $x }

    $r = [int][Math]::Round(($r1 + $m) * 255)
    $g = [int][Math]::Round(($g1 + $m) * 255)
    $b = [int][Math]::Round(($b1 + $m) * 255)
    return [System.Drawing.Color]::FromArgb($r, $g, $b)
}

# Photo Paint Handler (Draw markers over photo)
$picPhoto.Add_Paint({
    param($sender, $e)
    if ($null -eq $global:CurrentBitmap) { return }
    $g = $e.Graphics
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    # Calculate actual rendered image rectangle in PictureBox Zoom mode
    $rect = Get-ImageDisplayRect $picPhoto $global:CurrentBitmap

    $fontId = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
    foreach ($m in $global:Markers) {
        $px = $rect.X + ($m.XPct / 100.0) * $rect.Width
        $py = $rect.Y + ($m.YPct / 100.0) * $rect.Height

        $c = [System.Drawing.Color]::FromArgb($m.R, $m.G, $m.B)
        $br = New-Object System.Drawing.SolidBrush($c)
        $g.FillEllipse($br, ($px - 10), ($py - 10), 20, 20)
        $br.Dispose()

        $penOuter = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 2)
        $g.DrawEllipse($penOuter, ($px - 10), ($py - 10), 20, 20)
        $penOuter.Dispose()

        $textColor = if ($m.Hsl.L -gt 60) { [System.Drawing.Color]::Black } else { [System.Drawing.Color]::White }
        $brText = New-Object System.Drawing.SolidBrush($textColor)
        $tf = New-Object System.Drawing.StringFormat
        $tf.Alignment = [System.Drawing.StringAlignment]::Center
        $tf.LineAlignment = [System.Drawing.StringAlignment]::Center
        $g.DrawString($m.Id.ToString(), $fontId, $brText, $px, $py, $tf)
        $brText.Dispose()
    }
    $fontId.Dispose()
})

function Get-ImageDisplayRect($pb, $bmp) {
    if ($pb.Width -eq 0 -or $pb.Height -eq 0 -or $bmp.Width -eq 0 -or $bmp.Height -eq 0) {
        return New-Object System.Drawing.Rectangle(0,0,0,0)
    }
    $aspectPB = $pb.Width / $pb.Height
    $aspectImg = $bmp.Width / $bmp.Height

    $rw = 0; $rh = 0; $rx = 0; $ry = 0
    if ($aspectImg -gt $aspectPB) {
        $rw = $pb.Width
        $rh = [int]($pb.Width / $aspectImg)
        $rx = 0
        $ry = [int](($pb.Height - $rh) / 2)
    } else {
        $rh = $pb.Height
        $rw = [int]($pb.Height * $aspectImg)
        $rx = [int](($pb.Width - $rw) / 2)
        $ry = 0
    }
    return New-Object System.Drawing.Rectangle($rx, $ry, $rw, $rh)
}

# Click Photo Handler (Add Marker)
$picPhoto.Add_MouseClick({
    param($sender, $e)
    if ($null -eq $global:CurrentBitmap) { return }
    if ($global:Markers.Count -ge 10) {
        [System.Windows.Forms.MessageBox]::Show("Maximum of 10 color sample points reached. Reset pins to pick new colors.", "Limit Reached", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
        return
    }

    $rect = Get-ImageDisplayRect $picPhoto $global:CurrentBitmap
    if (-not $rect.Contains($e.Location)) { return }

    $xPct = (($e.X - $rect.X) / [double]$rect.Width) * 100.0
    $yPct = (($e.Y - $rect.Y) / [double]$rect.Height) * 100.0

    # Translate to exact bitmap pixel
    $pixelX = [int](($xPct / 100.0) * $global:CurrentBitmap.Width)
    $pixelY = [int](($yPct / 100.0) * $global:CurrentBitmap.Height)

    $pixelX = [Math]::Max(0, [Math]::Min($global:CurrentBitmap.Width - 1, $pixelX))
    $pixelY = [Math]::Max(0, [Math]::Min($global:CurrentBitmap.Height - 1, $pixelY))

    $color = $global:CurrentBitmap.GetPixel($pixelX, $pixelY)
    $hex = Convert-RgbToHex $color.R $color.G $color.B
    $hsl = Convert-RgbToHsl $color.R $color.G $color.B

    $markerId = $global:Markers.Count + 1
    $marker = [PSCustomObject]@{
        Id = $markerId
        Label = "Sample $markerId"
        R = $color.R
        G = $color.G
        B = $color.B
        Hex = $hex
        Hsl = $hsl
        XPct = [Math]::Round($xPct, 1)
        YPct = [Math]::Round($yPct, 1)
        PixelX = $pixelX
        PixelY = $pixelY
    }

    $global:Markers.Add($marker) | Out-Null
    Refresh-AllUI
})

function Refresh-AllUI {
    Calculate-Harmony
    
    # Update Status
    $statusLabel.Text = "Sampled: $($global:Markers.Count)/10 pins | Dominant Hue: $($global:PrimaryHue)° | Detected Harmony: $($global:DetectedHarmony)"
    $lblDetected.Text = "Natural Harmony: $($global:DetectedHarmony) (Base Hue: $($global:PrimaryHue)°)"

    # Repaint Visualizers
    $picPhoto.Invalidate()
    $picWheel.Invalidate()

    # Update Markers Table
    $lstMarkers.Items.Clear()
    foreach ($m in $global:Markers) {
        $item = New-Object System.Windows.Forms.ListViewItem($m.Id.ToString())
        $item.SubItems.Add("■") | Out-Null
        $item.SubItems.Add($m.Label) | Out-Null
        $item.SubItems.Add($m.Hex) | Out-Null
        $item.SubItems.Add("$($m.R), $($m.G), $($m.B)") | Out-Null
        $item.SubItems.Add("H:$($m.Hsl.H)° S:$($m.Hsl.S)% L:$($m.Hsl.L)%") | Out-Null
        $item.SubItems.Add("$($m.XPct)%, $($m.YPct)%") | Out-Null
        $item.ForeColor = [System.Drawing.Color]::White
        $item.SubItems[1].ForeColor = [System.Drawing.Color]::FromArgb($m.R, $m.G, $m.B)
        $lstMarkers.Items.Add($item) | Out-Null
    }

    # Update Nudge Table
    $lstNudge.Items.Clear()
    foreach ($m in $global:Markers) {
        $nudge = Get-NudgeShift $m.Hsl.H
        $item = New-Object System.Windows.Forms.ListViewItem("#$($m.Id) ($($m.Label))")
        $item.SubItems.Add("$($m.Hsl.H)°") | Out-Null
        $item.SubItems.Add("$($nudge.TargetHue)°") | Out-Null
        
        $shiftStr = if ($nudge.IsAligned) { "✔ Perfect Fit" } elseif ($nudge.Shift -gt 0) { "+$($nudge.Shift)° Shift" } else { "$($nudge.Shift)° Shift" }
        $item.SubItems.Add($shiftStr) | Out-Null
        $item.ForeColor = if ($nudge.IsAligned) { [System.Drawing.Color]::FromArgb(52, 211, 153) } else { [System.Drawing.Color]::FromArgb(251, 191, 36) }
        $lstNudge.Items.Add($item) | Out-Null
    }

    # Update Lightroom Strategy Advice
    $rule = if ($global:TargetHarmony -eq "Auto") { $global:DetectedHarmony } else { $global:TargetHarmony }
    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine("=== LIGHTROOM & PHOTOSHOP COLOR GRADING STRATEGY ===")
    [void]$sb.AppendLine("Target Harmony: $rule | Dominant Hue: $($global:PrimaryHue)°`r`n")
    [void]$sb.AppendLine("1. HSL / COLOR MIXER ADJUSTMENTS:")
    if ($rule -like "*Complementary*") {
        [void]$sb.AppendLine("   • Push warm highlights towards Hue: $($global:PrimaryHue)°")
        [void]$sb.AppendLine("   • Push cool shadow accents opposite towards: $((($global:PrimaryHue + 180) % 360))°")
        [void]$sb.AppendLine("   • Slightly desaturate outlying intermediate hues to clean the dual contrast.")
    } elseif ($rule -like "*Analogous*") {
        [void]$sb.AppendLine("   • Restrict colors within a cohesive 30°-60° spectrum arc.")
        [void]$sb.AppendLine("   • Nudge straggling greens or blues into the adjacent warmth zone.")
    } else {
        [void]$sb.AppendLine("   • Distribute tonal weights evenly across the 3 target vertices: $($global:PrimaryHue)°, $((($global:PrimaryHue + 120) % 360))°, $((($global:PrimaryHue + 240) % 360))°.")
    }
    [void]$sb.AppendLine("`r`n2. COLOR GRADING (3-WAY WHEELS):")
    [void]$sb.AppendLine("   • Highlights Wheel: Set Hue to ~$($global:PrimaryHue)° (Warm tone)")
    [void]$sb.AppendLine("   • Shadows Wheel: Set Hue to ~$((($global:PrimaryHue + 180) % 360))° (Cool teal/blue)")
    [void]$sb.AppendLine("`r`n3. SATURATION & CLIPPING DISCIPLINE:")
    [void]$sb.AppendLine("   • Drop global Vibrance/Saturation by -10% to prevent posterization, then selectively boost your target palette hues in Color Mixer.")

    $txtTips.Text = $sb.ToString()
}

# --- Event Listeners ---
$chkPureHue.Add_CheckedChanged({
    $global:PureHueMode = $chkPureHue.Checked
    $picWheel.Invalidate()
})

$cboHarmony.Add_SelectedIndexChanged({
    $global:TargetHarmony = $cboHarmony.SelectedItem.ToString()
    Refresh-AllUI
})

$btnReset.Add_Click({
    $global:Markers.Clear()
    Refresh-AllUI
})

$btnOpen.Add_Click({
    $dlg = New-Object System.Windows.Forms.OpenFileDialog
    $dlg.Filter = "Image Files (*.jpg;*.jpeg;*.png;*.bmp;*.webp)|*.jpg;*.jpeg;*.png;*.bmp;*.webp|All Files (*.*)|*.*"
    $dlg.Title = "Select Image for Color Analysis"
    if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        try {
            $global:CurrentBitmap = [System.Drawing.Bitmap]::FromFile($dlg.FileName)
            $picPhoto.Image = $global:CurrentBitmap
            $global:Markers.Clear()
            Refresh-AllUI
            $statusLabel.Text = "Loaded: $($dlg.FileName) ($($global:CurrentBitmap.Width) x $($global:CurrentBitmap.Height))"
        } catch {
            [System.Windows.Forms.MessageBox]::Show("Error loading image: $($_.Exception.Message)", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        }
    }
})

$btnExport.Add_Click({
    if ($global:Markers.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show("No color pins to export. Click on the photo to pick points first.", "Empty Palette", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)
        return
    }

    $sfd = New-Object System.Windows.Forms.SaveFileDialog
    $sfd.Filter = "JSON Files (*.json)|*.json|CSV Files (*.csv)|*.csv"
    $sfd.FileName = "color-harmony-palette.json"
    if ($sfd.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        if ($sfd.FileName.EndsWith(".json")) {
            $json = $global:Markers | ConvertTo-Json -Depth 4
            [System.IO.File]::WriteAllText($sfd.FileName, $json)
        } else {
            $global:Markers | Select-Object Id, Label, Hex, R, G, B, @{N='Hue';E={$_.Hsl.H}}, @{N='Sat';E={$_.Hsl.S}}, @{N='Lum';E={$_.Hsl.L}} | Export-Csv -Path $sfd.FileName -NoTypeInformation
        }
        [System.Windows.Forms.MessageBox]::Show("Exported $($global:Markers.Count) color points successfully!", "Saved", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    }
})

# Generate a synthetic demo landscape photo if no photo opened yet
$btnSample.Add_Click({
    $bmp = New-Object System.Drawing.Bitmap(800, 500)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Sunset sky gradient
    $skyRect = New-Object System.Drawing.Rectangle(0, 0, 800, 300)
    $skyBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($skyRect, [System.Drawing.Color]::FromArgb(234, 88, 12), [System.Drawing.Color]::FromArgb(67, 56, 202), 90)
    $g.FillRectangle($skyBrush, $skyRect)
    $skyBrush.Dispose()

    # Sun
    $sunBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(254, 240, 138))
    $g.FillEllipse($sunBrush, 340, 160, 120, 120)
    $sunBrush.Dispose()

    # Sand Dunes
    $duneRect = New-Object System.Drawing.Rectangle(0, 260, 800, 240)
    $duneBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($duneRect, [System.Drawing.Color]::FromArgb(217, 119, 6), [System.Drawing.Color]::FromArgb(120, 53, 15), 45)
    $g.FillRectangle($duneBrush, $duneRect)
    $duneBrush.Dispose()

    $g.Dispose()

    $global:CurrentBitmap = $bmp
    $picPhoto.Image = $bmp
    $global:Markers.Clear()

    # Add default sample points
    $defaultCoords = @(
        @{ X = 25.0; Y = 20.0; Label = "Sky Highlight" },
        @{ X = 48.0; Y = 40.0; Label = "Sun Amber" },
        @{ X = 70.0; Y = 70.0; Label = "Dune Midtone" },
        @{ X = 20.0; Y = 85.0; Label = "Deep Sand Shadow" }
    )

    $id = 1
    foreach ($pt in $defaultCoords) {
        $px = [int](($pt.X / 100.0) * $bmp.Width)
        $py = [int](($pt.Y / 100.0) * $bmp.Height)
        $c = $bmp.GetPixel($px, $py)
        $hex = Convert-RgbToHex $c.R $c.G $c.B
        $hsl = Convert-RgbToHsl $c.R $c.G $c.B
        $global:Markers.Add([PSCustomObject]@{
            Id = $id
            Label = $pt.Label
            R = $c.R; G = $c.G; B = $c.B
            Hex = $hex; Hsl = $hsl
            XPct = $pt.X; YPct = $pt.Y
            PixelX = $px; PixelY = $py
        }) | Out-Null
        $id++
    }

    Refresh-AllUI
})

# Load demo image automatically on start
$btnSample.PerformClick()

# Display Form
[System.Windows.Forms.Application]::Run($form)
