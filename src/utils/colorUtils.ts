import { ColorMarker, HarmonyDetectionResult, HarmonyRule, HslColor, NudgeSuggestion, RgbColor } from '../types';

export const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
};

export const hexToRgb = (hex: string): RgbColor => {
  const clean = hex.replace('#', '');
  const parsed = parseInt(clean, 16);
  if (clean.length === 6 && !isNaN(parsed)) {
    return {
      r: (parsed >> 16) & 255,
      g: (parsed >> 8) & 255,
      b: parsed & 255
    };
  }
  return { r: 0, g: 0, b: 0 };
};

export const rgbToHsl = (r: number, g: number, b: number): HslColor => {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rf:
        h = (gf - bf) / d + (gf < bf ? 6 : 0);
        break;
      case gf:
        h = (bf - rf) / d + 2;
        break;
      case bf:
        h = (rf - gf) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

export const hslToRgb = (h: number, s: number, l: number): RgbColor => {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;

  let r1 = 0, g1 = 0, b1 = 0;
  if (hp >= 0 && hp < 1) { r1 = c; g1 = x; b1 = 0; }
  else if (hp >= 1 && hp < 2) { r1 = x; g1 = c; b1 = 0; }
  else if (hp >= 2 && hp < 3) { r1 = 0; g1 = c; b1 = x; }
  else if (hp >= 3 && hp < 4) { r1 = 0; g1 = x; b1 = c; }
  else if (hp >= 4 && hp < 5) { r1 = x; g1 = 0; b1 = c; }
  else if (hp >= 5 && hp < 6) { r1 = c; g1 = 0; b1 = x; }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255)
  };
};

// Calculate shortest angular difference (-180 to 180)
export const angleDiff = (a: number, b: number): number => {
  let diff = (b - a + 180) % 360 - 180;
  return diff < -180 ? diff + 360 : diff;
};

// Auto Harmony Detection Engine
export const analyzeColorHarmony = (markers: ColorMarker[]): HarmonyDetectionResult => {
  if (markers.length === 0) {
    return {
      type: 'No Points',
      spread: 0,
      primaryHue: 0,
      score: 100,
      secondaryHues: [],
      description: 'Drop pins on the photo to start analyzing color harmonies.'
    };
  }

  if (markers.length === 1) {
    return {
      type: 'Monochromatic',
      spread: 0,
      primaryHue: markers[0].hsl.h,
      score: 100,
      secondaryHues: [markers[0].hsl.h],
      description: 'Single tone sampled. Perfect monochromatic basis.'
    };
  }

  const hues = markers.map(m => m.hsl.h).sort((a, b) => a - b);
  const primaryHue = hues[0];

  // Calculate maximum angular gap between consecutive hues
  let maxGap = 0;
  for (let i = 0; i < hues.length; i++) {
    const next = hues[(i + 1) % hues.length];
    const gap = (next - hues[i] + 360) % 360;
    if (gap > maxGap) maxGap = gap;
  }
  const totalSpread = 360 - maxGap;

  // Check for opposite complementary pairs (140° to 220° difference)
  const hasOpposite = hues.some(h1 =>
    hues.some(h2 => Math.abs(angleDiff(h1, h2)) >= 140 && Math.abs(angleDiff(h1, h2)) <= 220)
  );

  // Check for triadic distribution (three clusters ~120° apart)
  const hasTriadClustering = totalSpread > 190 && totalSpread < 265;

  if (totalSpread <= 35) {
    const fitScore = Math.max(60, Math.round(100 - (totalSpread * 1.1)));
    return {
      type: 'Monochromatic',
      spread: totalSpread,
      primaryHue,
      score: fitScore,
      secondaryHues: [primaryHue],
      description: `All sampled hues fall within a tight ${totalSpread}° spectrum. Ideal for minimal, moody, or single-color aesthetic.`
    };
  }

  if (totalSpread <= 75) {
    const fitScore = Math.max(65, Math.round(100 - Math.abs(totalSpread - 45) * 0.8));
    return {
      type: 'Analogous',
      spread: totalSpread,
      primaryHue,
      score: fitScore,
      secondaryHues: [(primaryHue - 30 + 360) % 360, (primaryHue + 30) % 360],
      description: `Hues reside within adjacent ${totalSpread}° arc. Creates a soothing, naturally cohesive landscape look.`
    };
  }

  if (hasOpposite && totalSpread > 140 && totalSpread < 215) {
    // Complementary fit score
    const targetOpposite = (primaryHue + 180) % 360;
    const closestOpposite = hues.reduce((prev, curr) => 
      Math.abs(angleDiff(curr, targetOpposite)) < Math.abs(angleDiff(prev, targetOpposite)) ? curr : prev
    , hues[0]);
    const offset = Math.abs(angleDiff(closestOpposite, targetOpposite));
    const fitScore = Math.max(60, Math.round(100 - offset * 1.2));

    return {
      type: 'Complementary',
      spread: totalSpread,
      primaryHue,
      score: fitScore,
      secondaryHues: [(primaryHue + 180) % 360],
      description: `Classic dual-pole contrast with warm and cool balance (approx. 180° opposite). Cinematic & dynamic.`
    };
  }

  if (hasOpposite && totalSpread >= 210) {
    return {
      type: 'Split-Complementary',
      spread: totalSpread,
      primaryHue,
      score: 86,
      secondaryHues: [(primaryHue + 150) % 360, (primaryHue + 210) % 360],
      description: `Primary hue paired with two adjacent opposites (150° & 210°). Offers contrast with reduced tension.`
    };
  }

  if (hasTriadClustering) {
    return {
      type: 'Triadic',
      spread: totalSpread,
      primaryHue,
      score: 88,
      secondaryHues: [(primaryHue + 120) % 360, (primaryHue + 240) % 360],
      description: `Equilateral 120° color triangle. Vibrant and energetic even with low saturation.`
    };
  }

  return {
    type: 'Tetradic / Multi-Tone',
    spread: totalSpread,
    primaryHue,
    score: 82,
    secondaryHues: [(primaryHue + 90) % 360, (primaryHue + 180) % 360, (primaryHue + 270) % 360],
    description: `Rich rectangular color distribution spanning multiple quadrants. Complex and colorful.`
  };
};

// Calculate Hue Nudge suggestions
export const calculateNudgeSuggestions = (
  markers: ColorMarker[],
  activeRule: string,
  baseHue: number
): NudgeSuggestion[] => {
  const rule = activeRule.toLowerCase();

  let targetHues = [baseHue];
  if (rule.includes('complementary') && !rule.includes('split')) {
    targetHues = [baseHue, (baseHue + 180) % 360];
  } else if (rule.includes('split-complementary')) {
    targetHues = [baseHue, (baseHue + 150) % 360, (baseHue + 210) % 360];
  } else if (rule.includes('triadic')) {
    targetHues = [baseHue, (baseHue + 120) % 360, (baseHue + 240) % 360];
  } else if (rule.includes('analogous')) {
    targetHues = [(baseHue - 30 + 360) % 360, baseHue, (baseHue + 30) % 360];
  } else if (rule.includes('tetradic')) {
    targetHues = [baseHue, (baseHue + 90) % 360, (baseHue + 180) % 360, (baseHue + 270) % 360];
  }

  return markers.map(marker => {
    const currentHue = marker.hsl.h;
    let closestTarget = targetHues[0];
    let minDiff = Math.abs(angleDiff(currentHue, targetHues[0]));

    targetHues.forEach(th => {
      const diff = Math.abs(angleDiff(currentHue, th));
      if (diff < minDiff) {
        minDiff = diff;
        closestTarget = th;
      }
    });

    const shift = angleDiff(currentHue, closestTarget);
    const isAligned = Math.abs(shift) <= 5;

    let actionText = 'Aligned with palette harmony';
    if (!isAligned) {
      if (shift > 0) {
        actionText = `Nudge clockwise by +${shift}° towards ${closestTarget}°`;
      } else {
        actionText = `Nudge counter-clockwise by ${shift}° towards ${closestTarget}°`;
      }
    }

    return {
      markerId: marker.id,
      currentHue,
      targetHue: closestTarget,
      shift,
      isAligned,
      actionText
    };
  });
};

// Generate PowerShell Custom Script with Embedded Sample Points
export const generateCustomPowerShellScript = (markers: ColorMarker[]): string => {
  const markerObjects = markers.map(m => 
    `        @{ X = ${m.x.toFixed(1)}; Y = ${m.y.toFixed(1)}; Label = "${m.label}"; Hex = "${m.hex}"; R = ${m.r}; G = ${m.g}; B = ${m.b}; H = ${m.hsl.h}; S = ${m.hsl.s}; L = ${m.hsl.l} }`
  ).join(",\r\n");

  return `# Photo Color Analysis & Harmony Lab - Custom Palette Preset
# Generated by AI Studio Photo Color Lab
# Contains ${markers.length} pre-sampled points

` + `$customPalette = @(
${markerObjects}
)
Write-Host "[+] Loaded custom palette with $($customPalette.Count) sample pins." -ForegroundColor Cyan
`;
};
