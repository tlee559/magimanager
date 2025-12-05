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
  const [moveableKey, setMoveableKey] = useState(0);

  const { layers, selectedId, setSelectedId, updateLayer } = textLayers;

  // Update container size on mount and resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
        // Force Moveable to recalculate when container size changes
        setMoveableKey((k) => k + 1);
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    // Also update after a short delay to handle dynamic layouts
    const timeout = setTimeout(updateSize, 100);
    return () => {
      window.removeEventListener("resize", updateSize);
      clearTimeout(timeout);
    };
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
      {selectedTarget && selectedId && containerSize.width > 0 && (
        <Moveable
          key={moveableKey}
          target={selectedTarget}
          container={containerRef.current}
          draggable={true}
          rotatable={true}
          scalable={true}
          keepRatio={true}
          throttleDrag={1}
          throttleRotate={1}
          throttleScale={0.01}
          rotationPosition="top"
          origin={false}
          edge={false}
          snappable={true}
          bounds={{
            left: 0,
            top: 0,
            right: containerSize.width,
            bottom: containerSize.height,
          }}
          onDrag={({ target, beforeTranslate }) => {
            // Apply translation directly for smooth dragging
            const currentLayer = layers.find((l) => l.id === selectedId);
            if (currentLayer) {
              target.style.transform = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px) rotate(${currentLayer.rotation}deg) scale(${currentLayer.scale})`;
            }
          }}
          onDragEnd={({ target, lastEvent }) => {
            if (containerSize.width && containerSize.height && lastEvent) {
              const [translateX, translateY] = lastEvent.beforeTranslate;
              const currentLayer = layers.find((l) => l.id === selectedId);
              if (currentLayer) {
                // Calculate new center position as percentage
                const baseX = (currentLayer.x / 100) * containerSize.width;
                const baseY = (currentLayer.y / 100) * containerSize.height;
                const newCenterX = baseX + translateX;
                const newCenterY = baseY + translateY;

                const percentX = (newCenterX / containerSize.width) * 100;
                const percentY = (newCenterY / containerSize.height) * 100;

                updateLayer(selectedId, {
                  x: Math.max(0, Math.min(100, percentX)),
                  y: Math.max(0, Math.min(100, percentY)),
                });

                // Reset transform to just rotation and scale
                target.style.transform = `rotate(${currentLayer.rotation}deg) scale(${currentLayer.scale})`;
              }
            }
          }}
          onRotate={({ target, beforeRotate }) => {
            const currentLayer = layers.find((l) => l.id === selectedId);
            if (currentLayer) {
              target.style.transform = `rotate(${beforeRotate}deg) scale(${currentLayer.scale})`;
            }
          }}
          onRotateEnd={({ target, lastEvent }) => {
            if (lastEvent) {
              const rotation = lastEvent.beforeRotate;
              updateLayer(selectedId, { rotation });
            }
          }}
          onScale={({ target, scale }) => {
            const currentLayer = layers.find((l) => l.id === selectedId);
            if (currentLayer) {
              const newScale = scale[0];
              target.style.transform = `rotate(${currentLayer.rotation}deg) scale(${newScale})`;
            }
          }}
          onScaleEnd={({ lastEvent }) => {
            if (lastEvent) {
              const scale = lastEvent.scale[0];
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
    // Position is center-based, so we need to render at center and use transform
    // The position values are percentages (0-100) representing center of text
    const centerX = (layer.x / 100) * containerSize.width;
    const centerY = (layer.y / 100) * containerSize.height;

    const style: React.CSSProperties = {
      position: "absolute",
      // Position at center point
      left: `${centerX}px`,
      top: `${centerY}px`,
      // Use transform for rotation and scale only, no translate
      transform: `rotate(${layer.rotation}deg) scale(${layer.scale})`,
      transformOrigin: "center center",
      // Center the element on its position point
      marginLeft: "auto",
      marginRight: "auto",
      // Use translate to center via separate property for cleaner Moveable interaction
      translate: "-50% -50%",
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
