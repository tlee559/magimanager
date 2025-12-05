"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { TextLayer } from "./types";

interface TextPreviewOverlayProps {
  imageUrl: string;
  layers: TextLayer[];
  className?: string;
}

/**
 * Canvas-based text preview that renders exactly like the export will.
 * This ensures WYSIWYG - what you see in preview matches the downloaded image.
 */
export function TextPreviewOverlay({ imageUrl, layers, className = "" }: TextPreviewOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Load image
  useEffect(() => {
    if (!imageUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      console.error("Failed to load image for preview");
    };
    img.src = imageUrl;

    return () => {
      imageRef.current = null;
      setImageLoaded(false);
    };
  }, [imageUrl]);

  // Calculate canvas size to fit container while maintaining aspect ratio
  useEffect(() => {
    if (!containerRef.current || !imageRef.current) return;

    const updateSize = () => {
      const container = containerRef.current;
      const img = imageRef.current;
      if (!container || !img) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const imgAspect = img.width / img.height;
      const containerAspect = containerWidth / containerHeight;

      let width, height;
      if (imgAspect > containerAspect) {
        width = containerWidth;
        height = containerWidth / imgAspect;
      } else {
        height = containerHeight;
        width = containerHeight * imgAspect;
      }

      setCanvasSize({ width, height });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [imageLoaded]);

  // Draw text layer on canvas
  const drawTextLayer = useCallback((
    ctx: CanvasRenderingContext2D,
    layer: TextLayer,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    const x = (layer.x / 100) * canvasWidth;
    const y = (layer.y / 100) * canvasHeight;

    // Scale font size relative to canvas size (assuming 1024px base)
    const baseSize = Math.min(canvasWidth, canvasHeight);
    const scaleFactor = baseSize / 1024;
    const scaledFontSize = layer.fontSize * layer.scale * scaleFactor;
    const scaledPadding = layer.backgroundPadding * scaleFactor;
    const scaledRadius = layer.backgroundRadius * scaleFactor;
    const scaledStrokeWidth = layer.strokeWidth * scaleFactor;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((layer.rotation * Math.PI) / 180);

    // Setup font
    ctx.font = `${layer.fontWeight} ${scaledFontSize}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = layer.textAlign;
    ctx.textBaseline = "middle";

    // Measure text
    const lines = layer.text.split("\n");
    const lineHeight = scaledFontSize * 1.3;
    const textMetrics = lines.map(line => ctx.measureText(line));
    const maxWidth = Math.max(...textMetrics.map(m => m.width));
    const totalHeight = lines.length * lineHeight;

    // Calculate box dimensions
    const boxWidth = maxWidth + scaledPadding * 2;
    const boxHeight = totalHeight + scaledPadding * 2;

    // Draw background
    if (layer.backgroundColor) {
      const r = parseInt(layer.backgroundColor.slice(1, 3), 16);
      const g = parseInt(layer.backgroundColor.slice(3, 5), 16);
      const b = parseInt(layer.backgroundColor.slice(5, 7), 16);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${layer.backgroundOpacity})`;

      // Rounded rectangle
      const rx = -boxWidth / 2;
      const ry = -boxHeight / 2;
      ctx.beginPath();
      ctx.moveTo(rx + scaledRadius, ry);
      ctx.lineTo(rx + boxWidth - scaledRadius, ry);
      ctx.quadraticCurveTo(rx + boxWidth, ry, rx + boxWidth, ry + scaledRadius);
      ctx.lineTo(rx + boxWidth, ry + boxHeight - scaledRadius);
      ctx.quadraticCurveTo(rx + boxWidth, ry + boxHeight, rx + boxWidth - scaledRadius, ry + boxHeight);
      ctx.lineTo(rx + scaledRadius, ry + boxHeight);
      ctx.quadraticCurveTo(rx, ry + boxHeight, rx, ry + boxHeight - scaledRadius);
      ctx.lineTo(rx, ry + scaledRadius);
      ctx.quadraticCurveTo(rx, ry, rx + scaledRadius, ry);
      ctx.closePath();
      ctx.fill();
    }

    // Draw text
    ctx.fillStyle = layer.color;

    // Calculate text X position based on alignment
    let textX = 0;
    if (layer.textAlign === "left") {
      textX = -maxWidth / 2;
    } else if (layer.textAlign === "right") {
      textX = maxWidth / 2;
    }

    // Draw each line
    lines.forEach((line, index) => {
      const lineY = -totalHeight / 2 + lineHeight / 2 + index * lineHeight;

      // Stroke first (if enabled)
      if (layer.strokeColor && scaledStrokeWidth > 0) {
        ctx.strokeStyle = layer.strokeColor;
        ctx.lineWidth = scaledStrokeWidth;
        ctx.lineJoin = "round";
        ctx.strokeText(line, textX, lineY);
      }

      // Then fill
      ctx.fillText(line, textX, lineY);
    });

    ctx.restore();
  }, []);

  // Main draw function - only draws text layers (transparent canvas overlay)
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx || canvasSize.width === 0) return;

    // Clear canvas (transparent background - don't draw image, it's already shown below)
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw text layers only (sorted by zIndex)
    const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);
    sortedLayers.forEach(layer => {
      if (layer.text.trim()) {
        drawTextLayer(ctx, layer, canvasSize.width, canvasSize.height);
      }
    });
  }, [layers, canvasSize, drawTextLayer]);

  // Redraw when dependencies change
  useEffect(() => {
    if (imageLoaded && canvasSize.width > 0 && canvasSize.height > 0) {
      draw();
    }
  }, [imageLoaded, draw, canvasSize]);

  // If no layers, don't render the canvas overlay
  if (layers.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 flex items-center justify-center pointer-events-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="max-w-full max-h-full"
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
        }}
      />
    </div>
  );
}

/**
 * Export function - renders image with text layers to a data URL
 * Can be called from anywhere to get the final composited image
 */
export async function exportImageWithText(
  imageUrl: string,
  layers: TextLayer[],
  outputWidth?: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      // Use original image dimensions or scale if specified
      const width = outputWidth || img.width;
      const height = outputWidth ? (img.height / img.width) * outputWidth : img.height;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Draw image
      ctx.drawImage(img, 0, 0, width, height);

      // Draw text layers
      const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

      sortedLayers.forEach(layer => {
        if (!layer.text.trim()) return;

        const x = (layer.x / 100) * width;
        const y = (layer.y / 100) * height;

        // Scale font size relative to image size
        const baseSize = Math.min(width, height);
        const scaleFactor = baseSize / 1024;
        const scaledFontSize = layer.fontSize * layer.scale * scaleFactor;
        const scaledPadding = layer.backgroundPadding * scaleFactor;
        const scaledRadius = layer.backgroundRadius * scaleFactor;
        const scaledStrokeWidth = layer.strokeWidth * scaleFactor;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((layer.rotation * Math.PI) / 180);

        // Setup font
        ctx.font = `${layer.fontWeight} ${scaledFontSize}px Inter, system-ui, -apple-system, sans-serif`;
        ctx.textAlign = layer.textAlign;
        ctx.textBaseline = "middle";

        // Measure text
        const lines = layer.text.split("\n");
        const lineHeight = scaledFontSize * 1.3;
        const textMetrics = lines.map(line => ctx.measureText(line));
        const maxWidth = Math.max(...textMetrics.map(m => m.width));
        const totalHeight = lines.length * lineHeight;

        // Calculate box dimensions
        const boxWidth = maxWidth + scaledPadding * 2;
        const boxHeight = totalHeight + scaledPadding * 2;

        // Draw background
        if (layer.backgroundColor) {
          const r = parseInt(layer.backgroundColor.slice(1, 3), 16);
          const g = parseInt(layer.backgroundColor.slice(3, 5), 16);
          const b = parseInt(layer.backgroundColor.slice(5, 7), 16);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${layer.backgroundOpacity})`;

          const rx = -boxWidth / 2;
          const ry = -boxHeight / 2;
          ctx.beginPath();
          ctx.moveTo(rx + scaledRadius, ry);
          ctx.lineTo(rx + boxWidth - scaledRadius, ry);
          ctx.quadraticCurveTo(rx + boxWidth, ry, rx + boxWidth, ry + scaledRadius);
          ctx.lineTo(rx + boxWidth, ry + boxHeight - scaledRadius);
          ctx.quadraticCurveTo(rx + boxWidth, ry + boxHeight, rx + boxWidth - scaledRadius, ry + boxHeight);
          ctx.lineTo(rx + scaledRadius, ry + boxHeight);
          ctx.quadraticCurveTo(rx, ry + boxHeight, rx, ry + boxHeight - scaledRadius);
          ctx.lineTo(rx, ry + scaledRadius);
          ctx.quadraticCurveTo(rx, ry, rx + scaledRadius, ry);
          ctx.closePath();
          ctx.fill();
        }

        // Draw text
        ctx.fillStyle = layer.color;

        let textX = 0;
        if (layer.textAlign === "left") {
          textX = -maxWidth / 2;
        } else if (layer.textAlign === "right") {
          textX = maxWidth / 2;
        }

        lines.forEach((line, index) => {
          const lineY = -totalHeight / 2 + lineHeight / 2 + index * lineHeight;

          if (layer.strokeColor && scaledStrokeWidth > 0) {
            ctx.strokeStyle = layer.strokeColor;
            ctx.lineWidth = scaledStrokeWidth;
            ctx.lineJoin = "round";
            ctx.strokeText(line, textX, lineY);
          }

          ctx.fillText(line, textX, lineY);
        });

        ctx.restore();
      });

      // Export as PNG
      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = imageUrl;
  });
}
