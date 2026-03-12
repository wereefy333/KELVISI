import React, { useState } from 'react';
import { Booking, Master } from '../types';
import { Card, Button, LazyImage } from '../components/Shared';
import { Clock, CheckCircle, XCircle, User, MessageSquare, Calendar, ChevronLeft, ChevronRight, Phone } from 'lucide-react';

interface MasterScheduleProps {
  bookings: Booking[];
  master: Master | null;
  onStatusChange: (id: string, status: Booking['status']) => void;
}

export const MasterSchedule: React.FC<MasterScheduleProps> = ({ bookings, master, onStatusChange }) => {
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [selectedDate, setSelectedDate] = useState('2026-02-11');
  
  // Filter bookings for this master
  const masterBookings = master 
    ? bookings.filter(b => b.masterId === master.id && b.date === selectedDate)
    : bookings.filter(b => b.date === selectedDate);
  
  // Sort by time
  const sortedBookings = [...masterBookings].sort((a, b) => a.time.localeCompare(b.time));
  
  // Calculate stats
  const todayStats = {
    total: sortedBookings.length,
    completed: sortedBookings.filter(b => b.status === 'COMPLETED').length,
    revenue: sortedBookings.filter(b => b.status === 'COMPLETED').reduce((acc, b) => acc + b.totalPrice, 0)
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const months = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const changeDate = (direction: 'prev' | 'next') => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="bg-zinc-900 p-4 sticky top-0 z-10 border-b border-zinc-800 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-serif text-white">Мое Расписание</h1>
            {master && <p className="text-gold-500 text-sm">{master.name}</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-zinc-500 text-xs">Выполнено</div>
              <div className="text-white font-mono">{todayStats.completed}/{todayStats.total}</div>
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-700">
              {master?.imageUrl ? (
                <LazyImage src={master.imageUrl} alt="" wrapperClass="w-full h-full rounded-full" imgClass="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                  <User size={20} className="text-zinc-400"/>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Date Navigation */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => changeDate('prev')}
            className="p-2 text-zinc-500 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <div className="text-white font-medium">{formatDateDisplay(selectedDate)}</div>
            <div className="text-zinc-600 text-xs">{selectedDate}</div>
          </div>
          <button 
            onClick={() => changeDate('next')}
            className="p-2 text-zinc-500 hover:text-white transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="p-4 bg-zinc-900/50 border-b border-zinc-800">
        <div className="flex gap-4 justify-center max-w-lg mx-auto">
          <div className="text-center flex-1">
            <div className="text-2xl font-serif text-white">{todayStats.total}</div>
            <div className="text-zinc-500 text-xs uppercase">Записей</div>
          </div>
          <div className="w-px bg-zinc-800"></div>
          <div className="text-center flex-1">
            <div className="text-2xl font-serif text-green-500">{todayStats.completed}</div>
            <div className="text-zinc-500 text-xs uppercase">Выполнено</div>
          </div>
          <div className="w-px bg-zinc-800"></div>
          <div className="text-center flex-1">
            <div className="text-2xl font-serif text-gold-500">{todayStats.revenue.toLocaleString()}</div>
            <div className="text-zinc-500 text-xs uppercase">Выручка ₽</div>
          </div>
        </div>
      </div>

      {/* Bookings List */}
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {sortedBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-zinc-600 mt-20">
            <Calendar size={48} className="mb-4 opacity-20" />
            <p className="text-lg">Нет записей на этот день</p>
            <p className="text-sm text-zinc-700 mt-2">Выберите другую дату</p>
          </div>
        ) : (
          sortedBookings.map((booking, index) => {
            const isCompleted = booking.status === 'COMPLETED';
            const isCancelled = booking.status === 'CANCELLED' || booking.status === 'NO_SHOW';
            const isInProgress = booking.status === 'IN_PROGRESS';
            const isNext = !isCompleted && !isCancelled && index === sortedBookings.findIndex(b => b.status !== 'COMPLETED' && b.status !== 'CANCELLED' && b.status !== 'NO_SHOW');
            
            return (
              <Card 
                key={booking.id} 
                className={`p-0 overflow-hidden transition-all ${
                  isCompleted ? 'opacity-60' : 
                  isCancelled ? 'opacity-40' :
                  isNext ? 'border-gold-500/50 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : ''
                }`}
              >
                {/* Time Header */}
                <div className={`px-5 py-3 flex justify-between items-center ${
                  isNext ? 'bg-gold-500/10' : 'bg-zinc-800/50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`text-xl font-mono font-bold ${isNext ? 'text-gold-500' : 'text-white'}`}>
                      {booking.time}
                    </div>
                    {isNext && (
                      <span className="text-xs bg-gold-500 text-black px-2 py-0.5 font-bold animate-pulse">
                        СЕЙЧАС
                      </span>
                    )}
                  </div>
                  <div className={`text-xs uppercase px-2 py-1 rounded font-medium ${
                    isCompleted ? 'text-green-500 bg-green-900/20' : 
                    isCancelled ? 'text-red-500 bg-red-900/20' :
                    isInProgress ? 'text-blue-500 bg-blue-900/20' :
                    'text-zinc-500 bg-zinc-800'
                  }`}>
                    {booking.status === 'CONFIRMED' ? 'Ожидает' :
                     booking.status === 'COMPLETED' ? 'Выполнено' :
                     booking.status === 'IN_PROGRESS' ? 'В работе' :
                     booking.status === 'CANCELLED' ? 'Отмена' :
                     booking.status === 'NO_SHOW' ? 'Не пришел' : 'Новая'}
                  </div>
                </div>

                <div className="p-5">
                  {/* Client Info */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="shrink-0 w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
                      <User size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold text-lg truncate">{booking.clientName}</h3>
                      <p className="text-zinc-400 text-sm mb-2">{booking.serviceId}</p>
                      <a href={`tel:${booking.clientPhone}`} className="inline-flex items-center text-xs text-zinc-500 hover:text-gold-500 transition-colors">
                        <Phone size={12} className="mr-1" /> {booking.clientPhone}
                      </a>
                    </div>
                    <div className="text-right">
                      <div className="text-gold-500 font-bold">{booking.totalPrice} ₽</div>
                    </div>
                  </div>

                  {/* VIP Notes */}
                  {booking.notes && (
                    <div className="mb-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded">
                      <div className="flex items-start gap-2">
                        <MessageSquare size={14} className="text-amber-500 mt-0.5 shrink-0" />
                        <span className="text-xs text-amber-500/80">{booking.notes}</span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {!isCompleted && !isCancelled && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
                      <button 
                        onClick={() => onStatusChange(booking.id, 'NO_SHOW')}
                        className="flex items-center justify-center py-3 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-sm hover:bg-red-900/20 hover:text-red-500 hover:border-red-900/50 transition-all"
                      >
                        <XCircle size={16} className="mr-2"/> Не пришел
                      </button>
                      {isInProgress ? (
                        <button 
                          onClick={() => onStatusChange(booking.id, 'COMPLETED')}
                          className="flex items-center justify-center py-3 rounded bg-green-600 text-white text-sm hover:bg-green-500 font-bold transition-all"
                        >
                          <CheckCircle size={16} className="mr-2"/> Завершить
                        </button>
                      ) : (
                        <button 
                          onClick={() => onStatusChange(booking.id, 'IN_PROGRESS')}
                          className="flex items-center justify-center py-3 rounded bg-gold-600 text-black text-sm hover:bg-gold-500 font-bold transition-all shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                        >
                          <Clock size={16} className="mr-2"/> Начать
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};