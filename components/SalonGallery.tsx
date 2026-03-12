import React from 'react';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { Lightbox } from './Shared';

type SalonImage = {
  previewUrl: string;
  lightboxUrl: string;
  title: string;
  description: string;
  // Manual framing controls:
  // focus: object-position for the visible crop (e.g. '50% 25%')
  // scale: additional zoom for the carousel crop (1 = no extra zoom)
  focus?: string;
  thumbFocus?: string;
  scale?: number;
};

const salonImages: SalonImage[] = [
  {
    previewUrl: 'https://i.pinimg.com/1200x/07/ed/4f/07ed4ff3934eafc18e1b46af739fed29.jpg',
    lightboxUrl: 'https://i.pinimg.com/1200x/07/ed/4f/07ed4ff3934eafc18e1b46af739fed29.jpg',
    title: 'Современный интерьер салона',
    description: 'Уютная и стильная обстановка',
    focus: '50% 48%',
    thumbFocus: '50% 52%',
    scale: 1.06,
  },
  {
    previewUrl: 'https://i.pinimg.com/1200x/66/92/96/6692961a1cb07a8dd66839ce35543a6a.jpg',
    lightboxUrl: 'https://i.pinimg.com/1200x/66/92/96/6692961a1cb07a8dd66839ce35543a6a.jpg',
    title: 'Мастерство барбера',
    description: 'Профессиональная стрижка и уход',
    focus: '50% 48%',
    thumbFocus: '50% 34%',
    scale: 1.12,
  },
  {
    previewUrl: 'https://i.pinimg.com/1200x/5c/59/ec/5c59ec53965a9a43653e71f50869dcf2.jpg',
    lightboxUrl: 'https://i.pinimg.com/1200x/5c/59/ec/5c59ec53965a9a43653e71f50869dcf2.jpg',
    title: 'Рабочее место стилиста',
    description: 'Оборудованные кабинеты для посетителей',
    focus: '50% 60%',
    thumbFocus: '50% 46%',
    scale: 1.08,
  },
  {
    previewUrl: 'https://i.pinimg.com/1200x/b9/60/ea/b960eacf4df43536ea212516295b66df.jpg',
    lightboxUrl: 'https://i.pinimg.com/1200x/b9/60/ea/b960eacf4df43536ea212516295b66df.jpg',
    title: 'Барберские инструменты',
    description: 'Только профессиональный инструментарий',
    focus: '50% 50%',
    thumbFocus: '50% 50%',
    scale: 1.04,
  },
  {
    previewUrl: 'https://i.pinimg.com/1200x/76/9e/b1/769eb1d867264d5e4b2daf5c985a212e.jpg',
    lightboxUrl: 'https://i.pinimg.com/1200x/76/9e/b1/769eb1d867264d5e4b2daf5c985a212e.jpg',
    title: 'Уход и стайлинг',
    description: 'Профессиональный уход за волосами',
    focus: '50% 22%',
    thumbFocus: '50% 30%',
    scale: 1.1,
  },
  {
    previewUrl: 'https://i.pinimg.com/1200x/df/3a/a2/df3aa2749a93b1a3a0aca0896a735d75.jpg',
    lightboxUrl: 'https://i.pinimg.com/1200x/df/3a/a2/df3aa2749a93b1a3a0aca0896a735d75.jpg',
    title: 'VIP зона',
    description: 'Комфорт и внимание к каждому гостю',
    focus: '50% 60%',
    thumbFocus: '50% 52%',
    scale: 1.05,
  },
];

export const SalonGallery: React.FC = () => {
  const [current, setCurrent] = React.useState(0);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  const [animDir, setAnimDir] = React.useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = React.useState(false);

  const goTo = (index: number, dir: 'left' | 'right') => {
    if (isAnimating) return;
    setAnimDir(dir);
    setIsAnimating(true);
    setTimeout(() => {
      setCurrent(index);
      setAnimDir(null);
      setIsAnimating(false);
    }, 320);
  };

  const prev = () => goTo((current - 1 + salonImages.length) % salonImages.length, 'right');
  const next = () => goTo((current + 1) % salonImages.length, 'left');

  const img = salonImages[current];

  return (
    <>
      <div className="py-16 bg-black">
        <div className="text-center mb-10 px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Наш Салон</h2>
          <p className="text-zinc-400 max-w-2xl mx-auto text-sm leading-relaxed">
            Добро пожаловать в мир профессиональной красоты и стиля. Наш салон предоставляет
            премиум-услуги в роскошной обстановке.
          </p>
        </div>

        <div className="relative w-full max-w-7xl mx-auto px-0 md:px-6 mb-6">
          <div
            className="relative w-full overflow-hidden rounded-none md:rounded-xl border-0 md:border border-zinc-800 cursor-zoom-in group select-none"
            style={{ height: 'clamp(320px, 52vw, 680px)' }}
            onClick={() => setLightboxIndex(current)}
          >
            {salonImages.map((slide, i) => (
              <div
                key={slide.previewUrl}
                className="absolute inset-0 transition-all duration-300"
                style={{
                  opacity: i === current ? 1 : 0,
                  transform:
                    i === current
                      ? animDir === 'left'
                        ? 'translateX(-3%)'
                        : animDir === 'right'
                        ? 'translateX(3%)'
                        : 'translateX(0)'
                      : 'translateX(0)',
                  zIndex: i === current ? 1 : 0,
                  pointerEvents: i === current ? 'auto' : 'none',
                }}
              >
                <img
                  src={slide.previewUrl}
                  alt={slide.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  style={{
                    objectPosition: slide.focus ?? '50% 50%',
                    transform: `scale(${slide.scale ?? 1})`,
                    transition: 'transform 300ms ease',
                  }}
                  draggable={false}
                />
              </div>
            ))}

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none z-10" />
            <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 z-10 pointer-events-none">
              <h3 className="text-xl md:text-2xl font-bold text-white leading-tight">{img.title}</h3>
              <p className="text-gold-400 text-sm mt-0.5">{img.description}</p>
            </div>

            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
              <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm">
                <ZoomIn size={22} className="text-gold-400" />
              </div>
            </div>

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-20 pointer-events-none">
              {salonImages.map((_, i) => (
                <span
                  key={i}
                  className={`block rounded-full transition-all duration-300 ${
                    i === current ? 'bg-gold-500 w-6 h-2' : 'bg-white/40 w-2 h-2'
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            onClick={e => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-0 md:left-0 top-1/2 -translate-y-6 -translate-x-0 md:-translate-x-5 bg-zinc-900/90 hover:bg-gold-500 text-white hover:text-black border border-zinc-700 hover:border-gold-500 p-3 rounded-full transition-all z-30 shadow-lg"
            aria-label="Предыдущее фото"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-0 md:right-0 top-1/2 -translate-y-6 translate-x-0 md:translate-x-5 bg-zinc-900/90 hover:bg-gold-500 text-white hover:text-black border border-zinc-700 hover:border-gold-500 p-3 rounded-full transition-all z-30 shadow-lg"
            aria-label="Следующее фото"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-6 gap-2 md:gap-3">
            {salonImages.map((image, index) => (
              <button
                key={index}
                onClick={() => goTo(index, index > current ? 'left' : 'right')}
                className={`relative aspect-[4/3] rounded-md overflow-hidden border-2 transition-all duration-200 ${
                  index === current
                    ? 'border-gold-500 ring-2 ring-gold-500/40 opacity-100'
                    : 'border-zinc-700 hover:border-zinc-500 opacity-60 hover:opacity-90'
                }`}
              >
                <img
                  src={image.previewUrl}
                  alt={image.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: image.thumbFocus ?? image.focus ?? '50% 50%' }}
                />
              </button>
            ))}
          </div>

        </div>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={salonImages.map(image => ({
            url: image.lightboxUrl,
            title: image.title,
            description: image.description,
          }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
};

