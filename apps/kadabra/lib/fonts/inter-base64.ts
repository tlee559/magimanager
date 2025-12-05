// Inter font embedded as base64 for server-side SVG rendering
// This ensures text renders correctly in serverless environments where system fonts aren't available

import fs from "fs";
import path from "path";

// Font weights we support
export type FontWeight = 400 | 500 | 600 | 700 | 800 | 900;

// Get the Inter font file path from node_modules
function getInterFontPath(weight: number): string {
  // Try to find the font in node_modules
  const possiblePaths = [
    path.join(process.cwd(), "node_modules/@fontsource/inter/files", `inter-latin-${weight}-normal.woff2`),
    path.join(process.cwd(), "../node_modules/@fontsource/inter/files", `inter-latin-${weight}-normal.woff2`),
    path.join(process.cwd(), "../../node_modules/@fontsource/inter/files", `inter-latin-${weight}-normal.woff2`),
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  throw new Error(`Inter font weight ${weight} not found`);
}

// Cache for loaded fonts
const fontCache: Map<number, string> = new Map();

/**
 * Load Inter font as base64 string for the given weight
 */
export function loadInterFontBase64(weight: FontWeight = 400): string {
  if (fontCache.has(weight)) {
    return fontCache.get(weight)!;
  }
  
  try {
    const fontPath = getInterFontPath(weight);
    const fontBuffer = fs.readFileSync(fontPath);
    const base64 = fontBuffer.toString("base64");
    fontCache.set(weight, base64);
    return base64;
  } catch (error) {
    console.error(`Failed to load Inter font weight ${weight}:`, error);
    // Return empty string - font won't render but won't crash
    return "";
  }
}

/**
 * Generate CSS @font-face rule for embedding in SVG
 */
export function createFontFaceCSS(weight: FontWeight = 700): string {
  const base64 = loadInterFontBase64(weight);
  if (!base64) return "";
  
  return `
    @font-face {
      font-family: 'Inter';
      src: url('data:font/woff2;base64,${base64}') format('woff2');
      font-weight: ${weight};
      font-style: normal;
    }
  `;
}

/**
 * Generate CSS for multiple font weights
 */
export function createMultiWeightFontFaceCSS(weights: FontWeight[]): string {
  return weights.map(w => createFontFaceCSS(w)).join("\n");
}
