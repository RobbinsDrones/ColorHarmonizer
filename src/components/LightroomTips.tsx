import React from 'react';
import { ColorMarker, HarmonyDetectionResult } from '../types';
import { Sliders, Download, Sparkles, Sun, Moon, Palette } from 'lucide-react';

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
  const primaryHue = detectedHarmony.primaryHue;
  const oppositeHue = (primaryHue + 180) % 360;
  const isComplementary = activeHarmonyRule.toLowerCase().includes('complementary') && !activeHarmonyRule.toLowerCase().includes('split');
  const isAnalogous = activeHarmonyRule.toLowerCase().includes('analogous');
  const isTriadic = activeHarmonyRule.toLowerCase().includes('triadic');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2 mb-1">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <span>Lightroom & Photoshop Post-Processing Strategy</span>
        </h3>
        <p className="text-xs text-slate-400">
          Tailored HSL adjustments to enforce the <span className="text-indigo-400 font-semibold">{activeHarmonyRule}</span> harmony rule.
        </p>
      </div>

      {/* Strategy Cards */}
      <div className="space-y-3">
        {/* HSL Mixer Shift */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
          <h4 className="text-xs font-semibold text-indigo-300 mb-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>1. HSL / Color Mixer Adjustments</span>
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            {isComplementary ? (
              `Push warm skin & highlight tones toward Hue ~${primaryHue}° and cool sky or shadow tones directly opposite toward ~${oppositeHue}°. In the HSL Saturation panel, lower intermediate colors that fall outside this axis to prevent visual distraction.`
            ) : isAnalogous ? (
              `Constrain all hue sliders within a tight 35°-60° spectrum centered around ~${primaryHue}°. Shift stray greens or blues inward towards your dominant hue for a silky, film-like analogous tone curve.`
            ) : isTriadic ? (
              `Balance tone saturation across your 3 triadic nodes (~${primaryHue}°, ~${(primaryHue + 120) % 360}°, ~${(primaryHue + 240) % 360}°). Use Color Mixer to ensure no single node overpowers the other two.`
            ) : (
              `Organize colors along balanced geometric quadrants. Consolidate erratic hues into clean anchor points using selective Hue slider nudges.`
            )}
          </p>
        </div>

        {/* 3-Way Split Toning / Color Grading */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
          <h4 className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>2. Color Grading (3-Way Split Toning Wheels)</span>
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <div className="flex items-center space-x-1.5 text-slate-400 mb-1 font-medium">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Highlights Wheel Target</span>
              </div>
              <div className="font-mono text-amber-300 font-bold">
                Hue: ~{primaryHue}°
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Keep saturation moderate (~15-25%) for natural roll-off.</p>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <div className="flex items-center space-x-1.5 text-slate-400 mb-1 font-medium">
                <Moon className="w-3.5 h-3.5 text-cyan-400" />
                <span>Shadows Wheel Target</span>
              </div>
              <div className="font-mono text-cyan-300 font-bold">
                Hue: ~{oppositeHue}°
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Complementary cool anchor for depth & separation.</p>
            </div>
          </div>
        </div>

        {/* Saturation & Vibrance Discipline */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
          <h4 className="text-xs font-semibold text-emerald-300 mb-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>3. Saturation & Vibrance Balance</span>
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Drop global Vibrance/Saturation by -10% to -15% in the Basic panel to avoid oversaturating natural skin or environmental tones. Then selectively boost only your target palette hues in the Color Mixer to create crisp, high-end separation.
          </p>
        </div>
      </div>

      {/* Download JSON Button */}
      <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
        <span className="text-slate-400">Save Grading Preset Specifications</span>
        <button
          onClick={() => {
            const data = {
              targetHarmony: activeHarmonyRule,
              primaryHue,
              oppositeHue,
              highlightsTargetHue: primaryHue,
              shadowsTargetHue: oppositeHue,
              sampledPoints: markers
            };
            const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const dlAnchor = document.createElement('a');
            dlAnchor.setAttribute("href", jsonStr);
            dlAnchor.setAttribute("download", `lightroom-${activeHarmonyRule.toLowerCase()}-preset.json`);
            document.body.appendChild(dlAnchor);
            dlAnchor.click();
            dlAnchor.remove();
          }}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Strategy JSON</span>
        </button>
      </div>
    </div>
  );
};
