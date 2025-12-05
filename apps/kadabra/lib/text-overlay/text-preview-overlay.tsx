"use client";

import React from "react";
import { TextLayer } from "./types";

interface TextPreviewOverlayProps {
  layers: TextLayer[];
  className?: string;
}

/**
 * Renders text layers as HTML overlays on top of an image
 * Used for previewing text in the main image view without burning into the image
 */
export function TextPreviewOverlay({ layers, className = "" }: TextPreviewOverlayProps) {
  if (layers.length === 0) return null;

  // Sort by zIndex
  const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      {sortedLayers.map((layer) => {
        const scaledFontSize = layer.fontSize * layer.scale;

        // Calculate background color with opacity
        const bgColor = layer.backgroundColor
          ? `rgba(${parseInt(layer.backgroundColor.slice(1, 3), 16)}, ${parseInt(layer.backgroundColor.slice(3, 5), 16)}, ${parseInt(layer.backgroundColor.slice(5, 7), 16)}, ${layer.backgroundOpacity})`
          : "transparent";

        return (
          <div
            key={layer.id}
            className="absolute"
            style={{
              left: `${layer.x}%`,
              top: `${layer.y}%`,
              transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
              zIndex: layer.zIndex,
            }}
          >
            <div
              style={{
                backgroundColor: bgColor,
                padding: layer.backgroundPadding,
                borderRadius: layer.backgroundRadius,
              }}
            >
              <div
                style={{
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  fontSize: `${scaledFontSize}px`,
                  fontWeight: layer.fontWeight,
                  color: layer.color,
                  textAlign: layer.textAlign,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.3,
                  WebkitTextStroke: layer.strokeColor && layer.strokeWidth > 0
                    ? `${layer.strokeWidth}px ${layer.strokeColor}`
                    : undefined,
                  paintOrder: "stroke fill",
                }}
              >
                {layer.text}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
