import React, { useState } from 'react';
import { AutoAnalysisResult, ColorMarker, DominantColor } from '../types';
import { 
  Sparkles, Layers, Sun, Moon, Flame, Wind, Sliders, Check, 
  Copy, PlusCircle, ArrowRight, Eye, RefreshCw, BarChart2 
} from 'lucide-react';

interface AutoPaletteAnalyzerProps {
  analysis: AutoAnalysisResult | null;
  isAnalyzing: boolean;
  onApplyAutoColorsAsPins: (colors: DominantColor[]) => void;
  onAddSingleColorAsPin: (color: DominantColor) => void;
  onReanalyze: (count: number) => void;
  targetCount: number;
}

export const AutoPaletteAnalyzer: React.FC<AutoPaletteAnalyzerProps> = ({
  analysis,
  isAnalyzing,
  onApplyAutoColorsAsPins,
  onAddSingleColorAsPin,
  onReanalyze,
  targetCount
}) => {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const copyToClipboard = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  if (isAnalyzing) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center min-h-[260px] space-y-3">
        <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-300">Analyzing Photo Pixel Clusters & Tonal Range...</p>
        <p className="text-[11px] text-slate-500">Extracting dominant colors, highlights, midtones, and shadows</p>
      </div>
    );
  }

  if (!analysis || analysis.dominantColors.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-center">
        <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-2 opacity-60" />
        <h3 className="text-sm font-bold text-slate-200">No Auto Analysis Available</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Load an image or click "Extract Main Colors" to automatically evaluate dominant color proportions and photo tones.
        </p>
      </div>
    );
  }

  const { dominantColors, tones, temperature, contrastLevel, saturationLevel, recommendedScheme } = analysis;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
      
      {/* Header and Cluster Count Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Auto Color Picker & Tonal Analysis
            </h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {dominantColors.length} Palette Nodes
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Balanced photographic extraction of dominant environment tones and visually prominent subject accents.
          </p>
        </div>

        {/* Count Selector & Apply Button */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
            {[5, 6, 8, 10].map(cnt => (
              <button
                key={cnt}
                onClick={() => onReanalyze(cnt)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${
                  targetCount === cnt 
                    ? 'bg-indigo-600 text-white shadow' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cnt}
              </button>
            ))}
          </div>

          <button
            onClick={() => onApplyAutoColorsAsPins(dominantColors)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            title="Convert dominant and visually significant colors into active pins on photo and color wheel"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Apply as Pins</span>
          </button>
        </div>
      </div>

      {/* 1. DOMINANT COLORS PROPORTION BAR */}
      <div>
        <div className="flex justify-between items-center text-xs mb-2">
          <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Dominant & Visually Significant Distribution</span>
          </span>
          <span className="text-[11px] text-slate-400 font-mono">Normalized Coverage</span>
        </div>

        {/* Visual Stacked Bar */}
        <div className="h-6 w-full rounded-xl overflow-hidden flex border border-slate-700/80 shadow-inner bg-slate-950">
          {dominantColors.map((color) => (
            <div
              key={color.id}
              style={{
                width: `${color.percentage}%`,
                backgroundColor: color.hex
              }}
              title={`${color.label} (${color.hex}): ${color.percentage}% - ${color.significanceType || 'Tone'}`}
              className="h-full relative group/bar transition-all hover:brightness-110 cursor-pointer"
              onClick={() => onAddSingleColorAsPin(color)}
            >
              {color.percentage >= 14 && (
                <span className={`text-[10px] font-bold absolute inset-0 flex items-center justify-center font-mono ${
                  color.hsl.l > 60 ? 'text-black/80' : 'text-white/90'
                }`}>
                  {color.percentage}%
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Swatch chips underneath */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mt-3">
          {dominantColors.map((color) => (
            <div
              key={color.id}
              className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between hover:border-slate-700 transition-all group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-1.5">
                  <div
                    style={{ backgroundColor: color.hex }}
                    className="w-5 h-5 rounded-md border border-white/20 shrink-0 shadow-sm"
                  />
                  <span className="text-xs font-mono font-bold text-slate-200">
                    {color.percentage}%
                  </span>
                </div>
                {color.significanceType && (
                  <span className={`text-[8.5px] font-semibold px-1 py-0.2 rounded border ${
                    color.significanceType === 'Vibrant Accent'
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      : color.significanceType === 'Dominant Base'
                      ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                      : color.significanceType === 'Key Highlight'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : color.significanceType === 'Deep Shadow'
                      ? 'bg-slate-800 text-slate-300 border-slate-700'
                      : color.significanceType === 'Subject Neutral'
                      ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                      : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                  }`}>
                    {color.significanceType}
                  </span>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-300 truncate" title={color.label}>
                  {color.label}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <button
                    onClick={() => copyToClipboard(color.hex)}
                    className="font-mono text-[10px] text-slate-400 hover:text-indigo-300 uppercase cursor-pointer flex items-center gap-0.5"
                    title="Click to copy HEX"
                  >
                    {color.hex}
                    {copiedHex === color.hex ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  </button>
                  <button
                    onClick={() => onAddSingleColorAsPin(color)}
                    className="text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer"
                    title="Drop pin on photo for this color"
                  >
                    <PlusCircle className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. PHOTO COLOR TONES BREAKDOWN (Highlights, Midtones, Shadows, Accents) */}
      <div className="pt-2 border-t border-slate-800">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Color Tones Breakdown</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Highlight */}
          {tones.highlight && (
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-amber-300 font-semibold mb-1">
                <span className="flex items-center gap-1">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Highlight</span>
                </span>
                <span className="font-mono text-[10px] text-slate-400">L:{tones.highlight.hsl.l}%</span>
              </div>
              <div className="flex items-center space-x-2 my-1">
                <div 
                  style={{ backgroundColor: tones.highlight.hex }} 
                  className="w-7 h-7 rounded-lg border border-white/20 shadow-sm shrink-0" 
                />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-200 block truncate">{tones.highlight.label}</span>
                  <span className="text-[10px] font-mono text-slate-400">{tones.highlight.hex}</span>
                </div>
              </div>
              <button
                onClick={() => onAddSingleColorAsPin(tones.highlight!)}
                className="mt-1 text-[10px] text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer font-medium"
              >
                <PlusCircle className="w-2.5 h-2.5" />
                <span>Pin Highlight Tone</span>
              </button>
            </div>
          )}

          {/* Midtone */}
          {tones.midtone && (
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold mb-1">
                <span className="flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Midtone</span>
                </span>
                <span className="font-mono text-[10px] text-slate-400">L:{tones.midtone.hsl.l}%</span>
              </div>
              <div className="flex items-center space-x-2 my-1">
                <div 
                  style={{ backgroundColor: tones.midtone.hex }} 
                  className="w-7 h-7 rounded-lg border border-white/20 shadow-sm shrink-0" 
                />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-200 block truncate">{tones.midtone.label}</span>
                  <span className="text-[10px] font-mono text-slate-400">{tones.midtone.hex}</span>
                </div>
              </div>
              <button
                onClick={() => onAddSingleColorAsPin(tones.midtone!)}
                className="mt-1 text-[10px] text-indigo-300 hover:text-indigo-200 flex items-center gap-1 cursor-pointer font-medium"
              >
                <PlusCircle className="w-2.5 h-2.5" />
                <span>Pin Midtone Tone</span>
              </button>
            </div>
          )}

          {/* Shadow */}
          {tones.shadow && (
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-blue-300 font-semibold mb-1">
                <span className="flex items-center gap-1">
                  <Moon className="w-3.5 h-3.5 text-blue-400" />
                  <span>Shadow</span>
                </span>
                <span className="font-mono text-[10px] text-slate-400">L:{tones.shadow.hsl.l}%</span>
              </div>
              <div className="flex items-center space-x-2 my-1">
                <div 
                  style={{ backgroundColor: tones.shadow.hex }} 
                  className="w-7 h-7 rounded-lg border border-white/20 shadow-sm shrink-0" 
                />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-200 block truncate">{tones.shadow.label}</span>
                  <span className="text-[10px] font-mono text-slate-400">{tones.shadow.hex}</span>
                </div>
              </div>
              <button
                onClick={() => onAddSingleColorAsPin(tones.shadow!)}
                className="mt-1 text-[10px] text-blue-300 hover:text-blue-200 flex items-center gap-1 cursor-pointer font-medium"
              >
                <PlusCircle className="w-2.5 h-2.5" />
                <span>Pin Shadow Tone</span>
              </button>
            </div>
          )}

          {/* Vibrant Accent */}
          {tones.vibrant && (
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-rose-300 font-semibold mb-1">
                <span className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  <span>Vibrant Pop</span>
                </span>
                <span className="font-mono text-[10px] text-slate-400">S:{tones.vibrant.hsl.s}%</span>
              </div>
              <div className="flex items-center space-x-2 my-1">
                <div 
                  style={{ backgroundColor: tones.vibrant.hex }} 
                  className="w-7 h-7 rounded-lg border border-white/20 shadow-sm shrink-0" 
                />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-200 block truncate">{tones.vibrant.label}</span>
                  <span className="text-[10px] font-mono text-slate-400">{tones.vibrant.hex}</span>
                </div>
              </div>
              <button
                onClick={() => onAddSingleColorAsPin(tones.vibrant!)}
                className="mt-1 text-[10px] text-rose-300 hover:text-rose-200 flex items-center gap-1 cursor-pointer font-medium"
              >
                <PlusCircle className="w-2.5 h-2.5" />
                <span>Pin Accent Tone</span>
              </button>
            </div>
          )}

          {/* Muted Neutral */}
          {tones.muted && (
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold mb-1">
                <span className="flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Neutral Ground</span>
                </span>
                <span className="font-mono text-[10px] text-slate-400">S:{tones.muted.hsl.s}%</span>
              </div>
              <div className="flex items-center space-x-2 my-1">
                <div 
                  style={{ backgroundColor: tones.muted.hex }} 
                  className="w-7 h-7 rounded-lg border border-white/20 shadow-sm shrink-0" 
                />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-200 block truncate">{tones.muted.label}</span>
                  <span className="text-[10px] font-mono text-slate-400">{tones.muted.hex}</span>
                </div>
              </div>
              <button
                onClick={() => onAddSingleColorAsPin(tones.muted!)}
                className="mt-1 text-[10px] text-emerald-300 hover:text-emerald-200 flex items-center gap-1 cursor-pointer font-medium"
              >
                <PlusCircle className="w-2.5 h-2.5" />
                <span>Pin Neutral Tone</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. COLOR SCHEME & TONAL CHARACTERISTICS */}
      <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-medium">Scheme Profile:</span>
          
          {/* Temperature Badge */}
          <span className={`px-2.5 py-1 rounded-full font-semibold border ${
            temperature === 'Warm'
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
              : temperature === 'Cool'
              ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}>
            {temperature} Temperature
          </span>

          {/* Contrast Badge */}
          <span className="px-2.5 py-1 rounded-full font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {contrastLevel}
          </span>

          {/* Saturation Badge */}
          <span className="px-2.5 py-1 rounded-full font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {saturationLevel}
          </span>
        </div>

        <span className="text-[11px] text-indigo-300 italic">
          {recommendedScheme}
        </span>
      </div>

    </div>
  );
};
