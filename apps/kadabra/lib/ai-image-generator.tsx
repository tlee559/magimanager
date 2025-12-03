"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Download,
  Image as ImageIcon,
  Loader2,
  Sparkles,
} from "lucide-react";

type Provider = "google-imagen" | "replicate-flux";

interface AIImageGeneratorProps {
  onBack?: () => void;
}

export function AIImageGenerator({ onBack }: AIImageGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<Provider>("google-imagen");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const response = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          provider,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate image");
      }

      setGeneratedImage(data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedImage) return;

    try {
      // For data URLs, create blob directly
      if (generatedImage.startsWith("data:")) {
        const response = await fetch(generatedImage);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ai-generated-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // For regular URLs, fetch and download
        const response = await fetch(generatedImage);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ai-generated-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      setError("Failed to download image");
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
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Describe your image
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A professional business woman in a modern office, natural lighting, corporate photography style..."
              className="w-full h-32 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none"
              disabled={isGenerating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Provider
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setProvider("google-imagen")}
                disabled={isGenerating}
                className={`flex-1 py-3 px-4 rounded-lg border transition text-sm font-medium ${
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
                className={`flex-1 py-3 px-4 rounded-lg border transition text-sm font-medium ${
                  provider === "replicate-flux"
                    ? "bg-purple-600/20 border-purple-500/50 text-purple-400"
                    : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                FLUX 1.1 Pro
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {provider === "google-imagen"
                ? "Google's latest Imagen 4 model - excellent for photorealistic images"
                : "Black Forest Labs FLUX 1.1 Pro - fast, high-quality generation"}
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-lg font-medium text-white transition flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Image
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
              Generated Image
            </h2>
            {generatedImage && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            )}
          </div>

          <div className="aspect-square bg-slate-900/50 rounded-lg border border-slate-700/50 flex items-center justify-center overflow-hidden">
            {isGenerating ? (
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-slate-500 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  Generating your image...
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  This may take 10-30 seconds
                </p>
              </div>
            ) : generatedImage ? (
              <img
                src={generatedImage}
                alt="Generated"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center">
                <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  Your generated image will appear here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
