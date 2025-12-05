"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Image as ImageIcon,
  Layers,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import { TextOverlayModal, TextLayer, TextPreviewOverlay } from "./text-overlay";

type Provider = "google-imagen" | "replicate-flux";
type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
type ViewMode = "generate" | "gallery";
type PresetCategory = "custom" | "google" | "meta" | "display";
type GenerationMode = "text" | "reference" | "composite";
type ProductPosition = "center" | "bottom" | "bottom-left" | "bottom-right";
type TextPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";
type FontWeight = "normal" | "bold";
type BackgroundCategory = "studio" | "lifestyle" | "abstract" | "outdoor" | "custom";
type BackgroundStyle = "minimal" | "elegant" | "bold" | "natural" | "modern";
type BackgroundMood = "bright" | "warm" | "cool" | "dramatic" | "neutral";
type EnhancementPreset = "none" | "clean" | "studio" | "dramatic";

// Enhancement presets for product compositing
const ENHANCEMENT_PRESETS: { value: EnhancementPreset; label: string; description: string }[] = [
  { value: "none", label: "None", description: "No effects" },
  { value: "clean", label: "Clean", description: "Soft shadow, light blur" },
  { value: "studio", label: "Studio", description: "Shadow, blur, vignette" },
  { value: "dramatic", label: "Dramatic", description: "Strong effects" },
];

// Prompt template system for product backgrounds
interface PromptTemplate {
  category: BackgroundCategory;
  style: BackgroundStyle;
  mood: BackgroundMood;
}

const BACKGROUND_CATEGORIES: { value: BackgroundCategory; label: string; description: string }[] = [
  { value: "studio", label: "Studio", description: "Clean professional backdrop" },
  { value: "lifestyle", label: "Lifestyle", description: "Real-world context" },
  { value: "abstract", label: "Abstract", description: "Artistic & creative" },
  { value: "outdoor", label: "Outdoor", description: "Nature & architecture" },
  { value: "custom", label: "Custom", description: "Write your own" },
];

const BACKGROUND_STYLES: { value: BackgroundStyle; label: string }[] = [
  { value: "minimal", label: "Clean & Minimal" },
  { value: "elegant", label: "Elegant & Luxurious" },
  { value: "bold", label: "Bold & Vibrant" },
  { value: "natural", label: "Natural & Organic" },
  { value: "modern", label: "Modern & Sleek" },
];

const BACKGROUND_MOODS: { value: BackgroundMood; label: string }[] = [
  { value: "bright", label: "Bright & Airy" },
  { value: "warm", label: "Warm & Cozy" },
  { value: "cool", label: "Cool & Calm" },
  { value: "dramatic", label: "Dramatic & Bold" },
  { value: "neutral", label: "Neutral & Balanced" },
];

// Generate prompt from template selections
function generatePromptFromTemplate(
  category: BackgroundCategory,
  style: BackgroundStyle,
  mood: BackgroundMood
): string {
  const categoryPrompts: Record<BackgroundCategory, string> = {
    studio: "Professional studio photography setup, seamless backdrop",
    lifestyle: "Lifestyle product photography in a real-world setting",
    abstract: "Abstract artistic background with creative elements",
    outdoor: "Outdoor setting with natural environment",
    custom: "",
  };

  const stylePrompts: Record<BackgroundStyle, string> = {
    minimal: "clean minimal aesthetic, simple composition, negative space",
    elegant: "luxury elegant styling, premium feel, sophisticated details",
    bold: "vibrant colors, eye-catching design, dynamic composition",
    natural: "organic textures, earthy tones, natural materials",
    modern: "contemporary design, sleek surfaces, geometric elements",
  };

  const moodPrompts: Record<BackgroundMood, string> = {
    bright: "bright airy lighting, soft shadows, high key",
    warm: "warm golden lighting, cozy atmosphere, inviting tones",
    cool: "cool blue tones, calm serene mood, soft diffused light",
    dramatic: "dramatic lighting, strong contrast, moody shadows",
    neutral: "balanced neutral lighting, even tones, professional",
  };

  if (category === "custom") return "";

  return `${categoryPrompts[category]}, ${stylePrompts[style]}, ${moodPrompts[mood]}, product photography, high quality, 8k`;
}

interface GeneratedImage {
  id: string;
  prompt: string;
  provider: string;
  aspectRatio: string;
  rawMode: boolean;
  imageUrl: string;
  isFavorite: boolean;
  createdAt: string;
  textLayers?: TextLayer[] | null; // Stored separately, not burned into image
}

interface AIImageGeneratorProps {
  onBack?: () => void;
}

const ASPECT_RATIOS: { value: AspectRatio; label: string; icon: string }[] = [
  { value: "1:1", label: "Square", icon: "□" },
  { value: "16:9", label: "Landscape", icon: "▭" },
  { value: "9:16", label: "Portrait", icon: "▯" },
  { value: "4:3", label: "Standard", icon: "▭" },
  { value: "3:4", label: "Photo", icon: "▯" },
];

// Ad platform presets with common sizes
interface AdPreset {
  id: string;
  name: string;
  aspectRatio: AspectRatio;
  description: string;
}

const AD_PRESETS: Record<PresetCategory, { label: string; color: string; presets: AdPreset[] }> = {
  custom: {
    label: "Custom",
    color: "slate",
    presets: [
      { id: "square", name: "Square", aspectRatio: "1:1", description: "Universal format" },
      { id: "landscape", name: "Landscape", aspectRatio: "16:9", description: "Wide format" },
      { id: "portrait", name: "Portrait", aspectRatio: "9:16", description: "Tall format" },
    ],
  },
  google: {
    label: "Google Ads",
    color: "blue",
    presets: [
      { id: "google-square", name: "Square", aspectRatio: "1:1", description: "Responsive display" },
      { id: "google-landscape", name: "Landscape", aspectRatio: "16:9", description: "YouTube, Display" },
      { id: "google-portrait", name: "Portrait", aspectRatio: "9:16", description: "Demand Gen" },
    ],
  },
  meta: {
    label: "Meta Ads",
    color: "indigo",
    presets: [
      { id: "meta-feed", name: "Feed", aspectRatio: "1:1", description: "FB/IG Feed" },
      { id: "meta-story", name: "Story/Reel", aspectRatio: "9:16", description: "Stories & Reels" },
      { id: "meta-carousel", name: "Carousel", aspectRatio: "1:1", description: "Multi-image ads" },
    ],
  },
  display: {
    label: "Display",
    color: "emerald",
    presets: [
      { id: "display-leaderboard", name: "Leaderboard", aspectRatio: "16:9", description: "728x90 style" },
      { id: "display-skyscraper", name: "Skyscraper", aspectRatio: "9:16", description: "160x600 style" },
      { id: "display-rectangle", name: "Rectangle", aspectRatio: "4:3", description: "300x250 style" },
    ],
  },
};

export function AIImageGenerator({ onBack }: AIImageGeneratorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("generate");
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<Provider>("google-imagen");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [imageCount, setImageCount] = useState(1);
  const [rawMode, setRawMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [savedImageIds, setSavedImageIds] = useState<Map<number, string>>(new Map()); // index -> database ID

  // Preset state
  const [presetCategory, setPresetCategory] = useState<PresetCategory>("custom");
  const [selectedPreset, setSelectedPreset] = useState<string>("square");
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);

  // Generation mode state
  const [generationMode, setGenerationMode] = useState<GenerationMode>("text");

  // Reference image state (for reference mode)
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  // Product composite state
  const [productImage, setProductImage] = useState<string | null>(null);
  const [transparentProductUrl, setTransparentProductUrl] = useState<string | null>(null);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [productPosition, setProductPosition] = useState<ProductPosition>("center");
  const [productScale, setProductScale] = useState(0.6);
  const [isCompositing, setIsCompositing] = useState(false);
  const [enableBgOverlay, setEnableBgOverlay] = useState(false);
  const [bgOverlayColor, setBgOverlayColor] = useState("#000000");
  const [bgOverlayOpacity, setBgOverlayOpacity] = useState(0.5);

  // Prompt template state (for composite mode)
  const [bgCategory, setBgCategory] = useState<BackgroundCategory>("studio");
  const [bgStyle, setBgStyle] = useState<BackgroundStyle>("minimal");
  const [bgMood, setBgMood] = useState<BackgroundMood>("bright");
  const [enhancementPreset, setEnhancementPreset] = useState<EnhancementPreset>("clean");

  // Text overlay modal state
  const [showTextOverlayModal, setShowTextOverlayModal] = useState(false);
  const [isApplyingText, setIsApplyingText] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Text layers per generated image (index -> layers)
  // These are stored separately and only burned in on export/download
  const [imageTextLayers, setImageTextLayers] = useState<Map<number, TextLayer[]>>(new Map());

  // Gallery state
  const [galleryImages, setGalleryImages] = useState<GeneratedImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<GeneratedImage | null>(null);

  // Load gallery images
  useEffect(() => {
    if (viewMode === "gallery") {
      loadGalleryImages();
    }
  }, [viewMode, showFavoritesOnly]);

  // Initialize prompt when entering composite mode with a product
  useEffect(() => {
    if (generationMode === "composite" && transparentProductUrl && !prompt && bgCategory !== "custom") {
      setPrompt(generatePromptFromTemplate(bgCategory, bgStyle, bgMood));
    }
  }, [generationMode, transparentProductUrl, bgCategory, bgStyle, bgMood]);

  const loadGalleryImages = async () => {
    setGalleryLoading(true);
    try {
      const params = new URLSearchParams();
      if (showFavoritesOnly) params.set("favorites", "true");
      params.set("limit", "100");

      const response = await fetch(`/api/ai/images?${params}`);
      const data = await response.json();

      if (response.ok) {
        setGalleryImages(data.images);
      }
    } catch (err) {
      console.error("Failed to load gallery:", err);
    } finally {
      setGalleryLoading(false);
    }
  };

  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setReferenceImage(event.target?.result as string);
      setGenerationMode("reference");
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const clearReferenceImage = () => {
    setReferenceImage(null);
  };

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const imageData = event.target?.result as string;
      setProductImage(imageData);
      setTransparentProductUrl(null);
      setError(null);

      // Automatically remove background
      setIsRemovingBackground(true);
      try {
        const response = await fetch("/api/ai/remove-background", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: imageData }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to remove background");
        }

        setTransparentProductUrl(data.transparentUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Background removal failed");
      } finally {
        setIsRemovingBackground(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBackground = async () => {
    if (!productImage) return;

    setIsRemovingBackground(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/remove-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: productImage }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove background");
      }

      setTransparentProductUrl(data.transparentUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Background removal failed");
    } finally {
      setIsRemovingBackground(false);
    }
  };

  const clearProductImage = () => {
    setProductImage(null);
    setTransparentProductUrl(null);
  };

  const handleComposite = async (backgroundUrl: string) => {
    if (!transparentProductUrl) return;

    setIsCompositing(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/composite-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backgroundUrl,
          productUrl: transparentProductUrl,
          position: productPosition,
          scale: productScale,
          overlayColor: bgOverlayOpacity > 0 ? bgOverlayColor : undefined,
          overlayOpacity: bgOverlayOpacity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to composite image");
      }

      // Add composite to generated images
      setGeneratedImages((prev) => [...prev, data.compositeUrl]);
      setCurrentImageIndex(generatedImages.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compositing failed");
    } finally {
      setIsCompositing(false);
    }
  };

  // Handle text overlay from modal - stores layers WITHOUT burning into image
  const handleApplyTextOverlay = async (layers: TextLayer[]) => {
    // Store layers for this image index (not burned in yet)
    setImageTextLayers((prev) => {
      const updated = new Map(prev);
      if (layers.length > 0) {
        updated.set(currentImageIndex, layers);
      } else {
        updated.delete(currentImageIndex);
      }
      return updated;
    });

    // If this image is already saved, update text layers in database
    const savedId = savedImageIds.get(currentImageIndex);
    if (savedId) {
      try {
        await fetch(`/api/ai/images/${savedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            textLayers: layers.length > 0 ? layers : null,
          }),
        });
      } catch (err) {
        console.error("Failed to update text layers:", err);
      }
    }

    // Close modal
    setShowTextOverlayModal(false);
  };

  // Get current text layers for the active image
  const getCurrentTextLayers = (): TextLayer[] => {
    return imageTextLayers.get(currentImageIndex) || [];
  };

  // Export/Download with text burned in
  const handleExportWithText = async () => {
    const currentImg = generatedImages[currentImageIndex];
    const layers = getCurrentTextLayers();

    if (!currentImg) return;

    setIsExporting(true);
    setError(null);

    try {
      // If no text layers, just download the original image
      if (layers.length === 0) {
        await handleDownload(currentImg);
        return;
      }

      // Burn text into image via API
      const response = await fetch("/api/ai/export-with-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: currentImg,
          layers: layers,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to export with text");
      }

      // Download the exported image
      await handleDownload(data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  // Get current preset details
  const getCurrentPreset = (): AdPreset | undefined => {
    return AD_PRESETS[presetCategory].presets.find((p) => p.id === selectedPreset);
  };

  // Handle preset selection
  const handlePresetSelect = (category: PresetCategory, presetId: string) => {
    const preset = AD_PRESETS[category].presets.find((p) => p.id === presetId);
    if (preset) {
      setPresetCategory(category);
      setSelectedPreset(presetId);
      setAspectRatio(preset.aspectRatio);
      setShowPresetDropdown(false);
    }
  };

  const handleGenerate = async () => {
    // Validate based on mode
    if (generationMode === "text" && !prompt.trim()) return;
    if (generationMode === "reference" && !referenceImage) return;
    if (generationMode === "composite" && !prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    // Don't clear images in composite mode - we append
    if (generationMode !== "composite") {
      setGeneratedImages([]);
      setCurrentImageIndex(0);
      setSavedIndices(new Set());
      setSavedImageIds(new Map());
      setImageTextLayers(new Map());
    }

    try {
      const requestBody =
        generationMode === "reference"
          ? {
              referenceImageUrl: referenceImage,
              aspectRatio,
              imageCount,
            }
          : {
              prompt: prompt.trim(),
              provider,
              aspectRatio,
              imageCount,
              rawMode: provider === "replicate-flux" ? rawMode : undefined,
            };

      const response = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate image");
      }

      const newImages = data.imageUrls || [];

      // In composite mode, auto-composite each generated background
      if (generationMode === "composite" && transparentProductUrl && newImages.length > 0) {
        setIsCompositing(true);
        const composites: string[] = [];

        for (const bgUrl of newImages) {
          try {
            const compositeResponse = await fetch("/api/ai/composite-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                backgroundUrl: bgUrl,
                productUrl: transparentProductUrl,
                position: productPosition,
                scale: productScale,
                overlayColor: enableBgOverlay ? bgOverlayColor : undefined,
                overlayOpacity: enableBgOverlay ? bgOverlayOpacity : 0,
                enhancementPreset,
              }),
            });

            const compositeData = await compositeResponse.json();
            if (compositeResponse.ok && compositeData.compositeUrl) {
              composites.push(compositeData.compositeUrl);
            }
          } catch {
            // Continue with other images if one fails
          }
        }

        setGeneratedImages(composites);
        setCurrentImageIndex(0);
        setSavedIndices(new Set());
        setIsCompositing(false);
      } else {
        setGeneratedImages(newImages);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGenerating(false);
      setIsCompositing(false);
    }
  };

  const handleSaveImage = async (index: number) => {
    const imageUrl = generatedImages[index];
    if (!imageUrl || savedIndices.has(index)) return;

    setSavingIndex(index);
    try {
      let savePrompt = prompt;
      let saveProvider = provider;

      if (generationMode === "reference") {
        savePrompt = "Reference image variation";
        saveProvider = "replicate-flux-redux" as Provider;
      } else if (generationMode === "composite") {
        savePrompt = `Product composite: ${prompt}`;
      }

      // Get text layers for this image (if any)
      const layers = imageTextLayers.get(index);

      const response = await fetch("/api/ai/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: savePrompt,
          provider: saveProvider,
          aspectRatio,
          rawMode: generationMode === "text" && provider === "replicate-flux" ? rawMode : false,
          imageUrl,
          // Save text layers separately (not burned into image)
          textLayers: layers && layers.length > 0 ? layers : null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSavedIndices((prev) => new Set([...prev, index]));
        // Store the database ID so we can update text layers later
        if (data.image?.id) {
          setSavedImageIds((prev) => {
            const updated = new Map(prev);
            updated.set(index, data.image.id);
            return updated;
          });
        }
      }
    } catch (err) {
      console.error("Failed to save image:", err);
    } finally {
      setSavingIndex(null);
    }
  };

  const handleSaveAll = async () => {
    for (let i = 0; i < generatedImages.length; i++) {
      if (!savedIndices.has(i)) {
        await handleSaveImage(i);
      }
    }
  };

  const handleToggleFavorite = async (image: GeneratedImage) => {
    try {
      const response = await fetch(`/api/ai/images/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !image.isFavorite }),
      });

      if (response.ok) {
        setGalleryImages((prev) =>
          prev.map((img) =>
            img.id === image.id ? { ...img, isFavorite: !img.isFavorite } : img
          )
        );
        if (selectedGalleryImage?.id === image.id) {
          setSelectedGalleryImage({ ...image, isFavorite: !image.isFavorite });
        }
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  const handleDeleteImage = async (image: GeneratedImage) => {
    if (!confirm("Delete this image?")) return;

    try {
      const response = await fetch(`/api/ai/images/${image.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setGalleryImages((prev) => prev.filter((img) => img.id !== image.id));
        if (selectedGalleryImage?.id === image.id) {
          setSelectedGalleryImage(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete image:", err);
    }
  };

  const handleDownload = async (imageUrl?: string) => {
    const url = imageUrl || generatedImages[currentImageIndex];
    if (!url) return;

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `ai-generated-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError("Failed to download image");
    }
  };

  const handleDownloadAll = async () => {
    for (let i = 0; i < generatedImages.length; i++) {
      await handleDownload(generatedImages[i]);
      if (i < generatedImages.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  };

  const currentImage = generatedImages[currentImageIndex];

  const getAspectClass = (ar?: string) => {
    const ratio = ar || aspectRatio;
    switch (ratio) {
      case "16:9":
        return "aspect-video";
      case "9:16":
        return "aspect-[9/16] max-h-[500px]";
      case "4:3":
        return "aspect-[4/3]";
      case "3:4":
        return "aspect-[3/4] max-h-[500px]";
      default:
        return "aspect-square";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-800 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-100">
              AI Image Generator
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {generationMode === "reference"
                ? "Generate variations from a reference image"
                : generationMode === "composite"
                  ? "Place product on AI-generated backgrounds"
                  : "Generate images from text descriptions"}
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 bg-slate-800/50 rounded-lg p-1">
          <button
            onClick={() => setViewMode("generate")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              viewMode === "generate"
                ? "bg-slate-700 text-slate-200"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Generate
          </button>
          <button
            onClick={() => setViewMode("gallery")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              viewMode === "gallery"
                ? "bg-slate-700 text-slate-200"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Gallery
          </button>
        </div>
      </div>

      {viewMode === "generate" ? (
        /* Generate View */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 space-y-5">
            {/* Mode Toggle */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Generation Mode
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setGenerationMode("text");
                    setReferenceImage(null);
                  }}
                  disabled={isGenerating}
                  className={`flex-1 py-2 px-3 rounded-lg border transition text-sm font-medium ${
                    generationMode === "text"
                      ? "bg-slate-700 border-slate-500 text-slate-200"
                      : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  Text to Image
                </button>
                <button
                  onClick={() => setGenerationMode("reference")}
                  disabled={isGenerating}
                  className={`flex-1 py-2 px-3 rounded-lg border transition text-sm font-medium ${
                    generationMode === "reference"
                      ? "bg-orange-600/20 border-orange-500/50 text-orange-400"
                      : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  Reference
                </button>
                <button
                  onClick={() => setGenerationMode("composite")}
                  disabled={isGenerating}
                  className={`flex-1 py-2 px-3 rounded-lg border transition text-sm font-medium flex items-center justify-center gap-1.5 ${
                    generationMode === "composite"
                      ? "bg-teal-600/20 border-teal-500/50 text-teal-400"
                      : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  Product
                </button>
              </div>
            </div>

            {/* Reference Image Upload (when in reference mode) */}
            {generationMode === "reference" && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Upload Reference Image
                </label>
                {referenceImage ? (
                  <div className="relative">
                    <div className="aspect-video bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
                      <img
                        src={referenceImage}
                        alt="Reference"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <button
                      onClick={clearReferenceImage}
                      disabled={isGenerating}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full transition"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                    <p className="text-xs text-slate-500 mt-2">
                      FLUX Redux will generate variations of this image
                    </p>
                  </div>
                ) : (
                  <label className="block cursor-pointer">
                    <div className="flex flex-col items-center justify-center h-32 bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-lg hover:border-slate-600 transition">
                      <Upload className="w-8 h-8 text-slate-500 mb-2" />
                      <span className="text-sm text-slate-400">
                        Click to upload or drag & drop
                      </span>
                      <span className="text-xs text-slate-500 mt-1">
                        PNG, JPG up to 10MB
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReferenceImageUpload}
                      className="hidden"
                      disabled={isGenerating}
                    />
                  </label>
                )}
              </div>
            )}

            {/* Product Composite Mode */}
            {generationMode === "composite" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    1. Upload Product Image
                  </label>
                  {productImage ? (
                    <div className="relative">
                      <div className="grid grid-cols-2 gap-3">
                        {/* Original */}
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Original</p>
                          <div className="aspect-square bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
                            <img
                              src={productImage}
                              alt="Product"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        </div>
                        {/* Transparent */}
                        <div>
                          <p className="text-xs text-slate-500 mb-1">
                            {transparentProductUrl
                              ? "Background Removed"
                              : isRemovingBackground
                                ? "Removing background..."
                                : "Failed"}
                          </p>
                          <div
                            className="aspect-square rounded-lg border overflow-hidden"
                            style={{
                              backgroundImage: transparentProductUrl
                                ? "linear-gradient(45deg, #334155 25%, transparent 25%), linear-gradient(-45deg, #334155 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #334155 75%), linear-gradient(-45deg, transparent 75%, #334155 75%)"
                                : "none",
                              backgroundSize: "16px 16px",
                              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                              backgroundColor: transparentProductUrl ? "#1e293b" : "#0f172a80",
                              borderColor: transparentProductUrl
                                ? "#10b981"
                                : !isRemovingBackground && !transparentProductUrl
                                  ? "#ef4444"
                                  : "#334155",
                            }}
                          >
                            {isRemovingBackground ? (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
                                <span className="text-xs text-slate-400">Processing...</span>
                              </div>
                            ) : transparentProductUrl ? (
                              <img
                                src={transparentProductUrl}
                                alt="Transparent"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                <X className="w-6 h-6 text-red-400" />
                                <span className="text-xs text-red-400">Failed</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        {isRemovingBackground && (
                          <div className="flex-1 py-2 px-3 bg-teal-600/20 border border-teal-500/30 rounded-lg text-sm font-medium text-teal-400 flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Removing Background...
                          </div>
                        )}
                        {!transparentProductUrl && !isRemovingBackground && (
                          <button
                            onClick={handleRemoveBackground}
                            className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium text-white transition flex items-center justify-center gap-2"
                          >
                            <Sparkles className="w-4 h-4" />
                            Retry Background Removal
                          </button>
                        )}
                        {transparentProductUrl && (
                          <div className="flex-1 py-2 px-3 bg-green-600/20 border border-green-500/30 rounded-lg text-sm font-medium text-green-400 flex items-center justify-center gap-2">
                            <Check className="w-4 h-4" />
                            Background Removed
                          </div>
                        )}
                        <button
                          onClick={clearProductImage}
                          disabled={isRemovingBackground}
                          className="py-2 px-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition disabled:opacity-50"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="block cursor-pointer">
                      <div className="flex flex-col items-center justify-center h-28 bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-lg hover:border-teal-500/50 transition">
                        <Upload className="w-6 h-6 text-slate-500 mb-2" />
                        <span className="text-sm text-slate-400">
                          Upload product image
                        </span>
                        <span className="text-xs text-slate-500 mt-1">
                          PNG, JPG up to 10MB
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProductImageUpload}
                        className="hidden"
                        disabled={isGenerating || isRemovingBackground}
                      />
                    </label>
                  )}
                </div>

                {/* Position & Scale (only show after background is removed) */}
                {transparentProductUrl && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">
                        Product Position
                      </label>
                      <div className="flex gap-2">
                        {(["center", "bottom", "bottom-left", "bottom-right"] as ProductPosition[]).map((pos) => (
                          <button
                            key={pos}
                            onClick={() => setProductPosition(pos)}
                            disabled={isGenerating}
                            className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition ${
                              productPosition === pos
                                ? "bg-teal-600/20 border border-teal-500/50 text-teal-400"
                                : "bg-slate-900/50 border border-slate-700 text-slate-500 hover:border-slate-600"
                            }`}
                          >
                            {pos.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">
                        Product Size: {Math.round(productScale * 100)}%
                      </label>
                      <input
                        type="range"
                        min="20"
                        max="90"
                        value={productScale * 100}
                        onChange={(e) => setProductScale(parseInt(e.target.value) / 100)}
                        disabled={isGenerating}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                      />
                    </div>

                    {/* Enhancement Preset */}
                    <div className="pt-2 border-t border-slate-700/50">
                      <label className="block text-xs font-medium text-slate-400 mb-2">
                        Enhancement Style
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {ENHANCEMENT_PRESETS.map((preset) => (
                          <button
                            key={preset.value}
                            onClick={() => setEnhancementPreset(preset.value)}
                            disabled={isGenerating}
                            className={`py-2 px-2 rounded-lg text-xs font-medium transition ${
                              enhancementPreset === preset.value
                                ? "bg-teal-600/20 border border-teal-500/50 text-teal-400"
                                : "bg-slate-900/50 border border-slate-700 text-slate-400 hover:border-slate-600"
                            } disabled:opacity-50`}
                            title={preset.description}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5">
                        {ENHANCEMENT_PRESETS.find((p) => p.value === enhancementPreset)?.description}
                      </p>
                    </div>

                    {/* Background Color Overlay - Optional */}
                    <div className="pt-2 border-t border-slate-700/50">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableBgOverlay}
                          onChange={(e) => setEnableBgOverlay(e.target.checked)}
                          disabled={isGenerating}
                          className="rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500/50"
                        />
                        Add Color Overlay (optional)
                      </label>
                      {enableBgOverlay && (
                        <div className="flex items-center gap-3 mt-2">
                          <input
                            type="color"
                            value={bgOverlayColor}
                            onChange={(e) => setBgOverlayColor(e.target.value)}
                            disabled={isGenerating}
                            className="w-10 h-8 rounded border border-slate-700 bg-slate-800 cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-500">Opacity</span>
                              <span className="text-xs text-slate-400">{Math.round(bgOverlayOpacity * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="10"
                              max="80"
                              value={bgOverlayOpacity * 100}
                              onChange={(e) => setBgOverlayOpacity(parseInt(e.target.value) / 100)}
                              disabled={isGenerating}
                              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Background prompt with template builder */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-300">
                    2. Choose Background Style
                  </label>

                  {/* Category selector */}
                  <div className="flex flex-wrap gap-2">
                    {BACKGROUND_CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => {
                          setBgCategory(cat.value);
                          if (cat.value !== "custom") {
                            setPrompt(generatePromptFromTemplate(cat.value, bgStyle, bgMood));
                          }
                        }}
                        disabled={isGenerating || !transparentProductUrl}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          bgCategory === cat.value
                            ? "bg-teal-600/20 border border-teal-500/50 text-teal-400"
                            : "bg-slate-900/50 border border-slate-700 text-slate-400 hover:border-slate-600"
                        } disabled:opacity-50`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Style & Mood selectors (hidden for custom) */}
                  {bgCategory !== "custom" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Style</label>
                        <select
                          value={bgStyle}
                          onChange={(e) => {
                            const newStyle = e.target.value as BackgroundStyle;
                            setBgStyle(newStyle);
                            setPrompt(generatePromptFromTemplate(bgCategory, newStyle, bgMood));
                          }}
                          disabled={isGenerating || !transparentProductUrl}
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-50"
                        >
                          {BACKGROUND_STYLES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Mood</label>
                        <select
                          value={bgMood}
                          onChange={(e) => {
                            const newMood = e.target.value as BackgroundMood;
                            setBgMood(newMood);
                            setPrompt(generatePromptFromTemplate(bgCategory, bgStyle, newMood));
                          }}
                          disabled={isGenerating || !transparentProductUrl}
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-50"
                        >
                          {BACKGROUND_MOODS.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Generated/Custom prompt preview */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-500">
                        {bgCategory === "custom" ? "Your prompt" : "Generated prompt (editable)"}
                      </label>
                      {bgCategory !== "custom" && prompt && (
                        <button
                          onClick={() => setPrompt(generatePromptFromTemplate(bgCategory, bgStyle, bgMood))}
                          className="text-xs text-teal-400 hover:text-teal-300"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={bgCategory === "custom"
                        ? "Modern kitchen countertop with soft natural lighting, lifestyle product photography..."
                        : "Select options above to generate a prompt..."
                      }
                      className="w-full h-16 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 resize-none text-xs"
                      disabled={isGenerating || !transparentProductUrl}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Prompt (when in text mode) */}
            {generationMode === "text" && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Describe your image
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A professional business woman in a modern office, natural lighting, corporate photography style..."
                  className="w-full h-28 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none"
                  disabled={isGenerating}
                />
              </div>
            )}

            {/* Provider (only show in text mode) */}
            {generationMode === "text" && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Provider
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setProvider("google-imagen")}
                    disabled={isGenerating}
                    className={`flex-1 py-2.5 px-4 rounded-lg border transition text-sm font-medium ${
                      provider === "google-imagen"
                        ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                        : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    Google Imagen 4
                  </button>
                  <button
                    onClick={() => setProvider("replicate-flux")}
                    disabled={isGenerating}
                    className={`flex-1 py-2.5 px-4 rounded-lg border transition text-sm font-medium ${
                      provider === "replicate-flux"
                        ? "bg-purple-600/20 border-purple-500/50 text-purple-400"
                        : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    FLUX 1.1 Pro
                  </button>
                </div>
              </div>
            )}

            {/* Ad Platform Presets */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Size Preset
              </label>
              <div className="relative">
                <button
                  onClick={() => !isGenerating && setShowPresetDropdown(!showPresetDropdown)}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-slate-200 hover:border-slate-600 transition disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        presetCategory === "google"
                          ? "bg-blue-500/20 text-blue-400"
                          : presetCategory === "meta"
                            ? "bg-indigo-500/20 text-indigo-400"
                            : presetCategory === "display"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-slate-600/50 text-slate-300"
                      }`}
                    >
                      {AD_PRESETS[presetCategory].label}
                    </span>
                    <span>{getCurrentPreset()?.name}</span>
                    <span className="text-slate-500 text-xs">({aspectRatio})</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${showPresetDropdown ? "rotate-180" : ""}`}
                  />
                </button>

                {showPresetDropdown && (
                  <div className="absolute z-20 w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                    {(Object.keys(AD_PRESETS) as PresetCategory[]).map((category) => (
                      <div key={category}>
                        <div
                          className={`px-3 py-1.5 text-xs font-medium ${
                            category === "google"
                              ? "bg-blue-500/10 text-blue-400"
                              : category === "meta"
                                ? "bg-indigo-500/10 text-indigo-400"
                                : category === "display"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-slate-700/50 text-slate-400"
                          }`}
                        >
                          {AD_PRESETS[category].label}
                        </div>
                        {AD_PRESETS[category].presets.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => handlePresetSelect(category, preset.id)}
                            className={`w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-700/50 transition ${
                              selectedPreset === preset.id
                                ? "bg-slate-700/30 text-slate-200"
                                : "text-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{preset.name}</span>
                              <span className="text-xs text-slate-500">
                                {preset.aspectRatio}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500">
                              {preset.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick aspect ratio buttons */}
              <div className="flex gap-2 mt-3">
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar.value}
                    onClick={() => {
                      setAspectRatio(ar.value);
                      // Find matching preset or set to custom
                      const matchingPreset = AD_PRESETS.custom.presets.find(
                        (p) => p.aspectRatio === ar.value
                      );
                      if (matchingPreset) {
                        setPresetCategory("custom");
                        setSelectedPreset(matchingPreset.id);
                      }
                    }}
                    disabled={isGenerating}
                    className={`flex-1 py-1.5 px-2 rounded-lg border transition text-xs font-medium ${
                      aspectRatio === ar.value
                        ? "bg-slate-700 border-slate-500 text-slate-200"
                        : "bg-slate-900/50 border-slate-700 text-slate-500 hover:border-slate-600"
                    }`}
                  >
                    {ar.value}
                  </button>
                ))}
              </div>
            </div>

            {/* Image Count */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Number of Images
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((count) => (
                  <button
                    key={count}
                    onClick={() => setImageCount(count)}
                    disabled={isGenerating}
                    className={`flex-1 py-2.5 px-4 rounded-lg border transition text-sm font-medium ${
                      imageCount === count
                        ? "bg-slate-700 border-slate-500 text-slate-200"
                        : "bg-slate-900/50 border-slate-700 text-slate-500 hover:border-slate-600"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Raw Mode (FLUX only, text mode only) */}
            {generationMode === "text" && provider === "replicate-flux" && (
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => !isGenerating && setRawMode(!rawMode)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      rawMode ? "bg-purple-600" : "bg-slate-700"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        rawMode ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-300">
                      Raw Mode
                    </span>
                    <p className="text-xs text-slate-500">
                      More photorealistic, natural-looking images (uses FLUX Ultra)
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={
                isGenerating ||
                isCompositing ||
                isRemovingBackground ||
                (generationMode === "reference" ? !referenceImage : !prompt.trim()) ||
                (generationMode === "composite" && !transparentProductUrl)
              }
              className={`w-full py-3 px-4 ${
                generationMode === "reference"
                  ? "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500"
                  : generationMode === "composite"
                    ? "bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500"
                    : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
              } disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-lg font-medium text-white transition flex items-center justify-center gap-2`}
            >
              {isGenerating || isCompositing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isCompositing
                    ? "Compositing..."
                    : generationMode === "reference"
                      ? `Generating ${imageCount > 1 ? `${imageCount} variations` : "variation"}...`
                      : generationMode === "composite"
                        ? `Generating ${imageCount > 1 ? `${imageCount} composites` : "composite"}...`
                        : `Generating ${imageCount > 1 ? `${imageCount} images` : "image"}...`}
                </>
              ) : (
                <>
                  {generationMode === "composite" ? <Layers className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                  {generationMode === "reference"
                    ? `Generate ${imageCount > 1 ? `${imageCount} Variations` : "Variation"}`
                    : generationMode === "composite"
                      ? `Generate ${imageCount > 1 ? `${imageCount} Composites` : "Composite"}`
                      : `Generate ${imageCount > 1 ? `${imageCount} Images` : "Image"}`}
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
                {generationMode === "text" && provider === "google-imagen" && (
                  <button
                    onClick={() => setProvider("replicate-flux")}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    Try with FLUX instead
                  </button>
                )}
                {generationMode === "text" && provider === "replicate-flux" && (
                  <button
                    onClick={() => setProvider("google-imagen")}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    Try with Google Imagen instead
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Output Section */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-medium text-slate-300">
                {generatedImages.length > 1
                  ? `Generated Images (${currentImageIndex + 1}/${generatedImages.length})`
                  : "Generated Image"}
              </h2>
              {generatedImages.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowTextOverlayModal(true)}
                    disabled={isApplyingText}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                      getCurrentTextLayers().length > 0
                        ? "bg-purple-600/20 border border-purple-500/50 text-purple-400 hover:bg-purple-600/30"
                        : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                    }`}
                  >
                    <Type className="w-4 h-4" />
                    {getCurrentTextLayers().length > 0 ? `Edit Text (${getCurrentTextLayers().length})` : "Add Text"}
                  </button>
                  <button
                    onClick={() => handleSaveImage(currentImageIndex)}
                    disabled={savingIndex === currentImageIndex || savedIndices.has(currentImageIndex)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                      savedIndices.has(currentImageIndex)
                        ? "bg-green-600/20 border border-green-500/30 text-green-400"
                        : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                    }`}
                  >
                    {savingIndex === currentImageIndex ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {savedIndices.has(currentImageIndex) ? "Saved" : "Save"}
                  </button>
                  {getCurrentTextLayers().length > 0 ? (
                    <button
                      onClick={handleExportWithText}
                      disabled={isExporting}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white transition disabled:opacity-50"
                    >
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Export with Text
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDownload()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  )}
                  {generatedImages.length > 1 && (
                    <>
                      <div className="w-px h-6 bg-slate-600" />
                      <button
                        onClick={handleSaveAll}
                        disabled={savedIndices.size === generatedImages.length}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg text-sm text-green-400 transition disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        Save All
                      </button>
                      <button
                        onClick={handleDownloadAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition"
                      >
                        <Download className="w-4 h-4" />
                        Download All
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div
              className={`${getAspectClass()} bg-slate-900/50 rounded-lg border border-slate-700/50 flex items-center justify-center overflow-hidden relative`}
            >
              {isGenerating ? (
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-slate-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-500">
                    Generating {imageCount > 1 ? "images" : "image"}...
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    This may take {imageCount > 1 ? "30-60" : "10-30"} seconds
                  </p>
                </div>
              ) : currentImage ? (
                <>
                  <img
                    src={currentImage}
                    alt={`Generated ${currentImageIndex + 1}`}
                    className="w-full h-full object-contain"
                  />
                  {/* Text overlay preview - renders text layers on top of image */}
                  <TextPreviewOverlay layers={getCurrentTextLayers()} />
                  {generatedImages.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setCurrentImageIndex((i) =>
                            i === 0 ? generatedImages.length - 1 : i - 1
                          )
                        }
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full transition"
                      >
                        <ChevronLeft className="w-5 h-5 text-white" />
                      </button>
                      <button
                        onClick={() =>
                          setCurrentImageIndex((i) =>
                            i === generatedImages.length - 1 ? 0 : i + 1
                          )
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full transition"
                      >
                        <ChevronRight className="w-5 h-5 text-white" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="text-center">
                  <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">
                    Your generated image will appear here
                  </p>
                </div>
              )}
            </div>

            {generatedImages.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {generatedImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                      idx === currentImageIndex
                        ? "border-blue-500"
                        : "border-transparent hover:border-slate-600"
                    }`}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {savedIndices.has(idx) && (
                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                        <Save className="w-4 h-4 text-green-400" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Gallery View */
        <div className="space-y-4">
          {/* Gallery Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFavoritesOnly(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  !showFavoritesOnly
                    ? "bg-slate-700 text-slate-200"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                All Images
              </button>
              <button
                onClick={() => setShowFavoritesOnly(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  showFavoritesOnly
                    ? "bg-slate-700 text-slate-200"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <Heart className="w-4 h-4" />
                Favorites
              </button>
            </div>
            <span className="text-sm text-slate-500">
              {galleryImages.length} images
            </span>
          </div>

          {/* Gallery Grid */}
          {galleryLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
            </div>
          ) : galleryImages.length === 0 ? (
            <div className="text-center py-20">
              <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">
                {showFavoritesOnly
                  ? "No favorite images yet"
                  : "No saved images yet"}
              </p>
              <button
                onClick={() => setViewMode("generate")}
                className="mt-4 text-sm text-blue-400 hover:text-blue-300"
              >
                Generate your first image
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {galleryImages.map((image) => (
                <div
                  key={image.id}
                  className="group relative bg-slate-800/50 rounded-lg overflow-hidden border border-slate-700/50 hover:border-slate-600 transition cursor-pointer"
                  onClick={() => setSelectedGalleryImage(image)}
                >
                  <div className="aspect-square">
                    <img
                      src={image.imageUrl}
                      alt={image.prompt}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition">
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-xs text-white line-clamp-2">
                        {image.prompt}
                      </p>
                    </div>
                  </div>
                  {image.isFavorite && (
                    <div className="absolute top-2 right-2">
                      <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image Detail Modal */}
      {selectedGalleryImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedGalleryImage(null)}
        >
          <div
            className="bg-slate-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-300">
                  {selectedGalleryImage.provider === "google-imagen"
                    ? "Google Imagen"
                    : "FLUX"}
                </span>
                <span className="text-xs text-slate-500">
                  {selectedGalleryImage.aspectRatio}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleFavorite(selectedGalleryImage)}
                  className={`p-2 rounded-lg transition ${
                    selectedGalleryImage.isFavorite
                      ? "text-red-500 hover:bg-red-500/10"
                      : "text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  <Heart
                    className={`w-5 h-5 ${
                      selectedGalleryImage.isFavorite ? "fill-red-500" : ""
                    }`}
                  />
                </button>
                <button
                  onClick={() => handleDownload(selectedGalleryImage.imageUrl)}
                  className="p-2 text-slate-400 hover:bg-slate-700 rounded-lg transition"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDeleteImage(selectedGalleryImage)}
                  className="p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setSelectedGalleryImage(null)}
                  className="p-2 text-slate-400 hover:bg-slate-700 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-120px)]">
              <img
                src={selectedGalleryImage.imageUrl}
                alt={selectedGalleryImage.prompt}
                className="w-full rounded-lg"
              />
              <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
                <p className="text-sm text-slate-300">
                  {selectedGalleryImage.prompt}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  {new Date(selectedGalleryImage.createdAt).toLocaleDateString()} at{" "}
                  {new Date(selectedGalleryImage.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Text Overlay Modal */}
      <TextOverlayModal
        imageUrl={currentImage}
        isOpen={showTextOverlayModal}
        onClose={() => setShowTextOverlayModal(false)}
        onApply={handleApplyTextOverlay}
        isApplying={isApplyingText}
        initialLayers={getCurrentTextLayers()}
      />
    </div>
  );
}
