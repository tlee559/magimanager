"use client";

import React from "react";
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Palette,
  Move,
  RotateCw,
  Maximize2,
} from "lucide-react";
import { TextLayer } from "./types";
import { UseTextLayersReturn } from "./use-text-layers";

interface TextControlsPanelProps {
  textLayers: UseTextLayersReturn;
  onApply: () => void;
  isApplying: boolean;
}

export function TextControlsPanel({
  textLayers,
  onApply,
  isApplying,
}: TextControlsPanelProps) {
  const {
    layers,
    selectedId,
    selectedLayer,
    setSelectedId,
    addLayer,
    updateLayer,
    deleteLayer,
    duplicateLayer,
    moveLayer,
  } = textLayers;

  const handleUpdate = <K extends keyof TextLayer>(
    key: K,
    value: TextLayer[K]
  ) => {
    if (selectedId) {
      updateLayer(selectedId, { [key]: value });
    }
  };

  return (
    <div className="space-y-4">
      {/* Layer tabs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-200">Text Layers</span>
          <button
            onClick={addLayer}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>

        {layers.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-sm">
            No text layers. Click &quot;Add&quot; to create one.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {layers.map((layer, idx) => (
              <button
                key={layer.id}
                onClick={() => setSelectedId(layer.id)}
                className={`px-3 py-1.5 text-xs rounded transition-colors truncate max-w-[100px] ${
                  layer.id === selectedId
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {layer.text.slice(0, 10) || `Layer ${idx + 1}`}
                {layer.text.length > 10 ? "..." : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected layer controls */}
      {selectedLayer && (
        <div className="space-y-4 border-t border-gray-700 pt-4">
          {/* Layer actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => duplicateLayer(selectedId!)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Duplicate layer"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => moveLayer(selectedId!, "up")}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Move up"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => moveLayer(selectedId!, "down")}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Move down"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <div className="flex-1" />
            <button
              onClick={() => deleteLayer(selectedId!)}
              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
              title="Delete layer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Text input */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-400">
              <Type className="w-3 h-3" />
              Text
            </label>
            <textarea
              value={selectedLayer.text}
              onChange={(e) => handleUpdate("text", e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Enter text..."
            />
          </div>

          {/* Position controls */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-400">
              <Move className="w-3 h-3" />
              Position
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">X: {Math.round(selectedLayer.x)}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedLayer.x}
                  onChange={(e) => handleUpdate("x", parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Y: {Math.round(selectedLayer.y)}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedLayer.y}
                  onChange={(e) => handleUpdate("y", parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Transform controls */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <RotateCw className="w-3 h-3" />
                Rotation: {selectedLayer.rotation}°
              </label>
              <input
                type="range"
                min="-180"
                max="180"
                value={selectedLayer.rotation}
                onChange={(e) => handleUpdate("rotation", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <Maximize2 className="w-3 h-3" />
                Scale: {selectedLayer.scale.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={selectedLayer.scale}
                onChange={(e) => handleUpdate("scale", parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

          {/* Typography */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-400">
              <Palette className="w-3 h-3" />
              Typography
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">Size: {selectedLayer.fontSize}px</label>
                <input
                  type="range"
                  min="12"
                  max="120"
                  value={selectedLayer.fontSize}
                  onChange={(e) => handleUpdate("fontSize", parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Color</label>
                <input
                  type="color"
                  value={selectedLayer.color}
                  onChange={(e) => handleUpdate("color", e.target.value)}
                  className="w-full h-8 rounded cursor-pointer bg-transparent"
                />
              </div>
            </div>

            {/* Font weight */}
            <div className="flex gap-1">
              {([400, 500, 600, 700, 800, 900] as const).map((weight) => (
                <button
                  key={weight}
                  onClick={() => handleUpdate("fontWeight", weight)}
                  className={`flex-1 px-1 py-1 text-xs rounded transition-colors ${
                    selectedLayer.fontWeight === weight
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                  style={{ fontWeight: weight }}
                >
                  {weight}
                </button>
              ))}
            </div>

            {/* Text alignment */}
            <div className="flex gap-1">
              <button
                onClick={() => handleUpdate("textAlign", "left")}
                className={`flex-1 p-2 rounded transition-colors ${
                  selectedLayer.textAlign === "left"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <AlignLeft className="w-4 h-4 mx-auto" />
              </button>
              <button
                onClick={() => handleUpdate("textAlign", "center")}
                className={`flex-1 p-2 rounded transition-colors ${
                  selectedLayer.textAlign === "center"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <AlignCenter className="w-4 h-4 mx-auto" />
              </button>
              <button
                onClick={() => handleUpdate("textAlign", "right")}
                className={`flex-1 p-2 rounded transition-colors ${
                  selectedLayer.textAlign === "right"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <AlignRight className="w-4 h-4 mx-auto" />
              </button>
            </div>
          </div>

          {/* Background */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-400">Background</label>
              <input
                type="checkbox"
                checked={!!selectedLayer.backgroundColor}
                onChange={(e) =>
                  handleUpdate("backgroundColor", e.target.checked ? "#000000" : null)
                }
                className="w-4 h-4 rounded accent-blue-500"
              />
            </div>
            {selectedLayer.backgroundColor && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Color</label>
                  <input
                    type="color"
                    value={selectedLayer.backgroundColor}
                    onChange={(e) => handleUpdate("backgroundColor", e.target.value)}
                    className="w-full h-8 rounded cursor-pointer bg-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">
                    Opacity: {Math.round(selectedLayer.backgroundOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={selectedLayer.backgroundOpacity}
                    onChange={(e) =>
                      handleUpdate("backgroundOpacity", parseFloat(e.target.value))
                    }
                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">
                    Padding: {selectedLayer.backgroundPadding}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={selectedLayer.backgroundPadding}
                    onChange={(e) =>
                      handleUpdate("backgroundPadding", parseInt(e.target.value))
                    }
                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">
                    Radius: {selectedLayer.backgroundRadius}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="24"
                    value={selectedLayer.backgroundRadius}
                    onChange={(e) =>
                      handleUpdate("backgroundRadius", parseInt(e.target.value))
                    }
                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Stroke/Outline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-400">Stroke/Outline</label>
              <input
                type="checkbox"
                checked={!!selectedLayer.strokeColor}
                onChange={(e) =>
                  handleUpdate("strokeColor", e.target.checked ? "#000000" : null)
                }
                className="w-4 h-4 rounded accent-blue-500"
              />
            </div>
            {selectedLayer.strokeColor && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Color</label>
                  <input
                    type="color"
                    value={selectedLayer.strokeColor}
                    onChange={(e) => handleUpdate("strokeColor", e.target.value)}
                    className="w-full h-8 rounded cursor-pointer bg-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">
                    Width: {selectedLayer.strokeWidth}px
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={selectedLayer.strokeWidth}
                    onChange={(e) =>
                      handleUpdate("strokeWidth", parseInt(e.target.value))
                    }
                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Apply button */}
      {layers.length > 0 && (
        <button
          onClick={onApply}
          disabled={isApplying}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {isApplying ? "Applying..." : "Apply Text Overlay"}
        </button>
      )}
    </div>
  );
}
