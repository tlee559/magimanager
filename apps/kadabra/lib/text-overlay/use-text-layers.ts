"use client";

import { useState, useCallback } from "react";
import { TextLayer, DEFAULT_TEXT_LAYER } from "./types";

export function useTextLayers(initialLayers: TextLayer[] = []) {
  const [layers, setLayers] = useState<TextLayer[]>(initialLayers);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const addLayer = useCallback(() => {
    const newLayer: TextLayer = {
      ...DEFAULT_TEXT_LAYER,
      id: crypto.randomUUID(),
      zIndex: layers.length,
    };
    setLayers((prev) => [...prev, newLayer]);
    setSelectedId(newLayer.id);
    return newLayer.id;
  }, [layers.length]);

  const updateLayer = useCallback(
    (id: string, updates: Partial<TextLayer>) => {
      setLayers((prev) =>
        prev.map((layer) =>
          layer.id === id ? { ...layer, ...updates } : layer
        )
      );
    },
    []
  );

  const deleteLayer = useCallback(
    (id: string) => {
      setLayers((prev) => {
        const filtered = prev.filter((layer) => layer.id !== id);
        // Re-index zIndex values
        return filtered.map((layer, idx) => ({ ...layer, zIndex: idx }));
      });
      if (selectedId === id) {
        setSelectedId(null);
      }
    },
    [selectedId]
  );

  const duplicateLayer = useCallback(
    (id: string) => {
      const layer = layers.find((l) => l.id === id);
      if (!layer) return null;

      const newLayer: TextLayer = {
        ...layer,
        id: crypto.randomUUID(),
        x: Math.min(layer.x + 5, 95),
        y: Math.min(layer.y + 5, 95),
        zIndex: layers.length,
      };
      setLayers((prev) => [...prev, newLayer]);
      setSelectedId(newLayer.id);
      return newLayer.id;
    },
    [layers]
  );

  const moveLayer = useCallback(
    (id: string, direction: "up" | "down") => {
      setLayers((prev) => {
        const index = prev.findIndex((l) => l.id === id);
        if (index === -1) return prev;

        const newIndex =
          direction === "up"
            ? Math.min(index + 1, prev.length - 1)
            : Math.max(index - 1, 0);

        if (newIndex === index) return prev;

        const newLayers = [...prev];
        const [removed] = newLayers.splice(index, 1);
        newLayers.splice(newIndex, 0, removed);

        // Re-index zIndex values
        return newLayers.map((layer, idx) => ({ ...layer, zIndex: idx }));
      });
    },
    []
  );

  const clearLayers = useCallback(() => {
    setLayers([]);
    setSelectedId(null);
  }, []);

  const selectedLayer = layers.find((l) => l.id === selectedId) || null;

  return {
    layers,
    selectedId,
    selectedLayer,
    setSelectedId,
    addLayer,
    updateLayer,
    deleteLayer,
    duplicateLayer,
    moveLayer,
    clearLayers,
    setLayers,
  };
}

export type UseTextLayersReturn = ReturnType<typeof useTextLayers>;
