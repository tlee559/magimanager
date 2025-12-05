// Text overlay types for Instagram-style text editor

export interface TextLayer {
  id: string;
  text: string;
  // Position (percentage of image dimensions, 0-100)
  x: number;
  y: number;
  // Transform
  rotation: number; // degrees, -180 to 180
  scale: number; // 0.5 to 3.0
  // Typography
  fontSize: number; // base px size (will scale with image)
  fontWeight: 400 | 500 | 600 | 700 | 800 | 900;
  color: string; // hex color
  textAlign: "left" | "center" | "right";
  // Background
  backgroundColor: string | null; // null = no background
  backgroundOpacity: number; // 0-1
  backgroundPadding: number; // px
  backgroundRadius: number; // px
  // Stroke/Outline
  strokeColor: string | null; // null = no stroke
  strokeWidth: number; // 0-10 px
  // Layer ordering
  zIndex: number;
}

export interface TextOverlayState {
  layers: TextLayer[];
  selectedLayerId: string | null;
}

// Default values for new text layers
export const DEFAULT_TEXT_LAYER: Omit<TextLayer, "id" | "zIndex"> = {
  text: "New Text",
  x: 50,
  y: 50,
  rotation: 0,
  scale: 1,
  fontSize: 48,
  fontWeight: 700,
  color: "#FFFFFF",
  textAlign: "center",
  backgroundColor: "#000000",
  backgroundOpacity: 0.5,
  backgroundPadding: 16,
  backgroundRadius: 8,
  strokeColor: null,
  strokeWidth: 0,
};

// API request/response types
export interface TextOverlayApiRequest {
  imageUrl: string;
  layers: TextLayer[];
}

export interface TextOverlayApiResponse {
  success: boolean;
  imageUrl: string;
}
