import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, Image as ImageIcon, Sparkles, RefreshCw, Trash2, 
  Eye, EyeOff, Layers, Sliders, Palette, Check, Copy, 
  HelpCircle, Info, Move, ArrowRight, Zap, Target, Download
} from 'lucide-react';

// Preset sample photos for immediate testing
const SAMPLE_PHOTOS = [
  {
    name: 'Sunset Dunes',
    url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80',
    description: 'Rich warm oranges, deep gold, and cool teal sky accents.'
  },
  {
    name: 'Neon Cyberpunk',
    url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80',
    description: 'Vibrant magenta, electric cyan, and deep urban shadows.'
  },
  {
    name: 'Forest Mist',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80',
    description: 'Moody greens, earthy moss, and subtle golden highlights.'
  }
];

// Helper Color Conversions
const rgbToHex = (r, g, b) => {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // monochromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

// Calculate shortest angular difference (-180 to 180)
const angleDiff = (a, b) => {
  let diff = (b - a + 180) % 360 - 180;
  return diff < -180 ? diff + 360 : diff;
};

export default function App() {
  // Main State
  const [imageSrc, setImageSrc] = useState(SAMPLE_PHOTOS[0].url);
  const [markers, setMarkers] = useState([]);
  const [pureHueMode, setPureHueMode] = useState(false);
  const [targetHarmony, setTargetHarmony] = useState('auto'); // auto, complementary, analogous, triadic, split-complementary, tetradic, monochromatic
  const [hoveredMarkerId, setHoveredMarkerId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [activeTab, setActiveTab] = useState('analysis'); // 'analysis', 'lightroom', 'palette'

  // Refs
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const colorWheelCanvasRef = useRef(null);

  // Initialize Default Color Markers for Preset Photo
  useEffect(() => {
    // Load default image & auto-pick sample points
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Default sample coordinates (% of container)
      const defaultPoints = [
        { x: 30, y: 35, label: 'Sky Highlight' },
        { x: 75, y: 45, label: 'Midtone Warmth' },
        { x: 50, y: 75, label: 'Foreground Shadow' },
        { x: 20, y: 65, label: 'Secondary Tone' },
        { x: 80, y: 25, label: 'Accent Light' }
      ];

      const initialMarkers = defaultPoints.map((pt, idx) => {
        const px = Math.floor((pt.x / 100) * img.width);
        const py = Math.floor((pt.y / 100) * img.height);
        const pixelData = ctx.getImageData(px, py, 1, 1).data;
        const r = pixelData[0], g = pixelData[1], b = pixelData[2];
        return {
          id: idx + 1,
          x: pt.x,
          y: pt.y,
          r, g, b,
          hex: rgbToHex(r, g, b),
          hsl: rgbToHsl(r, g, b),
          label: pt.label
        };
      });

      setMarkers(initialMarkers);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Handle Image Upload
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target.result);
        setMarkers([]); // clear previous markers
      };
      reader.readAsDataURL(file);
    }
  };

  // Image Click Handler (Sampling Colors)
  const handleImageClick = (e) => {
    if (!imageRef.current) return;

    if (markers.length >= 10) {
      alert("Maximum of 10 color sample points reached. Remove one to pick new colors.");
      return;
    }

    const rect = imageRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    // Create hidden canvas to get pixel RGB
    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const pixelX = Math.floor((xPct / 100) * img.naturalWidth);
    const pixelY = Math.floor((yPct / 100) * img.naturalHeight);

    const pixelData = ctx.getImageData(pixelX, pixelY, 1, 1).data;
    const r = pixelData[0], g = pixelData[1], b = pixelData[2];

    const newMarker = {
      id: Date.now(),
      x: Number(xPct.toFixed(2)),
      y: Number(yPct.toFixed(2)),
      r, g, b,
      hex: rgbToHex(r, g, b),
      hsl: rgbToHsl(r, g, b),
      label: `Sample ${markers.length + 1}`
    };

    setMarkers(prev => [...prev, newMarker]);
  };

  // Remove marker
  const removeMarker = (id) => {
    setMarkers(prev => prev.filter(m => m.id !== id));
  };

  // Update label
  const updateLabel = (id, label) => {
    setMarkers(prev => prev.map(m => m.id === id ? { ...m, label } : m));
  };

  // Detect Auto Harmony based on Hue Spread
  const detectedHarmony = useMemo(() => {
    if (markers.length < 2) return { type: 'Monochromatic', score: 100, primaryHue: markers[0]?.hsl.h || 0 };

    const hues = markers.map(m => m.hsl.h).sort((a, b) => a - b);
    
    // Compute max hue spread
    let maxGap = 0;
    for (let i = 0; i < hues.length; i++) {
      const next = hues[(i + 1) % hues.length];
      const gap = (next - hues[i] + 360) % 360;
      if (gap > maxGap) maxGap = gap;
    }
    const totalSpread = 360 - maxGap;

    // Determine primary dominant hue (mean angle)
    const primaryHue = hues[0];

    if (totalSpread <= 30) return { type: 'Monochromatic', spread: totalSpread, primaryHue };
    if (totalSpread <= 70) return { type: 'Analogous', spread: totalSpread, primaryHue };
    
    // Check for Complementary pair
    const hasOpposite = hues.some(h1 => hues.some(h2 => Math.abs(angleDiff(h1, h2)) >= 140 && Math.abs(angleDiff(h1, h2)) <= 220));
    if (hasOpposite && totalSpread > 150 && totalSpread < 210) return { type: 'Complementary', spread: totalSpread, primaryHue };
    
    if (totalSpread > 200 && totalSpread < 260) return { type: 'Triadic', spread: totalSpread, primaryHue };
    if (hasOpposite && totalSpread >= 210) return { type: 'Split-Complementary', spread: totalSpread, primaryHue };
    
    return { type: 'Tetradic / Complex', spread: totalSpread, primaryHue };
  }, [markers]);

  const activeHarmonyRule = targetHarmony === 'auto' ? detectedHarmony.type : targetHarmony;

  // Render Interactive Color Wheel Canvas
  useEffect(() => {
    const canvas = colorWheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 25;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw HSL Spectrum Background Circle
    for (let angle = 0; angle < 360; angle += 0.5) {
      const startAngle = (angle - 0.6) * (Math.PI / 180);
      const endAngle = (angle + 0.6) * (Math.PI / 180);

      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.7, `hsl(${angle}, 80%, 50%)`);
      gradient.addColorStop(1, `hsl(${angle}, 100%, 35%)`);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // 2. Draw Wheel Grid Lines & Rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;

    // Concentric Saturation Rings
    [0.33, 0.66, 1].forEach(rRatio => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * rRatio, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Radial Hue Lines (every 30 deg)
    for (let a = 0; a < 360; a += 30) {
      const rad = a * (Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + radius * Math.cos(rad), centerY + radius * Math.sin(rad));
      ctx.stroke();
    }

    // 3. Draw Target Harmony Guide Overlays
    if (markers.length > 0) {
      const baseHue = detectedHarmony.primaryHue;
      ctx.save();
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);

      const drawGuideLine = (hueAngle, color = 'rgba(255, 255, 255, 0.6)') => {
        const rad = (hueAngle % 360) * (Math.PI / 180);
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + radius * Math.cos(rad), centerY + radius * Math.sin(rad));
        ctx.stroke();
      };

      const rule = activeHarmonyRule.toLowerCase();

      if (rule.includes('complementary') && !rule.includes('split')) {
        drawGuideLine(baseHue, '#3b82f6');
        drawGuideLine(baseHue + 180, '#ef4444');
      } else if (rule.includes('split-complementary')) {
        drawGuideLine(baseHue, '#3b82f6');
        drawGuideLine(baseHue + 150, '#10b981');
        drawGuideLine(baseHue + 210, '#f59e0b');
      } else if (rule.includes('triadic')) {
        drawGuideLine(baseHue, '#ec4899');
        drawGuideLine(baseHue + 120, '#8b5cf6');
        drawGuideLine(baseHue + 240, '#06b6d4');
      } else if (rule.includes('analogous')) {
        drawGuideLine(baseHue - 30, 'rgba(255,255,255,0.4)');
        drawGuideLine(baseHue, '#3b82f6');
        drawGuideLine(baseHue + 30, 'rgba(255,255,255,0.4)');
      } else if (rule.includes('tetradic')) {
        drawGuideLine(baseHue, '#a855f7');
        drawGuideLine(baseHue + 90, '#ec4899');
        drawGuideLine(baseHue + 180, '#3b82f6');
        drawGuideLine(baseHue + 270, '#10b981');
      }
      ctx.restore();
    }

    // 4. Plot Sampled Color Markers on Wheel
    markers.forEach((marker) => {
      const angleRad = (marker.hsl.h) * (Math.PI / 180);
      const distance = pureHueMode ? radius : (marker.hsl.s / 100) * radius;

      const px = centerX + distance * Math.cos(angleRad);
      const py = centerY + distance * Math.sin(angleRad);

      const isHovered = hoveredMarkerId === marker.id;

      // Outer Glow & Border
      ctx.beginPath();
      ctx.arc(px, py, isHovered ? 12 : 9, 0, Math.PI * 2);
      ctx.fillStyle = marker.hex;
      ctx.fill();
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.strokeStyle = isHovered ? '#ffffff' : '#000000';
      ctx.stroke();

      // Number Label inside marker
      ctx.fillStyle = marker.hsl.l > 60 ? '#000000' : '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(marker.id, px, py);
    });

  }, [markers, pureHueMode, targetHarmony, hoveredMarkerId, detectedHarmony]);

  // Copy Color Value
  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Generate Smart Nudge & Alignment Suggestions
  const getSuggestions = (marker) => {
    const baseHue = detectedHarmony.primaryHue;
    const currentHue = marker.hsl.h;
    const rule = activeHarmonyRule.toLowerCase();

    let targetHues = [baseHue];
    if (rule.includes('complementary') && !rule.includes('split')) {
      targetHues = [baseHue, (baseHue + 180) % 360];
    } else if (rule.includes('split-complementary')) {
      targetHues = [baseHue, (baseHue + 150) % 360, (baseHue + 210) % 360];
    } else if (rule.includes('triadic')) {
      targetHues = [baseHue, (baseHue + 120) % 360, (baseHue + 240) % 360];
    } else if (rule.includes('analogous')) {
      targetHues = [(baseHue - 30 + 360) % 360, baseHue, (baseHue + 30) % 360];
    }

    // Find nearest target hue
    let closestTarget = targetHues[0];
    let minDiff = Math.abs(angleDiff(currentHue, targetHues[0]));

    targetHues.forEach(th => {
      const diff = Math.abs(angleDiff(currentHue, th));
      if (diff < minDiff) {
        minDiff = diff;
        closestTarget = th;
      }
    });

    const shiftNeeded = angleDiff(currentHue, closestTarget);
    return {
      shift: shiftNeeded,
      targetHue: closestTarget,
      isAligned: Math.abs(shiftNeeded) <= 5
    };
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40 px-6 py-4 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl shadow-lg shadow-indigo-500/20">
            <Palette className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Photo Color Analysis & Harmony Lab
            </h1>
            <p className="text-xs text-slate-400">Extract photo palettes, visualize color wheels, & optimize photo harmonies</p>
          </div>
        </div>

        {/* Action Controls Header */}
        <div className="flex items-center space-x-3">
          {/* Preset Selector */}
          <div className="hidden md:flex items-center bg-slate-800/80 rounded-lg p-1 border border-slate-700">
            <span className="text-xs text-slate-400 px-2.5 font-medium">Presets:</span>
            {SAMPLE_PHOTOS.map((sample) => (
              <button
                key={sample.name}
                onClick={() => setImageSrc(sample.url)}
                className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                  imageSrc === sample.url
                    ? 'bg-indigo-600 text-white font-medium shadow'
                    : 'text-slate-300 hover:bg-slate-700/60'
                }`}
              >
                {sample.name}
              </button>
            ))}
          </div>

          {/* Upload Button */}
          <label className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer transition-all shadow-lg shadow-indigo-600/30">
            <Upload className="w-4 h-4" />
            <span>Upload Photo</span>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload} 
            />
          </label>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Image Canvas Picker (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col flex-1">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-slate-200">Interactive Photo Sampler</h2>
              </div>
              <div className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
                Pick Points: <span className="text-indigo-400 font-semibold">{markers.length}</span>/10
              </div>
            </div>

            {/* Photo Viewport Container */}
            <div 
              ref={containerRef}
              className="relative flex-1 min-h-[380px] md:min-h-[480px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 flex items-center justify-center cursor-crosshair group select-none"
              onClick={handleImageClick}
            >
              <img 
                ref={imageRef}
                src={imageSrc} 
                alt="Analysis Subject" 
                className="max-h-[550px] w-full object-contain pointer-events-auto"
                crossOrigin="anonymous"
              />

              {/* Positioned Markers on Photo */}
              {markers.map((marker) => (
                <div
                  key={marker.id}
                  style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                  onMouseEnter={() => setHoveredMarkerId(marker.id)}
                  onMouseLeave={() => setHoveredMarkerId(null)}
                  onClick={(e) => {
                    e.stopPropagation(); // prevent adding duplicate point
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 group/marker z-10 cursor-pointer transition-transform ${
                    hoveredMarkerId === marker.id ? 'scale-125 z-30' : 'scale-100 hover:scale-110'
                  }`}
                >
                  {/* Ping Ring */}
                  <span className="absolute -inset-1 rounded-full animate-ping opacity-30 bg-white"></span>
                  
                  {/* Main Pin Badge */}
                  <div 
                    style={{ backgroundColor: marker.hex }}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shadow-lg font-bold text-xs ${
                      marker.hsl.l > 60 ? 'text-black border-black/40' : 'text-white border-white/60'
                    }`}
                  >
                    {marker.id}
                  </div>

                  {/* Hover Tooltip */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/marker:flex flex-col items-center pointer-events-none z-40">
                    <div className="bg-slate-900/95 border border-slate-700 text-slate-100 text-[11px] px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex flex-col items-center gap-0.5 backdrop-blur">
                      <span className="font-semibold text-indigo-300">{marker.label}</span>
                      <span className="text-slate-400 uppercase font-mono text-[10px]">{marker.hex}</span>
                    </div>
                    <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700"></div>
                  </div>
                </div>
              ))}

              {/* Instructions Overlay if No Markers */}
              {markers.length === 0 && (
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3 border border-indigo-500/30 animate-pulse">
                    <Target className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-200">Click anywhere on the photo to sample colors</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">Pick up to 10 points across highlights, midtones, and shadows to evaluate harmony</p>
                </div>
              )}
            </div>

            {/* Bottom Controls */}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800 text-xs">
              <span className="text-slate-400">Click photo to drop color pins</span>
              <button
                onClick={() => setMarkers([])}
                disabled={markers.length === 0}
                className="flex items-center space-x-1.5 text-slate-400 hover:text-rose-400 disabled:opacity-40 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset All Points</span>
              </button>
            </div>
          </div>

          {/* Color Palette Cards List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Sampled Color Palette ({markers.length})</span>
              {markers.length > 0 && (
                <button
                  onClick={() => {
                    const hexList = markers.map(m => `${m.label}: ${m.hex}`).join('\n');
                    copyToClipboard(hexList, 'all-palette');
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-normal flex items-center gap-1 normal-case text-xs"
                >
                  <Copy className="w-3.0 h-3.0" />
                  <span>{copiedId === 'all-palette' ? 'Copied!' : 'Copy Palette'}</span>
                </button>
              )}
            </h3>

            {markers.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2 text-center">No color points sampled yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                {markers.map((marker) => (
                  <div
                    key={marker.id}
                    onMouseEnter={() => setHoveredMarkerId(marker.id)}
                    onMouseLeave={() => setHoveredMarkerId(null)}
                    className={`flex items-center space-x-3 p-2.5 rounded-xl border transition-all ${
                      hoveredMarkerId === marker.id 
                        ? 'bg-slate-800 border-indigo-500/80 shadow-md' 
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Color Circle Swatch */}
                    <div 
                      style={{ backgroundColor: marker.hex }}
                      className="w-9 h-9 rounded-lg border border-white/20 shadow-inner flex items-center justify-center shrink-0 font-bold text-xs"
                    >
                      <span className={marker.hsl.l > 60 ? 'text-black/70' : 'text-white/80'}>
                        {marker.id}
                      </span>
                    </div>

                    {/* Meta Data */}
                    <div className="flex-1 min-w-0">
                      <input 
                        type="text"
                        value={marker.label}
                        onChange={(e) => updateLabel(marker.id, e.target.value)}
                        className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none focus:border-b border-indigo-400 w-full truncate"
                      />
                      <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400 mt-0.5">
                        <button
                          onClick={() => copyToClipboard(marker.hex, marker.id)}
                          className="hover:text-indigo-300 flex items-center gap-1 uppercase"
                          title="Click to copy Hex"
                        >
                          {marker.hex}
                          {copiedId === marker.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        </button>
                        <span>•</span>
                        <span>H:{marker.hsl.h}° S:{marker.hsl.s}%</span>
                      </div>
                    </div>

                    {/* Delete Icon */}
                    <button
                      onClick={() => removeMarker(marker.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      title="Remove sample"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Color Wheel Visualizer & Analytics (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          
          {/* Navigation Tabs for Right Panel */}
          <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-xl flex space-x-1">
            <button
              onClick={() => setActiveTab('analysis')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
                activeTab === 'analysis' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Color Wheel & Harmony</span>
            </button>
            <button
              onClick={() => setActiveTab('lightroom')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
                activeTab === 'lightroom' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Editing Tips</span>
            </button>
          </div>

          {activeTab === 'analysis' ? (
            <>
              {/* Color Wheel Visualizer Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span>2D Color Wheel Distribution</span>
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

                {/* Canvas Render */}
                <div className="relative my-2">
                  <canvas 
                    ref={colorWheelCanvasRef} 
                    width={280} 
                    height={280} 
                    className="rounded-full shadow-2xl border border-slate-800"
                  />
                  <div className="absolute inset-0 pointer-events-none rounded-full ring-1 ring-inset ring-white/10"></div>
                </div>

                <p className="text-[11px] text-slate-400 text-center mt-3 max-w-xs">
                  {pureHueMode 
                    ? 'Pure Hue Mode forces all markers to perimeter (100% saturation) for pure angle analysis.' 
                    : 'Dots plot actual Hue (angle) & Saturation (distance from center).'}
                </p>
              </div>

              {/* Harmony Detection & Nudge Guide */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
                
                {/* Header & Target Selector */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Detected Natural Harmony</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {detectedHarmony.type}
                    </span>
                  </div>

                  {/* Harmony Rule Target Overlay Selector */}
                  <div className="mt-3">
                    <label className="text-xs text-slate-300 font-medium block mb-1.5">Target Overlay Rule:</label>
                    <select
                      value={targetHarmony}
                      onChange={(e) => setTargetHarmony(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="auto">Auto (Match Detected: {detectedHarmony.type})</option>
                      <option value="Complementary">Complementary (180° Opposite)</option>
                      <option value="Split-Complementary">Split-Complementary (150° / 210°)</option>
                      <option value="Analogous">Analogous (30° Adjacent)</option>
                      <option value="Triadic">Triadic (120° Spaced Triangle)</option>
                      <option value="Tetradic">Tetradic (90° Square)</option>
                    </select>
                  </div>
                </div>

                {/* Smart Color Nudge Recommendations */}
                <div className="pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center space-x-1.5">
                    <Target className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Hue Alignment Nudge Suggestions</span>
                  </h4>

                  {markers.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Sample photo points to view hue shift recommendations.</p>
                  ) : (
                    <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                      {markers.map((marker) => {
                        const nudge = getSuggestions(marker);
                        return (
                          <div 
                            key={marker.id}
                            className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center space-x-2">
                              <div 
                                style={{ backgroundColor: marker.hex }}
                                className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                              />
                              <span className="font-medium text-slate-300 truncate max-w-[100px]">{marker.label}</span>
                            </div>

                            <div className="flex items-center space-x-2 font-mono">
                              <span className="text-slate-400">{marker.hsl.h}°</span>
                              <ArrowRight className="w-3 h-3 text-slate-600" />
                              {nudge.isAligned ? (
                                <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  Perfect Fit
                                </span>
                              ) : (
                                <span className={`font-semibold ${nudge.shift > 0 ? 'text-amber-400' : 'text-cyan-400'}`}>
                                  {nudge.shift > 0 ? `+${nudge.shift}°` : `${nudge.shift}°`} shift
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
            /* Editing Tips / Lightroom Instructions Tab */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2 mb-1">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span>Photoshop & Lightroom Color Grading Strategy</span>
                </h3>
                <p className="text-xs text-slate-400">Actionable post-processing tweaks to enforce current target color harmony.</p>
              </div>

              {/* HSL Adjustment Cards */}
              <div className="space-y-3">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <h4 className="text-xs font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    HSL / Color Mixer Shift
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {activeHarmonyRule.includes('Complementary') ? (
                      `To maximize the complementary contrast, push secondary warm tones toward Hue ~${detectedHarmony.primaryHue}° and push cool accent tones directly opposite to ~${(detectedHarmony.primaryHue + 180) % 360}°. Desaturate extraneous unaligned hues.`
                    ) : activeHarmonyRule.includes('Analogous') ? (
                      `Keep all hues tightly bounded within a 30°-60° spectrum arc. Slightly nudge outlying greens or purples into your primary dominant hue range for a harmonious cinematic look.`
                    ) : (
                      `Distribute key photo elements into balanced triadic zones. Use HSL Hue sliders to consolidate scattering tones into key primary colors.`
                    )}
                  </p>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <h4 className="text-xs font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Color Grading / Split Toning Target
                  </h4>
                  <div className="text-xs text-slate-300 space-y-1.5 mt-2">
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Highlights Hue:</span>
                      <span className="font-mono text-amber-400">~{detectedHarmony.primaryHue}° (Warm Gold/Amber)</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Shadows Hue:</span>
                      <span className="font-mono text-cyan-400">~{(detectedHarmony.primaryHue + 180) % 360}° (Teal/Cool Blue)</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <h4 className="text-xs font-semibold text-emerald-300 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Global Saturation & Luminance Balance
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Lower overall Saturation slider by -10 to -15% while boosting Target Palette Hue saturation in Color Mixer to create clean color separation without clipping background pixels.
                  </p>
                </div>
              </div>

              {/* Quick Export Palette Specs */}
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-xs text-slate-400">Export Palette Format</span>
                <button
                  onClick={() => {
                    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(markers, null, 2));
                    const dlAnchor = document.createElement('a');
                    dlAnchor.setAttribute("href", jsonStr);
                    dlAnchor.setAttribute("download", "color-harmony-palette.json");
                    document.body.appendChild(dlAnchor);
                    dlAnchor.click();
                    dlAnchor.remove();
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download JSON</span>
                </button>
              </div>

            </div>
          )}

        </div>

      </main>
    </div>
  );
}