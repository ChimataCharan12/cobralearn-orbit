import { useSyncExternalStore } from "react";
import {
  INITIAL_MEDIA_ITEMS,
  type MediaCategory,
  type MediaItem,
  type MediaType,
} from "@/lib/media-data";

// In-memory central media collection for frontend lifecycle
let currentMediaItems: MediaItem[] = [...INITIAL_MEDIA_ITEMS];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export const mediaStore = {
  getSnapshot(): MediaItem[] {
    return currentMediaItems;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getAll(): MediaItem[] {
    return currentMediaItems;
  },

  add(item: MediaItem): MediaItem {
    // Prevent duplicate entries by id
    const exists = currentMediaItems.some((m) => m.id === item.id);
    if (!exists) {
      currentMediaItems = [item, ...currentMediaItems];
      notify();
    }
    return item;
  },

  addFromFile(
    file: File,
    category: MediaCategory = "General",
    metadata?: Partial<MediaItem>
  ): MediaItem {
    // 1. Determine size formatted
    let sizeStr = "0 KB";
    if (file.size < 1024 * 1024) {
      sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
    } else {
      sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    }

    // 2. Determine type
    let type: MediaType = "Others";
    if (
      file.type.startsWith("image/") ||
      /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(file.name)
    ) {
      type = "Image";
    } else if (
      file.type.startsWith("video/") ||
      /\.(mp4|webm|mov|avi|mkv)$/i.test(file.name)
    ) {
      type = "Video";
    } else if (
      file.type.startsWith("application/pdf") ||
      /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt)$/i.test(file.name)
    ) {
      type = "Document";
    }

    // 3. Create blob preview URL for images & videos
    let previewUrl: string | undefined;
    if (typeof window !== "undefined") {
      try {
        previewUrl = URL.createObjectURL(file);
      } catch {
        previewUrl = undefined;
      }
    }

    // 4. Construct MediaItem
    const newItem: MediaItem = {
      id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: metadata?.name || file.name,
      type: metadata?.type || type,
      category: metadata?.category || category,
      size: sizeStr,
      date: "Today",
      ...(previewUrl ? { thumbnail: previewUrl, url: previewUrl } : {}),
      description: metadata?.description || "",
      tags: metadata?.tags || [],
      altText: metadata?.altText || file.name.replace(/\.[^/.]+$/, ""),
      visibility: metadata?.visibility || "Public (Showcase)",
      usageRights: metadata?.usageRights || "Internal Use",
      mimeType: file.type,
      createdAt: new Date().toISOString(),
    };

    currentMediaItems = [newItem, ...currentMediaItems];
    notify();
    return newItem;
  },

  remove(id: string): void {
    currentMediaItems = currentMediaItems.filter((m) => m.id !== id);
    notify();
  },

  removeBulk(ids: string[]): void {
    currentMediaItems = currentMediaItems.filter((m) => !ids.includes(m.id));
    notify();
  },

  reset(): void {
    currentMediaItems = [...INITIAL_MEDIA_ITEMS];
    notify();
  },
};

/**
 * React hook to access and subscribe to the central media store.
 */
export function useMediaStore() {
  const mediaItems = useSyncExternalStore(
    mediaStore.subscribe,
    mediaStore.getSnapshot,
    mediaStore.getSnapshot
  );

  return {
    mediaItems,
    addMediaItem: mediaStore.add,
    addMediaFromFile: mediaStore.addFromFile,
    removeMediaItem: mediaStore.remove,
    removeBulkMediaItems: mediaStore.removeBulk,
    resetMediaStore: mediaStore.reset,
  };
}
