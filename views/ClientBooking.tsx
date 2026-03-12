import React, { useState, useEffect } from 'react';
import { Badge, Button, Card, SectionTitle, LazyImage, Lightbox, ZoomHint } from '../components/Shared';
import { SalonGallery } from '../components/SalonGallery';
import { Booking, Master, Review, Service, ServiceCategory } from '../types';
import { Star, Clock, Check, Calendar as CalendarIcon, ArrowRight, ArrowLeft, MapPin, Phone, Mail, Crown, Sparkles, Hourglass, Gem, BadgeCheck, KeyRound } from 'lucide-react';

// ── Scroll-reveal component ───────────────────────────────────────────────────
// Without staggerSelector: the whole div fades+slides up when scrolled into view.
// With staggerSelector: wrapper reveals instantly, matched children stagger in one-by-one.
const FadeIn: React.FC<{
  children: React.ReactNode;
  className?: string;
  staggerSelector?: string;
  threshold?: number;
}> = ({ children, className = '', staggerSelector, threshold = 0.08 }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Pre-hide stagger children as early as possible so they're invisible on first paint
    if (staggerSelector) {
      el.querySelectorAll<HTMLElement>(staggerSelector).forEach(child => {
        child.style.opacity = '0';
        child.style.transform = 'translateY(22px)';
        child.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
      });
    }

    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;

      if (staggerSelector) {
        // Instantly reveal the wrapper (no animation — children animate instead)
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.style.transition = 'none';

        // Stagger each child using inline transitionDelay + double-rAF to trigger transition
        el.querySelectorAll<HTMLElement>(staggerSelector).forEach((child, i) => {
          child.style.transitionDelay = `${i * 130}ms`;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            child.style.opacity = '1';
            child.style.transform = 'none';
          }));
        });
      } else {
        el.classList.add('sr-visible');
      }

      obs.unobserve(el);
    }, { threshold });

    obs.observe(el);
    return () => obs.disconnect();
  }, [staggerSelector, threshold]);

  return (
    <div ref={ref} className={`sr-item ${className}`}>
      {children}
    </div>
  );
};

interface ClientBookingProps {
  onBook: (booking: Omit<Booking, 'id' | 'status'>) => void;
  services: Service[];
  masters: Master[];
  reviews: Review[];
}

type Step = 'HOME' | 'GENDER' | 'SERVICE' | 'MASTER' | 'DATETIME' | 'FORM' | 'SUCCESS' | 'WAITLIST';
type TimingMode = 'SEQUENTIAL' | 'PARALLEL';
type SlotPlanItem = {
  serviceId: string;
  start: string;
  end: string;
  primaryMasterId: string;
  primaryMasterName: string;
  secondaryMasterId?: string | null;
  secondaryMasterName?: string | null;
};

export const ClientBooking: React.FC<ClientBookingProps> = ({ onBook, services, masters, reviews }) => {
  const HOME_HERO_BG = 'https://img.freepik.com/premium-photo/beauty-salon-architecture-black-wall-modern-interior_943281-47501.jpg';
  const MEN_HALL_BG = 'https://i.pinimg.com/1200x/07/ed/4f/07ed4ff3934eafc18e1b46af739fed29.jpg';
  const SERVICE_MASTER_RULES: Record<string, { primary: string[]; secondary?: string[] }> = {
    m1: { primary: ['mst1', 'mst3', 'mst6'] },
    m2: { primary: ['mst1', 'mst3', 'mst6'] },
    m3: { primary: ['mst1', 'mst3', 'mst6'] },
    m4: { primary: ['mst1', 'mst3'] },
    m5: { primary: ['mst1', 'mst3', 'mst6'] },
    m6: { primary: ['mst1', 'mst3'] },
    m7: { primary: ['mst1', 'mst3'] },
    m8: { primary: ['mst7'] },
    m9: { primary: ['mst8'] },
    w1: { primary: ['mst2', 'mst4', 'mst5'] },
    w2: { primary: ['mst2', 'mst4', 'mst5'] },
    w3: { primary: ['mst2', 'mst4'] },
    w4: { primary: ['mst7'] },
    w5: { primary: ['mst2', 'mst4', 'mst5'] },
    w6: { primary: ['mst2', 'mst4', 'mst5'], secondary: ['mst7'] },
    w7: { primary: ['mst2', 'mst4'] },
    w8: { primary: ['mst2', 'mst4'], secondary: ['mst8'] },
    w9: { primary: ['mst2'] },
  };
  const MASTER_IMAGE_FOCUS: Record<string, string> = {
    mst1: '50% 5%',
    mst2: '50% 22%',
    mst3: '50% 34%',
    mst4: '50% 20%',
    mst5: '50% 20%',
    mst6: '50% 35%',
    mst7: '40% 20%',
    mst8: '50% 30%',
  };

  const [step, setStep] = useState<Step>('HOME');
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [timingMode, setTimingMode] = useState<TimingMode>('SEQUENTIAL');
  const [showTimingModePrompt, setShowTimingModePrompt] = useState(false);
  const [serviceMasterSelections, setServiceMasterSelections] = useState<Record<string, string>>({});
  const [serviceSecondarySelections, setServiceSecondarySelections] = useState<Record<string, string>>({});
  // Default date = today
  const _today = new Date();
  const _todayStr = `${_today.getFullYear()}-${String(_today.getMonth() + 1).padStart(2, '0')}-${String(_today.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState<string>(_todayStr);
  const [calViewYear, setCalViewYear] = useState(_today.getFullYear());
  const [calViewMonth, setCalViewMonth] = useState(_today.getMonth()); // 0-indexed
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [slotPlansByTime, setSlotPlansByTime] = useState<Record<string, SlotPlanItem[]>>({});
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const ANY_MASTER = '__ANY_MASTER__';

  // Auto-scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const toMinutes = (hhmm: string) => {
    const [hh, mm] = hhmm.split(':').map(Number);
    return hh * 60 + mm;
  };
  const toHHmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const parseLocalDateOnly = (dateStr: string): Date | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  };
  const parseTimeToMinutes = (hhmm: string): number | null => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };
  const isFutureDateTime = (dateStr: string, timeStr: string): boolean => {
    const date = parseLocalDateOnly(dateStr);
    const minutes = parseTimeToMinutes(timeStr);
    if (!date || minutes === null) return false;
    const dateTime = new Date(date);
    dateTime.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return dateTime.getTime() > Date.now();
  };
  const filterBookableSlots = (dateStr: string, slots: string[]) => (
    slots.filter(time => isFutureDateTime(dateStr, time))
  );
  const buildFallbackSlots = (durationMinutes: number) => {
    const slots: string[] = [];
    for (let start = 10 * 60; start + durationMinutes <= 21 * 60; start += 15) {
      slots.push(toHHmm(start));
    }
    return slots;
  };

  const getMasterById = (id?: string | null) => masters.find(master => master.id === id);
  const getMasterFocus = (id: string) => MASTER_IMAGE_FOCUS[id] ?? '50% 20%';

  const getPrimaryAllowedMasterIds = (service: Service): string[] => {
    const ruleById = SERVICE_MASTER_RULES[service.id];
    if (ruleById) return ruleById.primary;
    if (service.allowedMasterIds && service.allowedMasterIds.length > 0) {
      return service.allowedMasterIds;
    }
    return masters
      .filter(master => service.category ? master.specialization.includes(service.category) : true)
      .map(master => master.id);
  };

  const getSecondaryAllowedMasterIds = (service: Service): string[] => (
    SERVICE_MASTER_RULES[service.id]?.secondary ?? service.secondaryMasterIds ?? []
  );

  const canUseParallelMode = selectedServices.length > 1;
  const totalPrice = selectedServices.reduce((acc, s) => acc + s.price, 0);
  const totalDuration = selectedServices.reduce((acc, s) => acc + s.durationMinutes, 0);
  const parallelDuration = selectedServices.length > 0 ? Math.max(...selectedServices.map(s => s.durationMinutes)) : 0;
  const effectiveDuration = timingMode === 'PARALLEL' ? parallelDuration : totalDuration;
  const parallelTimeSaved = Math.max(0, totalDuration - parallelDuration);

  useEffect(() => {
    setServiceMasterSelections(prev => {
      const validIds = new Set(selectedServices.map(service => service.id));
      return Object.fromEntries(Object.entries(prev).filter(([serviceId]) => validIds.has(serviceId)));
    });
    setServiceSecondarySelections(prev => {
      const validIds = new Set(selectedServices.map(service => service.id));
      return Object.fromEntries(Object.entries(prev).filter(([serviceId]) => validIds.has(serviceId)));
    });
  }, [selectedServices]);

  useEffect(() => {
    if (selectedServices.length <= 1 && timingMode === 'PARALLEL') {
      setTimingMode('SEQUENTIAL');
    }
  }, [selectedServices.length, timingMode]);

  useEffect(() => {
    setSelectedTime(null);
  }, [timingMode, selectedServices]);

  const requiredSecondaryServices = React.useMemo(
    () => selectedServices.filter(service => getSecondaryAllowedMasterIds(service).length > 0),
    [selectedServices]
  );

  const primarySelectionsComplete = selectedServices.every(service => !!serviceMasterSelections[service.id]);
  const secondarySelectionsComplete = requiredSecondaryServices.every(service => !!serviceSecondarySelections[service.id]);
  const isMasterSelectionComplete = primarySelectionsComplete && secondarySelectionsComplete;

  useEffect(() => {
    if (step !== 'DATETIME' || !isMasterSelectionComplete || selectedServices.length === 0 || !selectedDate) {
      setAvailableTimeSlots([]);
      setSlotPlansByTime({});
      setSlotsError('');
      setSlotsLoading(false);
      return;
    }

    const controller = new AbortController();
    const loadSlots = async () => {
      setSlotsLoading(true);
      setSlotsError('');
      try {
        const payload = {
          date: selectedDate,
          timingMode,
          services: selectedServices.map(service => ({
            serviceId: service.id,
            serviceName: service.name,
            durationMinutes: service.durationMinutes,
            primaryMasterId: serviceMasterSelections[service.id] ?? null,
            primaryCandidates: getPrimaryAllowedMasterIds(service),
            secondaryMasterId: serviceSecondarySelections[service.id] ?? null,
            secondaryCandidates: getSecondaryAllowedMasterIds(service),
          })),
        };
        const res = await fetch('/api/booking-slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const raw = await res.text();
        let data: { success?: boolean; error?: string; slots?: Array<{ time: string; plan?: SlotPlanItem[] }> } | null = null;
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch {
            data = null;
          }
        }

        if (!res.ok) {
          const details = (data as { details?: string } | null)?.details;
          throw new Error(
            details
              ? `${data?.error || 'Сервис слотов недоступен'} (${res.status}): ${details}`
              : (data?.error || `Сервис слотов недоступен (${res.status})`)
          );
        }
        if (!data?.success) {
          throw new Error(data?.error || 'Не удалось рассчитать слоты');
        }
        const rawSlots = Array.isArray(data.slots) ? data.slots : [];
        const slots = filterBookableSlots(selectedDate, rawSlots.map((slot: { time: string }) => slot.time));
        const plans = Object.fromEntries(
          rawSlots
            .filter((slot: { time: string }) => slots.includes(slot.time))
            .map((slot: { time: string; plan?: SlotPlanItem[] }) => [slot.time, slot.plan ?? []])
        );
        setAvailableTimeSlots(slots);
        setSlotPlansByTime(plans);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        const message = (error as Error).message || 'Не удалось рассчитать слоты';
        if (message.includes("Failed to execute 'json' on 'Response'")) {
          setSlotsError('Сервис слотов вернул пустой ответ. Проверьте сервер API и перезапустите его.');
        } else {
          setSlotsError(message);
        }
        setAvailableTimeSlots(filterBookableSlots(selectedDate, buildFallbackSlots(effectiveDuration)));
        setSlotPlansByTime({});
      } finally {
        if (!controller.signal.aborted) setSlotsLoading(false);
      }
    };

    loadSlots();
    return () => controller.abort();
  }, [
    isMasterSelectionComplete,
    step,
    selectedServices,
    selectedDate,
    timingMode,
    serviceMasterSelections,
    serviceSecondarySelections,
    effectiveDuration,
  ]);

  useEffect(() => {
    if (step !== 'DATETIME') return;
    if (selectedTime && !availableTimeSlots.includes(selectedTime)) {
      setSelectedTime(null);
    }
  }, [step, availableTimeSlots, selectedTime]);

  const serviceAssignments = React.useMemo(
    () => selectedServices.map(service => {
      const primaryId = serviceMasterSelections[service.id];
      const secondaryId = serviceSecondarySelections[service.id];
      const primaryName = primaryId === ANY_MASTER ? 'Любой свободный мастер' : (getMasterById(primaryId)?.name ?? 'Не выбран');
      const secondaryName = secondaryId
        ? (secondaryId === ANY_MASTER ? 'Любой свободный мастер' : (getMasterById(secondaryId)?.name ?? 'Не выбран'))
        : undefined;
      return { service, primaryName, secondaryName, primaryId, secondaryId };
    }),
    [selectedServices, serviceMasterSelections, serviceSecondarySelections]
  );

  const selectedSlotPlan = React.useMemo(
    () => (selectedTime ? slotPlansByTime[selectedTime] ?? [] : []),
    [selectedTime, slotPlansByTime]
  );

  const handleServiceToggle = (service: Service) => {
    const exists = selectedServices.find(s => s.id === service.id);
    if (exists) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
    setSelectedTime(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTime) {
      setSendError('Выбранное время сброшено. Пожалуйста, выберите время ещё раз.');
      setStep('DATETIME');
      return;
    }
    if (!isFutureDateTime(selectedDate, selectedTime)) {
      setSendError('Нельзя записаться на прошедшее время. Выберите актуальный слот.');
      setSelectedTime(null);
      setStep('DATETIME');
      return;
    }
    if (!isMasterSelectionComplete) {
      setSendError('Проверьте выбор мастеров для всех услуг.');
      setStep('MASTER');
      return;
    }

    const primaryMasterId = selectedSlotPlan.find(item => item.primaryMasterId)?.primaryMasterId
      ?? serviceAssignments
        .map(assignment => assignment.primaryId)
        .find(id => id && id !== ANY_MASTER) ?? 'any';

    const computedPlanLines = selectedSlotPlan.map(item => {
      const second = item.secondaryMasterName ? ` + ${item.secondaryMasterName}` : '';
      return `${item.start}-${item.end} | ${item.serviceId}: ${item.primaryMasterName}${second}`;
    });

    const fallbackLines = serviceAssignments.map(assignment => {
      const second = assignment.secondaryName ? ` + ${assignment.secondaryName}` : '';
      return `${assignment.service.name}: ${assignment.primaryName}${second}`;
    });

    const bookingNotes = [
      `Режим: ${timingMode === 'PARALLEL' ? 'В 4 руки (параллельно)' : 'По очереди (последовательно)'}`,
      ...(computedPlanLines.length > 0 ? computedPlanLines : fallbackLines),
    ].join('\n');

    setSending(true);
    setSendError('');
    const controller = new AbortController();
    const submitTimeoutId = window.setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          clientName: formData.name,
          clientPhone: formData.phone,
          clientEmail: formData.email,
          serviceId: selectedServices.map(s => s.name).join(', '),
          masterId: primaryMasterId,
          date: selectedDate,
          time: selectedTime,
          totalPrice: totalPrice,
          notes: bookingNotes,
        }),
      });
      const raw = await res.text();
      let data: { success?: boolean; error?: string } | null = null;
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = null;
        }
      }
      if (!res.ok) {
        throw new Error(data?.error || `Ошибка сервера (${res.status})`);
      }
      if (data?.success) {
        // Also add to local state as PENDING_EMAIL so admin sees it
        onBook({
          clientName: formData.name,
          clientPhone: formData.phone,
          clientEmail: formData.email,
          serviceId: selectedServices.map(s => s.name).join(', '),
          masterId: primaryMasterId,
          date: selectedDate,
          time: selectedTime,
          totalPrice: totalPrice,
          notes: bookingNotes,
        });
        setStep('SUCCESS');
      } else {
        setSendError(data?.error || 'Ошибка при отправке письма');
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setSendError('Сервер подтверждений не ответил за 20 секунд. Проверьте SMTP-настройки и попробуйте снова.');
        return;
      }
      const message = (error as Error).message || '';
      if (message.includes("Failed to execute 'json' on 'Response'")) {
        setSendError('Сервер вернул пустой ответ. Проверьте backend и повторите попытку.');
      } else {
        setSendError(message || 'Не удалось связаться с сервером подтверждений.');
      }
    } finally {
      window.clearTimeout(submitTimeoutId);
      setSending(false);
    }
  };

  // --- SUB-COMPONENTS ---

  const MarqueeReviews = () => {
    const approvedReviews = reviews.filter(r => r.status === 'APPROVED');

    // Repeat reviews enough times so a single track always exceeds viewport width.
    // Each card is ~312px (w-72=288px + gap-6=24px). Target track width ≥ 2000px.
    const minReps = approvedReviews.length > 0
      ? Math.max(1, Math.ceil(2000 / (approvedReviews.length * 312)))
      : 1;
    const track = Array.from({ length: minReps }).flatMap(() => approvedReviews);

    const ReviewCard = ({ review, idx }: { review: typeof approvedReviews[0]; idx: number }) => (
      <div
        key={idx}
        className="w-72 shrink-0 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 border border-gold-500/20 hover:border-gold-500/50 rounded-lg shadow-lg transition-all hover:shadow-gold-500/10"
      >
        <div className="flex items-center gap-3 mb-4">
          <LazyImage src={review.avatarUrl ?? ''} alt="" wrapperClass="w-12 h-12 rounded-full shrink-0 ring-2 ring-gold-500/30" imgClass="object-cover" />
          <div>
            <p className="text-sm font-serif text-white font-semibold">{review.clientName}</p>
            <div className="flex text-gold-500 gap-0.5 mt-0.5">
              {[...Array(5)].map((_, i) => <Star key={i} size={12} fill={i < review.rating ? 'currentColor' : 'none'} className={i < review.rating ? 'text-gold-500' : 'text-zinc-700'} />)}
            </div>
          </div>
        </div>
        <p className="text-zinc-300 text-sm leading-relaxed">{review.text}</p>
        <div className="mt-3 text-xs text-gold-500/60">★★★★★</div>
      </div>
    );

    if (approvedReviews.length === 0) return null;

    return (
      <div className="w-full overflow-hidden bg-zinc-900 py-8 border-y border-zinc-800">
        {/*
          The wrapper holds two identical tracks (A and B).
          Each track repeats reviews enough times to exceed viewport width.
          Animation: 0 to -50% (one track width). At reset the view is identical,
          so the loop is perfectly seamless with no empty gaps at the end.
        */}
        <div className="animate-marquee">
          {/* Track A */}
          <div className="flex gap-6 pr-6">
            {track.map((r, i) => <ReviewCard key={`a-${i}`} review={r} idx={i} />)}
          </div>
          {/* Track B - aria-hidden duplicate, keeps the loop seamless */}
          <div className="flex gap-6 pr-6" aria-hidden="true">
            {track.map((r, i) => <ReviewCard key={`b-${i}`} review={r} idx={i} />)}
          </div>
        </div>
      </div>
    );
  };

  const PortfolioSection = () => {
    const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);

    const portfolioImages = [
      { url: 'https://i.pinimg.com/736x/34/8a/9a/348a9a6420184ecd513ed6b758b60c28.jpg', title: 'Женская стрижка' },
      { url: 'https://i.pinimg.com/736x/de/0e/3c/de0e3c6154e879a0ee040986a615eccf.jpg', title: 'Мужская стрижка' },
      { url: 'https://i.pinimg.com/1200x/81/71/c9/8171c95680238a0cb214052f4c2e1aa9.jpg', title: 'Окрашивание' },
      { url: 'https://i.pinimg.com/1200x/44/80/f5/4480f5b3f3be96fa397590bb8ddd1665.jpg', title: 'Маникюр' },
      { url: 'https://i.pinimg.com/736x/ee/a8/14/eea81433465ef02ab81dc04bee5f91c9.jpg', title: 'Укладка' },
      { url: 'https://i.pinimg.com/736x/e3/9f/10/e39f10f4b8fcd40efccc44262e5d6424.jpg', title: 'Оформление бороды' },
    ];

    return (<>
      <div className="py-20 bg-black">
        <div className="container mx-auto px-4">
           <SectionTitle title="Наши Работы" subtitle="Искусство стиля" centered />
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-[600px] md:h-[400px]">
               <div
                 className="col-span-1 row-span-2 overflow-hidden rounded relative group cursor-zoom-in"
                 onClick={() => setLightboxIndex(0)}
               >
                  <LazyImage src={portfolioImages[0].url} alt={portfolioImages[0].title} wrapperClass="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" imgClass="object-cover transition duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                     <span className="text-white font-medium">{portfolioImages[0].title}</span>
                  </div>
                  <ZoomHint />
               </div>
               <div
                 className="col-span-1 overflow-hidden rounded relative group cursor-zoom-in"
                 onClick={() => setLightboxIndex(1)}
               >
                  <LazyImage src={portfolioImages[1].url} alt={portfolioImages[1].title} wrapperClass="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" imgClass="object-cover transition duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                     <span className="text-white font-medium">{portfolioImages[1].title}</span>
                  </div>
                  <ZoomHint />
               </div>
               <div
                 className="col-span-1 row-span-2 overflow-hidden rounded relative group cursor-zoom-in"
                 onClick={() => setLightboxIndex(2)}
               >
                  <LazyImage src={portfolioImages[2].url} alt={portfolioImages[2].title} wrapperClass="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" imgClass="object-cover transition duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                     <span className="text-white font-medium">{portfolioImages[2].title}</span>
                  </div>
                  <ZoomHint />
               </div>
               <div
                 className="col-span-1 overflow-hidden rounded relative group cursor-zoom-in"
                 onClick={() => setLightboxIndex(3)}
               >
                  <LazyImage src={portfolioImages[3].url} alt={portfolioImages[3].title} wrapperClass="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" imgClass="object-cover transition duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                     <span className="text-white font-medium">{portfolioImages[3].title}</span>
                  </div>
                  <ZoomHint />
               </div>
               {/* Filled remaining slots */}
               <div
                 className="col-span-1 overflow-hidden rounded relative group cursor-zoom-in"
                 onClick={() => setLightboxIndex(4)}
               >
                  <LazyImage src={portfolioImages[4].url} alt={portfolioImages[4].title} wrapperClass="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" imgClass="object-cover transition duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                     <span className="text-white font-medium">{portfolioImages[4].title}</span>
                  </div>
                  <ZoomHint />
               </div>
               <div
                 className="col-span-1 overflow-hidden rounded relative group cursor-zoom-in"
                 onClick={() => setLightboxIndex(5)}
               >
                  <LazyImage src={portfolioImages[5].url} alt={portfolioImages[5].title} wrapperClass="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" imgClass="object-cover transition duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                     <span className="text-white font-medium">{portfolioImages[5].title}</span>
                  </div>
                  <ZoomHint />
               </div>
           </div>
           <div className="mt-12 text-center">
              <a href="#" className="inline-flex items-center text-gold-500 hover:text-white transition-colors uppercase tracking-widest text-xs">
                <span className="w-5 h-5 rounded-full border border-gold-500/70 flex items-center justify-center text-[9px] font-bold mr-2">VK</span>
                Мы в Вконтакте
              </a>
           </div>
        </div>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={portfolioImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>);
  };

  const PhilosophySection = () => (
    <div id="philosophy-section" className="py-24 bg-zinc-900/30">
      <div className="container mx-auto px-4 max-w-4xl text-center">
        <h3 className="text-3xl font-serif text-white mb-8">Философия LUMIÈRE</h3>
        <p className="text-zinc-400 text-lg leading-loose font-light">
          Мы не просто стрижем волосы или делаем маникюр. Мы создаем настроение и уверенность. 
          В нашем пространстве время замедляется, уступая место эстетике, комфорту и заботе о себе. 
          Каждая деталь — от аромата кофе до тактильных ощущений кресел — продумана для вашего исключительного опыта.
        </p>
      </div>
    </div>
  );

  // Services Preview Section
  const ServicesPreview = () => {
    const menServices = services.filter(s => s.category === ServiceCategory.MEN && s.type === 'VIP').slice(0, 2);
    const womenServices = services.filter(s => s.category === ServiceCategory.WOMEN && s.type === 'VIP').slice(0, 2);
    
    return (
      <div className="py-24 bg-black">
        <div className="container mx-auto px-4">
          <SectionTitle title="Премиальные Услуги" subtitle="VIP сервис для избранных" centered />
          
          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Men's Services */}
            <div className="service-preview-card">
              <div className="flex items-center gap-3 mb-6">
                <Crown className="text-gold-500" size={24} />
                <h4 className="text-xl font-serif text-white">Мужской зал</h4>
              </div>
              <div className="space-y-4">
                {menServices.map(service => (
                  <div key={service.id} className="bg-zinc-900 border border-zinc-800 p-5 hover:border-gold-500/50 transition-all group">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="text-white font-serif group-hover:text-gold-500 transition-colors">{service.name}</h5>
                        <p className="text-zinc-500 text-sm mt-1">{service.description}</p>
                      </div>
                      <span className="text-gold-500 font-bold">{service.price} ₽</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Women's Services */}
            <div className="service-preview-card">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="text-gold-500" size={24} />
                <h4 className="text-xl font-serif text-white">Женский зал</h4>
              </div>
              <div className="space-y-4">
                {womenServices.map(service => (
                  <div key={service.id} className="bg-zinc-900 border border-zinc-800 p-5 hover:border-gold-500/50 transition-all group">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="text-white font-serif group-hover:text-gold-500 transition-colors">{service.name}</h5>
                        <p className="text-zinc-500 text-sm mt-1">{service.description}</p>
                      </div>
                      <span className="text-gold-500 font-bold">{service.price} ₽</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <Button onClick={() => setStep('GENDER')} variant="outline">
              Все услуги <ArrowRight size={16} className="ml-2 inline" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const mastersShowcaseOrder = ['mst2', 'mst1', 'mst7', 'mst3', 'mst8', 'mst4', 'mst5', 'mst6'];
  const mastersForShowcase = [...masters.filter(m => m.isActive)].sort((a, b) => {
    const aPos = mastersShowcaseOrder.indexOf(a.id);
    const bPos = mastersShowcaseOrder.indexOf(b.id);
    if (aPos === -1 && bPos === -1) return a.name.localeCompare(b.name);
    if (aPos === -1) return 1;
    if (bPos === -1) return -1;
    return aPos - bPos;
  });
  // Masters Section
  const MastersSection = () => (
    <div id="masters-section" className="py-24 bg-zinc-900/20">
      <div className="container mx-auto px-4">
        <SectionTitle title="Наши Мастера" subtitle="Эксперты своего дела" centered />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {mastersForShowcase.map(master => (
            <div key={master.id} className="master-card text-center group">
              <div className="relative mb-4 overflow-hidden">
                <img
                  src={master.imageUrl}
                  alt={master.name}
                  className="w-full aspect-square object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  style={{ objectPosition: getMasterFocus(master.id) }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                  <div className="flex items-center text-gold-500 text-sm">
                    <Star size={12} fill="currentColor" className="mr-1" />
                    {master.rating.toFixed(1)}
                  </div>
                </div>
                {master.level === 'TOP' && (
                  <div className="absolute top-2 right-2 bg-gold-500 text-black text-[10px] px-2 py-1 font-bold">
                    TOP
                  </div>
                )}
              </div>
              <h5 className="text-white text-sm font-medium">{master.name}</h5>
              <p className="text-gold-500 text-xs uppercase tracking-wider">{master.role}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  // Stats Section
  const StatsSection = () => (
    <div className="py-16 bg-black border-y border-zinc-800">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
          <div className="stat-card">
            <div className="text-4xl font-serif text-gold-500 mb-2">2026</div>
            <div className="text-zinc-500 text-sm uppercase tracking-wider">Год основания</div>
          </div>
          <div className="stat-card">
            <div className="text-4xl font-serif text-gold-500 mb-2">100+</div>
            <div className="text-zinc-500 text-sm uppercase tracking-wider">Довольных клиентов</div>
          </div>
          <div className="stat-card">
            <div className="text-4xl font-serif text-gold-500 mb-2">{masters.length}</div>
            <div className="text-zinc-500 text-sm uppercase tracking-wider">Мастеров</div>
          </div>
          <div className="stat-card">
            <div className="text-4xl font-serif text-gold-500 mb-2">4.9</div>
            <div className="text-zinc-500 text-sm uppercase tracking-wider">Рейтинг</div>
          </div>
        </div>
      </div>
    </div>
  );

  // Advantages Section
  const AdvantagesSection = () => (
    <div className="py-24 bg-zinc-900/20">
      <div className="container mx-auto px-4">
        <SectionTitle title="Стандарты LUMIÈRE" subtitle="Привилегии LUMIÈRE" centered />
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <div className="adv-card text-center p-8 border border-zinc-800/90 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 hover:border-gold-500/40 hover:shadow-[0_16px_40px_rgba(245,158,11,0.08)] transition-all">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gold-500/10 ring-1 ring-gold-500/20 flex items-center justify-center">
              <Hourglass className="text-gold-500" size={28} />
            </div>
            <h4 className="text-white font-serif text-lg mb-3">Ценность вашего времени</h4>
            <p className="text-zinc-400 text-sm leading-relaxed">Организуем параллельную работу нескольких мастеров (до 6 рук одновременно) с ювелирной точностью, не теряя в качестве.</p>
          </div>
          <div className="adv-card text-center p-8 border border-zinc-800/90 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 hover:border-gold-500/40 hover:shadow-[0_16px_40px_rgba(245,158,11,0.08)] transition-all">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gold-500/10 ring-1 ring-gold-500/20 flex items-center justify-center">
              <Gem className="text-gold-500" size={28} />
            </div>
            <h4 className="text-white font-serif text-lg mb-3">Сервис уровня 5 звезд</h4>
            <p className="text-zinc-400 text-sm leading-relaxed">Закрытая парковка, авторская коктейльная карта, спешелти кофе и забота в каждой детали вашего визита.</p>
          </div>
          <div className="adv-card text-center p-8 border border-zinc-800/90 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 hover:border-gold-500/40 hover:shadow-[0_16px_40px_rgba(245,158,11,0.08)] transition-all">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gold-500/10 ring-1 ring-gold-500/20 flex items-center justify-center">
              <BadgeCheck className="text-gold-500" size={28} />
            </div>
            <h4 className="text-white font-serif text-lg mb-3">Международная экспертиза</h4>
            <p className="text-zinc-400 text-sm leading-relaxed">Наши арт-директора регулярно проходят стажировки в Европе и владеют передовыми техниками работы.</p>
          </div>
          <div className="adv-card text-center p-8 border border-zinc-800/90 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 hover:border-gold-500/40 hover:shadow-[0_16px_40px_rgba(245,158,11,0.08)] transition-all">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gold-500/10 ring-1 ring-gold-500/20 flex items-center justify-center">
              <KeyRound className="text-gold-500" size={28} />
            </div>
            <h4 className="text-white font-serif text-lg mb-3">Приватность</h4>
            <p className="text-zinc-400 text-sm leading-relaxed">Отдельные VIP-кабинеты для тех, кто предпочитает абсолютную тишину и уединение во время процедур.</p>
          </div>
        </div>
      </div>
    </div>
  );
  // Contact Section
  const ContactSection = () => (
    <div id="contacts-section" className="py-24 bg-black">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <div>
            <SectionTitle title="Контакты" subtitle="Ждем вас" />
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 shrink-0 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <MapPin className="text-gold-500" size={20} />
                </div>
                <div>
                  <h5 className="text-white font-medium mb-1">Адрес</h5>
                  <p className="text-zinc-400">г. Ростов-на-Дону пер. Островского, 108а</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 shrink-0 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <Phone className="text-gold-500" size={20} />
                </div>
                <div>
                  <h5 className="text-white font-medium mb-1">Телефон</h5>
                  <p className="text-zinc-400 font-mono">+7 (863) 000-00-00</p>
                  <div className="text-zinc-500 text-sm space-y-0.5">
                    <p>Режим работы</p>
                    <p>Пн-Пт: 10:00 - 21:00</p>
                    <p>Сб-Вс: 10:00 - 20:00</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 shrink-0 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <Mail className="text-gold-500" size={20} />
                </div>
                <div>
                  <h5 className="text-white font-medium mb-1">Email</h5>
                  <p className="text-zinc-400">lumierebot21@gmail.com</p>
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <a href="#" className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-gold-500 hover:border-gold-500/50 transition-colors">
                  <span className="text-[11px] font-bold tracking-wider">VK</span>
                </a>
              </div>
            </div>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 p-1 self-start w-full max-w-[560px] justify-self-center lg:justify-self-end lg:mt-3">
            <iframe 
              src="https://www.google.com/maps?q=%D0%B3.%20%D0%A0%D0%BE%D1%81%D1%82%D0%BE%D0%B2-%D0%BD%D0%B0-%D0%94%D0%BE%D0%BD%D1%83%20%D0%BF%D0%B5%D1%80.%20%D0%9E%D1%81%D1%82%D1%80%D0%BE%D0%B2%D1%81%D0%BA%D0%BE%D0%B3%D0%BE%2C%20108%D0%B0&output=embed"
              className="block w-full h-[360px] lg:h-[400px]"
              loading="lazy"
            ></iframe>
          </div>
        </div>
      </div>
    </div>
  );

  const StepHome = () => (
    <div className="min-h-screen flex flex-col">
      <div className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Abstract Dark Background */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url('${HOME_HERO_BG}')` }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-[#09090b]"></div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl animate-fade-in">
          <p className="text-gold-500 tracking-[0.4em] text-xs md:text-sm font-sans uppercase mb-6 flex items-center justify-center gap-2">
             <span className="w-8 h-[1px] bg-gold-500 inline-block"></span>
             Est. 2026 • Rostov-on-Don
             <span className="w-8 h-[1px] bg-gold-500 inline-block"></span>
          </p>
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-serif text-white mb-8 tracking-tighter">LUMIÈRE</h1>
          <p className="text-zinc-200 text-lg md:text-xl font-light max-w-2xl mx-auto mb-12 leading-relaxed tracking-wide">
            Пространство высокой эстетики. <br/> Ваш стиль — наше искусство.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => setStep('GENDER')} className="min-w-[240px] py-4 text-base shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              Записаться Онлайн
            </Button>
            <Button variant="outline" onClick={() => document.getElementById('services-section')?.scrollIntoView({ behavior: 'smooth' })} className="min-w-[200px] py-4 text-base">
              Услуги и цены
            </Button>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-zinc-600 animate-bounce">
           <ArrowRight className="rotate-90" />
        </div>
      </div>

      <FadeIn><PhilosophySection /></FadeIn>
      <FadeIn staggerSelector=".stat-card"><StatsSection /></FadeIn>
      
      <div id="services-section">
        <FadeIn staggerSelector=".service-preview-card"><ServicesPreview /></FadeIn>
      </div>
      
      <FadeIn staggerSelector=".master-card"><MastersSection /></FadeIn>
      <FadeIn><PortfolioSection /></FadeIn>
      <FadeIn staggerSelector=".adv-card"><AdvantagesSection /></FadeIn>
      <FadeIn><SalonGallery /></FadeIn>
      
      <FadeIn>
        <div className="py-16">
          <SectionTitle title="Отзывы Гостей" subtitle="Доверие Premium уровня" centered />
          <MarqueeReviews />
        </div>
      </FadeIn>
      
      <FadeIn><ContactSection /></FadeIn>
      
      {/* Footer */}
      <footer className="py-12 bg-zinc-950 border-t border-zinc-900">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-white font-serif text-xl mb-4">LUMIÈRE</h4>
              <p className="text-zinc-500 text-sm leading-relaxed">Премиальный салон красоты в самом сердце Ростова-на-Дону</p>
            </div>
            <div>
              <h5 className="text-white font-medium mb-4 text-sm uppercase tracking-wider">Услуги</h5>
              <ul className="space-y-2 text-zinc-500 text-sm">
                <li><button onClick={() => { setCategory(ServiceCategory.MEN); setSelectedServices([]); setServiceMasterSelections({}); setServiceSecondarySelections({}); setTimingMode('SEQUENTIAL'); setStep('SERVICE'); window.scrollTo({ top: 0 }); }} className="hover:text-gold-500 transition-colors">Мужской зал</button></li>
                <li><button onClick={() => { setCategory(ServiceCategory.WOMEN); setSelectedServices([]); setServiceMasterSelections({}); setServiceSecondarySelections({}); setTimingMode('SEQUENTIAL'); setStep('SERVICE'); window.scrollTo({ top: 0 }); }} className="hover:text-gold-500 transition-colors">Женский зал</button></li>
                <li><button onClick={() => { setStep('GENDER'); window.scrollTo({ top: 0 }); }} className="hover:text-gold-500 transition-colors">VIP услуги</button></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-medium mb-4 text-sm uppercase tracking-wider">Информация</h5>
              <ul className="space-y-2 text-zinc-500 text-sm">
                <li><button onClick={() => document.getElementById('philosophy-section')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-gold-500 transition-colors">О салоне</button></li>
                <li><button onClick={() => document.getElementById('masters-section')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-gold-500 transition-colors">Наши мастера</button></li>
                <li><button onClick={() => document.getElementById('contacts-section')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-gold-500 transition-colors">Контакты</button></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-medium mb-4 text-sm uppercase tracking-wider">Режим работы</h5>
              <ul className="space-y-2 text-zinc-500 text-sm">
                <li>Пн-Пт: 10:00 - 21:00</li>
                <li>Сб-Вс: 10:00 - 20:00</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-zinc-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-zinc-600 text-sm">© 2026 LUMIÈRE. Все права защищены.</p>
            <div className="flex gap-6 text-zinc-600 text-sm">
              <a href="#" className="hover:text-gold-500 transition-colors">Политика конфиденциальности</a>
              <a href="#" className="hover:text-gold-500 transition-colors">Оферта</a>
            </div>
          </div>
        </div>
      </footer>
      
      {/* Fixed Book Button */}
      <div className="fixed bottom-6 right-6 z-50 md:hidden">
        <Button onClick={() => setStep('GENDER')} className="rounded-full w-16 h-16 p-0 shadow-[0_0_30px_rgba(245,158,11,0.4)] flex items-center justify-center">
          <CalendarIcon size={24} />
        </Button>
      </div>
    </div>
  );

  const StepGender = () => (
    <div className="container mx-auto px-4 py-20 min-h-screen flex flex-col justify-center">
      <SectionTitle title="Выберите зал" subtitle="Пространство комфорта" centered />
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
        <div 
          onClick={() => { setCategory(ServiceCategory.MEN); setSelectedServices([]); setServiceMasterSelections({}); setServiceSecondarySelections({}); setTimingMode('SEQUENTIAL'); setStep('SERVICE'); }}
          className="group relative h-96 cursor-pointer overflow-hidden rounded-sm border border-zinc-800 hover:border-gold-500/50 transition-all"
        >
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105 opacity-60 group-hover:opacity-80"
            style={{ backgroundImage: `url('${MEN_HALL_BG}')` }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
          <div className="absolute bottom-10 left-0 right-0 text-center">
            <h3 className="text-4xl font-serif text-white group-hover:text-gold-500 transition-colors mb-2">Мужской Зал</h3>
            <p className="text-zinc-400 text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">Gentlemen's Club</p>
          </div>
        </div>
        <div 
          onClick={() => { setCategory(ServiceCategory.WOMEN); setSelectedServices([]); setServiceMasterSelections({}); setServiceSecondarySelections({}); setTimingMode('SEQUENTIAL'); setStep('SERVICE'); }}
          className="group relative h-96 cursor-pointer overflow-hidden rounded-sm border border-zinc-800 hover:border-gold-500/50 transition-all"
        >
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105 opacity-60 group-hover:opacity-80"
            style={{ backgroundImage: `url('${HOME_HERO_BG}')` }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
          <div className="absolute bottom-10 left-0 right-0 text-center">
            <h3 className="text-4xl font-serif text-white group-hover:text-gold-500 transition-colors mb-2">Женский Зал</h3>
             <p className="text-zinc-400 text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">Ladies Lounge</p>
          </div>
        </div>
      </div>
      <div className="mt-12 text-center">
        <Button variant="ghost" onClick={() => setStep('HOME')}>Назад</Button>
      </div>
    </div>
  );

  const StepService = () => {
    const filteredServices = services.filter(s => s.category === category);
    const proceedToMaster = () => {
      if (selectedServices.length === 0) return;
      if (canUseParallelMode) {
        setShowTimingModePrompt(true);
        return;
      }
      setTimingMode('SEQUENTIAL');
      setStep('MASTER');
    };
    
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 border-b border-zinc-800 pb-6">
          <div className="w-full md:w-auto text-center md:text-left">
             <SectionTitle title="Услуги" subtitle={category === ServiceCategory.MEN ? "Мужской зал" : "Женский зал"} />
          </div>
          <div className="text-center md:text-right w-full md:w-auto mt-4 md:mt-0">
            <p className="text-zinc-500 text-sm uppercase tracking-wide">Выбрано</p>
            <div className="flex items-center justify-center md:justify-end gap-3">
               <span className="text-white text-3xl font-serif">{selectedServices.length}</span>
               <div className="h-8 w-[1px] bg-zinc-700"></div>
               <span className="text-gold-500 font-serif text-3xl">{totalPrice} ₽</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24">
          {filteredServices.map(service => {
            const isSelected = !!selectedServices.find(s => s.id === service.id);
            return (
              <Card 
                key={service.id} 
                className="p-6 flex flex-col h-full"
                active={isSelected}
                onClick={() => handleServiceToggle(service)}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-serif text-white pr-4">{service.name}</h3>
                  {service.type === 'VIP' && <Badge type="vip">VIP</Badge>}
                </div>
                <p className="text-zinc-400 text-sm mb-6 flex-grow leading-relaxed">{service.description}</p>
                <div className="flex justify-between items-center text-sm border-t border-zinc-800 pt-4 mt-auto">
                  <span className="text-white font-bold text-lg">{service.price} ₽</span>
                  <span className="flex items-center text-zinc-500"><Clock size={14} className="mr-1"/> {service.durationMinutes} мин</span>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950/95 backdrop-blur border-t border-gold-500/30 flex justify-between items-center z-50 shadow-2xl">
          <div className="pl-2 md:pl-10">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Итого к оплате</p>
            <p className="text-white font-serif text-xl md:text-2xl">{totalPrice} ₽ <span className="text-zinc-600 text-sm font-sans">/ {totalDuration} мин</span></p>
          </div>
          <div className="flex gap-4 pr-2 md:pr-10">
            <Button variant="ghost" onClick={() => setStep('GENDER')}>Назад</Button>
            <Button 
              disabled={selectedServices.length === 0} 
              onClick={proceedToMaster}
              className="px-8"
            >
              Далее <ArrowRight size={16} className="ml-2 inline" />
            </Button>
          </div>
        </div>

        {showTimingModePrompt && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl border border-gold-500/30 bg-zinc-950 p-6 md:p-8">
              <h3 className="text-2xl md:text-3xl font-serif text-white mb-4">LUMIÈRE ценит ваше время</h3>
              <p className="text-zinc-300 leading-relaxed mb-6">
                Хотите, чтобы мастера выполнили услуги одновременно (в 4 руки)? Это сэкономит вам до{' '}
                <span className="text-gold-500 font-semibold">{parallelTimeSaved} мин</span>.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Button
                  onClick={() => {
                    setTimingMode('PARALLEL');
                    setShowTimingModePrompt(false);
                    setStep('MASTER');
                  }}
                >
                  Да, в 4 руки
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTimingMode('SEQUENTIAL');
                    setShowTimingModePrompt(false);
                    setStep('MASTER');
                  }}
                >
                  Нет, по очереди
                </Button>
              </div>
              <div className="mt-3 text-right">
                <button
                  className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                  onClick={() => setShowTimingModePrompt(false)}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const StepMaster = () => {
    const modeLabel = timingMode === 'PARALLEL' ? 'Режим: в 4 руки (параллельно)' : 'Режим: по очереди (последовательно)';
    const blockSubtitle = timingMode === 'PARALLEL'
      ? 'Подберите мастеров, которые будут работать синхронно'
      : 'Подберите мастеров для последовательного выполнения услуг';

    return (
      <div className="container mx-auto px-4 py-12">
        <SectionTitle title="Выбор специалистов" subtitle={blockSubtitle} />
        <p className="text-zinc-500 text-sm mb-8 uppercase tracking-widest">{modeLabel}</p>

        <div className="space-y-10 mb-12">
          {selectedServices.map(service => {
            const primaryIds = getPrimaryAllowedMasterIds(service);
            const primaryMasters = masters.filter(master => primaryIds.includes(master.id));
            const secondaryIds = getSecondaryAllowedMasterIds(service);
            const secondaryMasters = masters.filter(master => secondaryIds.includes(master.id));

            return (
              <div key={service.id} className="border border-zinc-800 p-5 md:p-6 bg-zinc-950/40">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
                  <div>
                    <h3 className="text-2xl font-serif text-white">Выберите мастера для «{service.name}»</h3>
                    <p className="text-zinc-500 text-sm mt-1">{service.durationMinutes} мин</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card
                    className="p-6 flex flex-col items-center justify-center text-center min-h-[240px]"
                    active={serviceMasterSelections[service.id] === ANY_MASTER}
                    onClick={() => setServiceMasterSelections(prev => ({ ...prev, [service.id]: ANY_MASTER }))}
                  >
                    <h4 className="text-lg font-serif text-white mb-2">Любой свободный мастер</h4>
                    <p className="text-zinc-500 text-sm">Автоподбор в выбранном профиле</p>
                  </Card>
                  {primaryMasters.map(master => (
                    <Card
                      key={`${service.id}-${master.id}`}
                      className="p-0 flex flex-col h-full group"
                      active={serviceMasterSelections[service.id] === master.id}
                      onClick={() => setServiceMasterSelections(prev => ({ ...prev, [service.id]: master.id }))}
                    >
                      <LazyImage
                        src={master.imageUrl}
                        alt={master.name}
                        wrapperClass="h-56"
                        imgClass="object-cover transition-transform duration-700 group-hover:scale-105"
                        imgStyle={{ objectPosition: getMasterFocus(master.id) }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </LazyImage>
                      <div className="p-4 text-center bg-zinc-900 border-t border-zinc-800 shadow-xl">
                        <h4 className="text-base font-serif text-white mb-1">{master.name}</h4>
                        <p className="text-gold-500 text-[10px] uppercase tracking-wider mb-2">{master.role}</p>
                        <div className="flex justify-center items-center text-zinc-400 text-xs bg-zinc-950 py-1 rounded-full mx-auto w-20">
                          <Star size={11} className="text-gold-500 mr-1" fill="currentColor" /> {master.rating.toFixed(1)}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {secondaryIds.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-zinc-800">
                    <h4 className="text-lg font-serif text-white mb-3">Второй мастер для этой услуги</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card
                        className="p-6 flex flex-col items-center justify-center text-center min-h-[200px]"
                        active={serviceSecondarySelections[service.id] === ANY_MASTER}
                        onClick={() => setServiceSecondarySelections(prev => ({ ...prev, [service.id]: ANY_MASTER }))}
                      >
                        <h5 className="text-base font-serif text-white mb-2">Любой свободный мастер</h5>
                        <p className="text-zinc-500 text-sm">Автоподбор второго специалиста</p>
                      </Card>
                      {secondaryMasters.map(master => (
                        <Card
                          key={`${service.id}-secondary-${master.id}`}
                          className="p-0 flex flex-col h-full group"
                          active={serviceSecondarySelections[service.id] === master.id}
                          onClick={() => setServiceSecondarySelections(prev => ({ ...prev, [service.id]: master.id }))}
                        >
                          <LazyImage
                            src={master.imageUrl}
                            alt={master.name}
                            wrapperClass="h-52"
                            imgClass="object-cover transition-transform duration-700 group-hover:scale-105"
                            imgStyle={{ objectPosition: getMasterFocus(master.id) }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          </LazyImage>
                          <div className="p-4 text-center bg-zinc-900 border-t border-zinc-800 shadow-xl">
                            <h5 className="text-base font-serif text-white mb-1">{master.name}</h5>
                            <p className="text-gold-500 text-[10px] uppercase tracking-wider mb-2">{master.role}</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => setStep('SERVICE')}><ArrowLeft size={16} className="mr-2 inline"/> Назад</Button>
          <Button disabled={!isMasterSelectionComplete} onClick={() => setStep('DATETIME')}>Далее</Button>
        </div>
      </div>
    );
  };

  const StepDateTime = () => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
    // Offset: Mon=0 … Sun=6
    const firstDayOffset = (new Date(calViewYear, calViewMonth, 1).getDay() + 6) % 7;

    const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

    const prevMonth = () => {
      if (calViewMonth === 0) { setCalViewMonth(11); setCalViewYear(y => y - 1); }
      else setCalViewMonth(m => m - 1);
    };
    const nextMonth = () => {
      if (calViewMonth === 11) { setCalViewMonth(0); setCalViewYear(y => y + 1); }
      else setCalViewMonth(m => m + 1);
    };

    return (
    <div className="container mx-auto px-4 py-12">
      <SectionTitle title="Дата и Время" subtitle="Выберите удобный слот" />
      
      <div className="grid lg:grid-cols-2 gap-12">
        {/* Dynamic Calendar */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <button onClick={prevMonth} className="p-2 text-zinc-500 hover:text-white transition-colors"><ArrowLeft size={18}/></button>
            <h3 className="text-white font-serif text-xl flex items-center gap-3">
              <CalendarIcon className="text-gold-500" size={20}/>
              {MONTHS_RU[calViewMonth]} {calViewYear}
            </h3>
            <button onClick={nextMonth} className="p-2 text-zinc-500 hover:text-white transition-colors"><ArrowRight size={18}/></button>
          </div>
          <div className="grid grid-cols-7 gap-2 mb-2">
             {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
               <div key={d} className="text-center text-zinc-600 text-xs py-2 uppercase tracking-wider">{d}</div>
             ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {/* Leading empty cells */}
            {[...Array(firstDayOffset)].map((_, i) => <div key={`e-${i}`}/>)}
            {[...Array(daysInMonth)].map((_, i) => {
               const day = i + 1;
               const dateStr = `${calViewYear}-${String(calViewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
               const cellDate = new Date(calViewYear, calViewMonth, day);
               const isPast = cellDate < todayDate;
               const isToday = cellDate.getTime() === todayDate.getTime();
               const isSelected = selectedDate === dateStr;
               return (
                 <button 
                  key={i}
                  disabled={isPast}
                  onClick={() => !isPast && setSelectedDate(dateStr)}
                  className={`
                    h-12 w-full text-sm rounded border transition-all flex items-center justify-center relative
                    ${isPast
                      ? 'border-transparent bg-transparent text-zinc-700 cursor-not-allowed'
                      : isSelected
                        ? 'bg-gold-500 text-black font-bold border-transparent shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                        : isToday
                          ? 'border-gold-500/50 bg-zinc-900 text-gold-400 font-semibold hover:bg-zinc-800'
                          : 'border-transparent bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700'
                    }
                  `}
                 >
                   {day}
                   {isSelected && <span className="absolute bottom-1 w-1 h-1 bg-black rounded-full"></span>}
                   {isToday && !isSelected && <span className="absolute bottom-1 w-1 h-1 bg-gold-500 rounded-full"></span>}
                 </button>
               );
             })}
          </div>
        </div>

        {/* Time Slots */}
        <div>
          <h3 className="text-white font-serif text-xl mb-2 flex items-center"><Clock className="mr-3 text-gold-500" size={20}/> Доступное время</h3>
          <p className="text-zinc-500 text-sm mb-6">
            {timingMode === 'PARALLEL'
              ? `В 4 руки: одна сессия ${effectiveDuration} мин`
              : `По очереди: общая длительность ${effectiveDuration} мин`}
          </p>
          {slotsLoading && (
            <div className="mb-4 p-3 bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm">
              Считаем доступные слоты по расписанию мастеров...
            </div>
          )}
          {slotsError && (
            <div className="mb-4 p-3 bg-red-950/30 border border-red-500/40 text-red-300 text-sm">
              {slotsError}
            </div>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-3 gap-4">
            {availableTimeSlots.map(time => (
              <button
                key={time}
                onClick={() => setSelectedTime(time)}
                className={`
                  py-4 border text-sm transition-all rounded
                  ${selectedTime === time 
                    ? 'border-gold-500 bg-gold-500/10 text-gold-500 font-bold' 
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-white'}
                `}
              >
                {time}
              </button>
            ))}
          </div>
          {!slotsLoading && availableTimeSlots.length === 0 && (
            <div className="mt-4 p-4 bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm">
              Нет доступных слотов под выбранную длительность. Измените набор услуг или режим выполнения.
            </div>
          )}
          {selectedDate && selectedTime && (
              <div className="mt-8 p-4 bg-zinc-900 border border-gold-500/20 rounded animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Ваш выбор:</span>
                    <span className="text-white font-serif text-lg">{selectedDate} / {selectedTime}</span>
                  </div>
                  <div className="mt-3 border-t border-zinc-800 pt-3 space-y-2 text-sm">
                    {selectedSlotPlan.length > 0 ? (
                      selectedSlotPlan.map((item, index) => (
                        <div key={`${item.serviceId}-${index}`} className="text-zinc-300">
                          {item.start} - {item.end} | {item.serviceId} ({item.primaryMasterName}{item.secondaryMasterName ? ` + ${item.secondaryMasterName}` : ''})
                        </div>
                      ))
                    ) : (
                      serviceAssignments.map((assignment, index) => (
                        <div key={assignment.service.id} className="text-zinc-300">
                          {timingMode === 'PARALLEL'
                            ? `${selectedTime} - ${String(Math.floor((toMinutes(selectedTime) + effectiveDuration) / 60)).padStart(2, '0')}:${String((toMinutes(selectedTime) + effectiveDuration) % 60).padStart(2, '0')}`
                            : (() => {
                                const start = toMinutes(selectedTime) + serviceAssignments.slice(0, index).reduce((acc, item) => acc + item.service.durationMinutes, 0);
                                const end = start + assignment.service.durationMinutes;
                                return `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')} - ${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
                              })()
                          } | {assignment.service.name} ({assignment.primaryName}{assignment.secondaryName ? ` + ${assignment.secondaryName}` : ''})
                        </div>
                      ))
                    )}
                  </div>
              </div>
          )}
        </div>
      </div>

      <div className="mt-12 flex justify-between">
        <Button variant="ghost" onClick={() => setStep('MASTER')}>Назад</Button>
        <Button disabled={!selectedTime} onClick={() => setStep('FORM')}>Далее</Button>
      </div>
    </div>
  );
  };

  const StepForm = () => (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <SectionTitle title="Подтверждение" subtitle="Завершение бронирования" />
      
      <Card className="p-8 mb-8 border-gold-500/30">
        <h3 className="text-white font-serif text-2xl mb-6 border-b border-zinc-800 pb-4">Детали визита</h3>
        <div className="space-y-4 text-zinc-300 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500">Услуги</span>
            <div className="text-right">
              {selectedServices.map(s => <div key={s.id} className="text-white font-medium">{s.name}</div>)}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500">Режим</span>
            <span className="text-white font-medium">{timingMode === 'PARALLEL' ? 'В 4 руки' : 'По очереди'}</span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-zinc-500">Специалисты</span>
            <div className="text-right">
              {selectedSlotPlan.length > 0 ? (
                selectedSlotPlan.map((item, index) => (
                  <div key={`form-plan-${item.serviceId}-${index}`} className="text-white font-medium">
                    {item.serviceId}: {item.primaryMasterName}{item.secondaryMasterName ? ` + ${item.secondaryMasterName}` : ''}
                  </div>
                ))
              ) : (
                serviceAssignments.map(assignment => (
                  <div key={`form-${assignment.service.id}`} className="text-white font-medium">
                    {assignment.service.name}: {assignment.primaryName}{assignment.secondaryName ? ` + ${assignment.secondaryName}` : ''}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500">Дата и время</span>
            <span className="text-white font-medium">{selectedDate} в {selectedTime}</span>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-zinc-800 mt-4">
            <span className="text-lg">Итого</span>
            <span className="text-3xl font-serif text-gold-500">{totalPrice} ₽</span>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-zinc-500 text-xs uppercase tracking-widest mb-2">Ваше Имя</label>
          <input 
            required
            type="text" 
            className="w-full bg-zinc-900 border border-zinc-700 p-4 text-white focus:border-gold-500 focus:outline-none transition-colors rounded-none placeholder-zinc-700"
            placeholder="Иван"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-zinc-500 text-xs uppercase tracking-widest mb-2">Телефон</label>
          <input 
            required
            type="tel" 
            className="w-full bg-zinc-900 border border-zinc-700 p-4 text-white focus:border-gold-500 focus:outline-none transition-colors rounded-none placeholder-zinc-700"
            placeholder="+7 (999) 000-00-00"
            value={formData.phone}
            onChange={e => setFormData({...formData, phone: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-zinc-500 text-xs uppercase tracking-widest mb-2">Email</label>
          <input 
            required
            type="email" 
            className="w-full bg-zinc-900 border border-zinc-700 p-4 text-white focus:border-gold-500 focus:outline-none transition-colors rounded-none placeholder-zinc-700"
            placeholder="you@example.com"
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
          />
          <p className="text-xs text-zinc-600 mt-2">* На этот адрес придёт письмо со ссылкой для подтверждения</p>
        </div>

        {sendError && (
          <div className="p-4 border border-red-500/40 bg-red-950/30 text-red-400 text-sm">
            {sendError}
          </div>
        )}

        <Button type="submit" disabled={sending || !selectedTime || !isMasterSelectionComplete} className="w-full py-4 text-lg bg-gold-600 hover:bg-gold-500 text-black disabled:opacity-50">
          {sending ? 'Отправляем письмо…' : 'Подтвердить запись'}
        </Button>
      </form>
      
      <div className="mt-6 text-center">
        <Button variant="ghost" onClick={() => setStep('DATETIME')}>Назад</Button>
      </div>
    </div>
  );

  const StepSuccess = () => (
    <div className="container mx-auto px-4 min-h-screen flex flex-col items-center justify-center text-center bg-zinc-950">
      <div className="w-24 h-24 rounded-full border-2 border-gold-500 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
        <Check size={48} className="text-gold-500" />
      </div>
      <h1 className="text-5xl font-serif text-white mb-6">Проверьте почту!</h1>
      <p className="text-zinc-400 mb-4 max-w-md text-lg leading-relaxed">
        Спасибо, {formData.name}.<br/>
        Письмо со ссылкой подтверждения отправлено на:
      </p>
      <p className="text-gold-500 font-mono text-lg mb-6">{formData.email}</p>
      <p className="text-zinc-500 text-sm mb-10 max-w-sm leading-relaxed">
        Кликните по ссылке в письме — и запись будет подтверждена.<br/>
        Планируемое время: <span className="text-white">{selectedDate}</span> в <span className="text-white">{selectedTime}</span>.
      </p>
      <Button onClick={() => window.location.reload()} variant="outline">На главную</Button>
    </div>
  );

  // Render Controller
  // Steps are called as plain functions (not <Component />) to avoid React re-mounting
  // the component subtree on every keystroke (which caused the jerky animation).
  // The outer wrapper uses key={step} so animate-fade-in fires only on step changes.

  const BOOKING_STEPS: Step[] = ['GENDER', 'SERVICE', 'MASTER', 'DATETIME', 'FORM'];
  const STEP_LABELS = ['Зал', 'Услуги', 'Мастер', 'Время', 'Запись'];
  const currentStepIndex = BOOKING_STEPS.indexOf(step);

  const renderStep = () => {
    switch (step) {
      case 'HOME':     return StepHome();
      case 'GENDER':   return StepGender();
      case 'SERVICE':  return StepService();
      case 'MASTER':   return StepMaster();
      case 'DATETIME': return StepDateTime();
      case 'FORM':     return StepForm();
      case 'SUCCESS':  return StepSuccess();
      default:         return StepHome();
    }
  };

  return (
    <div key={step} className="animate-fade-in">
      {/* Progress bar — shown only during booking steps */}
      {currentStepIndex >= 0 && (
        <div className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 px-4 py-3">
          <div className="max-w-xl mx-auto">
            <div className="flex items-center mb-2">
              {BOOKING_STEPS.map((s, i) => (
                <React.Fragment key={s}>
                  <button
                    onClick={() => {
                      // allow navigating to already-visited steps
                      if (i < currentStepIndex) {
                        setStep(BOOKING_STEPS[i]);
                      }
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0
                      ${
                        i < currentStepIndex
                          ? 'bg-gold-500 text-black cursor-pointer hover:brightness-110'
                          : i === currentStepIndex
                          ? 'bg-gold-500 text-black ring-2 ring-gold-400/40 ring-offset-1 ring-offset-zinc-950'
                          : 'bg-zinc-800 text-zinc-600 cursor-default'
                      }`}
                  >
                    {i < currentStepIndex ? '✓' : i + 1}
                  </button>
                  {i < BOOKING_STEPS.length - 1 && (
                    <div className={`flex-1 h-[2px] mx-1 transition-all duration-500 ${i < currentStepIndex ? 'bg-gold-500' : 'bg-zinc-800'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="flex justify-between">
              {STEP_LABELS.map((label, i) => (
                <span
                  key={label}
                  className={`text-[10px] uppercase tracking-wider transition-colors ${
                    i === currentStepIndex ? 'text-gold-500' : 'text-zinc-600'
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {renderStep()}
    </div>
  );
};
