"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Image as ImageIcon,
  Loader2,
  Sparkles,
} from "lucide-react";

type Provider = "google-imagen" | "replicate-flux";
type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

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

export function AIImageGenerator({ onBack }: AIImageGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<Provider>("google-imagen");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [imageCount, setImageCount] = useState(1);
  const [rawMode, setRawMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setCurrentImageIndex(0);

    try {
      const response = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          provider,
          aspectRatio,
          imageCount,
          rawMode: provider === "replicate-flux" ? rawMode : undefined,
        }),
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
      // Small delay between downloads
      if (i < generatedImages.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  };

  const currentImage = generatedImages[currentImageIndex];

  // Calculate aspect ratio for preview container
  const getAspectClass = () => {
    switch (aspectRatio) {
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
            Generate images from text descriptions
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 space-y-5">
          {/* Prompt */}
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

          {/* Provider */}
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

          {/* Aspect Ratio */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Aspect Ratio
            </label>
            <div className="flex gap-2">
              {ASPECT_RATIOS.map((ar) => (
                <button
                  key={ar.value}
                  onClick={() => setAspectRatio(ar.value)}
                  disabled={isGenerating}
                  className={`flex-1 py-2 px-2 rounded-lg border transition text-xs font-medium flex flex-col items-center gap-1 ${
                    aspectRatio === ar.value
                      ? "bg-slate-700 border-slate-500 text-slate-200"
                      : "bg-slate-900/50 border-slate-700 text-slate-500 hover:border-slate-600"
                  }`}
                >
                  <span className="text-lg">{ar.icon}</span>
                  <span>{ar.value}</span>
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

          {/* Raw Mode (FLUX only) */}
          {provider === "replicate-flux" && (
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
            disabled={!prompt.trim() || isGenerating}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-lg font-medium text-white transition flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating {imageCount > 1 ? `${imageCount} images` : "image"}...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate {imageCount > 1 ? `${imageCount} Images` : "Image"}
              </>
            )}
          </button>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Output Section */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-slate-300">
              {generatedImages.length > 1
                ? `Generated Images (${currentImageIndex + 1}/${generatedImages.length})`
                : "Generated Image"}
            </h2>
            {generatedImages.length > 0 && (
              <div className="flex items-center gap-2">
                {generatedImages.length > 1 && (
                  <button
                    onClick={handleDownloadAll}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition"
                  >
                    <Download className="w-4 h-4" />
                    All
                  </button>
                )}
                <button
                  onClick={() => handleDownload()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition"
                >
                  <Download className="w-4 h-4" />
                  {generatedImages.length > 1 ? "This" : "Download"}
                </button>
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
                {/* Navigation arrows for multiple images */}
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

          {/* Thumbnail strip for multiple images */}
          {generatedImages.length > 1 && (
            <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
              {generatedImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
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
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
