import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle,
  Clock,
  Edit2,
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

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseLocalDateTime(dateStr: string, timeStr = '00:00'): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
}

function formatCurrency(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} руб.`;
}

function formatDateRu(dateStr: string): string {
  const date = parseLocalDateTime(dateStr);
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
  }).format(date);
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
  if (!from || !to) return [];
  const start = parseLocalDateTime(from);
  const end = parseLocalDateTime(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const result: string[] = [];
  const cursor = new Date(start);
  let guard = 0;
  while (cursor <= end && guard < 366) {
    result.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return result;
}

function formatWorkSchedule(workSchedule?: Master['workSchedule']): string {
  if (!workSchedule || typeof workSchedule !== 'object') return 'График не задан';

  const labels: Array<{ key: number; label: string }> = [
    { key: 1, label: 'Пн' },
    { key: 2, label: 'Вт' },
    { key: 3, label: 'Ср' },
    { key: 4, label: 'Чт' },
    { key: 5, label: 'Пт' },
    { key: 6, label: 'Сб' },
    { key: 0, label: 'Вс' },
  ];

  const parts = labels.map(({ key, label }) => {
    const slot = (workSchedule as Record<string, { start: string; end: string } | null>)[String(key)]
      ?? (workSchedule as Record<number, { start: string; end: string } | null>)[key];
    if (!slot || !slot.start || !slot.end) return `${label}: выходной`;
    return `${label}: ${slot.start}-${slot.end}`;
  });

  return parts.join(' | ');
}

function normalizeProfileField(value: string | null | undefined, fallback: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return fallback;

  const compact = trimmed.replace(/\s+/g, '');
  const questionCount = (compact.match(/\?/g) || []).length;
  const alnumCount = (compact.match(/[A-Za-zА-Яа-я0-9Ёё]/g) || []).length;
  const questionRatio = compact.length > 0 ? questionCount / compact.length : 0;

  if ((questionCount >= 3 && questionCount >= alnumCount) || questionRatio >= 0.4) {
    return fallback;
  }

  return trimmed;
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
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [dateFrom, setDateFrom] = useState<string>(todayIso);
  const [dateTo, setDateTo] = useState<string>(todayIso);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [bookingActionId, setBookingActionId] = useState<string | null>(null);
  const [bookingActionError, setBookingActionError] = useState('');

  const [profileDraft, setProfileDraft] = useState({
    bio: '',
    experience: '',
    languages: '',
  });

  useEffect(() => {
    if (!master) return;
    setProfileDraft({
      bio: normalizeProfileField(master.bio, ''),
      experience: normalizeProfileField(master.experience, ''),
      languages: normalizeProfileField(master.languages, ''),
    });
  }, [master?.id, master?.bio, master?.experience, master?.languages]);

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

  if (!master) {
    return (
      <div className="min-h-screen bg-black text-zinc-300 flex items-center justify-center p-6">
        Профиль мастера не найден. Проверьте соответствие пользователя и карточки мастера.
      </div>
    );
  }

  const masterBookingsAll = useMemo(
    () => bookings.filter((booking) => booking.masterId === master.id),
    [bookings, master.id]
  );

  const reviewBookingIds = useMemo(() => new Set(masterBookingsAll.map((booking) => booking.id)), [masterBookingsAll]);
  const masterReviews = useMemo(
    () =>
      reviews
        .filter((review) => review.status === 'APPROVED' && !!review.bookingId && reviewBookingIds.has(review.bookingId))
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        }),
    [reviews, reviewBookingIds]
  );

  const periodBookings = useMemo(
    () =>
      masterBookingsAll.filter((booking) => {
        if (dateFrom && booking.date < dateFrom) return false;
        if (dateTo && booking.date > dateTo) return false;
        return true;
      }),
    [masterBookingsAll, dateFrom, dateTo]
  );

  const normalizedSearch = search.trim().toLowerCase();
  const filteredBookings = useMemo(
    () =>
      periodBookings
        .filter((booking) => (statusFilter === 'ALL' ? true : booking.status === statusFilter))
        .filter((booking) => {
          if (!normalizedSearch) return true;
          return (
            booking.clientName.toLowerCase().includes(normalizedSearch) ||
            booking.clientPhone.toLowerCase().includes(normalizedSearch)
          );
        })
        .sort((a, b) => parseLocalDateTime(a.date, a.time).getTime() - parseLocalDateTime(b.date, b.time).getTime()),
    [periodBookings, statusFilter, normalizedSearch]
  );

  const datesForSchedule = useMemo(() => {
    if (viewMode === 'day') return [selectedDate];
    return enumerateDates(dateFrom, dateTo);
  }, [viewMode, selectedDate, dateFrom, dateTo]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const date of datesForSchedule) map.set(date, []);
    for (const booking of filteredBookings) {
      const list = map.get(booking.date) ?? [];
      list.push(booking);
      map.set(booking.date, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [datesForSchedule, filteredBookings]);

  const reminders = useMemo(
    () =>
      masterBookingsAll
        .filter((booking) => ['PENDING', 'CONFIRMED'].includes(booking.status))
        .map((booking) => {
          const startsAt = parseLocalDateTime(booking.date, booking.time);
          return { booking, startsAt, diff: minutesDiff(now, startsAt) };
        })
        .filter((item) => item.diff >= 0 && item.diff <= 30)
        .sort((a, b) => a.diff - b.diff),
    [masterBookingsAll, now]
  );

  const kpi = useMemo(() => {
    const completed = periodBookings.filter((booking) => booking.status === 'COMPLETED');
    const noShows = periodBookings.filter((booking) => booking.status === 'NO_SHOW');
    const confirmedBase = periodBookings.filter((booking) =>
      ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'].includes(booking.status)
    );

    const avgCheck = completed.length > 0
      ? Math.round(completed.reduce((sum, booking) => sum + booking.totalPrice, 0) / completed.length)
      : 0;
    const conversion = confirmedBase.length > 0 ? (completed.length / confirmedBase.length) * 100 : 0;
    const noShowRate = confirmedBase.length > 0 ? (noShows.length / confirmedBase.length) * 100 : 0;

    return {
      total: periodBookings.length,
      revenue: completed.reduce((sum, booking) => sum + booking.totalPrice, 0),
      avgCheck,
      conversion,
      noShowRate,
    };
  }, [periodBookings]);

  const avgRating = masterReviews.length > 0
    ? (masterReviews.reduce((sum, review) => sum + review.rating, 0) / masterReviews.length).toFixed(1)
    : '0.0';
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
      setProfileError((error as Error).message || 'Не удалось сохранить профиль мастера');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-200 selection:bg-zinc-700 selection:text-white">
      <div className="bg-gradient-to-r from-gold-500 to-gold-600 text-black p-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={master.imageUrl}
              alt={master.name}
              className="w-16 h-16 rounded-full object-cover border-4 border-black"
            />
            <div>
              <h1 className="text-3xl font-bold">{master.name}</h1>
              <p className="text-gold-900">{master.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-zinc-900 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Выход
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <p className="text-zinc-400 text-sm">Рейтинг</p>
            <p className="text-3xl font-bold mt-1">{avgRating}</p>
            <p className="text-xs text-zinc-500 mt-1">{masterReviews.length} отзывов</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <p className="text-zinc-400 text-sm">Средний чек</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(kpi.avgCheck)}</p>
            <p className="text-xs text-zinc-500 mt-1">По завершенным записям</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <p className="text-zinc-400 text-sm">Конверсия</p>
            <p className="text-3xl font-bold mt-1 text-green-400">{kpi.conversion.toFixed(1)}%</p>
            <p className="text-xs text-zinc-500 mt-1">Подтверждена → Завершена</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <p className="text-zinc-400 text-sm">Доля неявок</p>
            <p className="text-3xl font-bold mt-1 text-red-400">{kpi.noShowRate.toFixed(1)}%</p>
            <p className="text-xs text-zinc-500 mt-1">Неявки по подтвержденным</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <p className="text-zinc-400 text-sm">Выручка периода</p>
            <p className="text-3xl font-bold mt-1 text-gold-400">{formatCurrency(kpi.revenue)}</p>
            <p className="text-xs text-zinc-500 mt-1">Записей: {kpi.total}</p>
          </div>
        </div>

        {reminders.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <h2 className="text-amber-300 font-semibold mb-3 flex items-center gap-2">
              <Clock size={16} />
              Напоминания: через 30 минут клиент
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

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
            <div className="xl:col-span-4 min-w-0 flex flex-wrap gap-2">
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-2 rounded border text-sm ${viewMode === 'day' ? 'bg-gold-500 text-black border-gold-500' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}
              >
                День
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-2 rounded border text-sm ${viewMode === 'week' ? 'bg-gold-500 text-black border-gold-500' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}
              >
                Неделя
              </button>
              <button onClick={() => changeSelectedDate(-1)} className="px-3 py-2 rounded border bg-zinc-800 text-zinc-300 border-zinc-700 text-sm">&lt;</button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 min-w-0"
              />
              <button onClick={() => changeSelectedDate(1)} className="px-3 py-2 rounded border bg-zinc-800 text-zinc-300 border-zinc-700 text-sm">&gt;</button>
            </div>

            <div className="xl:col-span-2 min-w-0">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200"
              >
                <option value="ALL">Все статусы</option>
                {Object.keys(STATUS_LABELS).map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status as BookingStatus]}</option>
                ))}
              </select>
            </div>

            <div className="xl:col-span-3 min-w-0 relative">
              <Search size={16} className="absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по клиенту или телефону"
                className="w-full bg-zinc-800 border border-zinc-700 rounded pl-9 pr-3 py-2 text-sm text-zinc-200"
              />
            </div>

            <div className="xl:col-span-3 min-w-0 grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm text-zinc-200"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm text-zinc-200"
              />
            </div>
          </div>
        </div>

        {bookingActionError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg p-3 text-sm">
            {bookingActionError}
          </div>
        )}

        <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
          <div className="2xl:col-span-2 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gold-500" />
                  Расписание ({viewMode === 'day' ? 'день' : 'неделя'})
                </h2>
                <div className="text-sm text-zinc-400">{dateFrom} — {dateTo}</div>
              </div>

              <div className="space-y-4">
                {datesForSchedule.length === 0 && (
                  <div className="text-zinc-500 text-sm">Нет дат для отображения. Проверьте фильтр периода.</div>
                )}

                {datesForSchedule.map((date) => {
                  const dayBookings = bookingsByDate.get(date) ?? [];
                  return (
                    <div key={date} className="border border-zinc-800 rounded-lg overflow-hidden">
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
                        <div className="divide-y divide-zinc-800">
                          {dayBookings.map((booking) => {
                            const timingBadge = getTimingBadge(booking, now);
                            const busy = bookingActionId === booking.id;
                            const canAct = ACTIONABLE_STATUSES.includes(booking.status);
                            return (
                              <div key={booking.id} className="px-4 py-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-lg font-mono text-gold-400">{booking.time}</span>
                                      <span className={`text-xs border rounded px-2 py-0.5 ${STATUS_BADGE_CLASS[booking.status]}`}>
                                        {STATUS_LABELS[booking.status]}
                                      </span>
                                      {timingBadge && (
                                        <span className={`text-xs border rounded px-2 py-0.5 ${timingBadge.className}`}>
                                          {timingBadge.label}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-white font-semibold mt-1">{booking.clientName}</p>
                                    <div className="text-sm text-zinc-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                      <span className="flex items-center gap-1"><Phone size={12} />{booking.clientPhone}</span>
                                      <span>{booking.serviceId}</span>
                                      <span className="text-gold-400">{formatCurrency(booking.totalPrice)}</span>
                                    </div>
                                    {booking.notes && (
                                      <p className="text-xs text-zinc-500 mt-2 whitespace-pre-wrap">{booking.notes}</p>
                                    )}
                                  </div>

                                  {canAct && (
                                    <div className="flex flex-wrap gap-2">
                                      {booking.status !== 'IN_PROGRESS' ? (
                                        <button
                                          disabled={busy}
                                          onClick={() => handleUpdateBookingStatus(booking, 'IN_PROGRESS')}
                                          className="px-3 py-2 rounded bg-gold-600 text-black text-sm font-semibold hover:bg-gold-500 disabled:opacity-50"
                                        >
                                          <Clock size={14} className="inline mr-1" />Начать
                                        </button>
                                      ) : (
                                        <button
                                          disabled={busy}
                                          onClick={() => handleUpdateBookingStatus(booking, 'COMPLETED')}
                                          className="px-3 py-2 rounded bg-green-600 text-white text-sm font-semibold hover:bg-green-500 disabled:opacity-50"
                                        >
                                          <CheckCircle size={14} className="inline mr-1" />Завершить
                                        </button>
                                      )}

                                      {booking.status !== 'IN_PROGRESS' && (
                                        <button
                                          disabled={busy}
                                          onClick={() => handleUpdateBookingStatus(booking, 'NO_SHOW')}
                                          className="px-3 py-2 rounded bg-red-600/80 text-white text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
                                        >
                                          <XCircle size={14} className="inline mr-1" />Неявка
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <User size={18} className="text-gold-500" />
                  Профиль мастера
                </h3>
                <button
                  onClick={() => {
                    setIsEditingProfile((prev) => !prev);
                    setProfileError('');
                  }}
                  className="text-zinc-400 hover:text-gold-400"
                >
                  {isEditingProfile ? <Close size={18} /> : <Edit2 size={18} />}
                </button>
              </div>

              {isEditingProfile ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-500">О себе</label>
                    <textarea
                      value={profileDraft.bio}
                      onChange={(e) => setProfileDraft((prev) => ({ ...prev, bio: e.target.value }))}
                      rows={4}
                      className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-sm text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500">Опыт</label>
                    <input
                      value={profileDraft.experience}
                      onChange={(e) => setProfileDraft((prev) => ({ ...prev, experience: e.target.value }))}
                      className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-sm text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500">Языки</label>
                    <input
                      value={profileDraft.languages}
                      onChange={(e) => setProfileDraft((prev) => ({ ...prev, languages: e.target.value }))}
                      className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-sm text-zinc-200"
                    />
                  </div>
                  {profileError && <p className="text-sm text-red-400">{profileError}</p>}
                  <button
                    disabled={isSavingProfile}
                    onClick={handleSaveProfile}
                    className="w-full py-2 bg-gold-500 text-black rounded font-semibold hover:bg-gold-400 disabled:opacity-50"
                  >
                    <Save size={14} className="inline mr-1" />
                    {isSavingProfile ? 'Сохраняем...' : 'Сохранить в БД'}
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

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Star size={18} className="text-gold-500" />
                Отзывы по вашим записям
              </h3>
              {masterReviews.length === 0 ? (
                <p className="text-zinc-500 text-sm">Нет отзывов, привязанных к вашим bookingId.</p>
              ) : (
                <div className="space-y-4 max-h-[420px] overflow-auto pr-1">
                  {masterReviews.slice(0, 12).map((review) => (
                    <div key={review.id} className="border-b border-zinc-800 pb-3 last:border-b-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-200">{review.clientName}</p>
                        <div className="flex items-center gap-1 text-gold-500">
                          <Star size={14} className="fill-current" />
                          <span className="text-sm">{review.rating}</span>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-400 mt-1">{review.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <TrendingUp size={18} className="text-gold-500" />
                Оперативная сводка
              </h3>
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
      </div>
    </div>
  );
};

