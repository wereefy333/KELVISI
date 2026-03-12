import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';

// Buttons
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' }> = ({ 
  className = '', 
  variant = 'primary', 
  children, 
  ...props 
}) => {
  const baseStyle = "inline-flex items-center justify-center gap-2 whitespace-nowrap px-6 py-3 rounded-none font-sans uppercase tracking-widest text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-gold-500 text-black hover:bg-gold-400 font-bold",
    outline: "border border-gold-500 text-gold-500 hover:bg-gold-500 hover:text-black",
    ghost: "text-zinc-400 hover:text-white"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

// Section Title
export const SectionTitle: React.FC<{ title: string; subtitle?: string; centered?: boolean }> = ({ title, subtitle, centered = false }) => (
  <div className={`mb-12 ${centered ? 'text-center' : ''}`}>
    <h2 className="text-3xl md:text-4xl font-serif text-white mb-3">{title}</h2>
    {subtitle && <div className="h-0.5 w-24 bg-gold-500 mb-4 mx-auto md:mx-0" style={centered ? { marginLeft: 'auto', marginRight: 'auto' } : {}} />}
    {subtitle && <p className="text-zinc-400 font-sans tracking-wide uppercase text-sm">{subtitle}</p>}
  </div>
);

// Card Wrapper
export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void; active?: boolean }> = ({ 
  children, 
  className = '', 
  onClick,
  active = false
}) => (
  <div 
    onClick={onClick}
    className={`
      bg-zinc-900 border transition-all duration-300 cursor-pointer overflow-hidden relative
      ${active ? 'border-gold-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'border-zinc-800 hover:border-zinc-600'}
      ${className}
    `}
  >
    {children}
  </div>
);

// LazyImage — shimmer skeleton + fade-in + error fallback
export const LazyImage: React.FC<{
  src: string;
  alt?: string;
  wrapperClass?: string;  // outer sizing, rounding, overflow, etc.
  imgClass?: string;      // object-fit, effects — applied to <img>
  imgStyle?: React.CSSProperties;
  children?: React.ReactNode; // e.g. absolute overlays inside the image area
}> = ({ src, alt = '', wrapperClass = '', imgClass = 'object-cover', imgStyle, children }) => {
  const [loaded, setLoaded] = React.useState(false);
  const [error,  setError]  = React.useState(false);

  // reset state when src changes (e.g. carousel slide change)
  const prevSrc = React.useRef(src);
  if (prevSrc.current !== src) {
    prevSrc.current = src;
    setLoaded(false);
    setError(false);
  }

  return (
    <div className={`relative overflow-hidden bg-zinc-800 ${wrapperClass}`}>
      {/* Shimmer — visible while loading */}
      {!loaded && !error && (
        <div className="absolute inset-0 animate-shimmer z-10 pointer-events-none" />
      )}

      {/* Error fallback */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 z-10">
          <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}

      {/* Image — opacity-0 until loaded, then fades in */}
      {!error && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={{ ...imgStyle, opacity: loaded ? undefined : 0 }}
          className={`w-full h-full transition-opacity duration-700 ${imgClass}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}

      {children}
    </div>
  );
};

// Lightbox
export interface LightboxImage {
  url: string;
  title?: string;
  description?: string;
}

export const Lightbox: React.FC<{
  images: LightboxImage[];
  initialIndex: number;
  onClose: () => void;
}> = ({ images, initialIndex, onClose }) => {
  const [current, setCurrent] = React.useState(initialIndex);
  const [zoom, setZoom] = React.useState(1);
  const [hasImageError, setHasImageError] = React.useState(false);

  const prev = useCallback(() => { setCurrent(i => (i - 1 + images.length) % images.length); setZoom(1); }, [images.length]);
  const next = useCallback(() => { setCurrent(i => (i + 1) % images.length); setZoom(1); }, [images.length]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(z => Math.max(1, Math.min(4, z + (e.deltaY > 0 ? -0.15 : 0.15))));
    }
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose, prev, next]);

  useEffect(() => {
    setHasImageError(false);
  }, [current, images]);

  const img = images[current];
  const hasThumbs = images.length > 1;

  const lightboxNode = (
    <div
      className="fixed inset-0 z-[9999] bg-black/95"
      onClick={onClose}
      onWheel={handleWheel}
      role="dialog"
      aria-modal="true"
    >
      {/* Close */}
      <button
        onClick={e => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 rounded-full p-2 transition-all z-50"
        aria-label="Закрыть"
      >
        <X size={24} />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-zinc-400 text-sm tracking-widest z-50 text-center">
        <div>{current + 1} / {images.length}</div>
        {zoom > 1 && <div className="text-xs text-gold-400 mt-1">Зум: {zoom.toFixed(1)}x</div>}
      </div>

      {/* Image area — padded so arrows/thumbs don't overlap */}
      <div
        className={`absolute flex items-center justify-center top-14 left-3 right-3 md:left-[72px] md:right-[72px] ${
          hasThumbs && zoom === 1 ? 'bottom-24 md:bottom-[88px]' : 'bottom-6'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center w-full h-full" style={{ overflow: zoom > 1 ? 'visible' : 'hidden' }}>
          {!hasImageError ? (
            <img
              key={img.url}
              src={img.url}
              alt={img.title ?? ''}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-full object-contain rounded shadow-2xl select-none"
              style={{
                transition: 'transform 0.2s ease',
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                cursor: zoom > 1 ? 'zoom-out' : 'zoom-in',
              }}
              onClick={e => { e.stopPropagation(); setZoom(z => z > 1 ? 1 : 2); }}
              onError={() => setHasImageError(true)}
              draggable={false}
            />
          ) : (
            <div className="max-w-2xl text-center px-6 py-8 border border-zinc-700 rounded bg-zinc-900/70">
              <p className="text-white font-medium mb-2">Не удалось загрузить фото в увеличении</p>
              <p className="text-zinc-400 text-sm mb-4">Источник изображения может блокировать открытие.</p>
              <a
                href={img.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-block px-4 py-2 border border-gold-500 text-gold-400 hover:bg-gold-500 hover:text-black transition-colors text-sm"
                onClick={e => e.stopPropagation()}
              >
                Открыть оригинал
              </a>
            </div>
          )}
          {/* Caption */}
          {(img.title || img.description) && zoom === 1 && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 rounded-b pointer-events-none">
              {img.title && <p className="text-white font-semibold">{img.title}</p>}
              {img.description && <p className="text-gold-400 text-sm">{img.description}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Prev */}
      {hasThumbs && (
        <button
          onClick={e => { e.stopPropagation(); prev(); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-zinc-800/80 hover:bg-gold-500 rounded-full p-3 transition-all z-50"
          aria-label="Предыдущее"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* Next */}
      {hasThumbs && (
        <button
          onClick={e => { e.stopPropagation(); next(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-zinc-800/80 hover:bg-gold-500 rounded-full p-3 transition-all z-50"
          aria-label="Следующее"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Thumbnail strip */}
      {hasThumbs && zoom === 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto max-w-[calc(100vw-24px)] md:max-w-[calc(100vw-160px)] px-2 z-50"
          onClick={e => e.stopPropagation()}
        >
          {images.map((thumb, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setCurrent(i); setZoom(1); }}
              className={`flex-shrink-0 w-14 h-14 rounded overflow-hidden border-2 transition-all ${
                i === current ? 'border-gold-500 opacity-100 ring-2 ring-gold-500/50' : 'border-zinc-700 opacity-50 hover:opacity-90 hover:border-zinc-500'
              }`}
              aria-label={`Фото ${i + 1}`}
            >
              <img src={thumb.url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Keyboard hint */}
      {zoom === 1 && (
        <div className="absolute bottom-3 right-3 text-zinc-600 text-xs text-right pointer-events-none z-40 hidden md:block">
          <div>Ctrl + колесо — зум</div>
          <div>← → — навигация · Esc — закрыть</div>
        </div>
      )}
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(lightboxNode, document.body);
};

// ZoomIcon helper — overlaid on gallery images
export const ZoomHint: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
    <div className="bg-black/60 rounded-full p-3 backdrop-blur-sm">
      <ZoomIn size={22} className="text-gold-400" />
    </div>
  </div>
);

// Badge
export const Badge: React.FC<{ children: React.ReactNode; type?: 'vip' | 'standard' }> = ({ children, type = 'standard' }) => {
  const styles = type === 'vip' 
    ? 'bg-gradient-to-r from-gold-600 to-yellow-300 text-black font-bold' 
    : 'bg-zinc-800 text-zinc-300';
    
  return (
    <span className={`px-2 py-1 text-[10px] uppercase tracking-wider rounded ${styles}`}>
      {children}
    </span>
  );
};

