"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  X,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Loader2,
} from "lucide-react";
import { TextLayer, DEFAULT_TEXT_LAYER } from "./types";

interface TextOverlayModalProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: (layers: TextLayer[]) => Promise<void>;
  isApplying?: boolean;
}

export function TextOverlayModal({
  imageUrl,
  isOpen,
  onClose,
  onApply,
  isApplying = false,
}: TextOverlayModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Layer state
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Image dimensions
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const scale = useMemo(() => {
    if (imageSize.width === 0) return 1;
    return canvasSize.width / imageSize.width;
  }, [imageSize.width, canvasSize.width]);

  // Selected layer
  const selectedLayer = useMemo(
    () => layers.find((l) => l.id === selectedId) || null,
    [layers, selectedId]
  );

  // Load image
  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageSize({ width: img.width, height: img.height });
    };
    img.src = imageUrl;
  }, [imageUrl, isOpen]);

  // Calculate canvas size based on container
  useEffect(() => {
    if (!containerRef.current || imageSize.width === 0) return;

    const updateCanvasSize = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const imgAspect = imageSize.width / imageSize.height;
      const containerAspect = containerWidth / containerHeight;

      let canvasW, canvasH;
      if (imgAspect > containerAspect) {
        // Image is wider than container
        canvasW = containerWidth;
        canvasH = containerWidth / imgAspect;
      } else {
        // Image is taller than container
        canvasH = containerHeight;
        canvasW = containerHeight * imgAspect;
      }

      setCanvasSize({ width: canvasW, height: canvasH });
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [imageSize]);

  // Draw a single text layer on canvas
  const drawTextLayer = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      layer: TextLayer,
      canvasWidth: number,
      canvasHeight: number,
      isSelected: boolean
    ) => {
      const x = (layer.x / 100) * canvasWidth;
      const y = (layer.y / 100) * canvasHeight;
      const scaledFontSize = layer.fontSize * layer.scale * scale;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((layer.rotation * Math.PI) / 180);

      // Set font
      ctx.font = `${layer.fontWeight} ${scaledFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = layer.textAlign;
      ctx.textBaseline = "middle";

      // Measure text for background
      const lines = layer.text.split("\n");
      const lineHeight = scaledFontSize * 1.2;
      const metrics = lines.map((line) => ctx.measureText(line));
      const maxWidth = Math.max(...metrics.map((m) => m.width));
      const totalHeight = lines.length * lineHeight;

      // Calculate background bounds
      const padding = layer.backgroundPadding * scale;
      let bgX = -padding;
      let bgY = -totalHeight / 2 - padding;
      const bgW = maxWidth + padding * 2;
      const bgH = totalHeight + padding * 2;

      // Adjust for text alignment
      if (layer.textAlign === "center") {
        bgX = -maxWidth / 2 - padding;
      } else if (layer.textAlign === "right") {
        bgX = -maxWidth - padding;
      }

      // Draw background
      if (layer.backgroundColor) {
        ctx.fillStyle = layer.backgroundColor;
        ctx.globalAlpha = layer.backgroundOpacity;
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgW, bgH, layer.backgroundRadius * scale);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Draw stroke/outline
      if (layer.strokeColor && layer.strokeWidth > 0) {
        ctx.strokeStyle = layer.strokeColor;
        ctx.lineWidth = layer.strokeWidth * scale;
        ctx.lineJoin = "round";
        lines.forEach((line, i) => {
          const lineY = -totalHeight / 2 + lineHeight / 2 + i * lineHeight;
          ctx.strokeText(line, 0, lineY);
        });
      }

      // Draw text
      ctx.fillStyle = layer.color;
      lines.forEach((line, i) => {
        const lineY = -totalHeight / 2 + lineHeight / 2 + i * lineHeight;
        ctx.fillText(line, 0, lineY);
      });

      // Draw selection indicator
      if (isSelected) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(bgX - 4, bgY - 4, bgW + 8, bgH + 8);
        ctx.setLineDash([]);
      }

      ctx.restore();
    },
    [scale]
  );

  // Draw canvas with image and text layers
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imageRef.current;
    if (!canvas || !ctx || !img) return;

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw each text layer
    const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);
    for (const layer of sortedLayers) {
      drawTextLayer(ctx, layer, canvas.width, canvas.height, layer.id === selectedId);
    }
  }, [layers, selectedId, drawTextLayer]);

  // Redraw on changes
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas, canvasSize]);

  // Hit test for layer selection
  const hitTestLayer = useCallback(
    (canvasX: number, canvasY: number): TextLayer | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      // Check layers in reverse order (top first)
      const sortedLayers = [...layers].sort((a, b) => b.zIndex - a.zIndex);

      for (const layer of sortedLayers) {
        const x = (layer.x / 100) * canvas.width;
        const y = (layer.y / 100) * canvas.height;
        const scaledFontSize = layer.fontSize * layer.scale * scale;
        const padding = layer.backgroundPadding * scale;

        // Approximate bounding box
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        ctx.font = `${layer.fontWeight} ${scaledFontSize}px Inter, system-ui, sans-serif`;
        const lines = layer.text.split("\n");
        const lineHeight = scaledFontSize * 1.2;
        const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
        const totalHeight = lines.length * lineHeight;

        // Check bounds (simplified, ignoring rotation for hit test)
        const halfW = maxWidth / 2 + padding;
        const halfH = totalHeight / 2 + padding;

        if (
          canvasX >= x - halfW &&
          canvasX <= x + halfW &&
          canvasY >= y - halfH &&
          canvasY <= y + halfH
        ) {
          return layer;
        }
      }

      return null;
    },
    [layers, scale]
  );

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;

      const hitLayer = hitTestLayer(canvasX, canvasY);
      if (hitLayer) {
        setSelectedId(hitLayer.id);
        setIsDragging(true);
        // Calculate offset from layer center
        const layerX = (hitLayer.x / 100) * canvas.width;
        const layerY = (hitLayer.y / 100) * canvas.height;
        setDragOffset({ x: canvasX - layerX, y: canvasY - layerY });
      } else {
        setSelectedId(null);
      }
    },
    [hitTestLayer]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging || !selectedId) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left - dragOffset.x;
      const canvasY = e.clientY - rect.top - dragOffset.y;

      // Convert to percentage
      const percentX = Math.max(0, Math.min(100, (canvasX / canvas.width) * 100));
      const percentY = Math.max(0, Math.min(100, (canvasY / canvas.height) * 100));

      setLayers((prev) =>
        prev.map((l) =>
          l.id === selectedId ? { ...l, x: percentX, y: percentY } : l
        )
      );
    },
    [isDragging, selectedId, dragOffset]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Layer management
  const addLayer = useCallback(() => {
    const newLayer: TextLayer = {
      ...DEFAULT_TEXT_LAYER,
      id: `layer-${Date.now()}`,
      zIndex: layers.length,
    };
    setLayers((prev) => [...prev, newLayer]);
    setSelectedId(newLayer.id);
  }, [layers.length]);

  const updateLayer = useCallback(
    (id: string, updates: Partial<TextLayer>) => {
      setLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
      );
    },
    []
  );

  const deleteLayer = useCallback((id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    setSelectedId(null);
  }, []);

  const duplicateLayer = useCallback(
    (id: string) => {
      const layer = layers.find((l) => l.id === id);
      if (!layer) return;

      const newLayer: TextLayer = {
        ...layer,
        id: `layer-${Date.now()}`,
        x: Math.min(layer.x + 5, 95),
        y: Math.min(layer.y + 5, 95),
        zIndex: layers.length,
      };
      setLayers((prev) => [...prev, newLayer]);
      setSelectedId(newLayer.id);
    },
    [layers]
  );

  const moveLayer = useCallback((id: string, direction: "up" | "down") => {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx === -1) return prev;

      const newIdx = direction === "up" ? idx + 1 : idx - 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;

      const newLayers = [...prev];
      [newLayers[idx], newLayers[newIdx]] = [newLayers[newIdx], newLayers[idx]];
      return newLayers.map((l, i) => ({ ...l, zIndex: i }));
    });
  }, []);

  // Handle apply
  const handleApply = useCallback(async () => {
    if (layers.length === 0) return;
    await onApply(layers);
  }, [layers, onApply]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLayers([]);
      setSelectedId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full h-full max-w-7xl max-h-[90vh] m-4 bg-slate-900 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Type className="w-5 h-5" />
            Text Overlay Editor
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying || layers.length === 0}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Applying...
                </>
              ) : (
                "Apply Text"
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Canvas area */}
          <div
            ref={containerRef}
            className="flex-1 flex items-center justify-center p-6 bg-slate-950"
          >
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className="bg-gray-900 rounded-lg shadow-lg cursor-crosshair"
              style={{
                width: canvasSize.width,
                height: canvasSize.height,
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          {/* Controls panel */}
          <div className="w-80 border-l border-slate-700 overflow-y-auto">
            <div className="p-4 space-y-4">
              {/* Layers section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">
                    Text Layers
                  </span>
                  <button
                    onClick={addLayer}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>

                {layers.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    No text layers yet.
                    <br />
                    Click "Add" to create one.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {layers.map((layer, idx) => (
                      <button
                        key={layer.id}
                        onClick={() => setSelectedId(layer.id)}
                        className={`w-full px-3 py-2 text-left text-sm rounded transition-colors truncate ${
                          layer.id === selectedId
                            ? "bg-blue-600 text-white"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {layer.text.slice(0, 20) || `Layer ${idx + 1}`}
                        {layer.text.length > 20 ? "..." : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected layer controls */}
              {selectedLayer && (
                <>
                  {/* Layer actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
                    <button
                      onClick={() => duplicateLayer(selectedId!)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveLayer(selectedId!, "up")}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                      title="Move up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveLayer(selectedId!, "down")}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                      title="Move down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => deleteLayer(selectedId!)}
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Text input */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">
                      Text
                    </label>
                    <textarea
                      value={selectedLayer.text}
                      onChange={(e) =>
                        updateLayer(selectedId!, { text: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="Enter text..."
                    />
                  </div>

                  {/* Font size */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">
                      Size: {selectedLayer.fontSize}px
                    </label>
                    <input
                      type="range"
                      min="16"
                      max="120"
                      value={selectedLayer.fontSize}
                      onChange={(e) =>
                        updateLayer(selectedId!, {
                          fontSize: parseInt(e.target.value),
                        })
                      }
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Font weight */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">
                      Weight
                    </label>
                    <div className="flex gap-1">
                      {([400, 500, 600, 700, 800, 900] as const).map((w) => (
                        <button
                          key={w}
                          onClick={() =>
                            updateLayer(selectedId!, { fontWeight: w })
                          }
                          className={`flex-1 px-1 py-1 text-xs rounded transition-colors ${
                            selectedLayer.fontWeight === w
                              ? "bg-blue-600 text-white"
                              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                          }`}
                          style={{ fontWeight: w }}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Colors */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400">
                        Text Color
                      </label>
                      <input
                        type="color"
                        value={selectedLayer.color}
                        onChange={(e) =>
                          updateLayer(selectedId!, { color: e.target.value })
                        }
                        className="w-full h-8 rounded cursor-pointer bg-transparent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400">
                        Stroke Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!selectedLayer.strokeColor}
                          onChange={(e) =>
                            updateLayer(selectedId!, {
                              strokeColor: e.target.checked ? "#000000" : null,
                              strokeWidth: e.target.checked ? 2 : 0,
                            })
                          }
                          className="w-4 h-4 rounded accent-blue-500"
                        />
                        {selectedLayer.strokeColor && (
                          <input
                            type="color"
                            value={selectedLayer.strokeColor}
                            onChange={(e) =>
                              updateLayer(selectedId!, {
                                strokeColor: e.target.value,
                              })
                            }
                            className="flex-1 h-8 rounded cursor-pointer bg-transparent"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stroke width */}
                  {selectedLayer.strokeColor && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400">
                        Stroke Width: {selectedLayer.strokeWidth}px
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={selectedLayer.strokeWidth}
                        onChange={(e) =>
                          updateLayer(selectedId!, {
                            strokeWidth: parseInt(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  )}

                  {/* Text alignment */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">
                      Alignment
                    </label>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          updateLayer(selectedId!, { textAlign: "left" })
                        }
                        className={`flex-1 p-2 rounded transition-colors ${
                          selectedLayer.textAlign === "left"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        }`}
                      >
                        <AlignLeft className="w-4 h-4 mx-auto" />
                      </button>
                      <button
                        onClick={() =>
                          updateLayer(selectedId!, { textAlign: "center" })
                        }
                        className={`flex-1 p-2 rounded transition-colors ${
                          selectedLayer.textAlign === "center"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        }`}
                      >
                        <AlignCenter className="w-4 h-4 mx-auto" />
                      </button>
                      <button
                        onClick={() =>
                          updateLayer(selectedId!, { textAlign: "right" })
                        }
                        className={`flex-1 p-2 rounded transition-colors ${
                          selectedLayer.textAlign === "right"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        }`}
                      >
                        <AlignRight className="w-4 h-4 mx-auto" />
                      </button>
                    </div>
                  </div>

                  {/* Background */}
                  <div className="space-y-2 pt-2 border-t border-slate-700">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-400">
                        Background
                      </label>
                      <input
                        type="checkbox"
                        checked={!!selectedLayer.backgroundColor}
                        onChange={(e) =>
                          updateLayer(selectedId!, {
                            backgroundColor: e.target.checked ? "#000000" : null,
                          })
                        }
                        className="w-4 h-4 rounded accent-blue-500"
                      />
                    </div>
                    {selectedLayer.backgroundColor && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Color</label>
                          <input
                            type="color"
                            value={selectedLayer.backgroundColor}
                            onChange={(e) =>
                              updateLayer(selectedId!, {
                                backgroundColor: e.target.value,
                              })
                            }
                            className="w-full h-8 rounded cursor-pointer bg-transparent"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">
                            Opacity: {Math.round(selectedLayer.backgroundOpacity * 100)}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={selectedLayer.backgroundOpacity}
                            onChange={(e) =>
                              updateLayer(selectedId!, {
                                backgroundOpacity: parseFloat(e.target.value),
                              })
                            }
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">
                            Padding: {selectedLayer.backgroundPadding}px
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="40"
                            value={selectedLayer.backgroundPadding}
                            onChange={(e) =>
                              updateLayer(selectedId!, {
                                backgroundPadding: parseInt(e.target.value),
                              })
                            }
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">
                            Radius: {selectedLayer.backgroundRadius}px
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="24"
                            value={selectedLayer.backgroundRadius}
                            onChange={(e) =>
                              updateLayer(selectedId!, {
                                backgroundRadius: parseInt(e.target.value),
                              })
                            }
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rotation */}
                  <div className="space-y-1 pt-2 border-t border-slate-700">
                    <label className="text-xs font-medium text-slate-400">
                      Rotation: {selectedLayer.rotation}°
                    </label>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={selectedLayer.rotation}
                      onChange={(e) =>
                        updateLayer(selectedId!, {
                          rotation: parseInt(e.target.value),
                        })
                      }
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Scale */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">
                      Scale: {selectedLayer.scale.toFixed(1)}x
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.1"
                      value={selectedLayer.scale}
                      onChange={(e) =>
                        updateLayer(selectedId!, {
                          scale: parseFloat(e.target.value),
                        })
                      }
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
