import { 
  ColorMarker, HarmonyDetectionResult, HarmonyRule, HslColor, 
  NudgeSuggestion, RgbColor, AutoAnalysisResult, DominantColor,
  LightroomPreset, LightroomHslAdjustment, LightroomThreeWayGrading
} from '../types';

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

// Lightroom 8 Color Mixer Channels Center Hues
const LIGHTROOM_CHANNEL_CENTERS: Record<keyof LightroomPreset['hsl'], number> = {
  red: 0,
  orange: 30,
  yellow: 60,
  green: 120,
  aqua: 180,
  blue: 225,
  purple: 275,
  magenta: 315
};

// Calculate calculated Lightroom HSL and 3-Way Color Grading values from sampled colors
export const generateLightroomPreset = (
  markers: ColorMarker[],
  harmonyRule: string,
  primaryHue: number,
  presetName: string = 'Photo Harmony Lab Grading'
): LightroomPreset => {
  const rule = harmonyRule.toLowerCase();

  // 1. Determine Target Harmony Angles on the 360 Color Wheel
  let targetHues = [primaryHue];
  if (rule.includes('split-complementary')) {
    targetHues = [primaryHue, (primaryHue + 150) % 360, (primaryHue + 210) % 360];	
  } else if (rule.includes('complementary') && !rule.includes('split')) {
    targetHues = [primaryHue, (primaryHue + 180) % 360];
  } else if (rule.includes('triadic')) {
    targetHues = [primaryHue, (primaryHue + 120) % 360, (primaryHue + 240) % 360];
  } else if (rule.includes('analogous')) {
    targetHues = [(primaryHue - 30 + 360) % 360, primaryHue, (primaryHue + 30) % 360];
  } else if (rule.includes('tetradic')) {
    targetHues = [primaryHue, (primaryHue + 90) % 360, (primaryHue + 180) % 360, (primaryHue + 270) % 360];
  } else if (rule.includes('monochromatic')) {
    targetHues = [primaryHue];
  }

  // 2. Map sampled markers to the 8 standard Lightroom Color Mixer channels
  const channels: Array<keyof LightroomPreset['hsl']> = [
    'red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'
  ];

  const channelAdjustments: Record<keyof LightroomPreset['hsl'], LightroomHslAdjustment> = {
    red: { hue: 0, saturation: 0, luminance: 0 },
    orange: { hue: 0, saturation: 0, luminance: 0 },
    yellow: { hue: 0, saturation: 0, luminance: 0 },
    green: { hue: 0, saturation: 0, luminance: 0 },
    aqua: { hue: 0, saturation: 0, luminance: 0 },
    blue: { hue: 0, saturation: 0, luminance: 0 },
    purple: { hue: 0, saturation: 0, luminance: 0 },
    magenta: { hue: 0, saturation: 0, luminance: 0 }
  };

  // Helper to determine which Lightroom channel a hue belongs to
  const getLightroomChannel = (hue: number): keyof LightroomPreset['hsl'] => {
    let closestChannel: keyof LightroomPreset['hsl'] = 'red';
    let minDistance = 360;

    for (const ch of channels) {
      const center = LIGHTROOM_CHANNEL_CENTERS[ch];
      const dist = Math.abs(angleDiff(hue, center));
      if (dist < minDistance) {
        minDistance = dist;
        closestChannel = ch;
      }
    }
    return closestChannel;
  };

  // Compute shifts for channels with sampled colors
  const channelSamples: Record<keyof LightroomPreset['hsl'], ColorMarker[]> = {
    red: [], orange: [], yellow: [], green: [], aqua: [], blue: [], purple: [], magenta: []
  };

  markers.forEach(m => {
    const ch = getLightroomChannel(m.hsl.h);
    channelSamples[ch].push(m);
  });

  // Calculate specific HSL adjustments per channel
  channels.forEach(ch => {
    const centerHue = LIGHTROOM_CHANNEL_CENTERS[ch];
    const samples = channelSamples[ch];

    // Find the closest target harmony angle to this channel's center
    let closestTarget = targetHues[0];
    let minDiffToTarget = Math.abs(angleDiff(centerHue, targetHues[0]));
    targetHues.forEach(th => {
      const d = Math.abs(angleDiff(centerHue, th));
      if (d < minDiffToTarget) {
        minDiffToTarget = d;
        closestTarget = th;
      }
    });

    if (samples.length > 0) {
	  /**
 * Calculates the circular mean of hue angles.
 * Correctly handles the 0°/360° boundary.
 *
 * @param hues Array of hue values in degrees (0-360)
 * @returns Average hue in degrees (0-360)
 */
export const circularMeanHue = (hues: number[]): number => {
  if (hues.length === 0) return 0;

  const radians = hues.map(h => (h * Math.PI) / 180);

  const sinSum = radians.reduce((sum, h) => sum + Math.sin(h), 0);
  const cosSum = radians.reduce((sum, h) => sum + Math.cos(h), 0);

  const meanRadians = Math.atan2(sinSum, cosSum);

  return (meanRadians * 180 / Math.PI + 360) % 360;
};
const avgCurrentHue = circularMeanHue(
  samples.map(m => m.hsl.h)
);
      const rawHueDiff = angleDiff(avgCurrentHue, closestTarget);
      
      // Conservative, proportional Hue adjustment (strictly within ±30):
      // Provides a photographic nudge towards harmony rather than forcing extreme color distortion
      const absDiff = Math.abs(rawHueDiff);
      const sign = rawHueDiff >= 0 ? 1 : -1;
      let lrHueShift = 0;
      if (absDiff <= 12) {
        // Small angular deviations: gentle 1:1 proportional correction
        lrHueShift = Math.round(rawHueDiff * 0.9);
      } else if (absDiff <= 30) {
        // Moderate deviations: proportional with diminishing curve
        lrHueShift = Math.round(sign * (11 + (absDiff - 12) * 0.65));
      } else {
        // Larger deviations: conservative photographic cap
        lrHueShift = Math.round(sign * Math.min(30, 23 + (absDiff - 30) * 0.25));
      }
      lrHueShift = Math.max(-30, Math.min(30, lrHueShift));

      // Conservative, proportional Saturation adjustment (strictly within ±35):
      // Core harmony tones get gentle photographic enhancement (+4 to +16).
      // Distant off-harmony tones get subtle dampening (-4 to -18) to clean the palette without stripping natural feel.
      let satAdjust = 0;
      if (minDiffToTarget <= 22) {
        satAdjust = Math.round((25 - minDiffToTarget) * 0.65); // +2 to +16
      } else if (minDiffToTarget > 45) {
        satAdjust = -Math.round(Math.min(18, (minDiffToTarget - 40) * 0.45)); // -2 to -18
      }
      satAdjust = Math.max(-35, Math.min(35, satAdjust));

      // Conservative Luminance adjustment (strictly within ±25):
      // Gentle tonal shaping based on average lightness of sampled pins
      const avgL = samples.reduce((acc, m) => acc + m.hsl.l, 0) / samples.length;
      const lumAdjust = Math.max(-25, Math.min(25, Math.round((50 - avgL) * 0.16)));

      channelAdjustments[ch] = {
        hue: lrHueShift,
        saturation: satAdjust,
        luminance: lumAdjust
      };
    } else {
      // Unsampled channel: conservative minor alignment or neutral
      if (minDiffToTarget <= 15) {
        const rawShift = angleDiff(centerHue, closestTarget);
        channelAdjustments[ch] = {
          hue: Math.max(-10, Math.min(10, Math.round(rawShift * 0.4))),
          saturation: 0,
          luminance: 0
        };
      } else if (minDiffToTarget > 60) {
        // Rogue channel distant from all harmony spokes: subtle conservative reduction
        channelAdjustments[ch] = {
          hue: 0,
          saturation: -8,
          luminance: 0
        };
      }
    }
  });

  // 3. Calculate 3-Way Split Toning / Color Grading from sampled highlights, midtones, and shadows
  // Sort sampled markers by lightness
  const sortedByLightness = [...markers].sort((a, b) => a.hsl.l - b.hsl.l);
  const shadowSample = sortedByLightness.find(m => m.hsl.l <= 35) || sortedByLightness[0];
  const highlightSample = [...sortedByLightness].reverse().find(m => m.hsl.l >= 65) || sortedByLightness[sortedByLightness.length - 1];
  const midtoneSample = sortedByLightness.find(m => m.hsl.l > 35 && m.hsl.l < 65) || sortedByLightness[Math.floor(sortedByLightness.length / 2)];

  // Calculate Highlight grading hue (derived from primary tone or sampled highlight)
  let highlightHue = primaryHue;
  let shadowHue = (primaryHue + 180) % 360;
  let midtoneHue = primaryHue;

  if (rule.includes('complementary')) {
    highlightHue = highlightSample ? highlightSample.hsl.h : primaryHue;
    shadowHue = (highlightHue + 180) % 360;
    midtoneHue = (highlightHue + 15) % 360;
  } else if (rule.includes('split-complementary')) {
    highlightHue = primaryHue;
    shadowHue = (primaryHue + 150) % 360;
    midtoneHue = (primaryHue + 210) % 360;
  } else if (rule.includes('analogous')) {
    highlightHue = (primaryHue + 15) % 360;
    shadowHue = (primaryHue - 15 + 360) % 360;
    midtoneHue = primaryHue;
  } else if (rule.includes('triadic')) {
    highlightHue = primaryHue;
    shadowHue = (primaryHue + 120) % 360;
    midtoneHue = (primaryHue + 240) % 360;
  }

  // Calculate grading saturation strengths (conservative photographic ranges: 6 to 18)
  const shadowSat = shadowSample ? Math.min(18, Math.max(6, Math.round(shadowSample.hsl.s * 0.22))) : 12;
  const highlightSat = highlightSample ? Math.min(16, Math.max(5, Math.round(highlightSample.hsl.s * 0.20))) : 10;
  const midtoneSat = midtoneSample ? Math.min(12, Math.max(4, Math.round(midtoneSample.hsl.s * 0.15))) : 6;

  // Calculate subtle luminance separation within reasonable bounds (well within ±25)
  const shadowLum = (shadowSample && shadowSample.hsl.l < 25) ? -3 : 0;
  const highlightLum = (highlightSample && highlightSample.hsl.l > 75) ? 2 : 0;
  const midtoneLum = 0;

  const colorGrading: LightroomThreeWayGrading = {
    shadowHue: Math.round(shadowHue),
    shadowSat,
    shadowLum,
    midtoneHue: Math.round(midtoneHue),
    midtoneSat,
    midtoneLum,
    highlightHue: Math.round(highlightHue),
    highlightSat,
    highlightLum,
    blending: 55,
    balance: 0
  };

  // 4. Calculate Global Vibrance & Saturation from sampled colors
  // Muted/neutral scenes receive a gentle vibrance boost to lift subtle chromas cleanly.
  // Saturated scenes receive controlled saturation roll-off to prevent digital clipping in Lightroom.
  const avgSampleSat = markers.length > 0 
    ? markers.reduce((sum, m) => sum + m.hsl.s, 0) / markers.length 
    : 45;

  let calculatedVibrance = 8;
  let calculatedSaturation = -4;

  if (avgSampleSat < 25) {
    calculatedVibrance = 12;
    calculatedSaturation = -2;
  } else if (avgSampleSat < 50) {
    calculatedVibrance = 8;
    calculatedSaturation = -4;
  } else if (avgSampleSat < 75) {
    calculatedVibrance = 5;
    calculatedSaturation = -6;
  } else {
    calculatedVibrance = 2;
    calculatedSaturation = -8;
  }

  // Name incorporating selected harmony and primary hue
  const cleanPresetName = presetName || `Photo Harmony - ${harmonyRule} (${Math.round(primaryHue)}°)`;

  return {
    name: cleanPresetName,
    harmonyRule,
    primaryHue: Math.round(primaryHue),
    vibrance: calculatedVibrance,
    saturation: calculatedSaturation,
    hsl: channelAdjustments,
    colorGrading,
    description: `Lightroom .xmp preset calculated from sampled photo colors enforcing ${harmonyRule} harmony with D65 white-balance discipline.`
  };
};

// Helper: Escape XML special characters in attribute values
const escapeXmlAttr = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// Validate generated XML structure and parseability for Lightroom Classic
export const validateXmpXml = (xml: string): { valid: boolean; error?: string } => {
  if (!xml || typeof xml !== 'string' || xml.trim().length === 0) {
    return { valid: false, error: 'XMP XML string is empty.' };
  }

  // 1. Verify absence of comments inside opening element tags or attribute lists
  const illegalCommentInTagRegex = /<[a-zA-Z0-9:]+\s+[^>]*?<!--/;
  if (illegalCommentInTagRegex.test(xml)) {
    return { valid: false, error: 'XML specification violation: comment found inside opening element tag or attribute list.' };
  }

  // 2. Verify root and namespaces
  if (!xml.includes('<x:xmpmeta') || !xml.includes('</x:xmpmeta>')) {
    return { valid: false, error: 'Missing standard <x:xmpmeta> root elements.' };
  }
  if (!xml.includes('xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"')) {
    return { valid: false, error: 'Missing Adobe Camera Raw Settings namespace definition.' };
  }
  if (!xml.includes('crs:HasSettings="True"')) {
    return { valid: false, error: 'Missing crs:HasSettings="True" develop flag.' };
  }

  // 3. Browser DOMParser strict validation
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        return { valid: false, error: parserError.textContent || 'XML parser error.' };
      }
    } catch (e: any) {
      return { valid: false, error: e?.message || 'XML parser execution failed.' };
    }
  }

  return { valid: true };
};

// Generate standard Adobe Camera Raw / Lightroom Classic .xmp preset XML
// Strictly contains HSL color mixer, 3-way color grading, and calculated global vibrance/saturation.
// Zero changes to exposure, white balance, crop, sharpening, or noise reduction.
// Guaranteed valid XML: No comments inside opening tags or attribute lists.
export const generateLightroomXmpPreset = (preset: LightroomPreset): string => {
  const { hsl, colorGrading, name, harmonyRule, primaryHue, vibrance, saturation } = preset;
  const dateStr = new Date().toISOString();
  
  // Format numeric values with explicit +/- signs where conventional in ACR presets
  const formatSigned = (val: number): string => (val > 0 ? `+${val}` : `${val}`);

  // RFC4122 v4 formatted UUID for Lightroom preset catalog indexing
  const generateUuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16).toUpperCase();
    });
  };

  const safeName = escapeXmlAttr(name);
  const safeDesc = escapeXmlAttr(`Photo Color Harmony Lab - ${harmonyRule} (Primary Hue: ${primaryHue}°)`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 7.0-c000 1.000000, 0000/00/00-00:00:00">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
    crs:PresetType="Normal"
    crs:Cluster=""
    crs:UUID="${generateUuid()}"
    crs:SupportsAmount="True"
    crs:Amount="1.0"
    crs:Name="${safeName}"
    crs:Description="${safeDesc}"
    crs:Date="${dateStr}"
    crs:HasSettings="True"
    crs:Version="16.0"
    crs:ProcessVersion="15.4"
    crs:Vibrance="${formatSigned(vibrance)}"
    crs:Saturation="${formatSigned(saturation)}"
    crs:HueAdjustmentRed="${hsl.red.hue}"
    crs:HueAdjustmentOrange="${hsl.orange.hue}"
    crs:HueAdjustmentYellow="${hsl.yellow.hue}"
    crs:HueAdjustmentGreen="${hsl.green.hue}"
    crs:HueAdjustmentAqua="${hsl.aqua.hue}"
    crs:HueAdjustmentBlue="${hsl.blue.hue}"
    crs:HueAdjustmentPurple="${hsl.purple.hue}"
    crs:HueAdjustmentMagenta="${hsl.magenta.hue}"
    crs:SaturationAdjustmentRed="${hsl.red.saturation}"
    crs:SaturationAdjustmentOrange="${hsl.orange.saturation}"
    crs:SaturationAdjustmentYellow="${hsl.yellow.saturation}"
    crs:SaturationAdjustmentGreen="${hsl.green.saturation}"
    crs:SaturationAdjustmentAqua="${hsl.aqua.saturation}"
    crs:SaturationAdjustmentBlue="${hsl.blue.saturation}"
    crs:SaturationAdjustmentPurple="${hsl.purple.saturation}"
    crs:SaturationAdjustmentMagenta="${hsl.magenta.saturation}"
    crs:LuminanceAdjustmentRed="${hsl.red.luminance}"
    crs:LuminanceAdjustmentOrange="${hsl.orange.luminance}"
    crs:LuminanceAdjustmentYellow="${hsl.yellow.luminance}"
    crs:LuminanceAdjustmentGreen="${hsl.green.luminance}"
    crs:LuminanceAdjustmentAqua="${hsl.aqua.luminance}"
    crs:LuminanceAdjustmentBlue="${hsl.blue.luminance}"
    crs:LuminanceAdjustmentPurple="${hsl.purple.luminance}"
    crs:LuminanceAdjustmentMagenta="${hsl.magenta.luminance}"
    crs:ColorGradeShadowHue="${colorGrading.shadowHue}"
    crs:ColorGradeShadowSat="${colorGrading.shadowSat}"
    crs:ColorGradeShadowLum="${colorGrading.shadowLum}"
    crs:ColorGradeMidtoneHue="${colorGrading.midtoneHue}"
    crs:ColorGradeMidtoneSat="${colorGrading.midtoneSat}"
    crs:ColorGradeMidtoneLum="${colorGrading.midtoneLum}"
    crs:ColorGradeHighlightHue="${colorGrading.highlightHue}"
    crs:ColorGradeHighlightSat="${colorGrading.highlightSat}"
    crs:ColorGradeHighlightLum="${colorGrading.highlightLum}"
    crs:ColorGradeBlending="${colorGrading.blending}"
    crs:ColorGradeBalance="${colorGrading.balance}"
    crs:ColorGradeGlobalHue="0"
    crs:ColorGradeGlobalSat="0"
    crs:ColorGradeGlobalLum="0" />
 </rdf:RDF>
</x:xmpmeta>`;
};

// CIELAB Color Conversion and Perceptual Difference (CIE76 / D65)
export interface LabColor {
  l: number; // 0 to 100
  a: number; // -128 to +127
  b: number; // -128 to +127
}

export const rgbToLab = (r: number, g: number, b: number): LabColor => {
  // 1. sRGB gamma to linear
  let rLin = r / 255;
  let gLin = g / 255;
  let bLin = b / 255;

  rLin = rLin > 0.04045 ? Math.pow((rLin + 0.055) / 1.055, 2.4) : rLin / 12.92;
  gLin = gLin > 0.04045 ? Math.pow((gLin + 0.055) / 1.055, 2.4) : gLin / 12.92;
  bLin = bLin > 0.04045 ? Math.pow((bLin + 0.055) / 1.055, 2.4) : bLin / 12.92;

  // 2. Linear RGB to CIE XYZ (D65 standard)
  const x = (rLin * 0.4124564 + gLin * 0.3575761 + bLin * 0.1804375) / 0.95047;
  const y = (rLin * 0.2126729 + gLin * 0.7151522 + bLin * 0.0721750) / 1.00000;
  const z = (rLin * 0.0193339 + gLin * 0.1191920 + bLin * 0.9503041) / 1.08883;

  // 3. XYZ to CIELAB
  const fx = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
  const fy = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  const fz = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;

  const l = Math.max(0, 116 * fy - 16);
  const aVal = 500 * (fx - fy);
  const bVal = 200 * (fy - fz);

  return { l, a: aVal, b: bVal };
};

export const deltaE = (c1: LabColor, c2: LabColor): number => {
  const dl = c1.l - c2.l;
  const da = c1.a - c2.a;
  const db = c1.b - c2.b;
  return Math.sqrt(dl * dl + da * da + db * db);
};

// Auto Color & Tone Extraction Algorithm:
// Balances dominant overall pixel distribution with visually significant colors
// (including low-saturation neutrals like white, ivory, cream, gray, and black,
// prominent subjects/clothing/wildlife, and distinctive accents)
// while strictly avoiding selecting multiple nearly identical shades.
export const extractPhotoColorsAndTones = (
  img: HTMLImageElement | { width: number; height: number; data: Uint8ClampedArray | number[] },
  targetCount: number = 5
): AutoAnalysisResult => {
  let data: Uint8ClampedArray | number[];
  let w: number;
  let h: number;

  if ('data' in img && 'width' in img && 'height' in img) {
    data = img.data;
    w = img.width;
    h = img.height;
  } else {
    const canvas = document.createElement('canvas');
    // Scale down to 200px on the longest side to preserve fine prominent subjects
    // (clothing details, flowers, animals, accessories, highlights) without performance lag
    const maxDim = 200;
    const naturalW = img.naturalWidth || img.width || 800;
    const naturalH = img.naturalHeight || img.height || 600;
    const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
    w = Math.max(40, Math.floor(naturalW * scale));
    h = Math.max(40, Math.floor(naturalH * scale));
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        dominantColors: [],
        tones: { highlight: null, midtone: null, shadow: null, vibrant: null, muted: null },
        temperature: 'Balanced Neutral',
        temperatureScore: 0,
        contrastLevel: 'Balanced Contrast',
        contrastRatio: 1,
        saturationLevel: 'Natural Richness',
        avgSaturation: 50,
        recommendedScheme: 'Standard Balance'
      };
    }

    ctx.drawImage(img as HTMLImageElement, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    data = imgData.data;
  }

  const totalPixels = w * h;

  // Step 1: Bucket pixels by quantized 15-bit color (5 bits per channel)
  // and compute global image statistics
  interface BucketData {
    rSum: number;
    gSum: number;
    bSum: number;
    xSum: number;
    ySum: number;
    count: number;
  }
  const buckets = new Map<number, BucketData>();
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let validPixelCount = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a < 128) continue; // skip transparent

      totalR += r;
      totalG += g;
      totalB += b;
      validPixelCount++;

      // Quantize to 5 bits (0 - 31)
      const qr = r >> 3;
      const qg = g >> 3;
      const qb = b >> 3;
      const key = (qr << 10) | (qg << 5) | qb;

      let bkt = buckets.get(key);
      if (!bkt) {
        bkt = { rSum: 0, gSum: 0, bSum: 0, xSum: 0, ySum: 0, count: 0 };
        buckets.set(key, bkt);
      }
      bkt.rSum += r;
      bkt.gSum += g;
      bkt.bSum += b;
      bkt.xSum += (x / w) * 100;
      bkt.ySum += (y / h) * 100;
      bkt.count += 1;
    }
  }

  const effectivePixels = validPixelCount || totalPixels;
  const meanR = Math.round(totalR / effectivePixels);
  const meanG = Math.round(totalG / effectivePixels);
  const meanB = Math.round(totalB / effectivePixels);
  const meanLab = rgbToLab(meanR, meanG, meanB);

  interface CandidateCluster {
    r: number;
    g: number;
    b: number;
    x: number;
    y: number;
    hex: string;
    hsl: HslColor;
    lab: LabColor;
    chroma: number; // CIELAB chroma sqrt(a^2 + b^2)
    count: number;
    weight: number;
    dominanceScore: number;
    saliencyScore: number;
    compositeScore: number;
  }

  // Convert buckets to preliminary clusters, filtering out single-pixel sensor noise (< 0.04%)
  const minNoiseThreshold = Math.max(3, Math.floor(effectivePixels * 0.0004));
  const rawClusters = Array.from(buckets.values())
    .filter(b => b.count >= minNoiseThreshold)
    .map(b => {
      const r = Math.round(b.rSum / b.count);
      const g = Math.round(b.gSum / b.count);
      const bCol = Math.round(b.bSum / b.count);
      const x = Number((b.xSum / b.count).toFixed(1));
      const y = Number((b.ySum / b.count).toFixed(1));
      const hex = rgbToHex(r, g, bCol);
      const hsl = rgbToHsl(r, g, bCol);
      const lab = rgbToLab(r, g, bCol);
      const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
      return {
        r, g, b: bCol, x, y, hex, hsl, lab, chroma,
        count: b.count,
        weight: b.count,
        dominanceScore: 0,
        saliencyScore: 0,
        compositeScore: 0
      };
    });

  // Sort raw clusters initially by count
  rawClusters.sort((a, b) => b.count - a.count);

  // Perceptual distance function combining CIELAB DeltaE and chromatic hue separation
  const perceptualColorDist = (c1: CandidateCluster, c2: CandidateCluster): number => {
    const dLab = deltaE(c1.lab, c2.lab);
    // If both colors have chromatic saturation, hue difference across sectors is significant
    if (c1.hsl.s > 18 && c2.hsl.s > 18 && c1.hsl.l > 12 && c2.hsl.l > 12 && c1.hsl.l < 90 && c2.hsl.l < 90) {
      const hDiff = Math.abs(angleDiff(c1.hsl.h, c2.hsl.h)); // 0 - 180
      return dLab * 0.75 + (hDiff / 180) * 32;
    }
    return dLab;
  };

  // Step 2: Preliminary merge of micro-shades (avoid fragmentation of identical gradients)
  const merged: CandidateCluster[] = [];
  for (const cand of rawClusters) {
    let matched = false;
    for (const m of merged) {
      if (deltaE(cand.lab, m.lab) < 10) {
        // Merge into existing cluster
        const totalCount = m.count + cand.count;
        m.r = Math.round((m.r * m.count + cand.r * cand.count) / totalCount);
        m.g = Math.round((m.g * m.count + cand.g * cand.count) / totalCount);
        m.b = Math.round((m.b * m.count + cand.b * cand.count) / totalCount);
        m.x = Number(((m.x * m.count + cand.x * cand.count) / totalCount).toFixed(1));
        m.y = Number(((m.y * m.count + cand.y * cand.count) / totalCount).toFixed(1));
        m.hex = rgbToHex(m.r, m.g, m.b);
        m.hsl = rgbToHsl(m.r, m.g, m.b);
        m.lab = rgbToLab(m.r, m.g, m.b);
        m.chroma = Math.sqrt(m.lab.a * m.lab.a + m.lab.b * m.lab.b);
        m.count = totalCount;
        m.weight = totalCount;
        matched = true;
        break;
      }
    }
    if (!matched) {
      merged.push({ ...cand });
    }
  }

  // Step 3: Compute Visual Saliency & Dominance Scores for each cluster
  // Balanced to evaluate:
  // - Dominance (pixel frequency curve)
  // - Neutral Subject Importance (white/ivory/cream clothing, gray stone/suits, black shadows)
  // - Chromatic Vibrancy (colorful flowers, plumage, ribbons, signs)
  // - Contrast from ambient scene average (pops out of background)
  // - Subject spatial composition (center/rule-of-thirds concentration)
  for (const c of merged) {
    const pFrac = c.count / effectivePixels;

    // 1. Dominance score: dampened power curve
    c.dominanceScore = Math.min(1.0, Math.sqrt(pFrac) * 1.7);

    // 2. Contrast against overall scene ambient color
    const dFromMean = deltaE(c.lab, meanLab);
    const contrastScore = Math.min(1.0, dFromMean / 58);

    // 3. Highlight / Clean Neutral Score (White, Ivory, Cream, Snow, Light Petals, Bright Clothing)
    // CRITICAL: Low saturation colors like white, ivory, and cream are NOT deprioritized!
    let highlightScore = 0;
    if (c.hsl.l >= 75) {
      const lWeight = Math.min(1.0, (c.hsl.l - 72) / 26);
      const presFactor = pFrac >= 0.008 ? 1.3 : 1.0;
      highlightScore = Math.min(1.0, lWeight * presFactor);
    }

    // 4. Deep Shadow / Anchor Tone Score (Black, Dark Charcoal, Deep Shadow)
    let shadowScore = 0;
    if (c.hsl.l <= 22) {
      const shWeight = Math.min(1.0, (24 - c.hsl.l) / 20);
      const presFactor = pFrac >= 0.008 ? 1.2 : 1.0;
      shadowScore = Math.min(1.0, shWeight * presFactor);
    }

    // 5. Chromatic Vibrancy / Accent Score (Flowers, plumage, lipstick, ribbons, neon)
    const chromaScore = Math.min(1.0, c.chroma / 50);

    // 6. Neutral Ground / Midtone Neutral Score (Gray, Slate, Taupe fabric, stone)
    let neutralScore = 0;
    if (c.hsl.s <= 18 && c.hsl.l > 25 && c.hsl.l < 75 && pFrac >= 0.012) {
      neutralScore = 0.65;
    }

    // 7. Spatial Focus / Subject Placement (Centrally composed subjects in middle 15% - 85% of frame)
    const inSubjectZone = c.x >= 15 && c.x <= 85 && c.y >= 15 && c.y <= 85;
    const spatialScore = inSubjectZone ? 1.0 : 0.6;

    // Primary salient trait: can be an intense chroma OR a prominent neutral highlight/shadow
    const primaryFeature = Math.max(chromaScore, highlightScore, shadowScore, neutralScore);

    // Unified Visual Saliency
    c.saliencyScore = Math.min(
      1.0,
      primaryFeature * 0.48 + contrastScore * 0.38 + spatialScore * 0.14
    );

    // Composite Score: 38% Dominance + 62% Visual Saliency
    c.compositeScore = c.dominanceScore * 0.38 + c.saliencyScore * 0.62;
  }

  // Step 4: Multi-Role Diverse Palette Selection (MMR with Strict Separation)
  // Balances environmental dominant colors with visually significant subject colors
  // and avoids selecting multiple nearly identical shades!
  const selected: CandidateCluster[] = [];
  const selectedTypes: Array<'Dominant Base' | 'Vibrant Accent' | 'Key Highlight' | 'Deep Shadow' | 'Harmonic Tone' | 'Subject Neutral'> = [];

  // Slot 1: Primary Environmental Dominant Base (Background, foliage, sky, or major ground plane)
  const sortedByCount = [...merged].sort((a, b) => b.count - a.count);
  const primaryDominant = sortedByCount[0];
  if (primaryDominant) {
    selected.push(primaryDominant);
    selectedTypes.push('Dominant Base');
  }

  // Slots 1b..N: Area Anchors
  // Reserve roughly half of the palette for the colors that physically cover the most
  // of the frame (e.g. the big mid-green foliage family, sky, ground), so that a vivid
  // but tiny accent can never push a large color family out of a "dominant" palette.
  // The remaining slots below are still filled by visual saliency (accents, highlights,
  // shadows, subject neutrals).
  const AREA_ANCHOR_FRACTION = 0.5;   // share of palette slots reserved for large-area colors
  const ANCHOR_MIN_SEPARATION = 14;   // perceptual distance between anchors (looser than accents)
  const anchorTarget = Math.max(2, Math.ceil(targetCount * AREA_ANCHOR_FRACTION));
  for (const cand of sortedByCount) {
    if (selected.length >= anchorTarget) break;
    if (selected.some(s => s.hex === cand.hex)) continue;
    if (selected.every(s => perceptualColorDist(cand, s) >= ANCHOR_MIN_SEPARATION)) {
      selected.push(cand);
      selectedTypes.push('Dominant Base');
    }
  }

  // Slot 2: Primary Visual Subject / Distinct Focal Color
  // Pick the highest saliency candidate that is perceptually distinct from Slot 1 (deltaE >= 28)
  // (e.g. white clothing, ivory dress, vivid flower, animal fur, or bright object)
  const candidateSubjects = [...merged]
    .filter(c => selected.every(s => perceptualColorDist(c, s) >= 28))
    .sort((a, b) => b.saliencyScore - a.saliencyScore);

  if (selected.length < targetCount && candidateSubjects.length > 0) {
    const topSubject = candidateSubjects[0];
    selected.push(topSubject);
    let role: typeof selectedTypes[0] = 'Harmonic Tone';
    if (topSubject.hsl.l >= 78) role = 'Key Highlight';
    else if (topSubject.hsl.l <= 20) role = 'Deep Shadow';
    else if (topSubject.chroma >= 38 || topSubject.hsl.s >= 55) role = 'Vibrant Accent';
    else if (topSubject.hsl.s <= 18) role = 'Subject Neutral';
    else role = 'Dominant Base';
    selectedTypes.push(role);
  }

  // Slot 3: Complementary Subject / Accent / Neutral Counterpart
  // If Slot 2 was a neutral (e.g. white dress, gray suit, black jacket), look for the most vibrant accent!
  // If Slot 2 was a chromatic color, look for the most prominent neutral highlight or shadow!
  const hasNeutralSoFar = selected.some(s => s.hsl.s <= 22 || s.hsl.l >= 78 || s.hsl.l <= 20);
  const hasVibrantSoFar = selected.some(s => s.chroma >= 35 || s.hsl.s >= 50);

  let targetRoleForSlot3: 'accent' | 'neutral' | 'diverse' = 'diverse';
  if (hasNeutralSoFar && !hasVibrantSoFar) targetRoleForSlot3 = 'accent';
  else if (hasVibrantSoFar && !hasNeutralSoFar) targetRoleForSlot3 = 'neutral';

  let slot3Candidate: CandidateCluster | null = null;
  if (targetRoleForSlot3 === 'accent') {
    slot3Candidate = [...merged]
      .filter(c => selected.every(s => perceptualColorDist(c, s) >= 25))
      .filter(c => c.chroma >= 25 || c.hsl.s >= 35)
      .sort((a, b) => (b.chroma * 0.6 + b.saliencyScore * 40) - (a.chroma * 0.6 + a.saliencyScore * 40))[0] || null;
  } else if (targetRoleForSlot3 === 'neutral') {
    slot3Candidate = [...merged]
      .filter(c => selected.every(s => perceptualColorDist(c, s) >= 25))
      .filter(c => c.hsl.l >= 76 || c.hsl.l <= 22 || c.hsl.s <= 18)
      .sort((a, b) => b.saliencyScore - a.saliencyScore)[0] || null;
  }

  if (selected.length < targetCount && slot3Candidate) {
    selected.push(slot3Candidate);
    let role: typeof selectedTypes[0] = 'Harmonic Tone';
    if (slot3Candidate.hsl.l >= 78) role = 'Key Highlight';
    else if (slot3Candidate.hsl.l <= 20) role = 'Deep Shadow';
    else if (slot3Candidate.chroma >= 38 || slot3Candidate.hsl.s >= 55) role = 'Vibrant Accent';
    else if (slot3Candidate.hsl.s <= 18) role = 'Subject Neutral';
    selectedTypes.push(role);
  }

  // Slots 4 to targetCount: Maximal Marginal Relevance (MMR) with Strict Avoidance of Duplicate Shades
  while (selected.length < targetCount && selected.length < merged.length) {
    let bestCand: CandidateCluster | null = null;
    let bestScore = -Infinity;

    for (const cand of merged) {
      if (selected.some(s => s.hex === cand.hex)) continue;

      const minDist = Math.min(...selected.map(s => perceptualColorDist(cand, s)));

      // Strict avoidance of nearly identical shades (minimum separation threshold deltaE 23)
      if (minDist < 23) continue;

      const diversityFactor = Math.min(1.4, Math.max(0.3, minDist / 38));
      const utility = cand.compositeScore * diversityFactor;

      if (utility > bestScore) {
        bestScore = utility;
        bestCand = cand;
      }
    }

    // If threshold was too strict to fill target count, slightly relax threshold to 16
    if (!bestCand) {
      for (const cand of merged) {
        if (selected.some(s => s.hex === cand.hex)) continue;
        const minDist = Math.min(...selected.map(s => perceptualColorDist(cand, s)));
        if (minDist >= 16) {
          bestCand = cand;
          break;
        }
      }
    }

    if (!bestCand) break;

    let role: typeof selectedTypes[0] = 'Harmonic Tone';
    if (bestCand.hsl.l >= 78) role = 'Key Highlight';
    else if (bestCand.hsl.l <= 20) role = 'Deep Shadow';
    else if (bestCand.chroma >= 38 || bestCand.hsl.s >= 55) role = 'Vibrant Accent';
    else if (bestCand.hsl.s <= 18) role = 'Subject Neutral';
    else if (bestCand.count / effectivePixels > 0.16) role = 'Dominant Base';

    selected.push(bestCand);
    selectedTypes.push(role);
  }

  // Step 5: Tonal Range & Distinctive Accent Safety Check
  // 1. If photo has a prominent clean highlight (white/ivory/cream >= 0.6% area) not yet in palette:
  const hasHighlight = selected.some(s => s.hsl.l >= 75);
  const candHighlight = merged.find(c => c.hsl.l >= 78 && (c.count / effectivePixels) >= 0.006 && selected.every(s => perceptualColorDist(c, s) >= 20));
  if (!hasHighlight && candHighlight && selected.length >= targetCount) {
    const swapIdx = selected.findIndex((_, idx) => selectedTypes[idx] === 'Harmonic Tone');
    if (swapIdx !== -1) {
      selected[swapIdx] = candHighlight;
      selectedTypes[swapIdx] = 'Key Highlight';
    }
  }

  // 2. If photo has a prominent deep shadow (black/charcoal >= 0.6% area) not yet in palette:
  const hasShadow = selected.some(s => s.hsl.l <= 22);
  const candShadow = merged.find(c => c.hsl.l <= 20 && (c.count / effectivePixels) >= 0.006 && selected.every(s => perceptualColorDist(c, s) >= 20));
  if (!hasShadow && candShadow && selected.length >= targetCount) {
    const swapIdx = selected.findIndex((_, idx) => selectedTypes[idx] === 'Harmonic Tone');
    if (swapIdx !== -1) {
      selected[swapIdx] = candShadow;
      selectedTypes[swapIdx] = 'Deep Shadow';
    }
  }

  // 3. Preserve distinctive accent colors, even when they occupy relatively small portions of the image (>= 0.2%)
  const hasAccent = selected.some(s => s.chroma >= 35 || s.hsl.s >= 55);
  const candAccent = merged.find(c => (c.chroma >= 38 || c.hsl.s >= 58) && (c.count / effectivePixels) >= 0.002 && selected.every(s => perceptualColorDist(c, s) >= 22));
  if (!hasAccent && candAccent && selected.length >= targetCount) {
    const swapIdx = selected.findIndex((_, idx) => selectedTypes[idx] === 'Harmonic Tone');
    if (swapIdx !== -1) {
      selected[swapIdx] = candAccent;
      selectedTypes[swapIdx] = 'Vibrant Accent';
    }
  }

  // True area coverage: assign EVERY pixel bucket to its perceptually nearest palette color,
  // so percentages are the real share of the photo (they sum to 100%) rather than a share
  // of only the handful of selected clusters. Swatch hex values stay as the representative
  // cluster colors so pins still land on real pixels.
  const coverage: number[] = new Array(selected.length).fill(0);
  let assignedTotal = 0;
  for (const bkt of buckets.values()) {
    const bl = rgbToLab(
      Math.round(bkt.rSum / bkt.count),
      Math.round(bkt.gSum / bkt.count),
      Math.round(bkt.bSum / bkt.count)
    );
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < selected.length; i++) {
      const d = deltaE(bl, selected[i].lab);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    coverage[bestIdx] += bkt.count;
    assignedTotal += bkt.count;
  }
  const sumCount = assignedTotal || effectivePixels;

  // Order the palette by true coverage (largest first) so the proportion bar and the
  // "Photo Dominant Palette" strip read in order of how much of the photo each color covers.
  const order = selected.map((_, i) => i).sort((a, b) => coverage[b] - coverage[a]);
  const selectedSorted = order.map(i => selected[i]);
  const typesSorted = order.map(i => selectedTypes[i]);
  const coverageSorted = order.map(i => coverage[i]);
  selected.splice(0, selected.length, ...selectedSorted);
  selectedTypes.splice(0, selectedTypes.length, ...typesSorted);

  // Photographic Color Name Generator using both HSL, RGB range, and CIELAB chroma
  // Distinguishes deep rich chromatic tones (e.g. burgundy, espresso, navy, olive) from true neutral black
  const getColorName = (hsl: HslColor, r: number, g: number, b: number, chroma: number): string => {
    const { h, s, l } = hsl;
    const maxVal = Math.max(r, g, b);
    const minVal = Math.min(r, g, b);
    const rgbRange = maxVal - minVal;

    // 1. Extreme Highlights & Off-Whites (L >= 75)
    if (l >= 90 && (rgbRange <= 18 || chroma <= 10)) return 'Crisp White';
    if (l >= 78 && (rgbRange <= 30 || chroma <= 18)) {
      if (h >= 25 && h <= 65) return 'Ivory / Cream';
      return 'Off-White / Pearl';
    }

    // 2. Pure Black vs Deep Chromatic Shadows (L <= 24)
    // A tone is chromatic if it has saturation, visible RGB spread, or CIELAB chroma
    const isChromaticDark = (s >= 35 || rgbRange >= 12 || chroma >= 8);
    if (l <= 7 && !isChromaticDark) return 'Pitch Black / Deep Shadow';
    if (l <= 20 && !isChromaticDark) return l <= 14 ? 'Deep Shadow / Black' : 'Charcoal / Onyx';

    // Deep Chromatic Tones (L <= 24 with rich hue/saturation, like #470302 or #160F08)
    if (l <= 24 && isChromaticDark) {
      if (h >= 345 || h < 15) return s > 65 ? 'Deep Burgundy / Crimson' : 'Dark Maroon / Russet';
      if (h >= 15 && h < 45) return s >= 35 ? 'Deep Espresso / Dark Umber' : 'Dark Chestnut / Warm Shadow';
      if (h >= 45 && h < 70) return 'Deep Olive / Dark Bronze';
      if (h >= 70 && h < 165) return 'Dark Forest Green / Pine';
      if (h >= 165 && h < 195) return 'Deep Teal / Dark Cyan';
      if (h >= 195 && h < 255) return 'Midnight Navy / Deep Indigo';
      if (h >= 255 && h < 290) return 'Deep Plum / Dark Eggplant';
      if (h >= 290 && h < 345) return 'Dark Wine / Berry';
    }

    // 3. Midtone Neutrals (S <= 18% or low rgbRange / chroma)
    if (rgbRange <= 18 || chroma <= 12 || s <= 14) {
      if (l <= 25) return 'Charcoal / Slate';
      if (l > 58) return 'Platinum / Light Gray';
      return 'Neutral Gray';
    }
    if (rgbRange <= 32 && l >= 45 && h >= 20 && h <= 60 && s <= 25) return 'Warm Sand / Taupe';

    // 4. Midtone Chromatics (L > 24)
    if (h >= 345 || h < 15) return s > 60 ? 'Crimson Red' : 'Rust Terracotta';
    if (h >= 15 && h < 45) return s > 60 ? 'Vivid Amber / Orange' : 'Warm Ochre';
    if (h >= 45 && h < 70) return s > 60 ? 'Golden Yellow' : 'Soft Khaki';
    if (h >= 70 && h < 165) return s > 60 ? 'Emerald Leaf Green' : 'Moss Olive';
    if (h >= 165 && h < 195) return s > 60 ? 'Electric Cyan' : 'Aqua Teal';
    if (h >= 195 && h < 255) return s > 60 ? 'Cobalt Sky Blue' : 'Steel Slate Blue';
    if (h >= 255 && h < 290) return s > 60 ? 'Royal Purple' : 'Moody Mauve';
    if (h >= 290 && h < 345) return s > 60 ? 'Neon Magenta' : 'Rose Quartz';
    return 'Chromatic Tone';
  };

  const dominantColors: DominantColor[] = selected.map((c, i) => {
    const pct = Number(((coverageSorted[i] / sumCount) * 100).toFixed(1));
    let toneCategory: DominantColor['toneCategory'] = 'Midtone';
    const rgbRange = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);

    if (c.hsl.l >= 74) toneCategory = 'Highlight';
    else if (c.hsl.l <= 24) toneCategory = 'Shadow';
    else if (c.chroma >= 38 || (c.hsl.s >= 60 && rgbRange >= 45)) toneCategory = 'Vibrant Accent';
    else if (c.hsl.s <= 20 || rgbRange <= 22 || c.chroma <= 12) toneCategory = 'Muted Neutral';

    return {
      id: i + 1,
      hex: c.hex,
      rgb: { r: c.r, g: c.g, b: c.b },
      hsl: c.hsl,
      percentage: pct,
      pixelCount: coverageSorted[i],
      label: getColorName(c.hsl, c.r, c.g, c.b, c.chroma),
      toneCategory,
      sampleX: c.x,
      sampleY: c.y,
      significanceType: selectedTypes[i],
      significanceScore: Math.round(c.compositeScore * 100)
    };
  });

  // Step 6: Extract Color Tones (Highlights, Midtones, Shadows, Vibrant, Muted)
  let highlight: DominantColor | null = null;
  let shadow: DominantColor | null = null;
  let vibrant: DominantColor | null = null;
  let muted: DominantColor | null = null;
  let midtone: DominantColor | null = null;

  if (dominantColors.length > 0) {
    // Highlight = Highest Lightness
    highlight = [...dominantColors].sort((a, b) => b.hsl.l - a.hsl.l)[0];
    // Shadow = Lowest Lightness
    shadow = [...dominantColors].sort((a, b) => a.hsl.l - b.hsl.l)[0];
    // Vibrant = Highest Chroma/Saturation
    vibrant = [...dominantColors].sort((a, b) => b.hsl.s - a.hsl.s)[0];
    // Muted = Lowest Saturation
    muted = [...dominantColors].sort((a, b) => a.hsl.s - b.hsl.s)[0];
    // Midtone = Closest to 50% Lightness, distinct from highlight/shadow if possible
    midtone = [...dominantColors].sort((a, b) => Math.abs(a.hsl.l - 50) - Math.abs(b.hsl.l - 50))[0];
  }

  // Step 7: Overall Photo Tonal & Scheme Analysis
  let warmScore = 0;
  let coolScore = 0;
  let totalSat = 0;

  dominantColors.forEach(c => {
    const h = c.hsl.h;
    // Warm = red through yellow-orange. Yellow-greens (hue ~60-90) are foliage, not warm light.
    const isWarm = (h >= 0 && h <= 60) || h >= 330;
    const isCool = h >= 140 && h <= 270;
    if (isWarm) warmScore += c.percentage;
    if (isCool) coolScore += c.percentage;
    totalSat += (c.hsl.s * c.percentage) / 100;
  });

  const tempDiff = warmScore - coolScore;
  let temperature: AutoAnalysisResult['temperature'] = 'Balanced Neutral';
  if (tempDiff > 18) temperature = 'Warm';
  else if (tempDiff < -18) temperature = 'Cool';

  const hiL = highlight?.hsl.l || 80;
  const shL = shadow?.hsl.l || 20;
  const contrastRatio = Number(((hiL + 5) / (shL + 5)).toFixed(2));

  let contrastLevel: AutoAnalysisResult['contrastLevel'] = 'Balanced Contrast';
  if (contrastRatio > 4.5 || (hiL - shL) > 65) contrastLevel = 'High Dynamic Contrast';
  else if (contrastRatio < 2.2 || (hiL - shL) < 35) contrastLevel = 'Soft / Low Key';

  const avgSaturation = Math.round(totalSat);
  let saturationLevel: AutoAnalysisResult['saturationLevel'] = 'Natural Richness';
  if (avgSaturation > 60) saturationLevel = 'Vibrant & Punchy';
  else if (avgSaturation < 32) saturationLevel = 'Moody & Desaturated';

  const recommendedScheme = `${temperature} ${saturationLevel} with ${contrastLevel}`;

  return {
    dominantColors,
    tones: { highlight, midtone, shadow, vibrant, muted },
    temperature,
    temperatureScore: Math.round(tempDiff),
    contrastLevel,
    contrastRatio,
    saturationLevel,
    avgSaturation,
    recommendedScheme
  };
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