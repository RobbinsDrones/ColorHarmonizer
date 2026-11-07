export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface ColorMarker {
  id: number;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  r: number;
  g: number;
  b: number;
  hex: string;
  hsl: HslColor;
  label: string;
  locked?: boolean;
}

export type HarmonyRule = 
  | 'auto' 
  | 'Monochromatic' 
  | 'Complementary' 
  | 'Split-Complementary' 
  | 'Analogous' 
  | 'Triadic' 
  | 'Tetradic';

export interface HarmonyDetectionResult {
  type: string;
  spread: number;
  primaryHue: number;
  score: number; // 0 to 100
  secondaryHues: number[];
  description: string;
}

export interface NudgeSuggestion {
  markerId: number;
  currentHue: number;
  targetHue: number;
  shift: number; // degrees (-180 to 180)
  isAligned: boolean;
  actionText: string;
}

export interface PresetPhoto {
  name: string;
  category: string;
  url: string;
  description: string;
  defaultPoints: Array<{ x: number; y: number; label: string }>;
}
