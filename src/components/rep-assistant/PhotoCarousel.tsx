'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  photoNames: string[];
  storeName: string | null;
}

function photoUrl(name: string, maxWidth = 800) {
  return `/api/places-photo?name=${encodeURIComponent(name)}&maxWidth=${maxWidth}`;
}

export default function PhotoCarousel({ photoNames, storeName }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(photoNames.length > 1);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();
    return () => el.removeEventListener('scroll', updateScrollState);
  }, [updateScrollState]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  const lightboxNext = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % photoNames.length);
  }, [lightboxIndex, photoNames.length]);

  const lightboxPrev = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + photoNames.length) % photoNames.length);
  }, [lightboxIndex, photoNames.length]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') lightboxNext();
      else if (e.key === 'ArrowLeft') lightboxPrev();
      else if (e.key === 'Escape') setLightboxIndex(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIndex, lightboxNext, lightboxPrev]);

  if (photoNames.length === 0) return null;

  return (
    <>
      {/* Carousel strip */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        {/* Scrollable row */}
        <div
          ref={scrollRef}
          style={{
            display: 'flex',
            gap: 3,
            height: 150,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            cursor: 'grab',
          }}
          // hide webkit scrollbar via inline style trick (CSS class would need globals)
          onMouseDown={(e) => {
            const el = scrollRef.current;
            if (!el) return;
            const startX = e.pageX - el.offsetLeft;
            const startScroll = el.scrollLeft;
            el.style.cursor = 'grabbing';
            const onMove = (ev: MouseEvent) => {
              el.scrollLeft = startScroll - (ev.pageX - el.offsetLeft - startX);
            };
            const onUp = () => {
              el.style.cursor = 'grab';
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
        >
          {photoNames.map((name, i) => (
            <div
              key={i}
              onClick={() => setLightboxIndex(i)}
              style={{
                flexShrink: 0,
                width: i === 0 ? 220 : 140,
                height: '100%',
                overflow: 'hidden',
                background: '#e5e7eb',
                cursor: 'pointer',
                position: 'relative',
                borderRadius: i === 0 ? '0 0 0 0' : undefined,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(name, 600)}
                alt={`${storeName || 'Store'} photo ${i + 1}`}
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover', display: 'block',
                  transition: 'transform 0.2s ease',
                }}
                loading="lazy"
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              />
              {/* Enlarge hint on first photo */}
              {i === 0 && (
                <div style={{
                  position: 'absolute', bottom: 6, right: 6,
                  background: 'rgba(0,0,0,0.55)', borderRadius: 6,
                  padding: '3px 7px', fontSize: 10, color: '#fff',
                  display: 'flex', alignItems: 'center', gap: 4,
                  pointerEvents: 'none',
                }}>
                  <span>⛶</span>
                  <span>{photoNames.length} photos</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={(e) => { e.stopPropagation(); scroll('left'); }}
            style={{
              position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(0,0,0,0.55)', border: 'none',
              color: '#fff', fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2, lineHeight: 1,
            }}
          >
            ‹
          </button>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <button
            onClick={(e) => { e.stopPropagation(); scroll('right'); }}
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(0,0,0,0.55)', border: 'none',
              color: '#fff', fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2, lineHeight: 1,
            }}
          >
            ›
          </button>
        )}

        {/* Dot indicators */}
        {photoNames.length > 1 && (
          <div style={{
            position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 4, pointerEvents: 'none',
          }}>
            {photoNames.map((_, i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'rgba(255,255,255,0.85)',
                opacity: 0.7,
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          onClick={() => setLightboxIndex(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* Image */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw', maxHeight: '85vh',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl(photoNames[lightboxIndex], 1200)}
              alt={`${storeName || 'Store'} photo ${lightboxIndex + 1}`}
              style={{
                maxWidth: '90vw', maxHeight: '82vh',
                objectFit: 'contain', borderRadius: 8,
                boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                display: 'block',
              }}
            />

            {/* Counter */}
            <div style={{
              position: 'absolute', bottom: -32, left: '50%', transform: 'translateX(-50%)',
              color: 'rgba(255,255,255,0.7)', fontSize: 13, whiteSpace: 'nowrap',
            }}>
              {lightboxIndex + 1} / {photoNames.length}
            </div>
          </div>

          {/* Prev */}
          {photoNames.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); lightboxPrev(); }}
              style={{
                position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', fontSize: 22, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 10000,
              }}
            >
              ‹
            </button>
          )}

          {/* Next */}
          {photoNames.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); lightboxNext(); }}
              style={{
                position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', fontSize: 22, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 10000,
              }}
            >
              ›
            </button>
          )}

          {/* Close */}
          <button
            onClick={() => setLightboxIndex(null)}
            style={{
              position: 'fixed', top: 16, right: 16,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10000,
            }}
          >
            ×
          </button>

          {/* Thumbnail strip at bottom */}
          {photoNames.length > 1 && (
            <div style={{
              position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: 6, zIndex: 10000,
            }}>
              {photoNames.map((name, i) => (
                <div
                  key={i}
                  onClick={e => { e.stopPropagation(); setLightboxIndex(i); }}
                  style={{
                    width: 52, height: 36, borderRadius: 5, overflow: 'hidden',
                    cursor: 'pointer', flexShrink: 0,
                    outline: i === lightboxIndex ? '2px solid #fff' : '2px solid transparent',
                    opacity: i === lightboxIndex ? 1 : 0.55,
                    transition: 'opacity 0.15s, outline 0.15s',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl(name, 200)}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
