"use client";

import { useState, useEffect } from "react";
import { useComponentStore } from "@/app/workspace/stores/componentStore";
import { useWorkspaceId } from "@/app/workspace/components/WorkspaceContext";
import { useContentSync } from "@/lib/sync/useContentSync";
import {
  Plus,
  Trash2,
  Edit2,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import InteractiveImageBentoGallery, {
  ImageItem,
} from "@/components/ui/bento-gallery";
import type { ComponentPreviewProps } from "@/components/playground/registry";

// ============================================================
// Component
// ============================================================

export default function BentoGalleryPreview({ onOutput }: ComponentPreviewProps) {
  const storedState = useComponentStore((s) => s.componentStates['bento-gallery']);
  const workspaceId = useWorkspaceId();

  const [images, setImages] = useState<ImageItem[]>([]);

  // Sync selected image to componentStore
  const syncSelectedImage = useContentSync('bento-gallery', 'selectedImageId', 1000);
  const [title, setTitle] = useState("Research Gallery");
  const [description, setDescription] = useState(
    "Images collected by the research agent. Send a query to populate."
  );
  const [showConfig, setShowConfig] = useState(false);

  // Listen for agent gallery directives
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const newImages = detail?.images;
      if (!Array.isArray(newImages)) return;

      setImages((prev) => [
        ...prev,
        ...newImages.map((img: { title: string; description?: string; url: string }, i: number) => ({
          id: prev.length + i + 1,
          title: img.title,
          desc: img.description || '',
          url: img.url,
          span: i === 0 ? 'md:col-span-2 md:row-span-2' : 'md:row-span-1',
        })),
      ]);
      setTitle('Agent Gallery');
      setDescription('Images collected by the research agent.');
    };
    window.addEventListener('agent:directive:UPDATE_GALLERY', handler);
    return () => window.removeEventListener('agent:directive:UPDATE_GALLERY', handler);
  }, []);

  // Report state to parent
  useEffect(() => {
    if (onOutput) {
      onOutput({
        imageCount: images.length,
        title,
      });
    }
  }, [images, title, onOutput]);

  const handleAddImage = () => {
    const newId = Math.max(...images.map((i) => Number(i.id)), 0) + 1;
    const newImage: ImageItem = {
      id: newId,
      title: `Image ${newId}`,
      desc: "Click to edit description",
      url: `https://picsum.photos/seed/${newId}/800/600`,
      span: "md:row-span-1",
    };
    setImages([...images, newImage]);
  };

  const handleRemoveImage = (id: number | string) => {
    setImages(images.filter((img) => img.id !== id));
  };

  const handleRefresh = () => {
    setImages(
      images.map((img) => ({
        ...img,
        url: img.url.includes("picsum")
          ? `https://picsum.photos/seed/${Date.now() + Number(img.id)}/800/600`
          : img.url,
      }))
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <ImageIcon className="h-5 w-5 text-indigo-600" />
          <span className="text-sm font-medium text-slate-800">
            Bento Gallery
          </span>
          <span className="px-2 py-0.5 text-xs bg-slate-200 text-slate-600 rounded-full">
            {images.length} images
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            title="Refresh images"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            onClick={handleAddImage}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-1.5 rounded transition-colors ${
              showConfig
                ? "bg-indigo-100 text-indigo-600"
                : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            }`}
            title="Toggle configuration"
          >
            <Edit2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex-shrink-0">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-white text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-white text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Image List */}
          <div className="mt-3">
            <label className="block text-xs text-slate-600 mb-2">
              Images (click to remove)
            </label>
            <div className="flex flex-wrap gap-2">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="group relative w-16 h-16 rounded-lg overflow-hidden cursor-pointer border border-slate-200"
                  onClick={() => handleRemoveImage(img.id)}
                >
                  <img
                    src={img.url}
                    alt={img.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/60 transition-colors flex items-center justify-center">
                    <Trash2 className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Gallery Content */}
      <div className="flex-1 min-h-0 overflow-auto p-4 bg-slate-50/50">
        {images.length > 0 ? (
          <InteractiveImageBentoGallery
            imageItems={images}
            title={title}
            description={description}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <ImageIcon className="h-12 w-12 mb-3" />
            <p className="text-sm font-medium">No images yet</p>
            <p className="text-xs mt-1">Ask the agent to collect images for your research</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Drag to scroll, click image to expand</span>
          <span>Use arrow keys in lightbox</span>
        </div>
      </div>
    </div>
  );
}
