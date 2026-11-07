import React, { useRef, useState, useEffect } from 'react';
import { ColorMarker } from '../types';
import { rgbToHex, rgbToHsl } from '../utils/colorUtils';
import { 
  Target, RefreshCw, ZoomIn, ZoomOut, Maximize2, Crosshair, 
  Trash2, Sparkles, Check, Copy 
} from 'lucide-react';

interface PhotoSamplerProps {
  imageSrc: string;
  markers: ColorMarker[];
  onAddMarker: (marker: ColorMarker) => void;
  onRemoveMarker: (id: number) => void;
  onResetMarkers: () => void;
  hoveredMarkerId: number | null;
  onMarkerHover: (id: number | null) => void;
}

export const PhotoSampler: React.FC<PhotoSamplerProps> = ({
  imageSrc,
  markers,
  onAddMarker,
  onRemoveMarker,
  onResetMarkers,
  hoveredMarkerId,
  onMarkerHover
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

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
      {/* Header with Title and Zoom Controls */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center space-x-2">
          <Crosshair className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-200">Interactive Photo Eyedropper</h2>
        </div>

        <div className="flex items-center space-x-2">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs text-slate-400">
            <button
              onClick={() => setZoom(prev => Math.max(1, prev - 0.25))}
              disabled={zoom <= 1}
              className="p-1 hover:text-white disabled:opacity-30 transition-colors"
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
              className="p-1 hover:text-white disabled:opacity-30 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoom > 1 && (
              <button
                onClick={() => setZoom(1)}
                className="px-1.5 py-0.5 text-[10px] text-indigo-400 hover:text-indigo-300 font-medium"
                title="Reset Zoom"
              >
                Reset
              </button>
            )}
          </div>

          <div className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
            Sampled: <span className="text-indigo-400 font-semibold">{markers.length}</span>/12
          </div>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleImageClick}
        className="relative flex-1 min-h-[380px] md:min-h-[480px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 flex items-center justify-center cursor-crosshair group select-none"
      >
        <div 
          className="relative transition-transform duration-100 ease-out flex items-center justify-center max-h-full max-w-full"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Analysis Subject"
            className="max-h-[540px] w-full object-contain pointer-events-auto block"
            crossOrigin="anonymous"
          />

          {/* Positioned Pins on Photo */}
          {markers.map((marker) => (
            <div
              key={marker.id}
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
              onMouseEnter={() => onMarkerHover(marker.id)}
              onMouseLeave={() => onMarkerHover(null)}
              onClick={(e) => {
                e.stopPropagation(); // prevent adding duplicate point
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 group/marker z-20 cursor-pointer transition-transform ${
                hoveredMarkerId === marker.id ? 'scale-125 z-30' : 'scale-100 hover:scale-110'
              }`}
            >
              {/* Outer Pulse Glow */}
              <span className="absolute -inset-1 rounded-full animate-ping opacity-35 bg-white pointer-events-none" />

              {/* Pin Badge Circle */}
              <div
                style={{ backgroundColor: marker.hex }}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shadow-xl font-bold text-xs ${
                  marker.hsl.l > 60 ? 'text-black border-black/50' : 'text-white border-white/70'
                }`}
              >
                {marker.id}
              </div>

              {/* Hover Badge Tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/marker:flex flex-col items-center pointer-events-none z-40">
                <div className="bg-slate-900/95 border border-slate-700 text-slate-100 text-[11px] px-2.5 py-1.5 rounded-lg shadow-2xl whitespace-nowrap flex flex-col items-center gap-0.5 backdrop-blur">
                  <span className="font-semibold text-indigo-300">{marker.label}</span>
                  <span className="text-slate-400 uppercase font-mono text-[10px]">{marker.hex}</span>
                  <span className="text-slate-500 text-[9px]">H:{marker.hsl.h}° S:{marker.hsl.s}% L:{marker.hsl.l}%</span>
                </div>
                <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700" />
              </div>
            </div>
          ))}
        </div>

        {/* Real-time Magnifying Loupe / Eyedropper Preview */}
        {loupe.visible && (
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
