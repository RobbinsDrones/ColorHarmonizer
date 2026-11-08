import React, { useState } from 'react';
import { ColorMarker } from '../types';
import { X, Copy, Check, Download, FileText, Code2, Database, Sliders } from 'lucide-react';
import { generateLightroomPreset, generateLightroomXmpPreset } from '../utils/colorUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  markers: ColorMarker[];
  detectedHarmony: string;
  primaryHue?: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  markers,
  detectedHarmony,
  primaryHue = 0
}) => {
  const [format, setFormat] = useState<'xmp' | 'json' | 'csv' | 'css' | 'tailwind' | 'pwsh' | 'markdown'>('xmp');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Format Content Generators
  const getFormattedContent = (): string => {
    switch (format) {
      case 'xmp': {
        const preset = generateLightroomPreset(markers, detectedHarmony, primaryHue, `Photo Harmony - ${detectedHarmony} (${Math.round(primaryHue)}°)`);
        return generateLightroomXmpPreset(preset);
      }

      case 'json':
        return JSON.stringify({
          harmony: detectedHarmony,
          exportedAt: new Date().toISOString(),
          totalPoints: markers.length,
          colors: markers
        }, null, 2);

      case 'csv': {
        const header = 'ID,Label,HEX,R,G,B,Hue,Saturation,Lightness,X_Percent,Y_Percent\n';
        const rows = markers.map(m => 
          `${m.id},"${m.label}",${m.hex},${m.r},${m.g},${m.b},${m.hsl.h},${m.hsl.s},${m.hsl.l},${m.x},${m.y}`
        ).join('\n');
        return header + rows;
      }

      case 'css': {
        const lines = markers.map((m, i) => 
          `  --color-${m.label.toLowerCase().replace(/[^a-z0-9]/g, '-') || (i + 1)}: ${m.hex}; /* H:${m.hsl.h}° S:${m.hsl.s}% L:${m.hsl.l}% */`
        ).join('\n');
        return `:root {\n  /* Photo Color Harmony: ${detectedHarmony} */\n${lines}\n}`;
      }

      case 'tailwind': {
        const entries = markers.map((m, i) => {
          const key = m.label.toLowerCase().replace(/[^a-z0-9]/g, '-') || `sample-${i + 1}`;
          return `      '${key}': '${m.hex}',`;
        }).join('\n');
        return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${entries}\n      }\n    }\n  }\n};`;
      }

      case 'pwsh': {
        const items = markers.map(m => 
          `    @{ Id = ${m.id}; Label = "${m.label}"; Hex = "${m.hex}"; R = ${m.r}; G = ${m.g}; B = ${m.b}; H = ${m.hsl.h}; S = ${m.hsl.s}; L = ${m.hsl.l} }`
        ).join(',\n');
        return `# PowerShell Palette Definition (${detectedHarmony})\n$palette = @(\n${items}\n)\n$palette | Format-Table Id, Label, Hex, H, S, L`;
      }

      case 'markdown': {
        const tableHeader = '| # | Swatch | Label | HEX | RGB | HSL |\n|---|:---:|---|---|---|---|\n';
        const tableRows = markers.map(m => 
          `| ${m.id} | \`■\` (${m.hex}) | **${m.label}** | \`${m.hex}\` | \`rgb(${m.r}, ${m.g}, ${m.b})\` | \`hsl(${m.hsl.h}°, ${m.hsl.s}%, ${m.hsl.l}%)\` |`
        ).join('\n');
        return `### 🎨 Photo Color Harmony Palette: ${detectedHarmony}\n\n` + tableHeader + tableRows;
      }

      default:
        return '';
    }
  };

  const content = getFormattedContent();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const extensions: Record<string, string> = {
      xmp: 'xmp',
      json: 'json',
      csv: 'csv',
      css: 'css',
      tailwind: 'js',
      pwsh: 'ps1',
      markdown: 'md'
    };
    const mimeTypes: Record<string, string> = {
      xmp: 'application/xml',
      json: 'application/json',
      csv: 'text/csv',
      css: 'text/css',
      tailwind: 'application/javascript',
      pwsh: 'text/plain',
      markdown: 'text/markdown'
    };

    const ext = extensions[format] || 'txt';
    const blob = new Blob([content], { type: mimeTypes[format] || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'xmp' 
      ? `photo-harmony-${detectedHarmony.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}.xmp` 
      : `photo-harmony-palette.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Export Palette & Lightroom Preset</span>
            </h3>
            <p className="text-xs text-slate-400">Export as native Adobe Lightroom .XMP develop preset or developer formats</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector Pills */}
        <div className="px-6 pt-4 pb-2 flex flex-wrap gap-1.5 border-b border-slate-800/60 bg-slate-950/40">
          {[
            { id: 'xmp', label: 'Lightroom .XMP', badge: 'Preset' },
            { id: 'json', label: 'JSON' },
            { id: 'csv', label: 'CSV / Excel' },
            { id: 'css', label: 'CSS Variables' },
            { id: 'tailwind', label: 'Tailwind CSS' },
            { id: 'pwsh', label: 'PowerShell (.ps1)' },
            { id: 'markdown', label: 'Markdown Doc' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFormat(tab.id as any)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                format === tab.id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Code Content Preview */}
        <div className="p-6 flex-1 flex flex-col">
          <div className="relative bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs text-slate-300 max-h-72 overflow-y-auto overflow-x-auto shadow-inner">
            <pre className="leading-relaxed">{content}</pre>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center mt-5 pt-3 border-t border-slate-800">
            <span className="text-xs text-slate-400 font-medium">
              {format === 'xmp' ? 'Calculated HSL & 3-Way Grading Preset' : `${markers.length} pins included`}
            </span>

            <div className="flex space-x-2">
              <button
                onClick={handleCopy}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3.5 py-2 rounded-lg border border-slate-700 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy Code'}</span>
              </button>

              <button
                onClick={handleDownload}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{format === 'xmp' ? 'Download .XMP Preset' : 'Download File'}</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
