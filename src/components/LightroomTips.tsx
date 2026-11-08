import React, { useState, useMemo } from 'react';
import { ColorMarker, HarmonyDetectionResult, LightroomPreset } from '../types';
import { 
  Sliders, Download, Sparkles, Sun, Moon, Circle, Check, Copy, 
  ExternalLink, FileCode2, Layers, Compass, HelpCircle, ChevronRight
} from 'lucide-react';
import { generateLightroomPreset, generateLightroomXmpPreset } from '../utils/colorUtils';

interface LightroomTipsProps {
  markers: ColorMarker[];
  activeHarmonyRule: string;
  detectedHarmony: HarmonyDetectionResult;
}

export const LightroomTips: React.FC<LightroomTipsProps> = ({
  markers,
  activeHarmonyRule,
  detectedHarmony
}) => {
  const [copiedXmp, setCopiedXmp] = useState(false);
  const [showXmpModal, setShowXmpModal] = useState(false);

  // Generate calculated Lightroom preset from sampled pins and active harmony
  const preset: LightroomPreset = useMemo(() => {
    return generateLightroomPreset(
      markers,
      activeHarmonyRule,
      detectedHarmony.primaryHue,
      `Photo Harmony - ${activeHarmonyRule} (${Math.round(detectedHarmony.primaryHue)}°)`
    );
  }, [markers, activeHarmonyRule, detectedHarmony.primaryHue]);

  // Generate .XMP contents
  const xmpContent = useMemo(() => {
    return generateLightroomXmpPreset(preset);
  }, [preset]);

  const handleDownloadXmp = () => {
    const filename = `${preset.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}.xmp`;
    const blob = new Blob([xmpContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyXmp = () => {
    navigator.clipboard.writeText(xmpContent);
    setCopiedXmp(true);
    setTimeout(() => setCopiedXmp(false), 2000);
  };

  const channelsList = [
    { key: 'red', name: 'Red', color: '#ef4444' },
    { key: 'orange', name: 'Orange', color: '#f97316' },
    { key: 'yellow', name: 'Yellow', color: '#eab308' },
    { key: 'green', name: 'Green', color: '#22c55e' },
    { key: 'aqua', name: 'Aqua', color: '#06b6d4' },
    { key: 'blue', name: 'Blue', color: '#3b82f6' },
    { key: 'purple', name: 'Purple', color: '#a855f7' },
    { key: 'magenta', name: 'Magenta', color: '#ec4899' },
  ] as const;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Lightroom Color Mixer & Preset Lab</span>
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              .XMP Ready
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Calculated directly from your <span className="text-indigo-400 font-semibold">{markers.length} sampled points</span> to enforce <span className="text-amber-300 font-semibold">{activeHarmonyRule}</span> harmony.
          </p>
        </div>

        {/* Primary Download Preset Action Button */}
        <button
          onClick={handleDownloadXmp}
          disabled={markers.length === 0}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-lg shadow-indigo-600/25 flex items-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-40"
          title="Download Adobe Lightroom & Photoshop Camera Raw .xmp develop preset"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export .XMP</span>
        </button>
      </div>

      {/* Workflow Step Tracker Banner */}
      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] flex items-center justify-between text-slate-400">
        <div className="flex items-center space-x-1.5">
          <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-[10px] border border-indigo-500/30">
            ✓
          </span>
          <span className="text-slate-300 font-medium">1. Sample Colors</span>
        </div>
        <ChevronRight className="w-3 h-3 text-slate-600" />
        <div className="flex items-center space-x-1.5">
          <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-[10px] border border-amber-500/30">
            ✓
          </span>
          <span className="text-slate-300 font-medium">2. Harmony Rule</span>
        </div>
        <ChevronRight className="w-3 h-3 text-slate-600" />
        <div className="flex items-center space-x-1.5">
          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-[10px] border border-emerald-500/30">
            ✓
          </span>
          <span className="text-emerald-300 font-bold">3. Calculated .XMP</span>
        </div>
      </div>

      {/* 1. CALCULATED 3-WAY COLOR GRADING (Shadows, Midtones, Highlights) */}
      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>1. Three-Way Color Grading Wheels (Split Toning)</span>
          </h4>
          <span className="text-[10px] font-mono text-slate-500">Blending: {preset.colorGrading.blending}%</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          {/* Shadows */}
          <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1 font-medium">
              <span className="flex items-center gap-1">
                <Moon className="w-3 h-3 text-cyan-400" />
                <span>Shadows</span>
              </span>
              <span 
                className="w-3 h-3 rounded-full border border-white/20" 
                style={{ backgroundColor: `hsl(${preset.colorGrading.shadowHue}, ${preset.colorGrading.shadowSat}%, 40%)` }}
              />
            </div>
            <div className="font-mono text-cyan-300 font-bold text-xs mt-1">
              Hue: {preset.colorGrading.shadowHue}°
            </div>
            <div className="font-mono text-[10px] text-slate-400">
              Sat: {preset.colorGrading.shadowSat} • Lum: {preset.colorGrading.shadowLum}
            </div>
          </div>

          {/* Midtones */}
          <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1 font-medium">
              <span className="flex items-center gap-1">
                <Circle className="w-3 h-3 text-indigo-400" />
                <span>Midtones</span>
              </span>
              <span 
                className="w-3 h-3 rounded-full border border-white/20" 
                style={{ backgroundColor: `hsl(${preset.colorGrading.midtoneHue}, ${preset.colorGrading.midtoneSat}%, 50%)` }}
              />
            </div>
            <div className="font-mono text-indigo-300 font-bold text-xs mt-1">
              Hue: {preset.colorGrading.midtoneHue}°
            </div>
            <div className="font-mono text-[10px] text-slate-400">
              Sat: {preset.colorGrading.midtoneSat} • Lum: {preset.colorGrading.midtoneLum}
            </div>
          </div>

          {/* Highlights */}
          <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1 font-medium">
              <span className="flex items-center gap-1">
                <Sun className="w-3 h-3 text-amber-400" />
                <span>Highlights</span>
              </span>
              <span 
                className="w-3 h-3 rounded-full border border-white/20" 
                style={{ backgroundColor: `hsl(${preset.colorGrading.highlightHue}, ${preset.colorGrading.highlightSat}%, 60%)` }}
              />
            </div>
            <div className="font-mono text-amber-300 font-bold text-xs mt-1">
              Hue: {preset.colorGrading.highlightHue}°
            </div>
            <div className="font-mono text-[10px] text-slate-400">
              Sat: {preset.colorGrading.highlightSat} • Lum: {preset.colorGrading.highlightLum}
            </div>
          </div>
        </div>
      </div>

      {/* 2. CALCULATED GLOBAL VIBRANCE & SATURATION */}
      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div>
          <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 mb-0.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>2. Global Vibrance & Saturation</span>
          </div>
          <p className="text-[10px] text-slate-400">
            Dynamically calculated from sampled photo chroma to protect skin tones and prevent clipping.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-center font-mono">
            <span className="text-[10px] text-slate-400 block">Vibrance</span>
            <span className={`text-xs font-bold ${preset.vibrance >= 0 ? 'text-indigo-300' : 'text-slate-300'}`}>
              {preset.vibrance > 0 ? `+${preset.vibrance}` : preset.vibrance}
            </span>
          </div>
          <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-center font-mono">
            <span className="text-[10px] text-slate-400 block">Saturation</span>
            <span className={`text-xs font-bold ${preset.saturation >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
              {preset.saturation > 0 ? `+${preset.saturation}` : preset.saturation}
            </span>
          </div>
        </div>
      </div>

      {/* 3. CALCULATED 8-CHANNEL HSL / COLOR MIXER SLIDERS */}
      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>3. Specific Lightroom 8-Channel HSL Sliders</span>
          </h4>
          <span className="text-[10px] text-slate-500 font-mono">Range: -100 to +100</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {channelsList.map((ch) => {
            const adj = preset.hsl[ch.key];
            const isModified = adj.hue !== 0 || adj.saturation !== 0 || adj.luminance !== 0;

            return (
              <div 
                key={ch.key}
                className={`p-2 rounded-lg border transition-colors ${
                  isModified 
                    ? 'bg-slate-900/95 border-slate-700/80' 
                    : 'bg-slate-900/40 border-slate-800/60 opacity-60'
                }`}
              >
                <div className="flex items-center space-x-1.5 mb-1.5">
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ backgroundColor: ch.color }}
                  />
                  <span className="font-semibold text-slate-200 text-[11px] capitalize">{ch.name}</span>
                </div>

                <div className="space-y-1 font-mono text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Hue:</span>
                    <span className={adj.hue > 0 ? 'text-amber-400' : adj.hue < 0 ? 'text-cyan-400' : 'text-slate-400'}>
                      {adj.hue > 0 ? `+${adj.hue}` : adj.hue}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Sat:</span>
                    <span className={adj.saturation > 0 ? 'text-emerald-400' : adj.saturation < 0 ? 'text-rose-400' : 'text-slate-400'}>
                      {adj.saturation > 0 ? `+${adj.saturation}` : adj.saturation}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Lum:</span>
                    <span className={adj.luminance > 0 ? 'text-white' : adj.luminance < 0 ? 'text-slate-400' : 'text-slate-500'}>
                      {adj.luminance > 0 ? `+${adj.luminance}` : adj.luminance}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Non-Destructive Camera Settings Guarantee */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-300">
        <div className="flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span><strong>Pure Color Preset:</strong> Zero changes to Exposure, White Balance (Temp/Tint), Sharpening, Noise Reduction, or Crop.</span>
        </div>
        <span className="text-[10px] text-emerald-400/80 font-mono hidden sm:inline">Develop → Presets → Import</span>
      </div>

      {/* Preset Action Bar & Inspection */}
      <div className="pt-2 border-t border-slate-800 flex flex-wrap justify-between items-center gap-3 text-xs">
        <div className="flex items-center space-x-2 text-slate-400">
          <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
          <span className="truncate max-w-[200px] font-mono text-[11px] text-slate-300 font-medium">
            {preset.name}.xmp
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Raw XMP Code */}
          <button
            onClick={() => setShowXmpModal(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
            title="Inspect raw Adobe Camera Raw XML markup"
          >
            <span>Inspect .XMP</span>
          </button>

          {/* Copy Raw XMP */}
          <button
            onClick={handleCopyXmp}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 font-medium transition-colors cursor-pointer"
          >
            {copiedXmp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedXmp ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Download .xmp */}
          <button
            onClick={handleDownloadXmp}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .xmp</span>
          </button>
        </div>
      </div>

      {/* RAW XMP PREVIEW MODAL */}
      {showXmpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div className="flex items-center space-x-2">
                <FileCode2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Adobe Lightroom / Camera Raw Develop Preset (.xmp)</h3>
              </div>
              <button
                onClick={() => setShowXmpModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-950 overflow-auto flex-1 font-mono text-xs text-indigo-200/90 leading-relaxed">
              <pre>{xmpContent}</pre>
            </div>

            <div className="px-6 py-3 border-t border-slate-800 flex justify-between items-center bg-slate-900">
              <span className="text-xs text-slate-400">
                Lightroom Classic: <strong>Develop</strong> module → <strong>Presets</strong> panel → <strong>+</strong> → <strong>Import Presets...</strong>
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={handleCopyXmp}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 font-medium transition-colors cursor-pointer flex items-center gap-1"
                >
                  {copiedXmp ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedXmp ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={handleDownloadXmp}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-md"
                >
                  <Download className="w-3 h-3" />
                  <span>Download .xmp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
