import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  History,
  LayoutGrid,
  List,
  LogOut,
  Mail,
  Phone,
  Save,
  Search,
  Star,
  TrendingUp,
  User,
  X as Close,
  XCircle,
} from 'lucide-react';
import { Booking, BookingStatus, Master, Review, User as AppUser } from '../types';

interface StylistCabinetProps {
  master: Master | null;
  user: AppUser;
  bookings: Booking[];
  reviews: Review[];
  onLogout: () => void;
  onUpdateBooking: (id: string, updates: Partial<Booking>) => Promise<void>;
  onUpdateMaster: (master: Master) => Promise<void>;
}

type ViewMode = 'day' | 'week';
type StatusFilter = 'ALL' | BookingStatus;
type LayoutMode = 'cards' | 'board';
type DayKey = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type DayScheduleForm = { enabled: boolean; start: string; end: string };
type MasterScheduleForm = Record<DayKey, DayScheduleForm>;

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'Новая',
  PENDING_EMAIL: 'Ожидает email',
  CONFIRMED: 'Подтверждена',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
  NO_SHOW: 'Неявка',
};

const STATUS_BADGE_CLASS: Record<BookingStatus, string> = {
  PENDING: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  PENDING_EMAIL: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  CONFIRMED: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  IN_PROGRESS: 'bg-gold-500/15 text-gold-300 border-gold-500/30',
  COMPLETED: 'bg-green-500/15 text-green-300 border-green-500/30',
  CANCELLED: 'bg-zinc-800 text-zinc-500 border-zinc-700',
  NO_SHOW: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const ACTIONABLE_STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'];
const DAY_ORDER: DayKey[] = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<DayKey, string> = { 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 0: 'Вс' };

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseLocalDateTime(dateStr: string, timeStr = '00:00'): Date {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  const [hours, minutes] = String(timeStr).split(':').map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
}

function formatCurrency(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
}

function formatDateRu(dateStr: string): string {
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: '2-digit', month: 'long' }).format(parseLocalDateTime(dateStr));
}

function minutesDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60000);
}

function getWeekBounds(anchorDate: string): { start: string; end: string } {
  const date = parseLocalDateTime(anchorDate);
  const mondayOffset = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(start.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function enumerateDates(from: string, to: string): string[] {
  const start = parseLocalDateTime(from);
  const end = parseLocalDateTime(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const result: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    result.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function normalizeProfileField(value: string | null | undefined, fallback: string): string {
  const trimmed = (value ?? '').trim();
  return trimmed || fallback;
}

function formatWorkSchedule(workSchedule?: Master['workSchedule']): string {
  if (!workSchedule || typeof workSchedule !== 'object') return 'График не задан';
  return DAY_ORDER.map((day) => {
    const slot = (workSchedule as Record<string, { start: string; end: string } | null>)[String(day)]
      ?? (workSchedule as Record<number, { start: string; end: string } | null>)[day];
    if (!slot || !slot.start || !slot.end) return `${DAY_LABELS[day]}: выходной`;
    return `${DAY_LABELS[day]}: ${slot.start}-${slot.end}`;
  }).join(' | ');
}

function getTimingBadge(booking: Booking, now: Date): { label: string; className: string } | null {
  if (!ACTIONABLE_STATUSES.includes(booking.status)) return null;
  const scheduledAt = parseLocalDateTime(booking.date, booking.time);
  const diff = minutesDiff(now, scheduledAt);
  if (diff > 30) return { label: 'В ожидании', className: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
  if (diff >= 0) return { label: `Через ${diff} мин`, className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
  if (diff >= -15) return { label: 'Ожидает', className: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
  return { label: 'Опаздывает', className: 'bg-red-500/15 text-red-300 border-red-500/30' };
}

function createDefaultScheduleForm(): MasterScheduleForm {
  return {
    1: { enabled: true, start: '10:00', end: '20:00' },
    2: { enabled: true, start: '10:00', end: '20:00' },
    3: { enabled: true, start: '10:00', end: '20:00' },
    4: { enabled: true, start: '10:00', end: '20:00' },
    5: { enabled: true, start: '10:00', end: '20:00' },
    6: { enabled: true, start: '11:00', end: '18:00' },
    0: { enabled: false, start: '10:00', end: '20:00' },
  };
}

function toScheduleForm(master: Master | null): MasterScheduleForm {
  const fallback = createDefaultScheduleForm();
  if (!master?.workSchedule || typeof master.workSchedule !== 'object') return fallback;
  const raw = master.workSchedule as Record<string, { start?: string; end?: string } | null>;
  for (const day of DAY_ORDER) {
    const slot = raw[String(day)] ?? raw[day];
    if (!slot || !slot.start || !slot.end) {
      fallback[day] = { ...fallback[day], enabled: false };
      continue;
    }
    fallback[day] = { enabled: true, start: slot.start, end: slot.end };
  }
  return fallback;
}

function fromScheduleForm(schedule: MasterScheduleForm): Master['workSchedule'] {
  const normalized: Record<number, { start: string; end: string } | null> = {};
  for (const day of DAY_ORDER) {
    normalized[day] = schedule[day].enabled ? { start: schedule[day].start, end: schedule[day].end } : null;
  }
  return normalized;
}

export const StylistCabinet: React.FC<StylistCabinetProps> = ({
  master,
  user,
  bookings,
  reviews,
  onLogout,
  onUpdateBooking,
  onUpdateMaster,
}) => {
  const now = new Date();
  const todayIso = toIsoDate(now);

  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('cards');
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [dateFrom, setDateFrom] = useState(todayIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileDraft, setProfileDraft] = useState({ bio: '', experience: '', languages: '' });

  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleDraft, setScheduleDraft] = useState<MasterScheduleForm>(createDefaultScheduleForm());

  const [bookingActionId, setBookingActionId] = useState<string | null>(null);
  const [bookingActionError, setBookingActionError] = useState('');

  useEffect(() => {
    if (!master) return;
    setProfileDraft({
      bio: normalizeProfileField(master.bio, ''),
      experience: normalizeProfileField(master.experience, ''),
      languages: normalizeProfileField(master.languages, ''),
    });
    setScheduleDraft(toScheduleForm(master));
  }, [master?.id, master?.bio, master?.experience, master?.languages, master?.workSchedule]);

  useEffect(() => {
    if (viewMode === 'day') {
      setDateFrom(selectedDate);
      setDateTo(selectedDate);
      return;
    }
    const week = getWeekBounds(selectedDate);
    setDateFrom(week.start);
    setDateTo(week.end);
  }, [viewMode, selectedDate]);

  const masterBookingsAll = useMemo(
    () => (master ? bookings.filter((booking) => booking.masterId === master.id) : []),
    [bookings, master?.id]
  );

  const reviewBookingIds = useMemo(() => new Set(masterBookingsAll.map((booking) => booking.id)), [masterBookingsAll]);
  const masterReviews = useMemo(
    () => reviews.filter((review) => review.status === 'APPROVED' && !!review.bookingId && reviewBookingIds.has(review.bookingId)),
    [reviews, reviewBookingIds]
  );

  const periodBookings = useMemo(
    () => masterBookingsAll.filter((booking) => booking.date >= dateFrom && booking.date <= dateTo),
    [masterBookingsAll, dateFrom, dateTo]
  );

  const normalizedSearch = search.trim().toLowerCase();
  const filteredBookings = useMemo(
    () => periodBookings
      .filter((booking) => statusFilter === 'ALL' || booking.status === statusFilter)
      .filter((booking) => {
        if (!normalizedSearch) return true;
        return [booking.clientName, booking.clientPhone, booking.serviceId, booking.notes || '']
          .some((value) => value.toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => parseLocalDateTime(a.date, a.time).getTime() - parseLocalDateTime(b.date, b.time).getTime()),
    [periodBookings, statusFilter, normalizedSearch]
  );

  const datesForSchedule = useMemo(
    () => (viewMode === 'day' ? [selectedDate] : enumerateDates(dateFrom, dateTo)),
    [viewMode, selectedDate, dateFrom, dateTo]
  );

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const date of datesForSchedule) map.set(date, []);
    for (const booking of filteredBookings) {
      const list = map.get(booking.date) ?? [];
      list.push(booking);
      map.set(booking.date, list);
    }
    for (const [, list] of map) list.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [datesForSchedule, filteredBookings]);

  const reminders = useMemo(
    () => masterBookingsAll
      .filter((booking) => ['PENDING', 'CONFIRMED'].includes(booking.status))
      .map((booking) => ({ booking, diff: minutesDiff(now, parseLocalDateTime(booking.date, booking.time)) }))
      .filter((item) => item.diff >= 0 && item.diff <= 30)
      .sort((a, b) => a.diff - b.diff),
    [masterBookingsAll, now]
  );

  const kpi = useMemo(() => {
    const completed = periodBookings.filter((booking) => booking.status === 'COMPLETED');
    const base = periodBookings.filter((booking) => ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'].includes(booking.status));
    const noShows = periodBookings.filter((booking) => booking.status === 'NO_SHOW');
    const todayBookings = masterBookingsAll.filter((booking) => booking.date === todayIso);
    const todayRevenue = todayBookings.filter((booking) => booking.status === 'COMPLETED').reduce((sum, booking) => sum + booking.totalPrice, 0);
    return {
      total: periodBookings.length,
      revenue: completed.reduce((sum, booking) => sum + booking.totalPrice, 0),
      avgCheck: completed.length ? Math.round(completed.reduce((sum, booking) => sum + booking.totalPrice, 0) / completed.length) : 0,
      conversion: base.length ? (completed.length / base.length) * 100 : 0,
      noShowRate: base.length ? (noShows.length / base.length) * 100 : 0,
      todayTotal: todayBookings.length,
      todayRevenue,
    };
  }, [masterBookingsAll, periodBookings, todayIso]);

  const todayShiftBookings = useMemo(
    () => masterBookingsAll.filter((booking) => booking.date === todayIso).sort((a, b) => a.time.localeCompare(b.time)),
    [masterBookingsAll, todayIso]
  );

  const boardBookings = useMemo(
    () => masterBookingsAll
      .filter((booking) => booking.date === selectedDate)
      .filter((booking) => statusFilter === 'ALL' || booking.status === statusFilter)
      .filter((booking) => {
        if (!normalizedSearch) return true;
        return [booking.clientName, booking.clientPhone, booking.serviceId, booking.notes || '']
          .some((value) => value.toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => a.time.localeCompare(b.time)),
    [masterBookingsAll, normalizedSearch, selectedDate, statusFilter]
  );

  const selectedBooking = useMemo(
    () => masterBookingsAll.find((booking) => booking.id === selectedBookingId) || null,
    [masterBookingsAll, selectedBookingId]
  );

  const clientHistory = useMemo(() => {
    if (!selectedBooking) return { previousVisits: [] as Booking[], preferences: [] as string[], lastVisit: null as Booking | null };
    const matches = masterBookingsAll
      .filter((booking) => booking.clientPhone === selectedBooking.clientPhone)
      .sort((a, b) => parseLocalDateTime(b.date, b.time).getTime() - parseLocalDateTime(a.date, a.time).getTime());
    const previousVisits = matches.filter((booking) => booking.id !== selectedBooking.id);
    const preferences = [...new Set(matches.map((booking) => (booking.notes || '').trim()).filter(Boolean))].slice(0, 5);
    return { previousVisits, preferences, lastVisit: previousVisits[0] || null };
  }, [masterBookingsAll, selectedBooking]);

  const avgRating = masterReviews.length
    ? (masterReviews.reduce((sum, review) => sum + review.rating, 0) / masterReviews.length).toFixed(1)
    : '0.0';

  if (!master) {
    return <div className="min-h-screen bg-black text-zinc-300 flex items-center justify-center p-6">Профиль мастера не найден.</div>;
  }

  const displayBio = normalizeProfileField(master.bio, 'Профиль пока не заполнен.');
  const displayExperience = normalizeProfileField(master.experience, 'Не указан');
  const displayLanguages = normalizeProfileField(master.languages, 'Не указаны');

  const changeSelectedDate = (deltaDays: number) => {
    const date = parseLocalDateTime(selectedDate);
    date.setDate(date.getDate() + deltaDays);
    setSelectedDate(toIsoDate(date));
  };

  const handleUpdateBookingStatus = async (booking: Booking, status: BookingStatus) => {
    try {
      setBookingActionError('');
      setBookingActionId(booking.id);
      await onUpdateBooking(booking.id, { status });
    } catch (error) {
      setBookingActionError((error as Error).message || 'Не удалось обновить статус записи');
    } finally {
      setBookingActionId(null);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setProfileError('');
      setIsSavingProfile(true);
      await onUpdateMaster({
        ...master,
        bio: profileDraft.bio.trim(),
        experience: profileDraft.experience.trim(),
        languages: profileDraft.languages.trim(),
      });
      setIsEditingProfile(false);
    } catch (error) {
      setProfileError((error as Error).message || 'Не удалось сохранить профиль');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const updateScheduleDay = (day: DayKey, updates: Partial<DayScheduleForm>) => {
    setScheduleDraft((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...updates },
    }));
  };

  const handleSaveSchedule = async () => {
    for (const day of DAY_ORDER) {
      const slot = scheduleDraft[day];
      if (!slot.enabled) continue;
      if (!slot.start || !slot.end || slot.start >= slot.end) {
        setScheduleError(`Проверьте график на день ${DAY_LABELS[day]}.`);
        return;
      }
    }

    try {
      setScheduleError('');
      setIsSavingSchedule(true);
      await onUpdateMaster({
        ...master,
        workSchedule: fromScheduleForm(scheduleDraft),
      });
      setIsEditingSchedule(false);
    } catch (error) {
      setScheduleError((error as Error).message || 'Не удалось сохранить график');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const renderActionButtons = (booking: Booking) => {
    if (!ACTIONABLE_STATUSES.includes(booking.status)) return null;
    const busy = bookingActionId === booking.id;
    return (
      <div className="flex flex-wrap gap-2 mt-4">
        {booking.status !== 'IN_PROGRESS' ? (
          <button
            disabled={busy}
            onClick={() => handleUpdateBookingStatus(booking, 'IN_PROGRESS')}
            className="flex-1 min-w-[150px] px-4 py-3 rounded-xl bg-gold-500 text-black text-sm font-semibold hover:bg-gold-400 disabled:opacity-50"
          >
            <Clock size={16} className="inline mr-2" />
            Начать стрижку
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={() => handleUpdateBookingStatus(booking, 'COMPLETED')}
            className="flex-1 min-w-[150px] px-4 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-500 disabled:opacity-50"
          >
            <CheckCircle size={16} className="inline mr-2" />
            Завершить
          </button>
        )}

        {booking.status !== 'IN_PROGRESS' && (
          <button
            disabled={busy}
            onClick={() => handleUpdateBookingStatus(booking, 'NO_SHOW')}
            className="px-4 py-3 rounded-xl bg-red-600/80 text-white text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
          >
            <XCircle size={16} className="inline mr-2" />
            Неявка
          </button>
        )}

        <button
          onClick={() => setSelectedBookingId(booking.id)}
          className="px-4 py-3 rounded-xl border border-zinc-700 text-zinc-200 text-sm font-medium hover:border-gold-500 hover:text-white"
        >
          История клиента
        </button>
      </div>
    );
  };

  const renderBookingCard = (booking: Booking, compact = false) => {
    const timingBadge = getTimingBadge(booking, now);
    return (
      <div key={booking.id} className={`rounded-2xl border border-zinc-800 bg-zinc-900 ${compact ? 'p-4' : 'p-5'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl font-mono text-gold-400">{booking.time}</span>
              <span className={`text-xs border rounded-full px-2 py-1 ${STATUS_BADGE_CLASS[booking.status]}`}>
                {STATUS_LABELS[booking.status]}
              </span>
              {timingBadge && (
                <span className={`text-xs border rounded-full px-2 py-1 ${timingBadge.className}`}>
                  {timingBadge.label}
                </span>
              )}
            </div>
            <h3 className="text-white font-semibold text-lg mt-3">{booking.clientName}</h3>
            <div className="text-sm text-zinc-400 mt-2 flex flex-wrap gap-x-4 gap-y-2">
              <span className="flex items-center gap-1"><Phone size={13} />{booking.clientPhone}</span>
              <span>{booking.serviceId}</span>
              <span className="text-gold-400">{formatCurrency(booking.totalPrice)}</span>
            </div>
            {booking.notes && (
              <p className="text-sm text-zinc-500 mt-3 whitespace-pre-wrap">{booking.notes}</p>
            )}
          </div>
          <button onClick={() => setSelectedBookingId(booking.id)} className="text-zinc-500 hover:text-white text-sm">
            Подробнее
          </button>
        </div>
        {!compact && renderActionButtons(booking)}
      </div>
    );
  };

  const waitingBoardBookings = boardBookings.filter((booking) => ['PENDING', 'PENDING_EMAIL', 'CONFIRMED'].includes(booking.status));
  const inProgressBoardBookings = boardBookings.filter((booking) => booking.status === 'IN_PROGRESS');
  const completedBoardBookings = boardBookings.filter((booking) => booking.status === 'COMPLETED');
  const archivedBoardBookings = boardBookings.filter((booking) => ['CANCELLED', 'NO_SHOW'].includes(booking.status));

  return (
    <div className="min-h-screen bg-black text-zinc-200 selection:bg-zinc-700 selection:text-white">
      <div className="bg-gradient-to-r from-gold-500 to-gold-600 text-black p-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={master.imageUrl} alt={master.name} className="w-16 h-16 rounded-full object-cover border-4 border-black" />
            <div>
              <h1 className="text-3xl font-bold">{master.name}</h1>
              <p className="text-gold-900">{master.role}</p>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-zinc-900 transition-colors">
            <LogOut className="w-5 h-5" />
            Выход
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-zinc-400 text-sm">Сегодня записей</p>
            <p className="text-3xl font-bold mt-1">{kpi.todayTotal}</p>
            <p className="text-xs text-zinc-500 mt-1">Смена на {todayIso}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-zinc-400 text-sm">Выручка сегодня</p>
            <p className="text-3xl font-bold mt-1 text-gold-400">{formatCurrency(kpi.todayRevenue)}</p>
            <p className="text-xs text-zinc-500 mt-1">По завершенным визитам</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-zinc-400 text-sm">Рейтинг</p>
            <p className="text-3xl font-bold mt-1">{avgRating}</p>
            <p className="text-xs text-zinc-500 mt-1">{masterReviews.length} отзывов</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-zinc-400 text-sm">Средний чек</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(kpi.avgCheck)}</p>
            <p className="text-xs text-zinc-500 mt-1">За выбранный период</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-zinc-400 text-sm">Конверсия</p>
            <p className="text-3xl font-bold mt-1 text-green-400">{kpi.conversion.toFixed(1)}%</p>
            <p className="text-xs text-zinc-500 mt-1">Неявки: {kpi.noShowRate.toFixed(1)}%</p>
          </div>
        </div>

        {reminders.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
            <h2 className="text-amber-300 font-semibold mb-3 flex items-center gap-2">
              <Clock size={16} />
              Напоминания на ближайшие 30 минут
            </h2>
            <div className="space-y-2">
              {reminders.map(({ booking, diff }) => (
                <div key={`reminder-${booking.id}`} className="text-sm text-zinc-200 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="font-semibold">{booking.time}</span>
                  <span>{booking.clientName}</span>
                  <span className="text-zinc-400">{booking.clientPhone}</span>
                  <span className="text-amber-300">через {diff} мин</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
            <div className="xl:col-span-4 min-w-0 flex flex-wrap gap-2">
              <button onClick={() => setViewMode('day')} className={`px-3 py-2 rounded-xl border text-sm ${viewMode === 'day' ? 'bg-gold-500 text-black border-gold-500' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>День</button>
              <button onClick={() => setViewMode('week')} className={`px-3 py-2 rounded-xl border text-sm ${viewMode === 'week' ? 'bg-gold-500 text-black border-gold-500' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>Неделя</button>
              <button onClick={() => changeSelectedDate(-1)} className="px-3 py-2 rounded-xl border bg-zinc-800 text-zinc-300 border-zinc-700 text-sm"><ChevronLeft size={16} /></button>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 min-w-0" />
              <button onClick={() => changeSelectedDate(1)} className="px-3 py-2 rounded-xl border bg-zinc-800 text-zinc-300 border-zinc-700 text-sm"><ChevronRight size={16} /></button>
            </div>

            <div className="xl:col-span-2 min-w-0">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200">
                <option value="ALL">Все статусы</option>
                {Object.keys(STATUS_LABELS).map((status) => <option key={status} value={status}>{STATUS_LABELS[status as BookingStatus]}</option>)}
              </select>
            </div>

            <div className="xl:col-span-3 min-w-0 relative">
              <Search size={16} className="absolute left-3 top-2.5 text-zinc-500" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по клиенту, телефону, услуге" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-sm text-zinc-200" />
            </div>

            <div className="xl:col-span-3 min-w-0 grid grid-cols-2 gap-2">
              <button onClick={() => setLayoutMode('cards')} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm ${layoutMode === 'cards' ? 'bg-gold-500 text-black border-gold-500' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>
                <List size={16} />
                Карточки
              </button>
              <button onClick={() => setLayoutMode('board')} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm ${layoutMode === 'board' ? 'bg-gold-500 text-black border-gold-500' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>
                <LayoutGrid size={16} />
                Kanban
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 xl:max-w-sm">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200" />
          </div>
        </div>

        {bookingActionError && <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl p-3 text-sm">{bookingActionError}</div>}

        <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
          <div className="2xl:col-span-2 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gold-500" />
                  Сегодняшняя смена
                </h2>
                <span className="text-sm text-zinc-500">{todayShiftBookings.length} записей</span>
              </div>

              {todayShiftBookings.length === 0 ? (
                <p className="text-zinc-500 text-sm">На сегодня записей нет.</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {todayShiftBookings.map((booking) => (
                    <div key={`today-${booking.id}`} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                      {renderBookingCard(booking, true)}
                      {renderActionButtons(booking)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {layoutMode === 'board' ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-gold-500" />
                    Kanban на {selectedDate}
                  </h2>
                  <span className="text-sm text-zinc-500">{boardBookings.length} карточек</span>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  {[
                    { title: 'Ожидают', items: waitingBoardBookings },
                    { title: 'В кресле', items: inProgressBoardBookings },
                    { title: 'Завершено', items: completedBoardBookings },
                  ].map((column) => (
                    <div key={column.title} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-white">{column.title}</h3>
                        <span className="text-xs text-zinc-500">{column.items.length}</span>
                      </div>
                      <div className="space-y-3">
                        {column.items.length === 0 && <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">Пусто</div>}
                        {column.items.map((booking) => (
                          <div key={`board-${booking.id}`} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-gold-400 font-mono">{booking.time}</span>
                              <button onClick={() => setSelectedBookingId(booking.id)} className="text-xs text-zinc-500 hover:text-white">История</button>
                            </div>
                            <p className="text-white font-semibold mt-2">{booking.clientName}</p>
                            <p className="text-sm text-zinc-400 mt-1">{booking.serviceId}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {booking.status !== 'IN_PROGRESS' && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(booking.status) && (
                                <button onClick={() => handleUpdateBookingStatus(booking, 'IN_PROGRESS')} disabled={bookingActionId === booking.id} className="px-3 py-2 rounded-xl bg-gold-500 text-black text-xs font-semibold disabled:opacity-50">
                                  В кресло
                                </button>
                              )}
                              {booking.status === 'IN_PROGRESS' && (
                                <button onClick={() => handleUpdateBookingStatus(booking, 'COMPLETED')} disabled={bookingActionId === booking.id} className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-semibold disabled:opacity-50">
                                  Завершить
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {archivedBoardBookings.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <h3 className="font-semibold text-white mb-3">Отмененные и неявки</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {archivedBoardBookings.map((booking) => renderBookingCard(booking, true))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gold-500" />
                    Лента записей
                  </h2>
                  <div className="text-sm text-zinc-400">{dateFrom} — {dateTo}</div>
                </div>

                <div className="space-y-4">
                  {datesForSchedule.map((date) => {
                    const dayBookings = bookingsByDate.get(date) ?? [];
                    return (
                      <div key={date} className="rounded-2xl border border-zinc-800 overflow-hidden">
                        <div className="px-4 py-3 bg-zinc-800/60 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-white">{formatDateRu(date)}</p>
                            <p className="text-xs text-zinc-500">{date}</p>
                          </div>
                          <div className="text-sm text-zinc-400">{dayBookings.length} записей</div>
                        </div>
                        {dayBookings.length === 0 ? (
                          <div className="px-4 py-4 text-sm text-zinc-500">Записей нет</div>
                        ) : (
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
                            {dayBookings.map((booking) => renderBookingCard(booking))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><User size={18} className="text-gold-500" />Профиль мастера</h3>
                <button onClick={() => { setIsEditingProfile((prev) => !prev); setProfileError(''); }} className="text-zinc-400 hover:text-gold-400">
                  {isEditingProfile ? <Close size={18} /> : <Edit2 size={18} />}
                </button>
              </div>

              {isEditingProfile ? (
                <div className="space-y-3">
                  <textarea value={profileDraft.bio} onChange={(e) => setProfileDraft((prev) => ({ ...prev, bio: e.target.value }))} rows={4} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-zinc-200" />
                  <input value={profileDraft.experience} onChange={(e) => setProfileDraft((prev) => ({ ...prev, experience: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-zinc-200" placeholder="Опыт" />
                  <input value={profileDraft.languages} onChange={(e) => setProfileDraft((prev) => ({ ...prev, languages: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-zinc-200" placeholder="Языки" />
                  {profileError && <p className="text-sm text-red-400">{profileError}</p>}
                  <button disabled={isSavingProfile} onClick={handleSaveProfile} className="w-full py-3 bg-gold-500 text-black rounded-xl font-semibold hover:bg-gold-400 disabled:opacity-50">
                    <Save size={14} className="inline mr-1" />
                    {isSavingProfile ? 'Сохраняем...' : 'Сохранить профиль'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <p className="text-zinc-300">{displayBio}</p>
                  <p className="text-zinc-400">Опыт: <span className="text-zinc-200">{displayExperience}</span></p>
                  <p className="text-zinc-400">Языки: <span className="text-zinc-200">{displayLanguages}</span></p>
                </div>
              )}

              <div className="mt-5 pt-5 border-t border-zinc-800 space-y-2 text-sm">
                <p className="text-zinc-400 flex items-center gap-2"><Phone size={14} className="text-gold-500" />{user.phone || 'Телефон не указан'}</p>
                <p className="text-zinc-400 flex items-center gap-2"><Mail size={14} className="text-gold-500" />{user.email}</p>
                <p className="text-zinc-500">{formatWorkSchedule(master.workSchedule)}</p>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Calendar size={18} className="text-gold-500" />Мое расписание</h3>
                <button onClick={() => { setIsEditingSchedule((prev) => !prev); setScheduleError(''); setScheduleDraft(toScheduleForm(master)); }} className="text-zinc-400 hover:text-gold-400">
                  {isEditingSchedule ? <Close size={18} /> : <Edit2 size={18} />}
                </button>
              </div>
              <p className="text-sm text-zinc-500 mb-4">Изменения сразу видны администратору. Можно закрыть день или поменять часы выхода.</p>
              <div className="space-y-2">
                {DAY_ORDER.map((day) => (
                  <div key={day} className="grid grid-cols-[46px_90px_1fr_1fr] gap-2 items-center">
                    <span className="text-zinc-300 text-sm">{DAY_LABELS[day]}</span>
                    <label className="text-xs text-zinc-400 flex items-center gap-2">
                      <input type="checkbox" checked={scheduleDraft[day].enabled} onChange={(e) => updateScheduleDay(day, { enabled: e.target.checked })} disabled={!isEditingSchedule} className="w-4 h-4" />
                      Работаю
                    </label>
                    <input type="time" value={scheduleDraft[day].start} onChange={(e) => updateScheduleDay(day, { start: e.target.value })} disabled={!isEditingSchedule || !scheduleDraft[day].enabled} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2 text-white disabled:opacity-40" />
                    <input type="time" value={scheduleDraft[day].end} onChange={(e) => updateScheduleDay(day, { end: e.target.value })} disabled={!isEditingSchedule || !scheduleDraft[day].enabled} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2 text-white disabled:opacity-40" />
                  </div>
                ))}
              </div>
              {scheduleError && <p className="text-sm text-red-400 mt-3">{scheduleError}</p>}
              {isEditingSchedule && (
                <button disabled={isSavingSchedule} onClick={handleSaveSchedule} className="w-full mt-4 py-3 bg-gold-500 text-black rounded-xl font-semibold hover:bg-gold-400 disabled:opacity-50">
                  <Save size={14} className="inline mr-1" />
                  {isSavingSchedule ? 'Сохраняем...' : 'Сохранить расписание'}
                </button>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Star size={18} className="text-gold-500" />Отзывы по вашим записям</h3>
              {masterReviews.length === 0 ? (
                <p className="text-zinc-500 text-sm">Нет отзывов, привязанных к вашим bookingId.</p>
              ) : (
                <div className="space-y-4 max-h-[420px] overflow-auto pr-1">
                  {masterReviews.slice(0, 12).map((review) => (
                    <div key={review.id} className="border-b border-zinc-800 pb-3 last:border-b-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-200">{review.clientName}</p>
                        <div className="flex items-center gap-1 text-gold-500"><Star size={14} className="fill-current" /><span className="text-sm">{review.rating}</span></div>
                      </div>
                      <p className="text-sm text-zinc-400 mt-1">{review.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><TrendingUp size={18} className="text-gold-500" />Оперативная сводка</h3>
              <ul className="space-y-2 text-sm text-zinc-300">
                <li>Записей в периоде: <span className="text-white">{kpi.total}</span></li>
                <li>Выручка: <span className="text-white">{formatCurrency(kpi.revenue)}</span></li>
                <li>Средний чек: <span className="text-white">{formatCurrency(kpi.avgCheck)}</span></li>
                <li>Конверсия: <span className="text-white">{kpi.conversion.toFixed(1)}%</span></li>
                <li>Доля неявок: <span className="text-white">{kpi.noShowRate.toFixed(1)}%</span></li>
              </ul>
            </div>
          </div>
        </div>
        {selectedBooking && (
          <div className="fixed inset-0 z-50 bg-black/80 p-4 flex items-center justify-center">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-3xl border border-zinc-800 bg-zinc-950">
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-white text-2xl font-bold">{selectedBooking.clientName}</h2>
                  <p className="text-zinc-500 text-sm mt-1">{selectedBooking.date} в {selectedBooking.time}</p>
                </div>
                <button onClick={() => setSelectedBookingId(null)} className="text-zinc-500 hover:text-white">
                  <Close size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><User size={16} className="text-gold-500" />Карточка клиента</h3>
                    <div className="space-y-2 text-sm text-zinc-300">
                      <p className="flex items-center gap-2"><Phone size={14} className="text-gold-500" />{selectedBooking.clientPhone}</p>
                      <p className="flex items-center gap-2"><Mail size={14} className="text-gold-500" />{selectedBooking.clientEmail || 'Email не указан'}</p>
                      <p>Услуга: <span className="text-white">{selectedBooking.serviceId}</span></p>
                      <p>Статус: <span className="text-white">{STATUS_LABELS[selectedBooking.status]}</span></p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><History size={16} className="text-gold-500" />История визитов</h3>
                    {clientHistory.lastVisit ? (
                      <div className="space-y-2 text-sm text-zinc-300">
                        <p>Прошлый визит: <span className="text-white">{clientHistory.lastVisit.date} в {clientHistory.lastVisit.time}</span></p>
                        <p>Что делали: <span className="text-white">{clientHistory.lastVisit.serviceId}</span></p>
                        <p>Всего прошлых визитов: <span className="text-white">{clientHistory.previousVisits.length}</span></p>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">Это первый визит клиента у вас.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  <h3 className="text-white font-semibold mb-3">Предпочтения и заметки</h3>
                  {clientHistory.preferences.length === 0 ? (
                    <p className="text-sm text-zinc-500">Заметок пока нет.</p>
                  ) : (
                    <div className="space-y-2">
                      {clientHistory.preferences.map((note) => (
                        <div key={note} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300 whitespace-pre-wrap">{note}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  <h3 className="text-white font-semibold mb-3">Прошлые визиты</h3>
                  {clientHistory.previousVisits.length === 0 ? (
                    <p className="text-sm text-zinc-500">История по этому клиенту пока пустая.</p>
                  ) : (
                    <div className="space-y-3">
                      {clientHistory.previousVisits.slice(0, 6).map((visit) => (
                        <div key={visit.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-white font-medium">{visit.date} в {visit.time}</p>
                              <p className="text-sm text-zinc-400 mt-1">{visit.serviceId}</p>
                            </div>
                            <span className={`text-xs border rounded-full px-2 py-1 ${STATUS_BADGE_CLASS[visit.status]}`}>{STATUS_LABELS[visit.status]}</span>
                          </div>
                          {visit.notes && <p className="text-sm text-zinc-500 mt-3 whitespace-pre-wrap">{visit.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
