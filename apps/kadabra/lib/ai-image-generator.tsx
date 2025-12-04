"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Image as ImageIcon,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type Provider = "google-imagen" | "replicate-flux";
type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
type ViewMode = "generate" | "gallery";
type PresetCategory = "custom" | "google" | "meta" | "display";

interface GeneratedImage {
  id: string;
  prompt: string;
  provider: string;
  aspectRatio: string;
  rawMode: boolean;
  imageUrl: string;
  isFavorite: boolean;
  createdAt: string;
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

  // Preset state
  const [presetCategory, setPresetCategory] = useState<PresetCategory>("custom");
  const [selectedPreset, setSelectedPreset] = useState<string>("square");
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);

  // Reference image state
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceMode, setReferenceMode] = useState(false);

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
      setReferenceMode(true);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const clearReferenceImage = () => {
    setReferenceImage(null);
    setReferenceMode(false);
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
    // Reference mode doesn't require prompt, text mode does
    if (!referenceMode && !prompt.trim()) return;
    if (referenceMode && !referenceImage) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setCurrentImageIndex(0);
    setSavedIndices(new Set());

    try {
      const requestBody = referenceMode
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

      setGeneratedImages(data.imageUrls || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveImage = async (index: number) => {
    const imageUrl = generatedImages[index];
    if (!imageUrl || savedIndices.has(index)) return;

    setSavingIndex(index);
    try {
      const response = await fetch("/api/ai/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: referenceMode ? "Reference image variation" : prompt,
          provider: referenceMode ? "replicate-flux-redux" : provider,
          aspectRatio,
          rawMode: !referenceMode && provider === "replicate-flux" ? rawMode : false,
          imageUrl,
        }),
      });

      if (response.ok) {
        setSavedIndices((prev) => new Set([...prev, index]));
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
              {referenceMode
                ? "Generate variations from a reference image"
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
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setReferenceMode(false);
                    setReferenceImage(null);
                  }}
                  disabled={isGenerating}
                  className={`flex-1 py-2.5 px-4 rounded-lg border transition text-sm font-medium ${
                    !referenceMode
                      ? "bg-slate-700 border-slate-500 text-slate-200"
                      : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  Text to Image
                </button>
                <button
                  onClick={() => setReferenceMode(true)}
                  disabled={isGenerating}
                  className={`flex-1 py-2.5 px-4 rounded-lg border transition text-sm font-medium ${
                    referenceMode
                      ? "bg-orange-600/20 border-orange-500/50 text-orange-400"
                      : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  Reference Image
                </button>
              </div>
            </div>

            {/* Reference Image Upload (when in reference mode) */}
            {referenceMode ? (
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
            ) : (
              /* Prompt (when in text mode) */
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
            {!referenceMode && (
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
            {!referenceMode && provider === "replicate-flux" && (
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
                (referenceMode ? !referenceImage : !prompt.trim())
              }
              className={`w-full py-3 px-4 ${
                referenceMode
                  ? "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500"
                  : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
              } disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-lg font-medium text-white transition flex items-center justify-center gap-2`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {referenceMode
                    ? `Generating ${imageCount > 1 ? `${imageCount} variations` : "variation"}...`
                    : `Generating ${imageCount > 1 ? `${imageCount} images` : "image"}...`}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  {referenceMode
                    ? `Generate ${imageCount > 1 ? `${imageCount} Variations` : "Variation"}`
                    : `Generate ${imageCount > 1 ? `${imageCount} Images` : "Image"}`}
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
                {!referenceMode && provider === "google-imagen" && (
                  <button
                    onClick={() => setProvider("replicate-flux")}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    Try with FLUX instead
                  </button>
                )}
                {!referenceMode && provider === "replicate-flux" && (
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
                  <button
                    onClick={() => handleDownload()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
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
    </div>
  );
}
