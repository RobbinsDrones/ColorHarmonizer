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

export interface DominantColor {
  id: number;
  hex: string;
  rgb: RgbColor;
  hsl: HslColor;
  percentage: number; // e.g. 38.5%
  pixelCount: number;
  label: string;
  toneCategory: 'Highlight' | 'Midtone' | 'Shadow' | 'Vibrant Accent' | 'Muted Neutral';
  sampleX: number; // estimated coordinate % on photo
  sampleY: number; // estimated coordinate % on photo
  significanceType?: 'Dominant Base' | 'Vibrant Accent' | 'Key Highlight' | 'Deep Shadow' | 'Harmonic Tone' | 'Subject Neutral';
  significanceScore?: number;
}

export interface ColorTones {
  highlight: DominantColor | null;
  midtone: DominantColor | null;
  shadow: DominantColor | null;
  vibrant: DominantColor | null;
  muted: DominantColor | null;
}

export interface AutoAnalysisResult {
  dominantColors: DominantColor[];
  tones: ColorTones;
  temperature: 'Warm' | 'Cool' | 'Balanced Neutral';
  temperatureScore: number; // -100 (very cool) to +100 (very warm)
  contrastLevel: 'High Dynamic Contrast' | 'Balanced Contrast' | 'Soft / Low Key';
  contrastRatio: number;
  saturationLevel: 'Vibrant & Punchy' | 'Natural Richness' | 'Moody & Desaturated';
  avgSaturation: number;
  recommendedScheme: string;
}

export type PhotographicMatte = 'gray50' | 'neutralDark' | 'charcoal' | 'black';
export type WorkspaceTheme = 'neutralGray' | 'gray50Studio' | 'darkSlate';
