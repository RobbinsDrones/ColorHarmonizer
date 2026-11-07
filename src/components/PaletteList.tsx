import React, { useState } from 'react';
import { ColorMarker } from '../types';
import { Copy, Check, Trash2, Sliders, Hash } from 'lucide-react';

interface PaletteListProps {
  markers: ColorMarker[];
  onRemoveMarker: (id: number) => void;
  onUpdateLabel: (id: number, label: string) => void;
  hoveredMarkerId: number | null;
  onMarkerHover: (id: number | null) => void;
  onOpenExportModal: () => void;
}

export const PaletteList: React.FC<PaletteListProps> = ({
  markers,
  onRemoveMarker,
  onUpdateLabel,
  hoveredMarkerId,
  onMarkerHover,
  onOpenExportModal
}) => {
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  const copyToClipboard = (text: string, id: string | number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Hash className="w-3.5 h-3.5 text-indigo-400" />
          <span>Sampled Color Palette ({markers.length})</span>
        </h3>

        {markers.length > 0 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                const hexList = markers.map(m => `${m.label}: ${m.hex} (H:${m.hsl.h}°, S:${m.hsl.s}%, L:${m.hsl.l}%)`).join('\n');
                copyToClipboard(hexList, 'all-palette');
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedId === 'all-palette' ? 'Copied!' : 'Copy Palette'}</span>
            </button>

            <span className="text-slate-700">•</span>

            <button
              onClick={onOpenExportModal}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Export Formats</span>
            </button>
          </div>
        )}
      </div>

      {markers.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-3 text-center">
          No color points sampled yet. Click anywhere on the photo above to sample points.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[230px] overflow-y-auto pr-1">
          {markers.map((marker) => (
            <div
              key={marker.id}
              onMouseEnter={() => onMarkerHover(marker.id)}
              onMouseLeave={() => onMarkerHover(null)}
              className={`flex items-center space-x-3 p-2.5 rounded-xl border transition-all ${
                hoveredMarkerId === marker.id
                  ? 'bg-slate-800 border-indigo-500/80 shadow-lg'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Color Swatch Circle */}
              <div
                style={{ backgroundColor: marker.hex }}
                className="w-9 h-9 rounded-lg border border-white/20 shadow-inner flex items-center justify-center shrink-0 font-bold text-xs"
              >
                <span className={marker.hsl.l > 60 ? 'text-black/80' : 'text-white/90'}>
                  {marker.id}
                </span>
              </div>

              {/* Color Metadata */}
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={marker.label}
                  onChange={(e) => onUpdateLabel(marker.id, e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none focus:border-b border-indigo-400 w-full truncate"
                  placeholder="Sample name..."
                />
                <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400 mt-0.5">
                  <button
                    onClick={() => copyToClipboard(marker.hex, `hex-${marker.id}`)}
                    className="hover:text-indigo-300 flex items-center gap-0.5 uppercase cursor-pointer"
                    title="Copy HEX"
                  >
                    <span>{marker.hex}</span>
                    {copiedId === `hex-${marker.id}` ? (
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-2.5 h-2.5" />
                    )}
                  </button>
                  <span className="text-slate-600">•</span>
                  <span>H:{marker.hsl.h}° S:{marker.hsl.s}%</span>
                </div>
              </div>

              {/* Delete Button */}
              <button
                onClick={() => onRemoveMarker(marker.id)}
                className="text-slate-500 hover:text-rose-400 p-1 rounded-md transition-colors cursor-pointer"
                title="Remove sample"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
