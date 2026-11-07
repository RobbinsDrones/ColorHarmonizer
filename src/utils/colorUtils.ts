import { 
  ColorMarker, HarmonyDetectionResult, HarmonyRule, HslColor, 
  NudgeSuggestion, RgbColor, AutoAnalysisResult, DominantColor 
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

// Auto Color & Tone Extraction Algorithm
// Auto Color & Tone Extraction Algorithm:
// Balances dominant overall pixel distribution with visually significant colors
// (such as clothing, flowers, animals, prominent subjects, and high-chroma accents)
// while preventing duplicate/nearly identical shades.
export const extractPhotoColorsAndTones = (
  img: HTMLImageElement,
  targetCount: number = 6
): AutoAnalysisResult => {
  const canvas = document.createElement('canvas');
  // Scale down to 180px on the longest side to preserve fine prominent subjects
  // (flowers, clothing items, eyes, accessories, neon signs) without performance lag
  const maxDim = 180;
  const naturalW = img.naturalWidth || img.width || 800;
  const naturalH = img.naturalHeight || img.height || 600;
  const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
  const w = Math.max(40, Math.floor(naturalW * scale));
  const h = Math.max(40, Math.floor(naturalH * scale));
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

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const totalPixels = w * h;

  // Step 1: Bucket pixels by quantized 15-bit color (5 bits per channel)
  // and compute global image statistics (mean RGB, mean lightness, mean saturation)
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
  const meanR = totalR / effectivePixels;
  const meanG = totalG / effectivePixels;
  const meanB = totalB / effectivePixels;
  const meanHsl = rgbToHsl(Math.round(meanR), Math.round(meanG), Math.round(meanB));

  // Step 2: Perceptual distance function that accounts for weighted RGB and chromatic hue separation
  const perceptualDist = (
    c1: { r: number; g: number; b: number; hsl: HslColor },
    c2: { r: number; g: number; b: number; hsl: HslColor }
  ) => {
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    // Human eye luminance sensitivity weights (Rec. 601)
    const rgbDist = Math.sqrt(dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114);

    // If both colors have chromatic saturation, hue difference matters significantly
    if (c1.hsl.s > 18 && c2.hsl.s > 18 && c1.hsl.l > 12 && c2.hsl.l > 12 && c1.hsl.l < 92 && c2.hsl.l < 92) {
      const hDiff = Math.abs(angleDiff(c1.hsl.h, c2.hsl.h)); // 0 - 180
      const hueWeight = (hDiff / 180) * 42;
      return rgbDist * 0.72 + hueWeight;
    }
    return rgbDist;
  };

  interface CandidateCluster {
    r: number;
    g: number;
    b: number;
    x: number;
    y: number;
    hex: string;
    hsl: HslColor;
    count: number;
    weight: number;
    dominanceScore: number;
    saliencyScore: number;
    compositeScore: number;
  }

  // Convert buckets to preliminary clusters, filtering out single-pixel sensor noise
  const minNoiseThreshold = Math.max(4, Math.floor(effectivePixels * 0.0006));
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
      return {
        r, g, b: bCol, x, y, hex, hsl,
        count: b.count,
        weight: b.count,
        dominanceScore: 0,
        saliencyScore: 0,
        compositeScore: 0
      };
    });

  // Sort raw clusters initially by count
  rawClusters.sort((a, b) => b.count - a.count);

  // Step 3: Initial fine merge to group micro-shades (avoid fragmentation)
  const merged: CandidateCluster[] = [];
  for (const cand of rawClusters) {
    let matched = false;
    for (const m of merged) {
      if (perceptualDist(cand, m) < 18) {
        // Merge into existing cluster
        const totalCount = m.count + cand.count;
        m.r = Math.round((m.r * m.count + cand.r * cand.count) / totalCount);
        m.g = Math.round((m.g * m.count + cand.g * cand.count) / totalCount);
        m.b = Math.round((m.b * m.count + cand.b * cand.count) / totalCount);
        m.x = Number(((m.x * m.count + cand.x * cand.count) / totalCount).toFixed(1));
        m.y = Number(((m.y * m.count + cand.y * cand.count) / totalCount).toFixed(1));
        m.hex = rgbToHex(m.r, m.g, m.b);
        m.hsl = rgbToHsl(m.r, m.g, m.b);
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

  // Step 4: Compute Visual Prominence & Dominance Scores for each cluster
  // Combines:
  // - Dominance (pixel count with square-root dampening so massive backgrounds don't drown out key subjects)
  // - Chromatic Vibrancy (saturation and chromatic purity: flowers, clothing, signs, animals)
  // - Contrast against Image Mean (pops out against environmental background)
  // - Tonal Keynotes (highlight / shadow dynamic boundaries)
  for (const c of merged) {
    const pFrac = c.count / effectivePixels;
    // 1. Dominance score: dampened power curve
    c.dominanceScore = Math.min(1, Math.sqrt(pFrac) * 1.6);

    // 2. Chromatic Vibrancy score
    const satNorm = c.hsl.s / 100;
    // Midtones have maximum pure chroma impact; extreme dark or white lacks pure hue
    const lightnessCenterFactor = 1 - Math.min(1, Math.abs(c.hsl.l - 50) / 52);
    const chromaImpact = Math.pow(satNorm, 1.25) * Math.pow(Math.max(0.1, lightnessCenterFactor), 0.5);

    // 3. Contrast against average background color
    const distFromMean = perceptualDist(c, { r: meanR, g: meanG, b: meanB, hsl: meanHsl });
    const contrastImpact = Math.min(1, distFromMean / 130);

    // 4. Subject prominence factor:
    // A small cluster (e.g. 0.5% - 5%) that is vibrant or highly contrasting represents a distinct subject
    // (clothing, flowers, animals, signs, architectural details)
    let subjectBoost = 0;
    if (c.hsl.s >= 35 && pFrac >= 0.002 && pFrac <= 0.20) {
      subjectBoost = (c.hsl.s / 100) * 0.45;
    }

    // 5. Dynamic range boundary (highlight / shadow)
    let tonalExtreme = 0;
    if (c.hsl.l >= 82) tonalExtreme = ((c.hsl.l - 82) / 18) * 0.3;
    else if (c.hsl.l <= 16) tonalExtreme = ((16 - c.hsl.l) / 16) * 0.3;

    c.saliencyScore = Math.min(1, chromaImpact * 0.45 + contrastImpact * 0.25 + subjectBoost * 0.20 + tonalExtreme * 0.10);

    // Composite Score: 38% Dominance + 62% Visual Saliency / Subject Prominence
    c.compositeScore = c.dominanceScore * 0.38 + c.saliencyScore * 0.62;
  }

  // Step 5: Multi-Role Diverse Palette Selection (MMR / Maximal Marginal Relevance)
  // Avoids selecting multiple nearly identical shades and preserves distinct accents!
  const selected: CandidateCluster[] = [];
  const selectedTypes: Array<'Dominant Base' | 'Vibrant Accent' | 'Key Highlight' | 'Deep Shadow' | 'Harmonic Tone'> = [];

  // Slot 1: Primary Environmental Dominant Base
  // Find the cluster with highest count that has broad presence
  const sortedByCount = [...merged].sort((a, b) => b.count - a.count);
  const primaryDominant = sortedByCount[0];
  if (primaryDominant) {
    selected.push(primaryDominant);
    selectedTypes.push('Dominant Base');
  }

  // Slot 2: Primary Visual Subject / Vibrant Accent
  // Pick the most visually salient / vibrant cluster that is perceptually distinct from the dominant base
  const sortedBySaliency = [...merged]
    .filter(c => selected.every(s => perceptualDist(c, s) >= 32))
    .sort((a, b) => b.saliencyScore - a.saliencyScore);

  if (sortedBySaliency.length > 0 && sortedBySaliency[0].hsl.s >= 25) {
    selected.push(sortedBySaliency[0]);
    selectedTypes.push('Vibrant Accent');
  }

  // Slots 3 to targetCount: Iterative Diverse Selection with Distance Penalties
  // Strictly avoids selecting nearly identical shades (min distance threshold 26)
  while (selected.length < targetCount && selected.length < merged.length) {
    let bestCand: CandidateCluster | null = null;
    let bestScore = -Infinity;

    for (const cand of merged) {
      if (selected.some(s => s.hex === cand.hex)) continue;

      // Distance to closest already selected color
      const minDist = Math.min(...selected.map(s => perceptualDist(cand, s)));

      // If nearly identical to an existing selection (< 26), reject it
      if (minDist < 26) continue;

      // Distance diversity factor: favors colors that explore fresh areas of the color wheel
      const diversityFactor = Math.min(1.4, Math.max(0.2, minDist / 42));

      // Calculate MMR utility
      const utility = cand.compositeScore * diversityFactor;

      if (utility > bestScore) {
        bestScore = utility;
        bestCand = cand;
      }
    }

    if (!bestCand) {
      // If threshold was too strict, lower threshold slightly to fill slots
      for (const cand of merged) {
        if (selected.some(s => s.hex === cand.hex)) continue;
        const minDist = Math.min(...selected.map(s => perceptualDist(cand, s)));
        if (minDist >= 18) {
          bestCand = cand;
          break;
        }
      }
    }

    if (!bestCand) break;

    // Determine type for this selected candidate
    let role: 'Dominant Base' | 'Vibrant Accent' | 'Key Highlight' | 'Deep Shadow' | 'Harmonic Tone' = 'Harmonic Tone';
    if (bestCand.hsl.s >= 55) {
      role = 'Vibrant Accent';
    } else if (bestCand.hsl.l >= 78) {
      role = 'Key Highlight';
    } else if (bestCand.hsl.l <= 18) {
      role = 'Deep Shadow';
    } else if (bestCand.count / effectivePixels > 0.18) {
      role = 'Dominant Base';
    }

    selected.push(bestCand);
    selectedTypes.push(role);
  }

  // Guarantee Tonal Range Check:
  // If the photograph has a prominent highlight or shadow not yet represented, ensure balance
  const hasHighlight = selected.some(s => s.hsl.l >= 72);
  const candidateHighlight = merged.find(c => c.hsl.l >= 75 && c.count >= effectivePixels * 0.003 && selected.every(s => perceptualDist(c, s) >= 22));
  if (!hasHighlight && candidateHighlight && selected.length >= targetCount) {
    const replaceIdx = selected.findIndex((_, idx) => selectedTypes[idx] === 'Harmonic Tone');
    if (replaceIdx !== -1) {
      selected[replaceIdx] = candidateHighlight;
      selectedTypes[replaceIdx] = 'Key Highlight';
    }
  }

  const hasShadow = selected.some(s => s.hsl.l <= 22);
  const candidateShadow = merged.find(c => c.hsl.l <= 20 && c.count >= effectivePixels * 0.003 && selected.every(s => perceptualDist(c, s) >= 22));
  if (!hasShadow && candidateShadow && selected.length >= targetCount) {
    const replaceIdx = selected.findIndex((_, idx) => selectedTypes[idx] === 'Harmonic Tone');
    if (replaceIdx !== -1) {
      selected[replaceIdx] = candidateShadow;
      selectedTypes[replaceIdx] = 'Deep Shadow';
    }
  }

  // Calculate percentage share among chosen palette
  const sumCount = selected.reduce((acc, curr) => acc + curr.count, 0) || effectivePixels;

  // Name Generator for colors
  const getColorName = (hsl: HslColor): string => {
    const { h, s, l } = hsl;
    if (l < 15) return 'Deep Shadow';
    if (l > 88 && s < 20) return 'Highlight White';
    if (s < 12) return l > 50 ? 'Pale Gray' : 'Charcoal Slate';

    if (h >= 345 || h < 15) return s > 60 ? 'Crimson Red' : 'Rust Terracotta';
    if (h >= 15 && h < 45) return s > 60 ? 'Vivid Amber / Orange' : 'Warm Sand Ochre';
    if (h >= 45 && h < 70) return s > 60 ? 'Golden Yellow' : 'Soft Khaki';
    if (h >= 70 && h < 165) return s > 60 ? 'Emerald Leaf Green' : 'Moss Olive';
    if (h >= 165 && h < 195) return s > 60 ? 'Electric Cyan' : 'Aqua Teal';
    if (h >= 195 && h < 255) return s > 60 ? 'Cobalt Sky Blue' : 'Steel Slate Blue';
    if (h >= 255 && h < 290) return s > 60 ? 'Royal Purple' : 'Moody Mauve';
    if (h >= 290 && h < 345) return s > 60 ? 'Neon Magenta' : 'Rose Quartz';
    return 'Chromatic Tone';
  };

  const dominantColors: DominantColor[] = selected.map((c, i) => {
    const pct = Number(((c.count / sumCount) * 100).toFixed(1));
    let toneCategory: DominantColor['toneCategory'] = 'Midtone';

    if (c.hsl.l >= 70) toneCategory = 'Highlight';
    else if (c.hsl.l <= 30) toneCategory = 'Shadow';
    else if (c.hsl.s >= 65) toneCategory = 'Vibrant Accent';
    else if (c.hsl.s <= 22) toneCategory = 'Muted Neutral';

    return {
      id: i + 1,
      hex: c.hex,
      rgb: { r: c.r, g: c.g, b: c.b },
      hsl: c.hsl,
      percentage: pct,
      pixelCount: c.count,
      label: getColorName(c.hsl),
      toneCategory,
      sampleX: c.x,
      sampleY: c.y,
      significanceType: selectedTypes[i],
      significanceScore: Math.round(c.compositeScore * 100)
    };
  });

  // Step 4: Extract Color Tones (Highlights, Midtones, Shadows, Vibrant, Muted)
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
    // Vibrant = Highest Saturation
    vibrant = [...dominantColors].sort((a, b) => b.hsl.s - a.hsl.s)[0];
    // Muted = Lowest Saturation
    muted = [...dominantColors].sort((a, b) => a.hsl.s - b.hsl.s)[0];
    // Midtone = Closest to 50% Lightness, distinct from highlight/shadow if possible
    midtone = [...dominantColors].sort((a, b) => Math.abs(a.hsl.l - 50) - Math.abs(b.hsl.l - 50))[0];
  }

  // Step 5: Overall Photo Tonal & Scheme Analysis
  let warmScore = 0;
  let coolScore = 0;
  let totalSat = 0;

  dominantColors.forEach(c => {
    const h = c.hsl.h;
    const isWarm = (h >= 0 && h <= 75) || h >= 330;
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
