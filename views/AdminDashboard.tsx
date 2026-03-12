import React, { useState } from 'react';
import { Booking, Service, Master, Review, Client, ServiceCategory, User } from '../types';
import { Card, Badge, Button, LazyImage } from '../components/Shared';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Users, DollarSign, Calendar, TrendingUp, Star, 
  Check, X, Edit2, Trash2, Plus, Clock, 
  MessageSquare, Bell, Search, Eye,
  Scissors, Crown, AlertCircle, Mail, Gift, LogOut, Lock, Shield
} from 'lucide-react';

type AdminTab = 'dashboard' | 'bookings' | 'services' | 'masters' | 'reviews' | 'clients' | 'users' | 'waitlist';

interface WaitlistEntry {
  id: string;
  clientName: string;
  clientPhone: string;
  masterId: string;
  serviceIds: string[];
  preferredDates: string[];
  createdAt: string;
  notified?: boolean;
}

interface AdminDashboardProps {
  bookings: Booking[];
  services: Service[];
  reviews: Review[];
  masters: Master[];
  clients: Client[];
  waitlist: WaitlistEntry[];
  users: User[];
  currentUser: User;
  onUpdateService: (service: Service) => void;
  onDeleteService: (id: string) => void;
  onAddService: (service: Omit<Service, 'id'>) => void;
  onUpdateMaster: (master: Master) => Promise<void> | void;
  onAddMaster: (master: Omit<Master, 'id'>) => Promise<void> | void;
  onDeleteMaster: (id: string) => Promise<void> | void;
  onApproveReview: (id: string) => void;
  onRejectReview: (id: string) => void;
  onUpdateBooking: (id: string, updates: Partial<Booking>) => void;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  bookings, 
  services, 
  reviews,
  masters,
  clients,
  waitlist,
  users,
  currentUser,
  onUpdateService,
  onDeleteService,
  onAddService,
  onUpdateMaster,
  onAddMaster,
  onDeleteMaster,
  onApproveReview,
  onRejectReview,
  onUpdateBooking,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showAddService, setShowAddService] = useState(false);
  const [editingMaster, setEditingMaster] = useState<Master | null>(null);
  const [showAddMaster, setShowAddMaster] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Calculate Stats (from DB data loaded into bookings)
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayBookings = bookings.filter(b => b.date === todayIso);
  const paidTodayBookings = todayBookings.filter(b => b.status === 'COMPLETED');
  const dashboardRevenueToday = paidTodayBookings.reduce((acc, b) => acc + b.totalPrice, 0);
  const totalBookings = todayBookings.length;
  const completedBookings = paidTodayBookings.length;
  const pendingReviews = reviews.filter(r => r.status === 'PENDING').length;
  
  // Inactive clients (not visited in 60 days)
  const inactiveClients = clients.filter(c => {
    if (!c.lastVisit) return true;
    const daysSinceVisit = Math.floor((now.getTime() - new Date(c.lastVisit).getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceVisit > 60;
  });
  
  // Prepare Chart Data (revenue by paid/completed bookings today)
  const chartHours = ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
  const chartData = chartHours.map((hour) => ({
    name: hour,
    revenue: paidTodayBookings
      .filter((b) => b.time === hour)
      .reduce((sum, booking) => sum + booking.totalPrice, 0),
  }));

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Сводка', icon: <TrendingUp size={18} /> },
    { id: 'bookings', label: 'Записи', icon: <Calendar size={18} />, badge: totalBookings },
    { id: 'services', label: 'Услуги', icon: <Scissors size={18} /> },
    { id: 'masters', label: 'Мастера', icon: <Crown size={18} /> },
    { id: 'reviews', label: 'Отзывы', icon: <Star size={18} />, badge: pendingReviews },
    { id: 'clients', label: 'Клиенты', icon: <Users size={18} /> },
    { id: 'users', label: 'Аккаунты', icon: <Shield size={18} />, badge: users.length },
    { id: 'waitlist', label: 'Лист ожидания', icon: <Bell size={18} />, badge: waitlist.length },
  ];

  type DayKey = 0 | 1 | 2 | 3 | 4 | 5 | 6;
  type DayScheduleForm = { enabled: boolean; start: string; end: string };
  type MasterScheduleForm = Record<DayKey, DayScheduleForm>;

  type MasterFormState = {
    name: string;
    role: string;
    imageUrl: string;
    bio: string;
    experience: string;
    languages: string;
    rating: number;
    level: Master['level'];
    priceMultiplier: number;
    isActive: boolean;
    specialization: ServiceCategory[];
    workSchedule: MasterScheduleForm;
    userEmail: string;
    userPhone: string;
    userPassword: string;
  };

  const dayOrder: DayKey[] = [1, 2, 3, 4, 5, 6, 0];
  const dayLabels: Record<DayKey, string> = {
    1: 'Пн',
    2: 'Вт',
    3: 'Ср',
    4: 'Чт',
    5: 'Пт',
    6: 'Сб',
    0: 'Вс',
  };

  const createDefaultScheduleForm = (): MasterScheduleForm => ({
    1: { enabled: true, start: '10:00', end: '20:00' },
    2: { enabled: true, start: '10:00', end: '20:00' },
    3: { enabled: true, start: '10:00', end: '20:00' },
    4: { enabled: true, start: '10:00', end: '20:00' },
    5: { enabled: true, start: '10:00', end: '20:00' },
    6: { enabled: true, start: '11:00', end: '18:00' },
    0: { enabled: false, start: '10:00', end: '20:00' },
  });

  const toScheduleForm = (master: Master | null): MasterScheduleForm => {
    const fallback = createDefaultScheduleForm();
    if (!master?.workSchedule || typeof master.workSchedule !== 'object') return fallback;

    const raw = master.workSchedule as Record<string, { start?: string; end?: string } | null>;
    for (const day of dayOrder) {
      const slot = raw[String(day)] ?? raw[day];
      if (!slot || typeof slot !== 'object' || !slot.start || !slot.end) {
        fallback[day] = { ...fallback[day], enabled: false };
        continue;
      }
      fallback[day] = { enabled: true, start: slot.start, end: slot.end };
    }
    return fallback;
  };

  const fromScheduleForm = (schedule: MasterScheduleForm): Master['workSchedule'] => {
    const normalized: Record<number, { start: string; end: string } | null> = {};
    for (const day of dayOrder) {
      normalized[day] = schedule[day].enabled
        ? { start: schedule[day].start, end: schedule[day].end }
        : null;
    }
    return normalized;
  };

  const createInitialMasterForm = (master: Master | null, linkedUser: User | null): MasterFormState => ({
    name: master?.name || '',
    role: master?.role || '',
    imageUrl: master?.imageUrl || '',
    bio: master?.bio || '',
    experience: master?.experience || '',
    languages: master?.languages || '',
    rating: master?.rating || 5,
    level: master?.level || 'JUNIOR',
    priceMultiplier: master?.priceMultiplier || 1,
    isActive: master?.isActive ?? true,
    specialization: master?.specialization?.length ? [...master.specialization] : [ServiceCategory.MEN],
    workSchedule: toScheduleForm(master),
    userEmail: linkedUser?.email || '',
    userPhone: linkedUser?.phone || '',
    userPassword: '',
  });

  // Service Edit Modal
  const ServiceModal = ({ service, onClose }: { service: Service | null; onClose: () => void }) => {
    const [formData, setFormData] = useState<Partial<Service>>(service || {
      name: '',
      description: '',
      price: 0,
      durationMinutes: 30,
      category: ServiceCategory.WOMEN,
      type: 'STANDARD',
      isActive: true
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (service) {
        onUpdateService({ ...service, ...formData } as Service);
      } else {
        onAddService(formData as Omit<Service, 'id'>);
      }
      onClose();
    };

    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md">
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
            <h3 className="text-white font-serif text-xl">{service ? 'Редактировать услугу' : 'Добавить услугу'}</h3>
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-zinc-500 text-xs uppercase mb-2">Название</label>
              <input 
                type="text" 
                value={formData.name || ''} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-zinc-500 text-xs uppercase mb-2">Описание</label>
              <input 
                type="text" 
                value={formData.description || ''} 
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Цена (₽)</label>
                <input 
                  type="number" 
                  value={formData.price || ''} 
                  onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                  className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Длительность (мин)</label>
                <input 
                  type="number" 
                  value={formData.durationMinutes || ''} 
                  onChange={e => setFormData({...formData, durationMinutes: Number(e.target.value)})}
                  className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Категория</label>
                <select 
                  value={formData.category} 
                  onChange={e => setFormData({...formData, category: e.target.value as ServiceCategory})}
                  className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                >
                  <option value="WOMEN">Женский зал</option>
                  <option value="MEN">Мужской зал</option>
                </select>
              </div>
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Тип</label>
                <select 
                  value={formData.type} 
                  onChange={e => setFormData({...formData, type: e.target.value as 'STANDARD' | 'VIP'})}
                  className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                >
                  <option value="STANDARD">Стандарт</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <input 
                type="checkbox" 
                checked={formData.isActive ?? true} 
                onChange={e => setFormData({...formData, isActive: e.target.checked})}
                className="w-4 h-4"
              />
              <label className="text-zinc-400 text-sm">Активна</label>
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Отмена</Button>
              <Button type="submit" className="flex-1">Сохранить</Button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const MasterModal = ({ master, onClose }: { master: Master | null; onClose: () => void }) => {
    const linkedUser = master
      ? users.find((user) => user.role === 'MASTER' && user.name === master.name) || null
      : null;
    const [formData, setFormData] = useState<MasterFormState>(createInitialMasterForm(master, linkedUser));
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isReadingImage, setIsReadingImage] = useState(false);

    const toggleSpecialization = (category: ServiceCategory) => {
      setFormData((prev) => {
        const exists = prev.specialization.includes(category);
        return {
          ...prev,
          specialization: exists
            ? prev.specialization.filter((value) => value !== category)
            : [...prev.specialization, category],
        };
      });
    };

    const updateDay = (day: DayKey, updates: Partial<DayScheduleForm>) => {
      setFormData((prev) => ({
        ...prev,
        workSchedule: {
          ...prev.workSchedule,
          [day]: { ...prev.workSchedule[day], ...updates },
        },
      }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!formData.specialization.length) {
        setError('Выберите хотя бы одну специализацию.');
        return;
      }

      for (const day of dayOrder) {
        const slot = formData.workSchedule[day];
        if (!slot.enabled) continue;
        if (!slot.start || !slot.end || slot.start >= slot.end) {
          setError(`Проверьте расписание на день ${dayLabels[day]}.`);
          return;
        }
      }

      const payload: Omit<Master, 'id'> = {
        name: formData.name.trim(),
        role: formData.role.trim(),
        imageUrl: formData.imageUrl.trim(),
        bio: formData.bio.trim(),
        experience: formData.experience.trim(),
        languages: formData.languages.trim(),
        rating: Number(formData.rating),
        level: formData.level,
        priceMultiplier: Number(formData.priceMultiplier),
        isActive: formData.isActive,
        specialization: formData.specialization,
        workSchedule: fromScheduleForm(formData.workSchedule),
      };

      const normalizedEmail = formData.userEmail.trim().toLowerCase();
      const normalizedPhone = formData.userPhone.trim();
      const normalizedPassword = formData.userPassword.trim();
      const hasAnyAccountField = Boolean(normalizedEmail || normalizedPhone || normalizedPassword);
      const shouldSendUser = !master || !!linkedUser || hasAnyAccountField;

      if (!master && !normalizedEmail) {
        setError('Для нового мастера укажите email аккаунта.');
        return;
      }
      if (!master && !normalizedPassword) {
        setError('Для нового мастера задайте пароль аккаунта.');
        return;
      }
      if (master && hasAnyAccountField && (!normalizedEmail || (!linkedUser && !normalizedPassword))) {
        setError('Чтобы создать аккаунт для мастера, укажите email и пароль.');
        return;
      }
      if (normalizedPassword && normalizedPassword.length < 4) {
        setError('Пароль аккаунта должен содержать минимум 4 символа.');
        return;
      }

      const userPayload = shouldSendUser
        ? {
            id: linkedUser?.id,
            email: normalizedEmail,
            phone: normalizedPhone || undefined,
            password: normalizedPassword || undefined,
            isActive: payload.isActive,
            name: payload.name,
          }
        : undefined;

      try {
        setIsSaving(true);
        if (master) {
          await Promise.resolve(onUpdateMaster({ ...master, ...payload, user: userPayload } as Master));
        } else {
          await Promise.resolve(onAddMaster({ ...payload, user: userPayload } as Omit<Master, 'id'>));
        }
        onClose();
      } catch (submitError) {
        setError((submitError as Error).message || 'Не удалось сохранить мастера.');
      } finally {
        setIsSaving(false);
      }
    };

    const handleDelete = async () => {
      if (!master) return;
      const confirmed = window.confirm(`Удалить мастера "${master.name}"?`);
      if (!confirmed) return;

      try {
        setError('');
        setIsDeleting(true);
        await Promise.resolve(onDeleteMaster(master.id));
        onClose();
      } catch (deleteError) {
        setError((deleteError as Error).message || 'Не удалось удалить мастера.');
      } finally {
        setIsDeleting(false);
      }
    };

    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        setError('Можно загружать только изображения.');
        e.target.value = '';
        return;
      }

      const maxFileSizeBytes = 5 * 1024 * 1024;
      if (file.size > maxFileSizeBytes) {
        setError('Файл слишком большой. Выберите изображение до 5 МБ.');
        e.target.value = '';
        return;
      }

      setError('');
      setIsReadingImage(true);

      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result) {
          setError('Не удалось прочитать изображение.');
        } else {
          setFormData((prev) => ({ ...prev, imageUrl: result }));
        }
        setIsReadingImage(false);
        e.target.value = '';
      };
      reader.onerror = () => {
        setError('Не удалось загрузить изображение с компьютера.');
        setIsReadingImage(false);
        e.target.value = '';
      };

      reader.readAsDataURL(file);
    };

    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 w-full max-w-4xl max-h-[90vh] overflow-auto">
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
            <h3 className="text-white font-serif text-xl">{master ? 'Редактировать мастера' : 'Добавить мастера'}</h3>
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Имя</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Роль</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_220px] gap-5 items-start">
              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-500 text-xs uppercase mb-2">Фото по ссылке</label>
                  <input
                    type="text"
                    value={formData.imageUrl.startsWith('data:image/') ? '' : formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                    placeholder="https://... или /masters/имя-файл.jpg"
                  />
                </div>

                <div>
                  <label className="block text-zinc-500 text-xs uppercase mb-2">Загрузить с компьютера</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="block w-full text-sm text-zinc-400 file:mr-4 file:border-0 file:bg-gold-500 file:px-4 file:py-2 file:text-black file:font-semibold hover:file:bg-gold-400"
                  />
                  <p className="mt-2 text-zinc-500 text-xs">
                    Поддерживаются изображения до 5 МБ. Файл с ПК заменяет текущее значение поля ссылки.
                  </p>
                  {isReadingImage && (
                    <p className="mt-2 text-gold-500 text-xs">Загружаю изображение...</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Превью</label>
                <div className="bg-zinc-950 border border-zinc-800 aspect-[4/5] overflow-hidden flex items-center justify-center">
                  {formData.imageUrl ? (
                    <LazyImage
                      src={formData.imageUrl}
                      alt={formData.name || 'Фото мастера'}
                      wrapperClass="w-full h-full"
                      imgClass="object-contain p-2"
                    />
                  ) : (
                    <div className="text-zinc-600 text-xs text-center px-4">
                      Добавьте ссылку или загрузите файл
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border border-zinc-800 rounded p-4 space-y-3">
              <p className="text-zinc-300 text-sm font-semibold">Аккаунт для входа в /barber</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-500 text-xs uppercase mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.userEmail}
                    onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                    placeholder="master@salon.ru"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 text-xs uppercase mb-2">Телефон</label>
                  <input
                    type="text"
                    value={formData.userPhone}
                    onChange={(e) => setFormData({ ...formData, userPhone: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                    placeholder="+7 900 000 00 00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">
                  {linkedUser ? 'Новый пароль (необязательно)' : 'Пароль'}
                </label>
                <input
                  type="text"
                  value={formData.userPassword}
                  onChange={(e) => setFormData({ ...formData, userPassword: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                  placeholder={linkedUser ? 'Оставьте пустым, чтобы не менять' : 'Минимум 4 символа'}
                />
              </div>
              <p className="text-zinc-500 text-xs">
                {!master
                  ? 'Для нового мастера email и пароль обязательны.'
                  : linkedUser
                    ? 'Аккаунт найден и будет обновлен вместе с профилем мастера.'
                    : 'Если заполнить email и пароль, будет создан новый аккаунт мастера.'}
              </p>
            </div>

            <div>
              <label className="block text-zinc-500 text-xs uppercase mb-2">О себе</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none resize-y"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Опыт</label>
                <input
                  type="text"
                  value={formData.experience}
                  onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Языки</label>
                <input
                  type="text"
                  value={formData.languages}
                  onChange={(e) => setFormData({ ...formData, languages: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-zinc-300 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  Активен
                </label>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Рейтинг</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Уровень</label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value as Master['level'] })}
                  className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                >
                  <option value="JUNIOR">Junior</option>
                  <option value="SENIOR">Senior</option>
                  <option value="TOP">Top</option>
                </select>
              </div>
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Множитель цены</label>
                <input
                  type="number"
                  min={0.1}
                  max={3}
                  step={0.1}
                  value={formData.priceMultiplier}
                  onChange={(e) => setFormData({ ...formData, priceMultiplier: Number(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Специализация</label>
                <div className="flex gap-3 h-[46px] items-center">
                  <label className="text-sm text-zinc-300 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.specialization.includes(ServiceCategory.MEN)}
                      onChange={() => toggleSpecialization(ServiceCategory.MEN)}
                      className="w-4 h-4"
                    />
                    Мужской зал
                  </label>
                  <label className="text-sm text-zinc-300 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.specialization.includes(ServiceCategory.WOMEN)}
                      onChange={() => toggleSpecialization(ServiceCategory.WOMEN)}
                      className="w-4 h-4"
                    />
                    Женский зал
                  </label>
                </div>
              </div>
            </div>

            <div>
              <p className="block text-zinc-500 text-xs uppercase mb-3">График работы</p>
              <div className="space-y-2">
                {dayOrder.map((day) => (
                  <div key={day} className="grid grid-cols-[50px_120px_1fr_1fr] gap-3 items-center">
                    <span className="text-zinc-300 text-sm">{dayLabels[day]}</span>
                    <label className="text-xs text-zinc-400 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.workSchedule[day].enabled}
                        onChange={(e) => updateDay(day, { enabled: e.target.checked })}
                        className="w-4 h-4"
                      />
                      Работает
                    </label>
                    <input
                      type="time"
                      value={formData.workSchedule[day].start}
                      onChange={(e) => updateDay(day, { start: e.target.value })}
                      disabled={!formData.workSchedule[day].enabled}
                      className="w-full bg-zinc-800 border border-zinc-700 p-2 text-white focus:border-gold-500 outline-none disabled:opacity-40"
                    />
                    <input
                      type="time"
                      value={formData.workSchedule[day].end}
                      onChange={(e) => updateDay(day, { end: e.target.value })}
                      disabled={!formData.workSchedule[day].enabled}
                      className="w-full bg-zinc-800 border border-zinc-700 p-2 text-white focus:border-gold-500 outline-none disabled:opacity-40"
                    />
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-400 border border-red-900/40 bg-red-900/10 px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} className="min-w-[140px]">Отмена</Button>
              <Button type="submit" className="min-w-[180px]" disabled={isSaving || isDeleting}>
                {isSaving ? 'Сохраняем...' : 'Сохранить'}
              </Button>
              {master && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDelete}
                  className="min-w-[180px] text-red-400 hover:text-red-300"
                  disabled={isSaving || isDeleting}
                >
                  {isDeleting ? 'Удаляем...' : 'Удалить мастера'}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Dashboard Tab
  const DashboardContent = () => (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-zinc-500 text-xs uppercase">Выручка за сегодня</p>
              <h3 className="text-2xl text-gold-500 font-serif mt-1">{dashboardRevenueToday.toLocaleString('ru-RU')} ₽</h3>
            </div>
            <DollarSign className="text-zinc-600" size={20}/>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-zinc-500 text-xs uppercase">Записей сегодня</p>
              <h3 className="text-2xl text-white font-serif mt-1">{totalBookings}</h3>
              <p className="text-green-500 text-xs mt-1">✓ {completedBookings} завершено</p>
            </div>
            <Calendar className="text-zinc-600" size={20}/>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-zinc-500 text-xs uppercase">Средний чек</p>
              <h3 className="text-2xl text-white font-serif mt-1">{completedBookings ? Math.round(dashboardRevenueToday / completedBookings) : 0} ₽</h3>
            </div>
            <TrendingUp className="text-zinc-600" size={20}/>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-zinc-500 text-xs uppercase">Ожидают модерации</p>
              <h3 className="text-2xl text-white font-serif mt-1">{pendingReviews}</h3>
              <p className="text-gold-500 text-xs mt-1">отзывов</p>
            </div>
            <MessageSquare className="text-zinc-600" size={20}/>
          </div>
        </Card>
      </div>

      {/* Charts & Chessboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <Card className="p-6">
          <h3 className="text-white font-serif mb-6">Динамика выручки</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', color: '#fff' }} 
                  itemStyle={{ color: '#fbbf24' }}
                  formatter={(value) => [`${Number(value).toLocaleString('ru-RU')} \u20BD`, '\u0412\u044b\u0440\u0443\u0447\u043a\u0430']}
                />
                <Line type="monotone" dataKey="revenue" stroke="#fbbf24" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-white font-serif mb-6">{'\u0420\u0430\u0441\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u043c\u0430\u0441\u0442\u0435\u0440\u043e\u0432 \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f'}</h3>
          <div className="overflow-x-auto">
             <div className="min-w-[500px]">
                {/* Header */}
                <div className="grid gap-1" style={{ gridTemplateColumns: `80px repeat(${masters.filter(m => m.isActive).length}, 1fr)` }}>
                  <div className="text-zinc-500 text-xs uppercase p-2">Время</div>
                  {masters.filter(m => m.isActive).map(master => (
                    <div key={master.id} className="text-zinc-500 text-xs uppercase p-2 text-center truncate">
                      {master.name.split(' ')[0]}
                    </div>
                  ))}
                </div>
                {/* Rows */}
                {['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map(hour => {
                  return (
                    <div key={hour} className="grid gap-1 border-t border-zinc-800" style={{ gridTemplateColumns: `80px repeat(${masters.filter(m => m.isActive).length}, 1fr)` }}>
                      <div className="text-zinc-400 font-mono text-sm p-2">{hour}</div>
                      {masters.filter(m => m.isActive).map(master => {
                        const booking = bookings.find(b => b.masterId === master.id && b.time === hour && b.date === todayIso);
                        return (
                          <div 
                            key={master.id} 
                            className={`m-0.5 rounded p-1 text-[9px] truncate ${
                              booking 
                                ? booking.status === 'COMPLETED' 
                                  ? 'bg-green-900/30 text-green-500' 
                                  : 'bg-gold-500/20 text-gold-500'
                                : 'bg-zinc-800/50'
                            }`}
                          >
                            {booking?.clientName.split(' ')[0] || ''}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
             </div>
          </div>
        </Card>
      </div>

      {/* Alerts Section */}
      {inactiveClients.length > 0 && (
        <Card className="p-6 border-amber-900/50 mb-8">
          <div className="flex items-start gap-4">
            <AlertCircle className="text-amber-500 shrink-0" size={24} />
            <div className="flex-1">
              <h4 className="text-white font-medium mb-2">Клиенты требуют внимания</h4>
              <p className="text-zinc-400 text-sm mb-4">
                {inactiveClients.length} клиентов не посещали салон более 60 дней.
                Рекомендуем отправить им специальное предложение.
              </p>
              <div className="flex gap-2 flex-wrap">
                {inactiveClients.slice(0, 3).map(c => (
                  <span key={c.id} className="text-xs bg-zinc-800 px-2 py-1 text-zinc-400">{c.name}</span>
                ))}
                {inactiveClients.length > 3 && (
                  <span className="text-xs text-zinc-600">и еще {inactiveClients.length - 3}</span>
                )}
              </div>
            </div>
            <Button variant="outline" className="shrink-0 text-xs px-3 py-2">
              <Gift size={14} className="mr-2" /> Отправить промокод
            </Button>
          </div>
        </Card>
      )}

      {/* Recent Bookings */}
      <Card className="p-0 overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-white font-serif">Последние записи</h3>
          <button onClick={() => setActiveTab('bookings')} className="text-gold-500 text-sm hover:text-white transition-colors">
            Все записи →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-zinc-950 text-zinc-500 uppercase text-xs tracking-wider">
              <tr>
                <th className="p-4 font-normal">Время</th>
                <th className="p-4 font-normal">Клиент</th>
                <th className="p-4 font-normal">Услуга</th>
                <th className="p-4 font-normal">Мастер</th>
                <th className="p-4 font-normal">Статус</th>
                <th className="p-4 font-normal text-right">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {bookings.slice(0, 5).map(booking => {
                const master = masters.find(m => m.id === booking.masterId);
                return (
                  <tr key={booking.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="p-4 text-white font-mono">
                      {booking.date.split('-').reverse().join('.')} <br/>
                      <span className="text-zinc-500">{booking.time}</span>
                    </td>
                    <td className="p-4 text-white">{booking.clientName}</td>
                    <td className="p-4">{booking.serviceId}</td>
                    <td className="p-4">{master?.name || '-'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs border ${
                          booking.status === 'CONFIRMED' ? 'border-green-900 text-green-500 bg-green-900/10' : 
                          booking.status === 'COMPLETED' ? 'border-blue-900 text-blue-500 bg-blue-900/10' :
                          booking.status === 'CANCELLED' ? 'border-red-900 text-red-500 bg-red-900/10' :
                          booking.status === 'NO_SHOW' ? 'border-orange-900 text-orange-500 bg-orange-900/10' :
                          'border-zinc-700 bg-zinc-800 text-zinc-400'
                      }`}>
                        {booking.status === 'CONFIRMED' ? 'Подтв.' :
                         booking.status === 'COMPLETED' ? 'Завершено' :
                         booking.status === 'CANCELLED' ? 'Отменено' :
                         booking.status === 'NO_SHOW' ? 'Не пришел' :
                         booking.status === 'IN_PROGRESS' ? 'В процессе' : 'Ожидает'}
                      </span>
                    </td>
                    <td className="p-4 text-right text-gold-500 font-mono">{booking.totalPrice} ₽</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );

  // Bookings Tab
  const BookingsContent = () => (
    <Card className="p-0 overflow-hidden">
      <div className="p-6 border-b border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h3 className="text-white font-serif">Все записи</h3>
        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Поиск по имени..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm w-full md:w-64 focus:border-gold-500 outline-none"
            />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-zinc-950 text-zinc-500 uppercase text-xs tracking-wider">
            <tr>
              <th className="p-4 font-normal">ID</th>
              <th className="p-4 font-normal">Дата / Время</th>
              <th className="p-4 font-normal">Клиент</th>
              <th className="p-4 font-normal">Телефон</th>
              <th className="p-4 font-normal">Услуга</th>
              <th className="p-4 font-normal">Мастер</th>
              <th className="p-4 font-normal">Статус</th>
              <th className="p-4 font-normal text-right">Сумма</th>
              <th className="p-4 font-normal">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {bookings
              .filter(b => !searchQuery || b.clientName.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(booking => {
                const master = masters.find(m => m.id === booking.masterId);
                return (
                  <tr key={booking.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="p-4 text-zinc-600 font-mono text-xs">{booking.id.substring(0, 6)}</td>
                    <td className="p-4 text-white font-mono">
                      {booking.date} <span className="text-zinc-500">{booking.time}</span>
                    </td>
                    <td className="p-4 text-white">{booking.clientName}</td>
                    <td className="p-4 text-zinc-500 font-mono text-xs">{booking.clientPhone}</td>
                    <td className="p-4">{booking.serviceId}</td>
                    <td className="p-4">{master?.name || '-'}</td>
                    <td className="p-4">
                      <select 
                        value={booking.status}
                        onChange={e => onUpdateBooking(booking.id, { status: e.target.value as Booking['status'] })}
                        className="bg-zinc-800 border border-zinc-700 text-xs p-1 text-white"
                      >
                        <option value="PENDING">Ожидает</option>
                        <option value="CONFIRMED">Подтверждено</option>
                        <option value="IN_PROGRESS">В процессе</option>
                        <option value="COMPLETED">Завершено</option>
                        <option value="CANCELLED">Отменено</option>
                        <option value="NO_SHOW">Не пришел</option>
                      </select>
                    </td>
                    <td className="p-4 text-right text-gold-500 font-mono">{booking.totalPrice} ₽</td>
                    <td className="p-4">
                      <button className="text-zinc-500 hover:text-white p-1"><Eye size={16} /></button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  // Services Tab
  const ServicesContent = () => (
    <>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-white font-serif text-xl">Управление услугами</h3>
        <Button onClick={() => setShowAddService(true)}>
          <Plus size={16} className="mr-2" /> Добавить
        </Button>
      </div>
      
      <div className="grid gap-4">
        {['MEN', 'WOMEN'].map(cat => (
          <Card key={cat} className="p-0 overflow-hidden">
            <div className="p-4 bg-zinc-800/50 border-b border-zinc-800">
              <h4 className="text-white font-medium flex items-center gap-2">
                {cat === 'MEN' ? <Crown size={16} className="text-gold-500" /> : <Scissors size={16} className="text-gold-500" />}
                {cat === 'MEN' ? 'Мужской зал' : 'Женский зал'}
              </h4>
            </div>
            <div className="divide-y divide-zinc-800">
              {services.filter(s => s.category === cat).map(service => (
                <div key={service.id} className={`p-4 flex items-center justify-between gap-4 ${!service.isActive ? 'opacity-50' : ''}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{service.name}</span>
                      {service.type === 'VIP' && <Badge type="vip">VIP</Badge>}
                      {!service.isActive && <span className="text-xs text-red-500">(неактивна)</span>}
                    </div>
                    <p className="text-zinc-500 text-sm">{service.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-gold-500 font-bold">{service.price} ₽</div>
                    <div className="text-zinc-500 text-xs flex items-center justify-end gap-1">
                      <Clock size={10} /> {service.durationMinutes} мин
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setEditingService(service)}
                      className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => onDeleteService(service.id)}
                      className="p-2 text-zinc-500 hover:text-red-500 hover:bg-zinc-800 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      
      {(editingService || showAddService) && (
        <ServiceModal 
          service={editingService} 
          onClose={() => { setEditingService(null); setShowAddService(false); }} 
        />
      )}
    </>
  );

  // Masters Tab
  const MastersContent = () => (
    <>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h3 className="text-white font-serif text-xl">Управление мастерами</h3>
        <Button onClick={() => { setEditingMaster(null); setShowAddMaster(true); }} className="px-4 py-2 text-xs">
          <Plus size={14} className="mr-2" /> Добавить мастера
        </Button>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {masters.map(master => (
          <Card key={master.id} className={`p-0 overflow-hidden ${!master.isActive ? 'opacity-50' : ''}`}>
            <div className="h-52 relative bg-zinc-950">
              <LazyImage
                src={master.imageUrl}
                alt={master.name}
                wrapperClass="w-full h-full"
                imgClass="object-contain object-center p-2"
              />
              <div className="absolute top-2 right-2 flex gap-2">
                {master.level === 'TOP' && <span className="bg-gold-500 text-black text-xs px-2 py-1 font-bold">TOP</span>}
                {master.level === 'SENIOR' && <span className="bg-zinc-700 text-white text-xs px-2 py-1">Senior</span>}
              </div>
            </div>
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="text-white font-medium">{master.name}</h4>
                  <p className="text-gold-500 text-sm">{master.role}</p>
                </div>
                <div className="flex items-center text-zinc-400 text-sm bg-zinc-800 px-2 py-1 rounded">
                  <Star size={12} className="text-gold-500 mr-1" fill="currentColor" />
                  {master.rating}
                </div>
              </div>
              <div className="flex gap-2 mb-4">
                {master.specialization.map(s => (
                  <span key={s} className="text-xs bg-zinc-800 px-2 py-1 text-zinc-400">
                    {s === 'MEN' ? 'Мужской' : 'Женский'}
                  </span>
                ))}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500">Множитель цены:</span>
                <span className="text-white font-mono">x{master.priceMultiplier}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <Button
                  variant="ghost"
                  className="w-full text-xs"
                  onClick={() => setEditingMaster(master)}
                >
                  <Edit2 size={14} className="mr-2" /> Редактировать
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {(editingMaster || showAddMaster) && (
        <MasterModal
          master={editingMaster}
          onClose={() => {
            setEditingMaster(null);
            setShowAddMaster(false);
          }}
        />
      )}
    </>
  );

  // Reviews Tab
  const ReviewsContent = () => (
    <>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-white font-serif text-xl">Модерация отзывов</h3>
        <span className="text-xs bg-amber-900/30 text-amber-500 px-3 py-1 rounded-full">
          {pendingReviews} на модерации
        </span>
      </div>
      
      <div className="space-y-4">
        {reviews.map(review => (
          <Card key={review.id} className={`p-6 ${review.status === 'APPROVED' ? 'border-green-900/30' : review.status === 'REJECTED' ? 'border-red-900/30 opacity-50' : 'border-amber-900/30'}`}>
            <div className="flex items-start gap-4">
              <LazyImage src={review.avatarUrl || ''} alt="" wrapperClass="w-12 h-12 rounded-full shrink-0" imgClass="object-cover" />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="text-white font-medium">{review.clientName}</span>
                  <div className="flex text-gold-500">
                    {[...Array(5)].map((_, i) => <Star key={i} size={12} fill={i < review.rating ? "currentColor" : "none"} />)}
                  </div>
                  <span className="text-zinc-600 text-xs">{review.createdAt}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    review.status === 'APPROVED' ? 'bg-green-900/30 text-green-500' :
                    review.status === 'REJECTED' ? 'bg-red-900/30 text-red-500' :
                    'bg-amber-900/30 text-amber-500'
                  }`}>
                    {review.status === 'APPROVED' ? 'Опубликован' : review.status === 'REJECTED' ? 'Отклонен' : 'На модерации'}
                  </span>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">"{review.text}"</p>
              </div>
              {review.status === 'PENDING' && (
                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => onApproveReview(review.id)}
                    className="p-2 text-green-500 hover:bg-green-900/20 rounded transition-colors"
                    title="Опубликовать"
                  >
                    <Check size={20} />
                  </button>
                  <button 
                    onClick={() => onRejectReview(review.id)}
                    className="p-2 text-red-500 hover:bg-red-900/20 rounded transition-colors"
                    title="Отклонить"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );

  // Clients Tab
  const ClientsContent = () => (
    <Card className="p-0 overflow-hidden">
      <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
        <h3 className="text-white font-serif">База клиентов</h3>
        <div className="text-zinc-500 text-sm">{clients.length} клиентов</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-zinc-950 text-zinc-500 uppercase text-xs tracking-wider">
            <tr>
              <th className="p-4 font-normal">Клиент</th>
              <th className="p-4 font-normal">Телефон</th>
              <th className="p-4 font-normal">Визитов</th>
              <th className="p-4 font-normal">Потрачено</th>
              <th className="p-4 font-normal">Последний визит</th>
              <th className="p-4 font-normal">Заметки</th>
              <th className="p-4 font-normal">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {clients.map(client => {
              const daysSinceVisit = client.lastVisit 
                ? Math.floor((now.getTime() - new Date(client.lastVisit).getTime()) / (1000 * 60 * 60 * 24))
                : null;
              const isInactive = daysSinceVisit !== null && daysSinceVisit > 60;
              
              return (
                <tr key={client.id} className={`hover:bg-zinc-800/30 transition-colors ${isInactive ? 'bg-amber-900/5' : ''}`}>
                  <td className="p-4">
                    <div className="text-white font-medium">{client.name}</div>
                    {client.email && <div className="text-zinc-600 text-xs">{client.email}</div>}
                  </td>
                  <td className="p-4 font-mono text-xs">{client.phone}</td>
                  <td className="p-4 text-center">{client.totalVisits}</td>
                  <td className="p-4 text-gold-500 font-mono">{client.totalSpent.toLocaleString()} ₽</td>
                  <td className="p-4">
                    {client.lastVisit || '-'}
                    {isInactive && (
                      <div className="text-amber-500 text-xs flex items-center gap-1 mt-1">
                        <AlertCircle size={10} /> {daysSinceVisit} дней
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-zinc-500 text-xs max-w-[150px] truncate">{client.notes || '-'}</td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <button className="p-1 text-zinc-500 hover:text-white" title="Написать"><Mail size={14} /></button>
                      <button className="p-1 text-zinc-500 hover:text-gold-500" title="Отправить промокод"><Gift size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  // Users Tab
  const UsersContent = () => (
    <>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-white font-serif text-xl">Управление аккаунтами</h3>
        <span className="text-xs bg-gold-500/20 text-gold-500 px-3 py-1 rounded-full">
          {users.length} аккаунтов
        </span>
      </div>

      <Card className="p-6">
        <table className="w-full">
          <thead className="border-b border-zinc-800">
            <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
              <th className="p-4">ФИО</th>
              <th className="p-4">Email</th>
              <th className="p-4">Роль</th>
              <th className="p-4">Статус</th>
              <th className="p-4">Дата создания</th>
              <th className="p-4 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center text-black text-xs font-bold">
                      {user.name.charAt(0)}
                    </div>
                    <span className="text-white font-medium">{user.name}</span>
                  </div>
                </td>
                <td className="p-4 text-zinc-400 font-mono text-sm">{user.email}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                    user.role === 'ADMIN' ? 'bg-purple-900/30 text-purple-400' :
                    user.role === 'MASTER' ? 'bg-blue-900/30 text-blue-400' :
                    'bg-gray-900/30 text-gray-400'
                  }`}>
                    {user.role === 'ADMIN' && <Shield size={12} />}
                    {user.role === 'MASTER' ? 'Стилист' : user.role === 'ADMIN' ? 'Администратор' : 'Клиент'}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    user.isActive 
                      ? 'bg-green-900/30 text-green-400' 
                      : 'bg-red-900/30 text-red-400'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full mr-2" style={{
                      backgroundColor: user.isActive ? '#4ade80' : '#ef4444'
                    }}></span>
                    {user.isActive ? 'Активен' : 'Деактивирован'}
                  </span>
                </td>
                <td className="p-4 text-zinc-500 text-xs">{new Date(user.createdAt).toLocaleDateString('ru-RU')}</td>
                <td className="p-4 text-right">
                  <div className="flex gap-1 justify-end">
                    <button className="p-1 text-zinc-500 hover:text-gold-500 transition-colors" title="Редактировать">
                      <Edit2 size={14} />
                    </button>
                    <button className={`p-1 transition-colors ${user.isActive ? 'text-zinc-500 hover:text-red-500' : 'text-zinc-500 hover:text-green-500'}`} title={user.isActive ? 'Деактивировать' : 'Активировать'}>
                      {user.isActive ? <Lock size={14} /> : <Check size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );

  // Waitlist Tab
  const WaitlistContent = () => (
    <>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-white font-serif text-xl">Лист ожидания</h3>
        <span className="text-xs bg-gold-500/20 text-gold-500 px-3 py-1 rounded-full">
          {waitlist.length} в очереди
        </span>
      </div>
      
      <div className="space-y-4">
        {waitlist.map(entry => {
          const master = masters.find(m => m.id === entry.masterId);
          return (
            <Card key={entry.id} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-white font-medium">{entry.clientName}</span>
                    <span className="text-zinc-600 font-mono text-xs">{entry.clientPhone}</span>
                  </div>
                  <div className="flex gap-4 text-sm text-zinc-400">
                    <span>Мастер: <span className="text-white">{master?.name || '-'}</span></span>
                    <span>Даты: <span className="text-white">{entry.preferredDates.join(', ')}</span></span>
                  </div>
                  <div className="text-zinc-600 text-xs mt-2">Добавлено: {entry.createdAt}</div>
                </div>
                <Button variant="outline" className="text-xs px-3 py-2 shrink-0">
                  <Bell size={14} className="mr-1" /> Уведомить
                </Button>
              </div>
            </Card>
          );
        })}
        
        {waitlist.length === 0 && (
          <Card className="p-12 text-center">
            <Bell size={48} className="mx-auto text-zinc-700 mb-4" />
            <p className="text-zinc-500">Лист ожидания пуст</p>
          </Card>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#0c0c0e]">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-serif text-white">LUMIÈRE <span className="text-zinc-500 font-sans text-sm ml-2">/ Администратор</span></h1>
            <div className="flex items-center gap-4">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-zinc-400 text-sm hidden sm:inline">Система активна</span>
              <span className="text-gold-500 text-sm font-medium ml-4 px-3 py-1 bg-gold-500/10 rounded">{currentUser.name}</span>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 text-zinc-400 hover:text-red-500 transition-colors text-sm ml-2"
                title="Выход из системы"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex overflow-x-auto gap-1 pb-0 -mb-px scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id 
                    ? 'border-gold-500 text-gold-500' 
                    : 'border-transparent text-zinc-500 hover:text-white'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="bg-gold-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">{tab.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === 'dashboard' && <DashboardContent />}
        {activeTab === 'bookings' && <BookingsContent />}
        {activeTab === 'services' && <ServicesContent />}
        {activeTab === 'masters' && <MastersContent />}
        {activeTab === 'reviews' && <ReviewsContent />}
        {activeTab === 'clients' && <ClientsContent />}
        {activeTab === 'users' && <UsersContent />}
        {activeTab === 'waitlist' && <WaitlistContent />}
      </div>
    </div>
  );
};



