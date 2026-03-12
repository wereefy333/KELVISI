import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, X, Loader2, Calendar, Clock, Scissors } from 'lucide-react';
import { Booking } from '../types';

type State = 'loading' | 'success' | 'already' | 'error';

export const ConfirmBooking: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<State>('loading');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMsg('Токен подтверждения отсутствует в ссылке.');
      return;
    }

    fetch(`/api/confirm-booking?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setBooking(data.booking);
          setState(data.alreadyConfirmed ? 'already' : 'success');
        } else {
          setErrorMsg(data.error || 'Неизвестная ошибка');
          setState('error');
        }
      })
      .catch(() => {
        setErrorMsg('Не удалось связаться с сервером. Убедитесь, что сервер запущен.');
        setState('error');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      {/* ── Loading ───────────────────────────────────────────── */}
      {state === 'loading' && (
        <div className="text-center">
          <Loader2 size={48} className="text-gold-500 animate-spin mx-auto mb-6" />
          <p className="text-zinc-400 text-lg tracking-widest uppercase">Проверка токена…</p>
        </div>
      )}

      {/* ── Success ───────────────────────────────────────────── */}
      {(state === 'success' || state === 'already') && booking && (
        <div className="text-center max-w-md w-full animate-fade-in">
          <div className="w-24 h-24 rounded-full border-2 border-gold-500 flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(245,158,11,0.25)]">
            <Check size={48} className="text-gold-500" />
          </div>

          <h1 className="text-4xl font-serif text-white mb-3">
            {state === 'already' ? 'Уже подтверждено' : 'Запись подтверждена!'}
          </h1>
          <p className="text-zinc-400 mb-10 leading-relaxed">
            {state === 'already'
              ? 'Эта запись уже была подтверждена ранее.'
              : `Отлично, ${booking.clientName}! Ждём вас в салоне.`}
          </p>

          {/* Booking details card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-6 text-left space-y-4 mb-8">
            <div className="flex items-center gap-3 text-zinc-300">
              <Scissors size={16} className="text-gold-500 shrink-0" />
              <span className="text-sm text-zinc-500">Услуга</span>
              <span className="ml-auto text-white font-medium text-sm">{booking.serviceId}</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-300">
              <Calendar size={16} className="text-gold-500 shrink-0" />
              <span className="text-sm text-zinc-500">Дата</span>
              <span className="ml-auto text-white font-medium text-sm">{booking.date}</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-300">
              <Clock size={16} className="text-gold-500 shrink-0" />
              <span className="text-sm text-zinc-500">Время</span>
              <span className="ml-auto text-white font-medium text-sm">{booking.time}</span>
            </div>
            <div className="border-t border-zinc-800 pt-4 flex justify-between items-center">
              <span className="text-zinc-500 text-sm">Итого</span>
              <span className="text-2xl font-serif text-gold-500">{booking.totalPrice} ₽</span>
            </div>
          </div>

          <button
            onClick={() => (window.location.href = '/')}
            className="border border-zinc-700 text-zinc-400 hover:border-gold-500 hover:text-gold-500 transition-colors px-8 py-3 text-sm tracking-widest uppercase"
          >
            На главную
          </button>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {state === 'error' && (
        <div className="text-center max-w-md animate-fade-in">
          <div className="w-24 h-24 rounded-full border-2 border-red-500/50 flex items-center justify-center mx-auto mb-8">
            <X size={48} className="text-red-400" />
          </div>
          <h1 className="text-4xl font-serif text-white mb-3">Ошибка</h1>
          <p className="text-zinc-400 mb-8 leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => (window.location.href = '/')}
            className="border border-zinc-700 text-zinc-400 hover:border-gold-500 hover:text-gold-500 transition-colors px-8 py-3 text-sm tracking-widest uppercase"
          >
            На главную
          </button>
        </div>
      )}
    </div>
  );
};
