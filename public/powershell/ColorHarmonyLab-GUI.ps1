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
    Framework: .NET WinForms & DataGridView Dark Mode (100% ASCII safe encoding)
#>

# Ensure WinForms and Drawing are loaded
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

# Global Data Structures
$global:CurrentBitmap = $null
$global:DisplayImage = $null
$global:Markers = [System.Collections.ArrayList]::new()
$global:SelectedMarkerId = $null
$global:PureHueMode = $false
$global:TargetHarmony = "Auto"
$global:DetectedHarmony = "None"
$global:PrimaryHue = 0

# ==================== HELPER FUNCTIONS: COLOR MATH & GEOMETRY ====================

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
        if ($l -gt 0.5) {
            $s = $d / (2.0 - $max - $min)
        } else {
            $s = $d / ($max + $min)
        }
        
        if ($max -eq $rf) {
            $offset = 0.0
            if ($gf -lt $bf) { $offset = 6.0 }
            $h = (($gf - $bf) / $d) + $offset
        } elseif ($max -eq $gf) {
            $h = (($bf - $rf) / $d) + 2.0
        } else {
            $h = (($rf - $gf) / $d) + 4.0
        }
        $h /= 6.0
    }

    $hDeg = [int][Math]::Round($h * 360)
    if ($hDeg -lt 0) { $hDeg += 360 }
    if ($hDeg -ge 360) { $hDeg = $hDeg % 360 }

    return [PSCustomObject]@{
        H = $hDeg
        S = [int][Math]::Round([Math]::Max(0.0, [Math]::Min(100.0, $s * 100)))
        L = [int][Math]::Round([Math]::Max(0.0, [Math]::Min(100.0, $l * 100)))
    }
}

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
    $r = [Math]::Max(0, [Math]::Min(255, $r))
    $g = [Math]::Max(0, [Math]::Min(255, $g))
    $b = [Math]::Max(0, [Math]::Min(255, $b))
    return [System.Drawing.Color]::FromArgb($r, $g, $b)
}

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
    $rule = $global:DetectedHarmony
    if ($global:TargetHarmony -ne "Auto") {
        $rule = $global:TargetHarmony
    }
    
    $targets = [System.Collections.Generic.List[int]]::new()
    $targets.Add($base)

    if ($rule -like "*Complementary*" -and $rule -notlike "*Split*") {
        $targets.Add((($base + 180) % 360))
    } elseif ($rule -like "*Split-Complementary*") {
        $targets.Add((($base + 150) % 360))
        $targets.Add((($base + 210) % 360))
    } elseif ($rule -like "*Triadic*") {
        $targets.Add((($base + 120) % 360))
        $targets.Add((($base + 240) % 360))
    } elseif ($rule -like "*Analogous*") {
        $targets.Add(((($base - 30 + 360) % 360)))
        $targets.Add((($base + 30) % 360))
    } elseif ($rule -like "*Tetradic*") {
        $targets.Add((($base + 90) % 360))
        $targets.Add((($base + 180) % 360))
        $targets.Add((($base + 270) % 360))
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

# ==================== MAIN WINDOW FORM CONSTRUCTION ====================

$form = New-Object System.Windows.Forms.Form
$form.Text = "Photo Color Analysis & Harmony Lab (pwsh Native)"
$form.Size = New-Object System.Drawing.Size(1260, 860)
$form.MinimumSize = New-Object System.Drawing.Size(1000, 700)
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
$subtitleLabel.Text = "Sample photo pins | 2D Color Wheel | Lightroom Nudge Guide | Standalone EXE Ready"
$subtitleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
$subtitleLabel.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$subtitleLabel.Location = New-Object System.Drawing.Point(18, 36)
$subtitleLabel.AutoSize = $true
$topPanel.Controls.Add($subtitleLabel)

# Buttons on Top Panel (Pure ASCII labels)
$btnOpen = New-Object System.Windows.Forms.Button
$btnOpen.Text = "Open Photo"
$btnOpen.Location = New-Object System.Drawing.Point(540, 15)
$btnOpen.Size = New-Object System.Drawing.Size(110, 36)
$btnOpen.BackColor = [System.Drawing.Color]::FromArgb(79, 70, 229) # Indigo-600
$btnOpen.ForeColor = [System.Drawing.Color]::White
$btnOpen.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnOpen.FlatAppearance.BorderSize = 0
$btnOpen.Cursor = [System.Windows.Forms.Cursors]::Hand
$topPanel.Controls.Add($btnOpen)

$btnAuto = New-Object System.Windows.Forms.Button
$btnAuto.Text = "Auto Extract"
$btnAuto.Location = New-Object System.Drawing.Point(660, 15)
$btnAuto.Size = New-Object System.Drawing.Size(120, 36)
$btnAuto.BackColor = [System.Drawing.Color]::FromArgb(217, 119, 6) # Amber-600
$btnAuto.ForeColor = [System.Drawing.Color]::White
$btnAuto.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnAuto.FlatAppearance.BorderSize = 0
$btnAuto.Cursor = [System.Windows.Forms.Cursors]::Hand
$topPanel.Controls.Add($btnAuto)

$btnSample = New-Object System.Windows.Forms.Button
$btnSample.Text = "Demo Photo"
$btnSample.Location = New-Object System.Drawing.Point(790, 15)
$btnSample.Size = New-Object System.Drawing.Size(110, 36)
$btnSample.BackColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$btnSample.ForeColor = [System.Drawing.Color]::White
$btnSample.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnSample.FlatAppearance.BorderSize = 0
$btnSample.Cursor = [System.Windows.Forms.Cursors]::Hand
$topPanel.Controls.Add($btnSample)

$btnReset = New-Object System.Windows.Forms.Button
$btnReset.Text = "Reset Pins"
$btnReset.Location = New-Object System.Drawing.Point(910, 15)
$btnReset.Size = New-Object System.Drawing.Size(100, 36)
$btnReset.BackColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$btnReset.ForeColor = [System.Drawing.Color]::FromArgb(248, 113, 113)
$btnReset.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnReset.FlatAppearance.BorderSize = 0
$btnReset.Cursor = [System.Windows.Forms.Cursors]::Hand
$topPanel.Controls.Add($btnReset)

$btnExport = New-Object System.Windows.Forms.Button
$btnExport.Text = "Export JSON"
$btnExport.Location = New-Object System.Drawing.Point(1020, 15)
$btnExport.Size = New-Object System.Drawing.Size(115, 36)
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
$statusLabel.Text = "Ready. Click on the photo to drop color sample pins (up to 10 points), or click pins to highlight."
$statusStrip.Items.Add($statusLabel) | Out-Null

# --- Main Split Container ---
$splitContainer = New-Object System.Windows.Forms.SplitContainer
$splitContainer.Dock = [System.Windows.Forms.DockStyle]::Fill
$splitContainer.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$splitContainer.SplitterDistance = 710
$splitContainer.SplitterWidth = 6
$form.Controls.Add($splitContainer)

# ==================== LEFT PANEL (Photo & Markers DataGridView) ====================
$leftPanel = New-Object System.Windows.Forms.Panel
$leftPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
$leftPanel.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$leftPanel.Padding = New-Object System.Windows.Forms.Padding(12)
$splitContainer.Panel1.Controls.Add($leftPanel)

# Photo Canvas PictureBox
$picPhoto = New-Object System.Windows.Forms.PictureBox
$picPhoto.Dock = [System.Windows.Forms.DockStyle]::Top
$picPhoto.Height = 420
$picPhoto.BackColor = [System.Drawing.Color]::FromArgb(2, 6, 23)
$picPhoto.SizeMode = [System.Windows.Forms.PictureBoxSizeMode]::Zoom
$picPhoto.Cursor = [System.Windows.Forms.Cursors]::Cross

# Markers List Header
$markersHeader = New-Object System.Windows.Forms.Label
$markersHeader.Text = "SAMPLED COLOR PALETTE (Click photo to sample, click rows or wheel pins to highlight)"
$markersHeader.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$markersHeader.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$markersHeader.Dock = [System.Windows.Forms.DockStyle]::Top
$markersHeader.Height = 28

# Markers High-Contrast DataGridView (Dark Mode Native)
$gridMarkers = New-Object System.Windows.Forms.DataGridView
$gridMarkers.Dock = [System.Windows.Forms.DockStyle]::Fill
$gridMarkers.BackgroundColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$gridMarkers.GridColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$gridMarkers.BorderStyle = [System.Windows.Forms.BorderStyle]::None
$gridMarkers.CellBorderStyle = [System.Windows.Forms.DataGridViewCellBorderStyle]::SingleHorizontal
$gridMarkers.EnableHeadersVisualStyles = $false
$gridMarkers.ColumnHeadersBorderStyle = [System.Windows.Forms.DataGridViewHeaderBorderStyle]::None
$gridMarkers.ColumnHeadersDefaultCellStyle.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$gridMarkers.ColumnHeadersDefaultCellStyle.ForeColor = [System.Drawing.Color]::FromArgb(203, 213, 225)
$gridMarkers.ColumnHeadersDefaultCellStyle.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$gridMarkers.ColumnHeadersHeight = 32
$gridMarkers.ColumnHeadersHeightSizeMode = [System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode]::DisableResizing
$gridMarkers.DefaultCellStyle.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$gridMarkers.DefaultCellStyle.ForeColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
$gridMarkers.DefaultCellStyle.SelectionBackColor = [System.Drawing.Color]::FromArgb(79, 70, 229)
$gridMarkers.DefaultCellStyle.SelectionForeColor = [System.Drawing.Color]::White
$gridMarkers.DefaultCellStyle.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$gridMarkers.RowHeadersVisible = $false
$gridMarkers.AllowUserToAddRows = $false
$gridMarkers.AllowUserToDeleteRows = $false
$gridMarkers.AllowUserToResizeRows = $false
$gridMarkers.ReadOnly = $true
$gridMarkers.SelectionMode = [System.Windows.Forms.DataGridViewSelectionMode]::FullRowSelect
$gridMarkers.MultiSelect = $false

[void]$gridMarkers.Columns.Add("Id", "#")
$gridMarkers.Columns["Id"].Width = 36
[void]$gridMarkers.Columns.Add("Swatch", "Color")
$gridMarkers.Columns["Swatch"].Width = 85
[void]$gridMarkers.Columns.Add("Label", "Label")
$gridMarkers.Columns["Label"].Width = 130
[void]$gridMarkers.Columns.Add("Hex", "HEX")
$gridMarkers.Columns["Hex"].Width = 85
[void]$gridMarkers.Columns.Add("Rgb", "RGB")
$gridMarkers.Columns["Rgb"].Width = 115
[void]$gridMarkers.Columns.Add("Hsl", "HSL (Hue / Sat / Lum)")
$gridMarkers.Columns["Hsl"].Width = 155
[void]$gridMarkers.Columns.Add("Coords", "Coords")
$gridMarkers.Columns["Coords"].Width = 90

# Add Left Panel Controls in strictly correct Dock order:
$leftPanel.Controls.Add($gridMarkers)
$leftPanel.Controls.Add($markersHeader)
$markersHeader.SendToBack()
$leftPanel.Controls.Add($picPhoto)
$picPhoto.SendToBack()

# ==================== RIGHT PANEL (Color Wheel & Analytics) ====================
$rightPanel = New-Object System.Windows.Forms.Panel
$rightPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
$rightPanel.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$rightPanel.Padding = New-Object System.Windows.Forms.Padding(12)
$splitContainer.Panel2.Controls.Add($rightPanel)

# Wheel Controls Bar (Pure Hue toggle + Target Rule)
$wheelBar = New-Object System.Windows.Forms.Panel
$wheelBar.Dock = [System.Windows.Forms.DockStyle]::Top
$wheelBar.Height = 38
$wheelBar.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)

$chkPureHue = New-Object System.Windows.Forms.CheckBox
$chkPureHue.Text = "Pure Hue Mode"
$chkPureHue.Location = New-Object System.Drawing.Point(4, 7)
$chkPureHue.AutoSize = $true
$chkPureHue.ForeColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
$wheelBar.Controls.Add($chkPureHue)

$lblRule = New-Object System.Windows.Forms.Label
$lblRule.Text = "Target Rule:"
$lblRule.Location = New-Object System.Drawing.Point(165, 9)
$lblRule.AutoSize = $true
$lblRule.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$wheelBar.Controls.Add($lblRule)

$cboHarmony = New-Object System.Windows.Forms.ComboBox
$cboHarmony.Location = New-Object System.Drawing.Point(250, 5)
$cboHarmony.Size = New-Object System.Drawing.Size(185, 26)
$cboHarmony.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
$cboHarmony.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$cboHarmony.ForeColor = [System.Drawing.Color]::White
$cboHarmony.Items.AddRange(@("Auto", "Complementary", "Split-Complementary", "Analogous", "Triadic", "Tetradic"))
$cboHarmony.SelectedIndex = 0
$wheelBar.Controls.Add($cboHarmony)

# Color Wheel PictureBox
$picWheel = New-Object System.Windows.Forms.PictureBox
$picWheel.Dock = [System.Windows.Forms.DockStyle]::Top
$picWheel.Height = 260
$picWheel.BackColor = [System.Drawing.Color]::FromArgb(2, 6, 23)
$picWheel.Cursor = [System.Windows.Forms.Cursors]::Hand

# Harmony Summary Card
$pnlSummary = New-Object System.Windows.Forms.Panel
$pnlSummary.Dock = [System.Windows.Forms.DockStyle]::Top
$pnlSummary.Height = 44
$pnlSummary.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$pnlSummary.Padding = New-Object System.Windows.Forms.Padding(6)

$lblDetected = New-Object System.Windows.Forms.Label
$lblDetected.Text = "Natural Harmony: Monochromatic | Base Hue: 0 deg"
$lblDetected.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$lblDetected.ForeColor = [System.Drawing.Color]::FromArgb(129, 140, 248) # Indigo-400
$lblDetected.Dock = [System.Windows.Forms.DockStyle]::Fill
$lblDetected.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$pnlSummary.Controls.Add($lblDetected)

# Tab Bar Switcher (Clean, dark-mode native toggle buttons, eliminating TabControl rendering glitches)
$pnlTabHeader = New-Object System.Windows.Forms.Panel
$pnlTabHeader.Dock = [System.Windows.Forms.DockStyle]::Top
$pnlTabHeader.Height = 38
$pnlTabHeader.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$pnlTabHeader.Padding = New-Object System.Windows.Forms.Padding(0, 4, 0, 4)

$btnTabNudge = New-Object System.Windows.Forms.Button
$btnTabNudge.Text = "Hue Nudge Shifts"
$btnTabNudge.Location = New-Object System.Drawing.Point(0, 4)
$btnTabNudge.Size = New-Object System.Drawing.Size(160, 30)
$btnTabNudge.BackColor = [System.Drawing.Color]::FromArgb(79, 70, 229) # Active Indigo
$btnTabNudge.ForeColor = [System.Drawing.Color]::White
$btnTabNudge.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnTabNudge.FlatAppearance.BorderSize = 0
$btnTabNudge.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$btnTabNudge.Cursor = [System.Windows.Forms.Cursors]::Hand
$pnlTabHeader.Controls.Add($btnTabNudge)

$btnTabTips = New-Object System.Windows.Forms.Button
$btnTabTips.Text = "Lightroom Strategy"
$btnTabTips.Location = New-Object System.Drawing.Point(168, 4)
$btnTabTips.Size = New-Object System.Drawing.Size(160, 30)
$btnTabTips.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59) # Inactive Slate
$btnTabTips.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$btnTabTips.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnTabTips.FlatAppearance.BorderSize = 0
$btnTabTips.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$btnTabTips.Cursor = [System.Windows.Forms.Cursors]::Hand
$pnlTabHeader.Controls.Add($btnTabTips)

# Tab Content Body Panel
$pnlTabBody = New-Object System.Windows.Forms.Panel
$pnlTabBody.Dock = [System.Windows.Forms.DockStyle]::Fill
$pnlTabBody.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)

# Nudge DataGridView (Dark Mode Native)
$gridNudge = New-Object System.Windows.Forms.DataGridView
$gridNudge.Dock = [System.Windows.Forms.DockStyle]::Fill
$gridNudge.BackgroundColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$gridNudge.GridColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$gridNudge.BorderStyle = [System.Windows.Forms.BorderStyle]::None
$gridNudge.CellBorderStyle = [System.Windows.Forms.DataGridViewCellBorderStyle]::SingleHorizontal
$gridNudge.EnableHeadersVisualStyles = $false
$gridNudge.ColumnHeadersBorderStyle = [System.Windows.Forms.DataGridViewHeaderBorderStyle]::None
$gridNudge.ColumnHeadersDefaultCellStyle.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$gridNudge.ColumnHeadersDefaultCellStyle.ForeColor = [System.Drawing.Color]::FromArgb(203, 213, 225)
$gridNudge.ColumnHeadersDefaultCellStyle.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$gridNudge.ColumnHeadersHeight = 30
$gridNudge.ColumnHeadersHeightSizeMode = [System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode]::DisableResizing
$gridNudge.DefaultCellStyle.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$gridNudge.DefaultCellStyle.ForeColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
$gridNudge.DefaultCellStyle.SelectionBackColor = [System.Drawing.Color]::FromArgb(79, 70, 229)
$gridNudge.DefaultCellStyle.SelectionForeColor = [System.Drawing.Color]::White
$gridNudge.DefaultCellStyle.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$gridNudge.RowHeadersVisible = $false
$gridNudge.AllowUserToAddRows = $false
$gridNudge.AllowUserToDeleteRows = $false
$gridNudge.AllowUserToResizeRows = $false
$gridNudge.ReadOnly = $true
$gridNudge.SelectionMode = [System.Windows.Forms.DataGridViewSelectionMode]::FullRowSelect

[void]$gridNudge.Columns.Add("Point", "Sample Point")
$gridNudge.Columns["Point"].Width = 110
[void]$gridNudge.Columns.Add("Cur", "Current Hue")
$gridNudge.Columns["Cur"].Width = 95
[void]$gridNudge.Columns.Add("Tgt", "Target Hue")
$gridNudge.Columns["Tgt"].Width = 95
[void]$gridNudge.Columns.Add("Shift", "Recommended Shift")
$gridNudge.Columns["Shift"].Width = 145
$pnlTabBody.Controls.Add($gridNudge)

# Lightroom Tips TextBox
$txtTips = New-Object System.Windows.Forms.TextBox
$txtTips.Dock = [System.Windows.Forms.DockStyle]::Fill
$txtTips.Multiline = $true
$txtTips.ReadOnly = $true
$txtTips.ScrollBars = [System.Windows.Forms.ScrollBars]::Vertical
$txtTips.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$txtTips.ForeColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
$txtTips.Font = New-Object System.Drawing.Font("Consolas", 9.5)
$txtTips.Visible = $false
$pnlTabBody.Controls.Add($txtTips)

# Tab Toggle Logic
$btnTabNudge.Add_Click({
    $btnTabNudge.BackColor = [System.Drawing.Color]::FromArgb(79, 70, 229)
    $btnTabNudge.ForeColor = [System.Drawing.Color]::White
    $btnTabTips.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
    $btnTabTips.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
    $gridNudge.Visible = $true
    $txtTips.Visible = $false
})

$btnTabTips.Add_Click({
    $btnTabTips.BackColor = [System.Drawing.Color]::FromArgb(79, 70, 229)
    $btnTabTips.ForeColor = [System.Drawing.Color]::White
    $btnTabNudge.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
    $btnTabNudge.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
    $gridNudge.Visible = $false
    $txtTips.Visible = $true
})

# Add Right Panel Controls in strictly correct Dock order:
$rightPanel.Controls.Add($pnlTabBody)
$rightPanel.Controls.Add($pnlTabHeader)
$pnlTabHeader.SendToBack()
$rightPanel.Controls.Add($pnlSummary)
$pnlSummary.SendToBack()
$rightPanel.Controls.Add($picWheel)
$picWheel.SendToBack()
$rightPanel.Controls.Add($wheelBar)
$wheelBar.SendToBack()

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
    $radius = [Math]::Min($cx, $cy) - 20

    # 1. Draw 360-degree Hue Spectrum using LinearGradientBrush wedges
    # Center = Pure White (Sat 0%), Outer Edge = Full Saturated Color (Sat 100%)
    for ($angle = 0; $angle -lt 360; $angle += 2) {
        $rad1 = ($angle - 1.1) * [Math]::PI / 180.0
        $rad2 = ($angle + 1.1) * [Math]::PI / 180.0

        $c = ColorFromHSL $angle 1.0 0.5

        $ptCenter = New-Object System.Drawing.PointF($cx, $cy)
        $ptEdge1 = New-Object System.Drawing.PointF(($cx + $radius * [Math]::Cos($rad1)), ($cy + $radius * [Math]::Sin($rad1)))
        $ptEdge2 = New-Object System.Drawing.PointF(($cx + $radius * [Math]::Cos($rad2)), ($cy + $radius * [Math]::Sin($rad2)))

        $pts = @($ptCenter, $ptEdge1, $ptEdge2)

        if ($global:PureHueMode) {
            $brush = New-Object System.Drawing.SolidBrush($c)
            $g.FillPolygon($brush, $pts)
            $brush.Dispose()
        } else {
            $midRad = $angle * [Math]::PI / 180.0
            $ptMidEdge = New-Object System.Drawing.PointF(($cx + $radius * [Math]::Cos($midRad)), ($cy + $radius * [Math]::Sin($midRad)))
            $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($ptCenter, $ptMidEdge, [System.Drawing.Color]::White, $c)
            $g.FillPolygon($brush, $pts)
            $brush.Dispose()
        }
    }

    # Outer border ring around the wheel
    $penWheelRing = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 255, 255, 255), 2)
    $g.DrawEllipse($penWheelRing, ($cx - $radius), ($cy - $radius), ($radius * 2), ($radius * 2))
    $penWheelRing.Dispose()

    # 2. Concentric Saturation Reference Rings
    $penGrid = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(65, 0, 0, 0), 1)
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
    $rule = $global:DetectedHarmony
    if ($global:TargetHarmony -ne "Auto") {
        $rule = $global:TargetHarmony
    }

    if ($global:Markers.Count -gt 0) {
        $base = $global:PrimaryHue
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
    }

    # 4. Plot Sampled Markers on Color Wheel
    $fontId = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
    foreach ($m in $global:Markers) {
        $angleRad = $m.Hsl.H * [Math]::PI / 180.0
        $dist = ($m.Hsl.S / 100.0) * $radius
        if ($global:PureHueMode) {
            $dist = $radius
        }

        $px = $cx + $dist * [Math]::Cos($angleRad)
        $py = $cy + $dist * [Math]::Sin($angleRad)

        $isSelected = ($null -ne $global:SelectedMarkerId -and $m.Id -eq $global:SelectedMarkerId)

        if ($isSelected) {
            # Highlight Halo on Color Wheel
            $penGlow = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(250, 204, 21), 3)
            $g.DrawEllipse($penGlow, ($px - 14), ($py - 14), 28, 28)
            $penGlow.Dispose()
        }

        $c = [System.Drawing.Color]::FromArgb($m.R, $m.G, $m.B)
        $br = New-Object System.Drawing.SolidBrush($c)
        $g.FillEllipse($br, ($px - 10), ($py - 10), 20, 20)
        $br.Dispose()

        $penOuterColor = if ($isSelected) { [System.Drawing.Color]::FromArgb(250, 204, 21) } else { [System.Drawing.Color]::White }
        $penDot = New-Object System.Drawing.Pen($penOuterColor, 2)
        $g.DrawEllipse($penDot, ($px - 10), ($py - 10), 20, 20)
        $penDot.Dispose()

        $textColor = [System.Drawing.Color]::White
        if ($m.Hsl.L -gt 60) {
            $textColor = [System.Drawing.Color]::Black
        }
        $brText = New-Object System.Drawing.SolidBrush($textColor)
        $textFormat = New-Object System.Drawing.StringFormat
        $textFormat.Alignment = [System.Drawing.StringAlignment]::Center
        $textFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
        $g.DrawString($m.Id.ToString(), $fontId, $brText, $px, $py, $textFormat)
        $brText.Dispose()
    }
    $fontId.Dispose()
})

# Color Wheel Mouse Click: Select/Highlight Pin
$picWheel.Add_MouseClick({
    param($sender, $e)
    $w = $picWheel.Width
    $h = $picWheel.Height
    $cx = $w / 2.0
    $cy = $h / 2.0
    $radius = [Math]::Min($cx, $cy) - 20

    $clickedMarker = $null
    foreach ($m in $global:Markers) {
        $angleRad = $m.Hsl.H * [Math]::PI / 180.0
        $dist = ($m.Hsl.S / 100.0) * $radius
        if ($global:PureHueMode) {
            $dist = $radius
        }

        $px = $cx + $dist * [Math]::Cos($angleRad)
        $py = $cy + $dist * [Math]::Sin($angleRad)

        $dx = $e.X - $px
        $dy = $e.Y - $py
        $clickDist = [Math]::Sqrt($dx * $dx + $dy * $dy)
        if ($clickDist -le 16) {
            $clickedMarker = $m
            break
        }
    }

    if ($null -ne $clickedMarker) {
        $global:SelectedMarkerId = $clickedMarker.Id
        $statusLabel.Text = "Selected Point #$($clickedMarker.Id) ($($clickedMarker.Label)) - $($clickedMarker.Hex) | Hue: $($clickedMarker.Hsl.H) deg Sat: $($clickedMarker.Hsl.S)% Lum: $($clickedMarker.Hsl.L)%"
        
        # Select row in DataGridView
        foreach ($row in $gridMarkers.Rows) {
            if ([int]$row.Cells[0].Value -eq $clickedMarker.Id) {
                $row.Selected = $true
                $gridMarkers.CurrentCell = $row.Cells[0]
                break
            }
        }
        $picPhoto.Invalidate()
        $picWheel.Invalidate()
    } else {
        $global:SelectedMarkerId = $null
        $picPhoto.Invalidate()
        $picWheel.Invalidate()
    }
})

# Photo Paint Handler (Draw markers over photo)
$picPhoto.Add_Paint({
    param($sender, $e)
    if ($null -eq $global:CurrentBitmap) { return }
    $g = $e.Graphics
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $rect = Get-ImageDisplayRect $picPhoto $global:CurrentBitmap

    $fontId = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
    foreach ($m in $global:Markers) {
        $px = $rect.X + ($m.XPct / 100.0) * $rect.Width
        $py = $rect.Y + ($m.YPct / 100.0) * $rect.Height

        $isSelected = ($null -ne $global:SelectedMarkerId -and $m.Id -eq $global:SelectedMarkerId)

        if ($isSelected) {
            # Glowing Reticle Target on Photo
            $penGlow = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(250, 204, 21), 3)
            $g.DrawEllipse($penGlow, ($px - 16), ($py - 16), 32, 32)
            $g.DrawLine($penGlow, ($px - 22), $py, ($px + 22), $py)
            $g.DrawLine($penGlow, $px, ($py - 22), $px, ($py + 22))
            $penGlow.Dispose()
        }

        $c = [System.Drawing.Color]::FromArgb($m.R, $m.G, $m.B)
        $br = New-Object System.Drawing.SolidBrush($c)
        $g.FillEllipse($br, ($px - 11), ($py - 11), 22, 22)
        $br.Dispose()

        $penOuterColor = if ($isSelected) { [System.Drawing.Color]::FromArgb(250, 204, 21) } else { [System.Drawing.Color]::White }
        $penOuter = New-Object System.Drawing.Pen($penOuterColor, 2)
        $g.DrawEllipse($penOuter, ($px - 11), ($py - 11), 22, 22)
        $penOuter.Dispose()

        $textColor = [System.Drawing.Color]::White
        if ($m.Hsl.L -gt 60) {
            $textColor = [System.Drawing.Color]::Black
        }
        $brText = New-Object System.Drawing.SolidBrush($textColor)
        $tf = New-Object System.Drawing.StringFormat
        $tf.Alignment = [System.Drawing.StringAlignment]::Center
        $tf.LineAlignment = [System.Drawing.StringAlignment]::Center
        $g.DrawString($m.Id.ToString(), $fontId, $brText, $px, $py, $tf)
        $brText.Dispose()
    }
    $fontId.Dispose()
})

# Click Photo Handler (Add Marker or Select Existing)
$picPhoto.Add_MouseClick({
    param($sender, $e)
    if ($null -eq $global:CurrentBitmap) { return }

    $rect = Get-ImageDisplayRect $picPhoto $global:CurrentBitmap
    if (-not $rect.Contains($e.Location)) { return }

    # Check if clicked on an existing marker to select it
    foreach ($m in $global:Markers) {
        $mpx = $rect.X + ($m.XPct / 100.0) * $rect.Width
        $mpy = $rect.Y + ($m.YPct / 100.0) * $rect.Height
        $dist = [Math]::Sqrt(($e.X - $mpx) * ($e.X - $mpx) + ($e.Y - $mpy) * ($e.Y - $mpy))
        if ($dist -le 15) {
            $global:SelectedMarkerId = $m.Id
            $statusLabel.Text = "Selected Point #$($m.Id) ($($m.Label)) - $($m.Hex) | Hue: $($m.Hsl.H) deg Sat: $($m.Hsl.S)% Lum: $($m.Hsl.L)%"
            foreach ($row in $gridMarkers.Rows) {
                if ([int]$row.Cells[0].Value -eq $m.Id) {
                    $row.Selected = $true
                    $gridMarkers.CurrentCell = $row.Cells[0]
                    break
                }
            }
            $picPhoto.Invalidate()
            $picWheel.Invalidate()
            return
        }
    }

    if ($global:Markers.Count -ge 10) {
        [System.Windows.Forms.MessageBox]::Show("Maximum of 10 color sample points reached. Reset pins to pick new colors.", "Limit Reached", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
        return
    }

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
    $global:SelectedMarkerId = $markerId
    Refresh-AllUI
})

function Refresh-AllUI {
    Calculate-Harmony
    
    # Update Status
    $statusLabel.Text = "Sampled: $($global:Markers.Count)/10 pins | Dominant Hue: $($global:PrimaryHue) deg | Detected Harmony: $($global:DetectedHarmony)"
    $lblDetected.Text = "Natural Harmony: $($global:DetectedHarmony) (Base Hue: $($global:PrimaryHue) deg)"

    # Repaint Visualizers
    $picPhoto.Invalidate()
    $picWheel.Invalidate()

    # Update Markers DataGridView
    $gridMarkers.Rows.Clear()
    foreach ($m in $global:Markers) {
        $rowIdx = $gridMarkers.Rows.Add(
            $m.Id,
            $m.Hex,
            $m.Label,
            $m.Hex,
            "R:$($m.R) G:$($m.G) B:$($m.B)",
            "H:$($m.Hsl.H) deg S:$($m.Hsl.S)% L:$($m.Hsl.L)%",
            "$($m.XPct)%, $($m.YPct)%"
        )
        $row = $gridMarkers.Rows[$rowIdx]
        
        # Color swatch block
        $row.Cells[1].Style.BackColor = [System.Drawing.Color]::FromArgb($m.R, $m.G, $m.B)
        $textColor = if ($m.Hsl.L -gt 60) { [System.Drawing.Color]::Black } else { [System.Drawing.Color]::White }
        $row.Cells[1].Style.ForeColor = $textColor
        $row.Cells[1].Style.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
        $row.Cells[1].Style.Alignment = [System.Windows.Forms.DataGridViewContentAlignment]::MiddleCenter

        # High-contrast cell font colors
        $row.Cells[2].Style.ForeColor = [System.Drawing.Color]::FromArgb(241, 245, 249) # White label
        $row.Cells[3].Style.ForeColor = [System.Drawing.Color]::FromArgb(192, 132, 252) # Purple hex
        $row.Cells[4].Style.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184) # Slate RGB
        $row.Cells[5].Style.ForeColor = [System.Drawing.Color]::FromArgb(56, 189, 248)  # Cyan HSL
        $row.Cells[6].Style.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184) # Slate coords
    }

    # Update Nudge DataGridView
    $gridNudge.Rows.Clear()
    foreach ($m in $global:Markers) {
        $nudge = Get-NudgeShift $m.Hsl.H
        $shiftStr = "$($nudge.Shift) deg Shift"
        if ($nudge.IsAligned) {
            $shiftStr = "[Aligned] Fit"
        } elseif ($nudge.Shift -gt 0) {
            $shiftStr = "+$($nudge.Shift) deg Shift"
        }

        $rIdx = $gridNudge.Rows.Add(
            "#$($m.Id) ($($m.Label))",
            "$($m.Hsl.H) deg",
            "$($nudge.TargetHue) deg",
            $shiftStr
        )
        $row = $gridNudge.Rows[$rIdx]
        $row.Cells[0].Style.ForeColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
        $row.Cells[1].Style.ForeColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
        $row.Cells[2].Style.ForeColor = [System.Drawing.Color]::FromArgb(56, 189, 248)
        
        if ($nudge.IsAligned) {
            $row.Cells[3].Style.ForeColor = [System.Drawing.Color]::FromArgb(52, 211, 153) # Green
        } else {
            $row.Cells[3].Style.ForeColor = [System.Drawing.Color]::FromArgb(251, 191, 36)  # Amber
        }
        $row.Cells[3].Style.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    }

    # Update Lightroom Strategy Advice
    $rule = $global:DetectedHarmony
    if ($global:TargetHarmony -ne "Auto") {
        $rule = $global:TargetHarmony
    }
    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine("=== LIGHTROOM & PHOTOSHOP COLOR GRADING STRATEGY ===")
    [void]$sb.AppendLine("Target Harmony: $rule | Dominant Hue: $($global:PrimaryHue) deg`r`n")
    [void]$sb.AppendLine("1. HSL / COLOR MIXER ADJUSTMENTS:")
    if ($rule -like "*Complementary*") {
        [void]$sb.AppendLine("   - Push warm highlights towards Hue: $($global:PrimaryHue) deg")
        [void]$sb.AppendLine("   - Push cool shadow accents opposite towards: $((($global:PrimaryHue + 180) % 360)) deg")
        [void]$sb.AppendLine("   - Slightly desaturate outlying intermediate hues to clean dual contrast.")
    } elseif ($rule -like "*Analogous*") {
        [void]$sb.AppendLine("   - Restrict colors within a cohesive 30 to 60 deg spectrum arc.")
        [void]$sb.AppendLine("   - Nudge straggling greens or blues into adjacent warmth zone.")
    } else {
        [void]$sb.AppendLine("   - Distribute tonal weights evenly across target vertices: $($global:PrimaryHue) deg, $((($global:PrimaryHue + 120) % 360)) deg, $((($global:PrimaryHue + 240) % 360)) deg.")
    }
    [void]$sb.AppendLine("`r`n2. COLOR GRADING (3-WAY WHEELS):")
    [void]$sb.AppendLine("   - Highlights Wheel: Set Hue to ~$($global:PrimaryHue) deg (Warm tone)")
    [void]$sb.AppendLine("   - Shadows Wheel: Set Hue to ~$((($global:PrimaryHue + 180) % 360)) deg (Cool teal/blue)")
    [void]$sb.AppendLine("`r`n3. SATURATION & CLIPPING DISCIPLINE:")
    [void]$sb.AppendLine("   - Drop global Vibrance/Saturation by -10% to prevent posterization, then selectively boost target palette hues in Color Mixer.")

    $txtTips.Text = $sb.ToString()
}

# --- Event Listeners ---
$gridMarkers.Add_SelectionChanged({
    if ($gridMarkers.SelectedRows.Count -gt 0) {
        $id = [int]$gridMarkers.SelectedRows[0].Cells[0].Value
        $global:SelectedMarkerId = $id
        $picPhoto.Invalidate()
        $picWheel.Invalidate()
    }
})

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
    $global:SelectedMarkerId = $null
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
            $global:SelectedMarkerId = $null
            Refresh-AllUI
            $statusLabel.Text = "Loaded: $($dlg.FileName) ($($global:CurrentBitmap.Width) x $($global:CurrentBitmap.Height))"
        } catch {
            [System.Windows.Forms.MessageBox]::Show("Error loading image: $($_.Exception.Message)", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        }
    }
})

$btnAuto.Add_Click({
    if ($null -eq $global:CurrentBitmap) {
        [System.Windows.Forms.MessageBox]::Show("Please open or load a photo first.", "No Photo", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
        return
    }

    $global:Markers.Clear()
    $global:SelectedMarkerId = $null
    $bmp = $global:CurrentBitmap
    $stepX = [Math]::Max(1, [int]($bmp.Width / 14))
    $stepY = [Math]::Max(1, [int]($bmp.Height / 14))

    $samples = [System.Collections.ArrayList]::new()
    for ($y = [int]($stepY / 2); $y -lt $bmp.Height; $y += $stepY) {
        for ($x = [int]($stepX / 2); $x -lt $bmp.Width; $x += $stepX) {
            $c = $bmp.GetPixel($x, $y)
            $hsl = Convert-RgbToHsl $c.R $c.G $c.B
            $xPct = [Math]::Round((($x / [double]$bmp.Width) * 100.0), 1)
            $yPct = [Math]::Round((($y / [double]$bmp.Height) * 100.0), 1)
            $samples.Add([PSCustomObject]@{
                R = $c.R; G = $c.G; B = $c.B; Hsl = $hsl
                XPct = $xPct; YPct = $yPct; PixelX = $x; PixelY = $y
            }) | Out-Null
        }
    }

    if ($samples.Count -eq 0) { return }

    # Photographic Palette Selection: Highlights, Shadows, Subject Accents & Midtones
    $sortedLum = $samples | Sort-Object { $_.Hsl.L }
    $sortedSat = $samples | Sort-Object { $_.Hsl.S }

    $shadow = $sortedLum[0]
    $highlight = $sortedLum[$sortedLum.Count - 1]
    $vibrant = $sortedSat[$sortedSat.Count - 1]
    $midIdx = [int]($samples.Count / 2)
    $midtone = $sortedLum[$midIdx]

    $selected = [System.Collections.ArrayList]::new()
    $selected.Add(@{ Pt = $highlight; Label = "Highlight Tone" }) | Out-Null
    $selected.Add(@{ Pt = $midtone;   Label = "Primary Midtone" }) | Out-Null
    $selected.Add(@{ Pt = $shadow;    Label = "Deep Shadow" }) | Out-Null
    $selected.Add(@{ Pt = $vibrant;   Label = "Vibrant Accent" }) | Out-Null

    # Add 5th tone distinct from midtone and vibrant
    $distinct = $samples | Where-Object { 
        [Math]::Abs($_.Hsl.H - $midtone.Hsl.H) -gt 45 -and
        [Math]::Abs($_.Hsl.H - $vibrant.Hsl.H) -gt 35
    } | Select-Object -First 1

    if ($null -ne $distinct) {
        $selected.Add(@{ Pt = $distinct; Label = "Secondary Tone" }) | Out-Null
    }

    $id = 1
    foreach ($item in $selected) {
        $pt = $item.Pt
        $hex = Convert-RgbToHex $pt.R $pt.G $pt.B
        $global:Markers.Add([PSCustomObject]@{
            Id = $id
            Label = $item.Label
            R = $pt.R; G = $pt.G; B = $pt.B
            Hex = $hex; Hsl = $pt.Hsl
            XPct = $pt.XPct; YPct = $pt.YPct
            PixelX = $pt.PixelX; PixelY = $pt.PixelY
        }) | Out-Null
        $id++
    }

    Refresh-AllUI
    $statusLabel.Text = "Auto Extracted $($global:Markers.Count) Dominant Photo Tones (Highlights, Midtones, Shadows, Accents)!"
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
    $global:SelectedMarkerId = $null

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
