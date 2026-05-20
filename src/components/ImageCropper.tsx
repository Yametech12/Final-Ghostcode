import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, ZoomIn, ZoomOut, RotateCcw, Check } from 'lucide-react';

interface ImageCropperProps {
  imageUrl: string;
  onCrop: (croppedBlob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number;
}

/**
 * Simple drag-to-pan + scroll/slider-to-zoom image cropper.
 * Outputs a square-cropped Blob ready for upload.
 * Uses native event listeners for touch/wheel to avoid passive listener issues.
 */
export default function ImageCropper({ imageUrl, onCrop, onCancel }: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);

  const CROP_SIZE = 260;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 4;

  // Keep positionRef in sync
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Center image when loaded
  useEffect(() => {
    if (imgLoaded) {
      setPosition({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [imgLoaded]);

  // Native wheel listener (non-passive) to prevent page scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Native touch listeners (non-passive) to prevent page scroll during drag
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX - positionRef.current.x,
        y: e.touches[0].clientY - positionRef.current.y,
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      const newPos = {
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y,
      };
      setPosition(newPos);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - positionRef.current.x, y: e.clientY - positionRef.current.y };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  }, []);

  const handleCrop = useCallback(() => {
    if (!imgRef.current || !containerRef.current) return;

    const canvas = document.createElement('canvas');
    const outputSize = 512;
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imgRef.current;
    const containerRect = containerRef.current.getBoundingClientRect();

    const cropCenterX = containerRect.width / 2;
    const cropCenterY = containerRect.height / 2;

    const displayedWidth = img.naturalWidth * zoom;
    const displayedHeight = img.naturalHeight * zoom;

    const imgLeft = cropCenterX - displayedWidth / 2 + position.x;
    const imgTop = cropCenterY - displayedHeight / 2 + position.y;

    const cropLeft = (containerRect.width - CROP_SIZE) / 2;
    const cropTop = (containerRect.height - CROP_SIZE) / 2;

    const sx = (cropLeft - imgLeft) / zoom;
    const sy = (cropTop - imgTop) / zoom;
    const sWidth = CROP_SIZE / zoom;
    const sHeight = CROP_SIZE / zoom;

    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, outputSize, outputSize);

    canvas.toBlob((blob) => {
      if (blob) onCrop(blob);
    }, 'image/jpeg', 0.9);
  }, [zoom, position, onCrop]);

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-mystic-950/90 backdrop-blur-md"
        onClick={onCancel}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className="relative w-full max-w-md bg-mystic-900/95 backdrop-blur-xl border border-accent-primary/8 rounded-2xl shadow-[0_24px_80px_-16px_rgba(0,0,0,0.65)] overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700/30 flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight text-slate-100">Crop Photo</h3>
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="p-2 rounded-xl hover:bg-white/5 text-slate-400 transition-colors"
          >
            <X aria-hidden="true" className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Crop area */}
        <div
          ref={containerRef}
          className="relative w-full aspect-square bg-mystic-950 overflow-hidden cursor-move select-none touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Image */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Crop preview"
            onLoad={() => setImgLoaded(true)}
            className="absolute top-1/2 left-1/2 max-w-none pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
            draggable={false}
          />

          {/* Crop overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle ${CROP_SIZE / 2}px at center, transparent ${CROP_SIZE / 2 - 1}px, rgba(14, 11, 18, 0.75) ${CROP_SIZE / 2}px)`,
              }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent-primary/60"
              style={{ width: CROP_SIZE, height: CROP_SIZE }}
            />
          </div>

          {/* Instructions */}
          {!isDragging && (
            <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
              <span className="text-[10px] text-slate-400 bg-mystic-950/80 px-3 py-1 rounded-full">
                Drag to move • Scroll to zoom
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-slate-700/30 space-y-4">
          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleZoom(-0.2)}
              aria-label="Zoom out"
              className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <ZoomOut className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <input
              type="range"
              min={MIN_ZOOM * 100}
              max={MAX_ZOOM * 100}
              value={zoom * 100}
              onChange={(e) => setZoom(Number(e.target.value) / 100)}
              className="flex-1 h-1.5 bg-mystic-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-primary [&::-webkit-slider-thumb]:shadow-lg"
            />
            <button
              onClick={() => handleZoom(0.2)}
              aria-label="Zoom in"
              className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <ZoomIn className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={handleReset}
              aria-label="Reset"
              className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <RotateCcw className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl bg-white/5 border border-slate-700/30 text-slate-100 font-semibold tracking-wide hover:bg-white/8 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCrop}
              className="flex-1 py-3 rounded-xl accent-gradient text-mystic-950 font-semibold tracking-wide shadow-lg shadow-accent-primary/15 hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" strokeWidth={2} />
              Apply
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
