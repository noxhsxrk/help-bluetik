'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function KofiButton() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef({
    startX: 0, startY: 0,
    currentX: 0, currentY: 0,
    lastX: 0, lastY: 0,
    isDragging: false, isActive: false
  });

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.isActive) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (!drag.isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        drag.isDragging = true;
        setIsDragging(true);
      }

      if (drag.isDragging) {
        e.preventDefault();
        const newX = drag.currentX + dx;
        const newY = drag.currentY + dy;
        drag.lastX = newX;
        drag.lastY = newY;
        setPosition({ x: newX, y: newY });
      }
    };

    const handlePointerUp = () => {
      const drag = dragRef.current;
      if (!drag.isActive) return;
      drag.isActive = false;

      if (drag.isDragging && wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        const isCloserToLeft = center < window.innerWidth / 2;

        const marginX = 20;
        const marginY = 20;

        let deltaX = 0;
        if (isCloserToLeft) {
          deltaX = marginX - rect.left;
        } else {
          deltaX = (window.innerWidth - marginX) - rect.right;
        }

        let deltaY = 0;
        const bottomMargin = 24;
        if (rect.top < marginY) {
          deltaY = marginY - rect.top;
        } else if (rect.bottom > window.innerHeight - bottomMargin) {
          deltaY = (window.innerHeight - bottomMargin) - rect.bottom;
        }

        const finalX = drag.lastX + deltaX;
        const finalY = drag.lastY + deltaY;
        setPosition({ x: finalX, y: finalY });
        drag.lastX = finalX;
        drag.lastY = finalY;
      }

      setTimeout(() => {
        setIsDragging(false);
        drag.isDragging = false;
      }, 50);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== -1) return;
    dragRef.current = {
      ...dragRef.current,
      startX: e.clientX,
      startY: e.clientY,
      currentX: position.x,
      currentY: position.y,
      lastX: position.x,
      lastY: position.y,
      isDragging: false,
      isActive: true
    };
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging || dragRef.current.isDragging) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      ref={wrapperRef}
      onPointerDown={handlePointerDown}
      className="kofi-floating-wrapper"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        touchAction: 'none',
        transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      }}
    >
      <div className="kofi-animation-container">
        <a
          href="https://ko-fi.com/brandnewnox"
          target="_blank"
          rel="noopener noreferrer"
          className="kofi-floating-btn"
          aria-label="สนับสนุนค่ากาแฟ"
          onClick={handleClick}
          draggable={false}
          style={{
            position: 'static',
            margin: 0,
            pointerEvents: isDragging ? 'none' : 'auto',
            cursor: isDragging ? 'grabbing' : 'pointer'
          }}
        >
          <div className="kofi-btn-content">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              className="kofi-btn-icon"
              aria-hidden="true"
            >
              <path d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298" />
            </svg>
            <span>เลี้ยงกาแฟ</span>
          </div>
        </a>
      </div>
    </div>
  );
}
