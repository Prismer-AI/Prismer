"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { X, ZoomIn, ChevronLeft, ChevronRight, Grip } from "lucide-react";

// ============================================================
// Types
// ============================================================

export interface ImageItem {
  id: number | string;
  title: string;
  desc: string;
  url: string;
  span?: string;
}

export interface InteractiveImageBentoGalleryProps {
  imageItems: ImageItem[];
  title?: string;
  description?: string;
  className?: string;
}

// ============================================================
// Image Card Component
// ============================================================

interface ImageCardProps {
  item: ImageItem;
  onClick: () => void;
}

function ImageCard({ item, onClick }: ImageCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl bg-slate-100 cursor-pointer group shadow-sm border border-slate-200 ${item.span || ""}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Image */}
      <div className="absolute inset-0">
        {!isLoaded && (
          <div className="absolute inset-0 bg-slate-200 animate-pulse" />
        )}
        <img
          src={item.url}
          alt={item.title}
          className={`w-full h-full object-cover transition-all duration-500 ${
            isLoaded ? "opacity-100" : "opacity-0"
          } ${isHovered ? "scale-110" : "scale-100"}`}
          onLoad={() => setIsLoaded(true)}
          draggable={false}
        />
      </div>

      {/* Gradient Overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300 ${
          isHovered ? "opacity-100" : "opacity-60"
        }`}
      />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4 transform transition-transform duration-300">
        <h3 className="text-white font-semibold text-lg mb-1">{item.title}</h3>
        <p
          className={`text-white/70 text-sm transition-all duration-300 ${
            isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          {item.desc}
        </p>
      </div>

      {/* Zoom Icon */}
      <div
        className={`absolute top-4 right-4 p-2 rounded-full bg-white/10 backdrop-blur-sm transition-all duration-300 ${
          isHovered ? "opacity-100 scale-100" : "opacity-0 scale-90"
        }`}
      >
        <ZoomIn className="w-4 h-4 text-white" />
      </div>
    </motion.div>
  );
}

// ============================================================
// Lightbox Component
// ============================================================

interface LightboxProps {
  items: ImageItem[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

function Lightbox({ items, currentIndex, onClose, onNext, onPrev }: LightboxProps) {
  const currentItem = items[currentIndex];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNext, onPrev]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Navigation Buttons */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      )}

      {currentIndex < items.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Image */}
      <motion.div
        key={currentItem.id}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="relative max-w-[90vw] max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={currentItem.url}
          alt={currentItem.title}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />

        {/* Caption */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg">
          <h3 className="text-white font-semibold text-xl mb-1">
            {currentItem.title}
          </h3>
          <p className="text-white/70">{currentItem.desc}</p>
        </div>
      </motion.div>

      {/* Thumbnails */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/50 rounded-full backdrop-blur-sm">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={(e) => {
              e.stopPropagation();
              // Navigate to this image
              const diff = index - currentIndex;
              if (diff > 0) {
                for (let i = 0; i < diff; i++) onNext();
              } else if (diff < 0) {
                for (let i = 0; i < -diff; i++) onPrev();
              }
            }}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex
                ? "bg-white w-6"
                : "bg-white/40 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================
// Draggable Gallery Container
// ============================================================

interface DraggableGalleryProps {
  children: React.ReactNode;
}

function DraggableGallery({ children }: DraggableGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div
      ref={containerRef}
      className={`overflow-x-auto scrollbar-hide ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      {children}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function InteractiveImageBentoGallery({
  imageItems,
  title,
  description,
  className = "",
}: InteractiveImageBentoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleImageClick = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) =>
      prev !== null && prev < imageItems.length - 1 ? prev + 1 : prev
    );
  }, [imageItems.length]);

  const handlePrev = useCallback(() => {
    setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
  }, []);

  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      {(title || description) && (
        <div className="mb-6">
          {title && (
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
              <Grip className="w-5 h-5 text-slate-500" />
            </div>
          )}
          {description && (
            <p className="text-slate-600">{description}</p>
          )}
        </div>
      )}

      {/* Gallery Grid */}
      <DraggableGallery>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[200px] min-w-max md:min-w-0">
          {imageItems.map((item, index) => (
            <ImageCard
              key={item.id}
              item={item}
              onClick={() => handleImageClick(index)}
            />
          ))}
        </div>
      </DraggableGallery>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedIndex !== null && (
          <Lightbox
            items={imageItems}
            currentIndex={selectedIndex}
            onClose={handleClose}
            onNext={handleNext}
            onPrev={handlePrev}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default InteractiveImageBentoGallery;
