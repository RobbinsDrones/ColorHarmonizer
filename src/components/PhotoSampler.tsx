import React, { useRef, useState, useEffect } from 'react';
import { ColorMarker, PhotographicMatte } from '../types';
import { rgbToHex, rgbToHsl } from '../utils/colorUtils';
import { 
  Target, RefreshCw, ZoomIn, ZoomOut, Maximize2, Crosshair, 
  Trash2, Sparkles, Check, Copy, Eye, Square
} from 'lucide-react';

interface PhotoSamplerProps {
  imageSrc: string;
  markers: ColorMarker[];
  onAddMarker: (marker: ColorMarker) => void;
  onRemoveMarker: (id: number) => void;
  onResetMarkers: () => void;
  hoveredMarkerId: number | null;
  selectedMarkerId?: number | null;
  onMarkerHover: (id: number | null) => void;
  onSelectMarker?: (id: number | null) => void;
  samplingMode: 'manual' | 'auto';
  onSetSamplingMode: (mode: 'manual' | 'auto') => void;
  onTriggerAutoExtract: () => void;
  isAnalyzingAuto: boolean;
  initialMatte?: PhotographicMatte;
}

export const PhotoSampler: React.FC<PhotoSamplerProps> = ({
  imageSrc,
  markers,
  onAddMarker,
  onRemoveMarker,
  onResetMarkers,
  hoveredMarkerId,
  selectedMarkerId,
  onMarkerHover,
  onSelectMarker,
  samplingMode,
  onSetSamplingMode,
  onTriggerAutoExtract,
  isAnalyzingAuto,
  initialMatte = 'neutralDark'
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Photographic Canvas Matte & Calibration State
  const [canvasMatte, setCanvasMatte] = useState<PhotographicMatte>(initialMatte);
  const [showNeutralFrame, setShowNeutralFrame] = useState<boolean>(true);

  // Sync canvas matte when initialMatte prop changes (e.g., from top surround theme switcher)
  useEffect(() => {
    if (initialMatte) {
      setCanvasMatte(initialMatte);
    }
  }, [initialMatte]);

  // Loupe & Zoom state
  const [zoom, setZoom] = useState(1);
  const [loupe, setLoupe] = useState<{
    visible: boolean;
    x: number;
    y: number;
    hex: string;
    r: number;
    g: number;
    b: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    hex: '#000000',
    r: 0,
    g: 0,
    b: 0
  });

  // Reset zoom on image change
  useEffect(() => {
    setZoom(1);
  }, [imageSrc]);

  // Handle Photo Mouse Move (Update Loupe Eyedropper)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // If hovering over or selecting an existing marker pin, suppress the eyedropper loupe
    if (hoveredMarkerId !== null || selectedMarkerId !== null) {
      setLoupe(prev => ({ ...prev, visible: false }));
      return;
    }

    const img = imageRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    if (
      e.clientX < rect.left || 
      e.clientX > rect.right || 
      e.clientY < rect.top || 
      e.clientY > rect.bottom
    ) {
      setLoupe(prev => ({ ...prev, visible: false }));
      return;
    }

    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    // Check if close to any existing marker to avoid accidental overlap
    const nearMarker = markers.some(m => {
      const dx = Math.abs(m.x - xPct);
      const dy = Math.abs(m.y - yPct);
      return dx < 3.5 && dy < 3.5;
    });

    if (nearMarker) {
      setLoupe(prev => ({ ...prev, visible: false }));
      return;
    }

    // Read pixel from hidden offscreen canvas
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const px = Math.floor((xPct / 100) * canvas.width);
        const py = Math.floor((yPct / 100) * canvas.height);
        const pixelData = ctx.getImageData(px, py, 1, 1).data;
        const r = pixelData[0], g = pixelData[1], b = pixelData[2];
        const hex = rgbToHex(r, g, b);

        setLoupe({
          visible: true,
          x: e.clientX - containerRef.current!.getBoundingClientRect().left,
          y: e.clientY - containerRef.current!.getBoundingClientRect().top,
          hex,
          r,
          g,
          b
        });
      }
    } catch {
      // Cross-origin restriction fallback
      setLoupe(prev => ({ ...prev, visible: false }));
    }
  };

  const handleMouseLeave = () => {
    setLoupe(prev => ({ ...prev, visible: false }));
  };

  // Click Handler: Sample Color Pin
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const img = imageRef.current;
    if (!img) return;

    if (markers.length >= 12) {
      alert("Maximum of 12 color sample points reached. Remove an existing point to sample new colors.");
      return;
    }

    const rect = img.getBoundingClientRect();
    if (
      e.clientX < rect.left || 
      e.clientX > rect.right || 
      e.clientY < rect.top || 
      e.clientY > rect.bottom
    ) {
      return;
    }

    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const px = Math.floor((xPct / 100) * canvas.width);
      const py = Math.floor((yPct / 100) * canvas.height);
      const pixelData = ctx.getImageData(px, py, 1, 1).data;
      const r = pixelData[0], g = pixelData[1], b = pixelData[2];

      const newId = markers.length > 0 ? Math.max(...markers.map(m => m.id)) + 1 : 1;
      const marker: ColorMarker = {
        id: newId,
        x: Number(xPct.toFixed(2)),
        y: Number(yPct.toFixed(2)),
        r,
        g,
        b,
        hex: rgbToHex(r, g, b),
        hsl: rgbToHsl(r, g, b),
        label: `Sample ${newId}`
      };

      onAddMarker(marker);
    } catch (err) {
      console.error("Failed to read image pixel", err);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col flex-1">
      {/* Header with Title, Mode Switcher, and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center space-x-2">
          {/* Sampling Mode Switcher Tabs */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => onSetSamplingMode('manual')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                samplingMode === 'manual'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Manual Eyedropper</span>
            </button>

            <button
              onClick={() => onSetSamplingMode('auto')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                samplingMode === 'auto'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto Color Picker</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Photographic 50% / 18% Gray Surround Matte Switcher */}
          <div className="flex items-center bg-slate-950/90 border border-slate-800 rounded-lg p-0.5 text-xs">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold pl-1.5 pr-1 flex items-center gap-1">
              <Eye className="w-3 h-3 text-amber-400" />
              <span>Matte:</span>
            </span>
            <button
              onClick={() => setCanvasMatte('gray50')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                canvasMatte === 'gray50'
                  ? 'bg-[#808080] text-black shadow font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="50% Neutral Gray (18% Reflectance Card Standard - Optical Neutral Anchor)"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#808080] border border-slate-600 inline-block" />
              <span>50% Gray</span>
            </button>
            <button
              onClick={() => setCanvasMatte('neutralDark')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                canvasMatte === 'neutralDark'
                  ? 'bg-neutral-700 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Lightroom Dark Neutral (#262626)"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#262626] border border-slate-600 inline-block" />
              <span>Dark</span>
            </button>
            <button
              onClick={() => setCanvasMatte('charcoal')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                canvasMatte === 'charcoal'
                  ? 'bg-neutral-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Neutral Charcoal (#181818)"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#181818] border border-slate-600 inline-block" />
              <span>Charcoal</span>
            </button>
            <button
              onClick={() => setCanvasMatte('black')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                canvasMatte === 'black'
                  ? 'bg-black text-white shadow ring-1 ring-neutral-700'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Deep Black (#0a0a0a)"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#0a0a0a] border border-slate-600 inline-block" />
              <span>Black</span>
            </button>
          </div>

          {/* Toggle 18% Neutral Frame Around Photo */}
          <button
            onClick={() => setShowNeutralFrame(prev => !prev)}
            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all cursor-pointer ${
              showNeutralFrame
                ? 'bg-[#808080]/20 text-[#d4d4d8] border-[#808080]/60 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle 18% Neutral Gray Frame directly surrounding photograph for white-balance reference"
          >
            <Square className="w-3 h-3 text-[#808080]" />
            <span className="text-[11px]">18% Frame</span>
          </button>

          {/* Quick Auto Extract Palette Trigger */}
          <button
            onClick={onTriggerAutoExtract}
            disabled={isAnalyzingAuto}
            className="bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Scan photo pixels and auto-extract dominant palette"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAnalyzingAuto ? 'animate-spin' : ''}`} />
            <span>{isAnalyzingAuto ? 'Analyzing...' : 'Auto Extract'}</span>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs text-slate-400">
            <button
              onClick={() => setZoom(prev => Math.max(1, prev - 0.25))}
              disabled={zoom <= 1}
              className="p-1 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(prev => Math.min(2.5, prev + 0.25))}
              disabled={zoom >= 2.5}
              className="p-1 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoom > 1 && (
              <button
                onClick={() => setZoom(1)}
                className="px-1.5 py-0.5 text-[10px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                title="Reset Zoom"
              >
                Reset
              </button>
            )}
          </div>

          <div className="text-xs text-slate-400 bg-slate-800/90 px-2.5 py-1 rounded-full border border-slate-700">
            Pins: <span className="text-indigo-400 font-semibold">{markers.length}</span>/12
          </div>
        </div>
      </div>

      {/* Main Viewport Container with Photographic Matte Surround */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleImageClick}
        style={{
          backgroundColor: 
            canvasMatte === 'gray50' ? '#7f7f7f' :
            canvasMatte === 'neutralDark' ? '#262626' :
            canvasMatte === 'charcoal' ? '#181818' : '#0a0a0a'
        }}
        className="relative flex-1 min-h-[380px] md:min-h-[480px] rounded-xl overflow-hidden border border-neutral-700/80 shadow-inner flex items-center justify-center cursor-crosshair group select-none transition-colors duration-200"
      >
        {/* Subtle 50% Gray Calibration Indicator watermark */}
        {canvasMatte === 'gray50' && (
          <div className="absolute top-2.5 left-3 text-[10px] font-mono tracking-widest uppercase text-neutral-900/60 pointer-events-none font-bold">
            Studio 50% Neutral Gray Matte (18% Reflectance D65)
          </div>
        )}

        <div 
          className="relative transition-transform duration-100 ease-out flex items-center justify-center max-h-full max-w-full"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        >
          {/* Calibrated 18% Neutral Gray Frame Container */}
          <div
            className={`transition-all duration-200 ${
              showNeutralFrame 
                ? 'p-2.5 md:p-3.5 bg-[#808080] shadow-2xl rounded-sm ring-1 ring-black/40 ring-offset-1 ring-offset-black/20' 
                : ''
            }`}
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Analysis Subject"
              className="max-h-[520px] w-full object-contain pointer-events-auto block shadow-md"
              crossOrigin="anonymous"
            />
          </div>

          {/* Positioned Pins on Photo */}
          {markers.map((marker) => {
            const isHovered = hoveredMarkerId === marker.id;
            const isSelected = selectedMarkerId === marker.id;

            return (
              <div
                key={marker.id}
                style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                onMouseEnter={() => {
                  onMarkerHover(marker.id);
                  setLoupe(prev => ({ ...prev, visible: false }));
                }}
                onMouseLeave={() => {
                  onMarkerHover(null);
                }}
                onClick={(e) => {
                  e.stopPropagation(); // prevent adding duplicate point
                  onSelectMarker?.(isSelected ? null : marker.id);
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 group/marker z-20 cursor-pointer transition-transform ${
                  isSelected 
                    ? 'scale-125 z-40' 
                    : isHovered 
                    ? 'scale-120 z-30' 
                    : 'scale-100 hover:scale-110'
                }`}
              >
                {/* Outer Pulse Glow Beacon for selected pin */}
                {isSelected ? (
                  <>
                    <span className="absolute -inset-2.5 rounded-full animate-ping opacity-60 bg-cyan-400 pointer-events-none" />
                    <span className="absolute -inset-1 rounded-full ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-950 pointer-events-none" />
                  </>
                ) : (
                  <span className="absolute -inset-1 rounded-full animate-ping opacity-25 bg-white pointer-events-none" />
                )}

                {/* Pin Badge Circle */}
                <div
                  style={{ backgroundColor: marker.hex }}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shadow-2xl font-bold text-xs transition-all ${
                    isSelected
                      ? 'border-cyan-300 ring-2 ring-cyan-400 shadow-cyan-500/50'
                      : marker.hsl.l > 60 
                      ? 'text-black border-black/50' 
                      : 'text-white border-white/70'
                  }`}
                >
                  <span className={isSelected ? (marker.hsl.l > 60 ? 'text-black font-extrabold' : 'text-white font-extrabold') : (marker.hsl.l > 60 ? 'text-black' : 'text-white')}>
                    {marker.id}
                  </span>
                </div>

                {/* Unified Hover / Selection Tooltip (Shown on hover or when spotlighted from color wheel) */}
                {(isHovered || isSelected) && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 flex flex-col items-center pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="bg-slate-900/98 border border-slate-700 text-slate-100 px-3 py-2 rounded-xl shadow-2xl whitespace-nowrap flex items-center gap-2.5 backdrop-blur-md">
                      <div
                        style={{ backgroundColor: marker.hex }}
                        className="w-5 h-5 rounded-md border border-white/30 shrink-0 shadow-inner"
                      />
                      <div className="flex flex-col text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[11px] text-cyan-300">#{marker.id}</span>
                          <span className="font-semibold text-slate-200 text-[11px]">{marker.label}</span>
                          {isSelected && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              Spotlight
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400 mt-0.5">
                          <span className="uppercase font-bold text-slate-200">{marker.hex}</span>
                          <span>•</span>
                          <span>R:{marker.r} G:{marker.g} B:{marker.b}</span>
                          <span>•</span>
                          <span>H:{marker.hsl.h}° S:{marker.hsl.s}% L:{marker.hsl.l}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-2.5 h-2.5 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Real-time Magnifying Loupe / Eyedropper Preview (Only when NOT hovering over an existing pin) */}
        {loupe.visible && hoveredMarkerId === null && selectedMarkerId === null && (
          <div
            className="absolute pointer-events-none z-50 -translate-x-1/2 -translate-y-[120%] flex flex-col items-center transition-all duration-75"
            style={{ left: `${loupe.x}px`, top: `${loupe.y}px` }}
          >
            <div className="bg-slate-900/95 border-2 border-white/60 rounded-xl p-1.5 shadow-2xl flex items-center space-x-2 backdrop-blur">
              <div
                className="w-7 h-7 rounded-lg border border-white/30 shadow-inner shrink-0"
                style={{ backgroundColor: loupe.hex }}
              />
              <div className="pr-1 text-left">
                <div className="font-mono text-[11px] font-bold uppercase text-slate-100">{loupe.hex}</div>
                <div className="font-mono text-[9px] text-slate-400">
                  R:{loupe.r} G:{loupe.g} B:{loupe.b}
                </div>
              </div>
            </div>
            <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700" />
          </div>
        )}

        {/* Empty state guidance */}
        {markers.length === 0 && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3 border border-indigo-500/30 animate-pulse">
              <Target className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-slate-200">Click anywhere on the photo to sample colors</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Pick points across highlights, midtones, and shadows to analyze the photo's harmony distribution.
            </p>
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800 text-xs">
        <span className="text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Click photo to sample • Hover for live eyedropper
        </span>
        <button
          onClick={onResetMarkers}
          disabled={markers.length === 0}
          className="flex items-center space-x-1.5 text-slate-400 hover:text-rose-400 disabled:opacity-40 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset All Pins</span>
        </button>
      </div>
    </div>
  );
};
