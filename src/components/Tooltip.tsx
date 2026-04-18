import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactNode;
  term?: string;
  definition?: string;
  content?: string;
}

export default function Tooltip({ children, term, definition, content }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0, align: 'center' as 'center' | 'left' | 'right' });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const showTimeout = useRef<NodeJS.Timeout | null>(null);
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      
      // Check viewport boundaries
      const viewportWidth = window.innerWidth;
      const tooltipMaxWidth = 320; // max-w-xs is 20rem = 320px
      const halfWidth = tooltipMaxWidth / 2;
      
      let align: 'center' | 'left' | 'right' = 'center';
      let x = centerX;

      if (centerX - halfWidth < 16) {
        // Too close to left edge
        align = 'left';
        x = Math.max(16, rect.left);
      } else if (centerX + halfWidth > viewportWidth - 16) {
        // Too close to right edge
        align = 'right';
        x = Math.min(viewportWidth - 16, rect.right);
      }

      setCoords({
        x,
        y: rect.top - 8, // 8px gap above the element
        align
      });
    }
  };

  const handleShow = () => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    showTimeout.current = setTimeout(() => {
      setIsVisible(true);
      // Small delay to ensure DOM is ready before calculating position
      setTimeout(updatePosition, 0);
    }, 150); // Small delay before showing
  };

  const handleHide = () => {
    if (showTimeout.current) clearTimeout(showTimeout.current);
    hideTimeout.current = setTimeout(() => {
      setIsVisible(false);
    }, 100); // Small delay before hiding
  };

  useEffect(() => {
    if (isVisible) {
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isVisible]);

  return (
    <>
      <span
        ref={triggerRef}
        className="relative inline-block cursor-help border-b border-dashed border-accent-primary/50 text-accent-primary hover:text-accent-secondary transition-colors"
        onMouseEnter={handleShow}
        onMouseLeave={handleHide}
        onFocus={handleShow}
        onBlur={handleHide}
        onClick={(e) => {
          // Toggle for touch devices
          if (isVisible) handleHide();
          else handleShow();
          e.stopPropagation();
        }}
        tabIndex={0}
      >
        {children}
      </span>
      {isVisible && createPortal(
        <div
          style={{
            position: 'fixed',
            left: coords.x,
            top: coords.y,
            transform: `translate(${coords.align === 'left' ? '0' : coords.align === 'right' ? '-100%' : '-50%'}, -100%)`,
            zIndex: 9999,
          }}
          className="pointer-events-none w-max max-w-[calc(100vw-32px)] sm:max-w-xs p-3 rounded-xl bg-mystic-900 border border-white/10 shadow-xl shadow-black/50 animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="text-sm font-bold text-accent-primary mb-1">{term}</div>
          <div className="text-xs text-slate-300 leading-relaxed">{content || definition}</div>
          
          {/* Tooltip Arrow */}
          <div 
            className="absolute -bottom-2 border-8 border-transparent border-t-mystic-900"
            style={{ 
              filter: 'drop-shadow(0 1px 0 rgba(255,255,255,0.1))',
              left: coords.align === 'left' ? '16px' : coords.align === 'right' ? 'calc(100% - 32px)' : '50%',
              transform: coords.align === 'center' ? 'translateX(-50%)' : 'none'
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
}
