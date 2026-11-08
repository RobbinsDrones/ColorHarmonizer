/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Palette, Upload, Sparkles, Sliders, Zap, Target, ArrowRight, 
  Terminal, Download, Copy, Check, RefreshCw, Layers, ExternalLink,
  Info, Cpu, ShieldCheck, HelpCircle, Eye
} from 'lucide-react';
import { ColorMarker, HarmonyRule, AutoAnalysisResult, DominantColor, WorkspaceTheme } from './types';
import { 
  analyzeColorHarmony, calculateNudgeSuggestions, rgbToHex, rgbToHsl, extractPhotoColorsAndTones 
} from './utils/colorUtils';
import { PhotoSampler } from './components/PhotoSampler';
import { ColorWheel } from './components/ColorWheel';
import { PaletteList } from './components/PaletteList';
import { AutoPaletteAnalyzer } from './components/AutoPaletteAnalyzer';
import { LightroomTips } from './components/LightroomTips';
import { PowerShellHub } from './components/PowerShellHub';
import { ExportModal } from './components/ExportModal';

// Default High-Fidelity Photograph (Atmospheric urban night with vibrant subjects)
const DEFAULT_PHOTO_URL = 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1400&q=80';

export default function App() {
  // Navigation State: 'studio' | 'powershell'
  const [appMode, setAppMode] = useState<'studio' | 'powershell'>('studio');

  // Photographic Workspace Theme: 'gray50Studio' | 'neutralGray' | 'darkSlate'
  const [workspaceTheme, setWorkspaceTheme] = useState<WorkspaceTheme>(() => {
    return (localStorage.getItem('photo_lab_theme') as WorkspaceTheme) || 'darkSlate';
  });

  const handleSetWorkspaceTheme = (theme: WorkspaceTheme) => {
    setWorkspaceTheme(theme);
    localStorage.setItem('photo_lab_theme', theme);
  };

  // Photo & Color Markers State
  const [imageSrc, setImageSrc] = useState<string>(DEFAULT_PHOTO_URL);
  const [markers, setMarkers] = useState<ColorMarker[]>([]);
  const [pureHueMode, setPureHueMode] = useState<boolean>(false);
  const [targetHarmony, setTargetHarmony] = useState<HarmonyRule>('auto');
  const [hoveredMarkerId, setHoveredMarkerId] = useState<number | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<number | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<'wheel' | 'lightroom'>('wheel');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Auto Color Extraction State
  const [samplingMode, setSamplingMode] = useState<'manual' | 'auto'>('manual');
  const [autoAnalysis, setAutoAnalysis] = useState<AutoAnalysisResult | null>(null);
  const [isAnalyzingAuto, setIsAnalyzingAuto] = useState<boolean>(false);
  const [autoClusterCount, setAutoClusterCount] = useState<number>(5);

  // Load and analyze photo using balanced dominant + visually significant extraction
  const loadAndAnalyzePhoto = (url: string, count: number = autoClusterCount, autoPopulatePins: boolean = true) => {
    setIsAnalyzingAuto(true);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const autoRes = extractPhotoColorsAndTones(img, count);
        setAutoAnalysis(autoRes);

        if (autoPopulatePins && autoRes.dominantColors.length > 0) {
          const autoPins: ColorMarker[] = autoRes.dominantColors.map(c => ({
            id: c.id,
            x: c.sampleX,
            y: c.sampleY,
            r: c.rgb.r,
            g: c.rgb.g,
            b: c.rgb.b,
            hex: c.hex,
            hsl: c.hsl,
            label: c.label
          }));
          setMarkers(autoPins);
        }
      } catch (err) {
        console.error('Failed to analyze photo colors', err);
      } finally {
        setIsAnalyzingAuto(false);
      }
    };
    img.onerror = () => setIsAnalyzingAuto(false);
    img.src = url;
  };

  // Run Auto Extraction on an image URL (when re-analyzing or changing cluster count)
  const runAutoAnalysis = (url: string, count: number = autoClusterCount) => {
    loadAndAnalyzePhoto(url, count, false);
  };

  // Initialize Photo on Mount
  useEffect(() => {
    loadAndAnalyzePhoto(imageSrc, autoClusterCount, true);
  }, []);

  // Handle Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newUrl = event.target.result as string;
          setImageSrc(newUrl);
          loadAndAnalyzePhoto(newUrl, autoClusterCount, true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Apply Auto Colors as Pins on Photo & Color Wheel
  const handleApplyAutoColorsAsPins = (colors: DominantColor[]) => {
    const newMarkers: ColorMarker[] = colors.map((c, idx) => ({
      id: idx + 1,
      x: c.sampleX,
      y: c.sampleY,
      r: c.rgb.r,
      g: c.rgb.g,
      b: c.rgb.b,
      hex: c.hex,
      hsl: c.hsl,
      label: `${c.toneCategory}: ${c.label}`
    }));
    setMarkers(newMarkers);
    setSamplingMode('manual'); // switch to viewing the pins on the photo
  };

  // Add a single dominant color or tone as a pin
  const handleAddSingleColorAsPin = (color: DominantColor) => {
    if (markers.length >= 12) {
      alert("Maximum of 12 color sample points reached. Remove one first.");
      return;
    }
    const newId = markers.length > 0 ? Math.max(...markers.map(m => m.id)) + 1 : 1;
    const newMarker: ColorMarker = {
      id: newId,
      x: color.sampleX,
      y: color.sampleY,
      r: color.rgb.r,
      g: color.rgb.g,
      b: color.rgb.b,
      hex: color.hex,
      hsl: color.hsl,
      label: `${color.toneCategory} (${color.percentage}%)`
    };
    setMarkers(prev => [...prev, newMarker]);
  };

  // Marker Operations
  const handleAddMarker = (newMarker: ColorMarker) => {
    setMarkers(prev => [...prev, newMarker]);
  };

  const handleRemoveMarker = (id: number) => {
    setMarkers(prev => prev.filter(m => m.id !== id));
  };

  const handleUpdateLabel = (id: number, label: string) => {
    setMarkers(prev => prev.map(m => m.id === id ? { ...m, label } : m));
  };

  const handleResetMarkers = () => {
    setMarkers([]);
  };

  const handleMarkerSelect = (id: number | null) => {
    setSelectedMarkerId(id);
    if (id !== null && samplingMode === 'auto') {
      setSamplingMode('manual');
    }
  };

  // Derived Harmony Detection
  const detectedHarmony = useMemo(() => {
    return analyzeColorHarmony(markers);
  }, [markers]);

  const activeHarmonyRule = targetHarmony === 'auto' ? detectedHarmony.type : targetHarmony;

  // Derived Hue Nudge Suggestions
  const nudgeSuggestions = useMemo(() => {
    return calculateNudgeSuggestions(markers, activeHarmonyRule, detectedHarmony.primaryHue);
  }, [markers, activeHarmonyRule, detectedHarmony.primaryHue]);

  return (
    <div 
      data-theme={workspaceTheme}
      className={`flex flex-col min-h-screen font-sans antialiased selection:bg-indigo-500 selection:text-white transition-colors duration-200 ${
        workspaceTheme === 'gray50Studio'
          ? 'bg-[#585858] text-[#f5f5f5]'
          : workspaceTheme === 'neutralGray'
          ? 'bg-[#121212] text-[#f4f4f5]'
          : 'bg-slate-950 text-slate-100'
      }`}
    >
      
      {/* Top Application Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-4 md:px-6 py-3 flex flex-wrap justify-between items-center gap-4 shadow-lg">
        
        {/* Brand & Mode Switcher */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl shadow-lg shadow-indigo-500/25">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Photo Color Analysis & Harmony Lab
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hidden sm:inline-block">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                2D Color Wheel • Harmony Engine • PowerShell (pwsh) to EXE Converter
              </p>
            </div>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="hidden lg:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 ml-2">
            <button
              onClick={() => setAppMode('studio')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                appMode === 'studio'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Color Studio</span>
            </button>

            <button
              onClick={() => setAppMode('powershell')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                appMode === 'powershell'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>PowerShell / EXE Hub</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse ml-0.5" />
            </button>
          </div>
        </div>

        {/* Right Header Controls: Photographic Surround Switcher & Actions */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          
          {/* Photographic Eye Surround Theme Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-2 flex items-center gap-1.5" title="Calibrated surround color to eliminate chromatic adaptation bias">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">Surround:</span>
            </span>
            <button
              onClick={() => handleSetWorkspaceTheme('gray50Studio')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                workspaceTheme === 'gray50Studio'
                  ? 'bg-[#808080] text-black shadow-md font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="50% Neutral Gray (18% Reflectance Card Standard - Optical Neutral Anchor)"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#808080] border border-black/40 inline-block" />
              <span>50% Gray</span>
            </button>
            <button
              onClick={() => handleSetWorkspaceTheme('neutralGray')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                workspaceTheme === 'neutralGray'
                  ? 'bg-[#2b2b2b] text-white shadow-md ring-1 ring-[#444444]'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Lightroom / DaVinci Neutral Dark (#121212, zero chromatic bias)"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#242424] border border-[#555555] inline-block" />
              <span>Neutral</span>
            </button>
            <button
              onClick={() => handleSetWorkspaceTheme('darkSlate')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                workspaceTheme === 'darkSlate'
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Deep Slate Blue UI (#020617)"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#0f172a] border border-slate-600 inline-block" />
              <span>Slate</span>
            </button>
          </div>

          {/* Mobile Mode Switcher Toggle */}
          <div className="flex lg:hidden items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setAppMode('studio')}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                appMode === 'studio' ? 'bg-indigo-600 text-white' : 'text-slate-400'
              }`}
            >
              Studio
            </button>
            <button
              onClick={() => setAppMode('powershell')}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                appMode === 'powershell' ? 'bg-cyan-600 text-white' : 'text-slate-400'
              }`}
            >
              pwsh
            </button>
          </div>

          {/* Upload Button */}
          <label className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg cursor-pointer transition-all shadow-md shadow-indigo-600/25">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Photo</span>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload} 
            />
          </label>

          {/* Export Palette Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="hidden sm:flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-lg border border-slate-700 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        
        {/* VIEW 1: Main Photo Color Studio */}
        {appMode === 'studio' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Interactive Photo Sampler, Auto Color Analyzer, and Palette Cards (7 cols) */}
            <div className="lg:col-span-7 flex flex-col space-y-5">
              {/* Photographic Calibration Active Indicator */}
              {workspaceTheme === 'gray50Studio' && (
                <div className="bg-[#383838] border border-[#525252] rounded-xl px-3.5 py-2 text-xs flex items-center justify-between shadow-xs">
                  <div className="flex items-center space-x-2 text-[#e0e0e0]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#808080] border border-black/40 shrink-0" />
                    <span className="font-semibold text-white">50% Neutral Gray Environment Active</span>
                    <span className="text-[#a8a8a8] hidden sm:inline">• 18% Reflectance D65 Standard (Zero Simultaneous Contrast Bias)</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-[#282828] text-amber-300 px-2 py-0.5 rounded border border-[#484848] font-bold">
                    D65 Calibrated
                  </span>
                </div>
              )}

              <PhotoSampler
                imageSrc={imageSrc}
                markers={markers}
                onAddMarker={handleAddMarker}
                onRemoveMarker={handleRemoveMarker}
                onResetMarkers={handleResetMarkers}
                hoveredMarkerId={hoveredMarkerId}
                selectedMarkerId={selectedMarkerId}
                onMarkerHover={setHoveredMarkerId}
                onSelectMarker={handleMarkerSelect}
                samplingMode={samplingMode}
                onSetSamplingMode={setSamplingMode}
                onTriggerAutoExtract={() => runAutoAnalysis(imageSrc, autoClusterCount)}
                isAnalyzingAuto={isAnalyzingAuto}
                initialMatte={workspaceTheme === 'gray50Studio' ? 'gray50' : 'neutralDark'}
              />

              {/* Auto Color Picker & Tonal Analysis Panel */}
              {samplingMode === 'auto' ? (
                <AutoPaletteAnalyzer
                  analysis={autoAnalysis}
                  isAnalyzing={isAnalyzingAuto}
                  onApplyAutoColorsAsPins={handleApplyAutoColorsAsPins}
                  onAddSingleColorAsPin={handleAddSingleColorAsPin}
                  onReanalyze={(count) => {
                    setAutoClusterCount(count);
                    runAutoAnalysis(imageSrc, count);
                  }}
                  targetCount={autoClusterCount}
                />
              ) : (
                /* Compact Auto Color Banner when in Manual Eyedropper mode */
                autoAnalysis && autoAnalysis.dominantColors.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-white">Photo Dominant Palette</span>
                          <span className="text-[10px] text-amber-300 font-medium px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25">
                            {autoAnalysis.temperature} Scheme
                          </span>
                        </div>
                        {/* Mini preview bar */}
                        <div className="flex items-center space-x-1.5 mt-1.5">
                          {autoAnalysis.dominantColors.slice(0, 5).map(c => (
                            <div 
                              key={c.id} 
                              style={{ backgroundColor: c.hex }} 
                              className="w-5 h-5 rounded-md border border-white/20 shadow-xs cursor-pointer hover:scale-110 transition-transform" 
                              title={`${c.label} (${c.hex}) - ${c.percentage}%`}
                              onClick={() => handleAddSingleColorAsPin(c)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setSamplingMode('auto')}
                      className="bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 shrink-0 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>View Tones & Breakdown</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              )}

              <PaletteList
                markers={markers}
                onRemoveMarker={handleRemoveMarker}
                onUpdateLabel={handleUpdateLabel}
                hoveredMarkerId={hoveredMarkerId}
                selectedMarkerId={selectedMarkerId}
                onMarkerHover={setHoveredMarkerId}
                onSelectMarker={handleMarkerSelect}
                onOpenExportModal={() => setIsExportModalOpen(true)}
              />

              {/* Callout to PowerShell & EXE Conversion */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/60 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Need to run locally as an EXE or in pwsh?
                    </h4>
                    <p className="text-xs text-slate-400">
                      Export standalone PowerShell script (<code className="text-indigo-300">.ps1</code>) or compile to a native Windows executable with <code className="text-cyan-300">ps2exe</code>.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setAppMode('powershell')}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <span>Open Converter Hub</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right Column: 2D Polar Color Wheel & Analytics (5 cols) */}
            <div className="lg:col-span-5 flex flex-col space-y-4">
              
              {/* Tab Selector for Right Panel */}
              <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-xl flex space-x-1 shadow-md">
                <button
                  onClick={() => setRightPanelTab('wheel')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    rightPanelTab === 'wheel'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Color Wheel & Harmony</span>
                </button>

                <button
                  onClick={() => setRightPanelTab('lightroom')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    rightPanelTab === 'lightroom'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Editing & Grading Tips</span>
                </button>
              </div>

              {rightPanelTab === 'wheel' ? (
                <>
                  {/* 2D Color Wheel Distribution Card */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col items-center">
                    <div className="w-full flex justify-between items-center mb-4">
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <span>2D Polar Color Distribution</span>
                      </h3>

                      {/* Pure Hue Toggle */}
                      <label className="flex items-center space-x-2 cursor-pointer bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        <span className="text-[11px] font-medium text-slate-300">Pure Hue Mode</span>
                        <input
                          type="checkbox"
                          checked={pureHueMode}
                          onChange={(e) => setPureHueMode(e.target.checked)}
                          className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </label>
                    </div>

                    {/* Canvas Wheel Component */}
                    <ColorWheel
                      markers={markers}
                      pureHueMode={pureHueMode}
                      activeHarmonyRule={activeHarmonyRule}
                      detectedHarmony={detectedHarmony}
                      hoveredMarkerId={hoveredMarkerId}
                      selectedMarkerId={selectedMarkerId}
                      onMarkerHover={setHoveredMarkerId}
                      onMarkerSelect={handleMarkerSelect}
                    />

                    <p className="text-[11px] text-slate-400 text-center mt-3 max-w-xs">
                      {pureHueMode
                        ? 'Pure Hue Mode projects all markers to the perimeter for pure angular geometric comparison.'
                        : 'Plots exact Hue (angle 0°-360°) and Saturation (radial distance from center).'}
                    </p>
                  </div>

                  {/* Harmony Analysis & Nudge Recommendations Card */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                    
                    {/* Natural Harmony Detection Box */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Detected Natural Harmony
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {detectedHarmony.type}
                          </span>
                          <span className="text-[11px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {detectedHarmony.score}% Match
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {detectedHarmony.description}
                      </p>

                      {/* Harmony Target Rule Selector */}
                      <div className="mt-3 pt-3 border-t border-slate-800">
                        <label className="text-xs text-slate-300 font-medium block mb-1.5">
                          Enforce Target Overlay Geometry:
                        </label>
                        <select
                          value={targetHarmony}
                          onChange={(e) => setTargetHarmony(e.target.value as HarmonyRule)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="auto">Auto (Match Detected: {detectedHarmony.type})</option>
                          <option value="Complementary">Complementary (180° Direct Opposite)</option>
                          <option value="Split-Complementary">Split-Complementary (150° & 210°)</option>
                          <option value="Analogous">Analogous (30° Adjacent Harmony)</option>
                          <option value="Triadic">Triadic (120° Equilateral Triangle)</option>
                          <option value="Tetradic">Tetradic (90° Square Harmony)</option>
                          <option value="Monochromatic">Monochromatic (Single Hue Family)</option>
                        </select>
                      </div>
                    </div>

                    {/* Hue Alignment Nudge Suggestions */}
                    <div className="pt-3 border-t border-slate-800">
                      <div className="flex justify-between items-center mb-2.5">
                        <h4 className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                          <Target className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Hue Alignment Nudge Offsets</span>
                        </h4>
                        <span className="text-[10px] text-slate-500">Target Hue: {detectedHarmony.primaryHue}°</span>
                      </div>

                      {markers.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-2">
                          Sample photo points to view hue shift recommendations.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-[195px] overflow-y-auto pr-1">
                          {nudgeSuggestions.map((nudge) => {
                            const marker = markers.find(m => m.id === nudge.markerId);
                            if (!marker) return null;

                            return (
                              <div
                                key={nudge.markerId}
                                className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                              >
                                <div className="flex items-center space-x-2 min-w-0">
                                  <div
                                    style={{ backgroundColor: marker.hex }}
                                    className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                                  />
                                  <span className="font-medium text-slate-300 truncate max-w-[110px]">
                                    {marker.label}
                                  </span>
                                </div>

                                <div className="flex items-center space-x-2 font-mono shrink-0">
                                  <span className="text-slate-400">{nudge.currentHue}°</span>
                                  <ArrowRight className="w-3 h-3 text-slate-600" />
                                  <span className="text-indigo-300">{nudge.targetHue}°</span>
                                  {nudge.isAligned ? (
                                    <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[11px]">
                                      Perfect Fit
                                    </span>
                                  ) : (
                                    <span
                                      className={`font-semibold text-[11px] px-1.5 py-0.5 rounded ${
                                        nudge.shift > 0 
                                          ? 'text-amber-400 bg-amber-500/10' 
                                          : 'text-cyan-400 bg-cyan-500/10'
                                      }`}
                                    >
                                      {nudge.shift > 0 ? `+${nudge.shift}°` : `${nudge.shift}°`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                </>
              ) : (
                /* Lightroom & Photoshop Post-Processing Tab */
                <LightroomTips
                  markers={markers}
                  activeHarmonyRule={activeHarmonyRule}
                  detectedHarmony={detectedHarmony}
                />
              )}

            </div>

          </div>
        ) : (
          /* VIEW 2: PowerShell & Desktop EXE Hub */
          <PowerShellHub markers={markers} />
        )}

      </main>

      {/* Multi-Format Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        markers={markers}
        detectedHarmony={detectedHarmony.type}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 px-6 py-4 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2">
        <div>
          <span>Photo Color Analysis & Harmony Lab</span> • <span>Run online or compile to local desktop <code className="text-indigo-400 font-mono">.exe</code></span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setAppMode('powershell')}
            className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>PowerShell & ps2exe Guide</span>
          </button>
          <span>•</span>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Export Palette
          </button>
        </div>
      </footer>

    </div>
  );
}
