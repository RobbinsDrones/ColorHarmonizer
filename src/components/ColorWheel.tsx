import React, { useRef, useEffect } from 'react';
import { ColorMarker, HarmonyDetectionResult } from '../types';

interface ColorWheelProps {
  markers: ColorMarker[];
  pureHueMode: boolean;
  activeHarmonyRule: string;
  detectedHarmony: HarmonyDetectionResult;
  hoveredMarkerId: number | null;
  onMarkerHover: (id: number | null) => void;
  onMarkerSelect?: (id: number) => void;
}

export const ColorWheel: React.FC<ColorWheelProps> = ({
  markers,
  pureHueMode,
  activeHarmonyRule,
  detectedHarmony,
  hoveredMarkerId,
  onMarkerHover,
  onMarkerSelect
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 28;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw HSL Spectrum Radial Background
    for (let angle = 0; angle < 360; angle += 0.5) {
      const startAngle = (angle - 0.7) * (Math.PI / 180);
      const endAngle = (angle + 0.7) * (Math.PI / 180);

      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.35, `hsl(${angle}, 45%, 70%)`);
      gradient.addColorStop(0.72, `hsl(${angle}, 85%, 50%)`);
      gradient.addColorStop(1, `hsl(${angle}, 100%, 36%)`);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // 2. Wheel Grid Lines, Concentric Rings & Spoke Marks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;

    // Saturation rings (33%, 66%, 100%)
    [0.33, 0.66, 1].forEach((rRatio) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * rRatio, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Outer border ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Radial spokes (every 30 degrees)
    for (let a = 0; a < 360; a += 30) {
      const rad = a * (Math.PI / 180);
      const isMajor = a % 90 === 0;
      ctx.strokeStyle = isMajor ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = isMajor ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + radius * Math.cos(rad), centerY + radius * Math.sin(rad));
      ctx.stroke();

      // Degree labels outside perimeter
      const labelDist = radius + 14;
      const lx = centerX + labelDist * Math.cos(rad);
      const ly = centerY + labelDist * Math.sin(rad);
      ctx.fillStyle = isMajor ? '#cbd5e1' : '#64748b';
      ctx.font = isMajor ? 'bold 9px sans-serif' : '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${a}°`, lx, ly);
    }

    // 3. Draw Target Harmony Guide Overlays
    if (markers.length > 0) {
      const baseHue = detectedHarmony.primaryHue;
      ctx.save();

      const drawSpoke = (hueAngle: number, color: string, label?: string) => {
        const rad = (hueAngle % 360) * (Math.PI / 180);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + radius * Math.cos(rad), centerY + radius * Math.sin(rad));
        ctx.stroke();

        // Little anchor circle on perimeter
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(centerX + radius * Math.cos(rad), centerY + radius * Math.sin(rad), 4, 0, Math.PI * 2);
        ctx.fill();
      };

      const drawPolygon = (angles: number[], strokeColor: string, fillColor: string) => {
        ctx.beginPath();
        angles.forEach((deg, idx) => {
          const rad = (deg % 360) * (Math.PI / 180);
          const px = centerX + radius * Math.cos(rad);
          const py = centerY + radius * Math.sin(rad);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.setLineDash([]);
      };

      const rule = activeHarmonyRule.toLowerCase();

      if (rule.includes('complementary') && !rule.includes('split')) {
        drawSpoke(baseHue, '#38bdf8');
        drawSpoke(baseHue + 180, '#f87171');
        // Connecting line
        const r1 = (baseHue % 360) * (Math.PI / 180);
        const r2 = ((baseHue + 180) % 360) * (Math.PI / 180);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(centerX + radius * Math.cos(r1), centerY + radius * Math.sin(r1));
        ctx.lineTo(centerX + radius * Math.cos(r2), centerY + radius * Math.sin(r2));
        ctx.stroke();
      } else if (rule.includes('split-complementary')) {
        const h1 = baseHue;
        const h2 = (baseHue + 150) % 360;
        const h3 = (baseHue + 210) % 360;
        drawPolygon([h1, h2, h3], '#38bdf8', 'rgba(56, 189, 248, 0.08)');
        drawSpoke(h1, '#38bdf8');
        drawSpoke(h2, '#34d399');
        drawSpoke(h3, '#fbbf24');
      } else if (rule.includes('triadic')) {
        const h1 = baseHue;
        const h2 = (baseHue + 120) % 360;
        const h3 = (baseHue + 240) % 360;
        drawPolygon([h1, h2, h3], '#ec4899', 'rgba(236, 72, 153, 0.08)');
        drawSpoke(h1, '#ec4899');
        drawSpoke(h2, '#a855f7');
        drawSpoke(h3, '#06b6d4');
      } else if (rule.includes('analogous')) {
        const hLeft = (baseHue - 35 + 360) % 360;
        const hRight = (baseHue + 35) % 360;
        drawSpoke(hLeft, 'rgba(255, 255, 255, 0.4)');
        drawSpoke(baseHue, '#38bdf8');
        drawSpoke(hRight, 'rgba(255, 255, 255, 0.4)');

        // Arc highlight
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.98, (hLeft) * Math.PI / 180, (hRight) * Math.PI / 180);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.stroke();
      } else if (rule.includes('tetradic')) {
        const h1 = baseHue;
        const h2 = (baseHue + 90) % 360;
        const h3 = (baseHue + 180) % 360;
        const h4 = (baseHue + 270) % 360;
        drawPolygon([h1, h2, h3, h4], '#c084fc', 'rgba(192, 132, 252, 0.08)');
        drawSpoke(h1, '#c084fc');
        drawSpoke(h2, '#f472b6');
        drawSpoke(h3, '#38bdf8');
        drawSpoke(h4, '#34d399');
      }

      ctx.restore();
    }

    // 4. Plot Sampled Color Markers on Wheel
    markers.forEach((marker) => {
      const angleRad = marker.hsl.h * (Math.PI / 180);
      const distance = pureHueMode ? radius : (marker.hsl.s / 100) * radius;

      const px = centerX + distance * Math.cos(angleRad);
      const py = centerY + distance * Math.sin(angleRad);

      const isHovered = hoveredMarkerId === marker.id;

      // Glow halo on hover
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(px, py, 16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.fill();
      }

      // Outer Shadow & Fill
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
      ctx.fillText(marker.id.toString(), px, py);
    });

  }, [markers, pureHueMode, activeHarmonyRule, detectedHarmony, hoveredMarkerId]);

  return (
    <div className="relative flex flex-col items-center select-none">
      <canvas
        ref={canvasRef}
        width={310}
        height={310}
        className="rounded-full shadow-2xl bg-slate-950 border border-slate-800"
      />
      <div className="absolute inset-0 pointer-events-none rounded-full ring-1 ring-inset ring-white/10" />
    </div>
  );
};
