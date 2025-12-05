"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import Moveable from "react-moveable";
import { TextLayer } from "./types";
import { UseTextLayersReturn } from "./use-text-layers";

interface TextOverlayEditorProps {
  imageUrl: string;
  textLayers: UseTextLayersReturn;
  containerWidth?: number;
  containerHeight?: number;
}

export function TextOverlayEditor({
  imageUrl,
  textLayers,
}: TextOverlayEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const targetRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { layers, selectedId, setSelectedId, updateLayer } = textLayers;

  // Update container size on mount and resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Handle click outside to deselect
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === containerRef.current) {
        setSelectedId(null);
      }
    },
    [setSelectedId]
  );

  // Handle keyboard events for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        // Only delete if not editing text
        const activeElement = document.activeElement;
        if (
          activeElement?.tagName !== "INPUT" &&
          activeElement?.tagName !== "TEXTAREA"
        ) {
          textLayers.deleteLayer(selectedId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, textLayers]);

  // Get the ref for a layer
  const getLayerRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) {
        targetRefs.current.set(id, el);
      } else {
        targetRefs.current.delete(id);
      }
    },
    []
  );

  // Get selected layer element
  const selectedTarget = selectedId
    ? targetRefs.current.get(selectedId)
    : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[9/16] bg-gray-900 rounded-lg overflow-hidden cursor-crosshair"
      onClick={handleContainerClick}
    >
      {/* Background image */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Preview"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
      )}

      {/* Text layers */}
      {layers.map((layer) => (
        <TextLayerElement
          key={layer.id}
          layer={layer}
          containerSize={containerSize}
          isSelected={layer.id === selectedId}
          onSelect={() => setSelectedId(layer.id)}
          ref={getLayerRef(layer.id)}
        />
      ))}

      {/* Moveable controls for selected layer */}
      {selectedTarget && selectedId && (
        <Moveable
          target={selectedTarget}
          draggable={true}
          rotatable={true}
          scalable={true}
          keepRatio={false}
          throttleDrag={0}
          throttleRotate={0}
          throttleScale={0}
          rotationPosition="top"
          origin={false}
          padding={{ left: 0, top: 0, right: 0, bottom: 0 }}
          onDrag={({ target, left, top }) => {
            target.style.left = `${left}px`;
            target.style.top = `${top}px`;
          }}
          onDragEnd={({ target }) => {
            if (containerSize.width && containerSize.height) {
              const left = parseFloat(target.style.left) || 0;
              const top = parseFloat(target.style.top) || 0;
              const rect = target.getBoundingClientRect();
              const width = rect.width;
              const height = rect.height;

              // Convert to percentage (center point)
              const centerX =
                ((left + width / 2) / containerSize.width) * 100;
              const centerY =
                ((top + height / 2) / containerSize.height) * 100;

              updateLayer(selectedId, {
                x: Math.max(0, Math.min(100, centerX)),
                y: Math.max(0, Math.min(100, centerY)),
              });
            }
          }}
          onRotate={({ target, transform }) => {
            target.style.transform = transform;
          }}
          onRotateEnd={({ target }) => {
            const transform = target.style.transform;
            const match = transform.match(/rotate\(([-\d.]+)deg\)/);
            if (match) {
              const rotation = parseFloat(match[1]);
              updateLayer(selectedId, { rotation });
            }
          }}
          onScale={({ target, transform }) => {
            target.style.transform = transform;
          }}
          onScaleEnd={({ target }) => {
            const transform = target.style.transform;
            const scaleMatch = transform.match(/scale\(([-\d.]+)/);
            if (scaleMatch) {
              const scale = parseFloat(scaleMatch[1]);
              updateLayer(selectedId, {
                scale: Math.max(0.5, Math.min(3, scale)),
              });
            }
          }}
        />
      )}
    </div>
  );
}

// Individual text layer component
interface TextLayerElementProps {
  layer: TextLayer;
  containerSize: { width: number; height: number };
  isSelected: boolean;
  onSelect: () => void;
}

const TextLayerElement = React.forwardRef<HTMLDivElement, TextLayerElementProps>(
  ({ layer, containerSize, isSelected, onSelect }, ref) => {
    // Calculate position from percentage
    const style: React.CSSProperties = {
      position: "absolute",
      left: `${(layer.x / 100) * containerSize.width}px`,
      top: `${(layer.y / 100) * containerSize.height}px`,
      transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
      transformOrigin: "center center",
      // Typography
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      fontSize: `${layer.fontSize}px`,
      fontWeight: layer.fontWeight,
      color: layer.color,
      textAlign: layer.textAlign,
      whiteSpace: "pre-wrap",
      // Background
      backgroundColor: layer.backgroundColor
        ? `${layer.backgroundColor}${Math.round(layer.backgroundOpacity * 255)
            .toString(16)
            .padStart(2, "0")}`
        : "transparent",
      padding: `${layer.backgroundPadding}px`,
      borderRadius: `${layer.backgroundRadius}px`,
      // Stroke effect using text-shadow
      textShadow: layer.strokeColor
        ? `
          ${layer.strokeWidth}px 0 0 ${layer.strokeColor},
          -${layer.strokeWidth}px 0 0 ${layer.strokeColor},
          0 ${layer.strokeWidth}px 0 ${layer.strokeColor},
          0 -${layer.strokeWidth}px 0 ${layer.strokeColor},
          ${layer.strokeWidth}px ${layer.strokeWidth}px 0 ${layer.strokeColor},
          -${layer.strokeWidth}px ${layer.strokeWidth}px 0 ${layer.strokeColor},
          ${layer.strokeWidth}px -${layer.strokeWidth}px 0 ${layer.strokeColor},
          -${layer.strokeWidth}px -${layer.strokeWidth}px 0 ${layer.strokeColor}
        `
        : undefined,
      // Interaction
      cursor: "move",
      userSelect: "none",
      zIndex: layer.zIndex + 1,
      // Selection indicator
      outline: isSelected ? "2px solid #3b82f6" : "none",
      outlineOffset: "2px",
    };

    return (
      <div
        ref={ref}
        style={style}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className="hover:outline hover:outline-2 hover:outline-blue-400 hover:outline-offset-2"
      >
        {layer.text || "New Text"}
      </div>
    );
  }
);

TextLayerElement.displayName = "TextLayerElement";
