import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ClientBooking } from './views/ClientBooking';
import { AdminDashboard } from './views/AdminDashboard';
import { Login } from './views/Login';
import { StylistCabinet } from './views/StylistCabinet';
import { ConfirmBooking } from './views/ConfirmBooking';
import { Booking, Service, Master, Review, Client, User } from './types';
import { WAITLIST as WAITLIST_SEED, MASTERS as MASTERS_SEED, REVIEWS as REVIEWS_SEED, SERVICES as SERVICES_SEED, CLIENTS as CLIENTS_SEED, USERS as USERS_SEED } from './data';

// ── API helpers ────────────────────────────────────────────────────────────────
const api = {
  get:    (url: string)               => fetch(url).then(r => r.json()),
  post:   (url: string, body: object) => fetch(url, { method: 'POST',   headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  put:    (url: string, body: object) => fetch(url, { method: 'PUT',    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  delete: (url: string)               => fetch(url, { method: 'DELETE' }).then(r => r.json()),
};

const App: React.FC = () => {
  // ── Shared Data State ──────────────────────────────────────────────────
  const [services, setServices]   = useState<Service[]>(SERVICES_SEED);
  const [masters,  setMasters]    = useState<Master[]>(MASTERS_SEED);
  const [reviews,  setReviews]    = useState<Review[]>(REVIEWS_SEED);
  const [clients,  setClients]    = useState<Client[]>(CLIENTS_SEED);
  const [waitlist, setWaitlist]   = useState(WAITLIST_SEED);
  const [users,    setUsers]      = useState<User[]>(USERS_SEED);
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [loading,  setLoading]    = useState(true);

  // ── Load all data from API on mount ────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get('/api/services'),
      api.get('/api/masters'),
      api.get('/api/bookings'),
      api.get('/api/reviews'),
      api.get('/api/clients'),
      api.get('/api/waitlist'),
      api.get('/api/users'),
    ]).then(([svcs, msts, bks, rvs, cls, wl, usrs]) => {
      setServices(svcs);
      setMasters(msts);
      setBookings(bks);
      setReviews(rvs);
      setClients(cls);
      if (wl?.length) setWaitlist(wl);
      setUsers(usrs);
    }).catch(err => {
      console.warn('⚠️  API unavailable, running in offline mode:', err.message);
    }).finally(() => setLoading(false));
  }, []);

  // ── Auth State (per section) ───────────────────────────────────────────
  const [barberUser, setBarberUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<User | null>(null);

  // ── Booking handlers ───────────────────────────────────────────────────
  const addBooking = (_bookingData: Omit<Booking, 'id' | 'status'>) => {
    // Booking creation (with email) is handled by server/ClientBooking directly.
    // The booking will appear after the client confirms via email link.
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    const updated = await api.put(`/api/bookings/${id}`, updates);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updated } : b));
  };

  // ── Service handlers ───────────────────────────────────────────────────
  const updateService = async (service: Service) => {
    const { id, ...data } = service;
    const updated = await api.put(`/api/services/${id}`, data);
    setServices(prev => prev.map(s => s.id === id ? updated : s));
  };

  const deleteService = async (id: string) => {
    await api.delete(`/api/services/${id}`);
    setServices(prev => prev.filter(s => s.id !== id));
  };

  const addService = async (serviceData: Omit<Service, 'id'>) => {
    const created = await api.post('/api/services', serviceData);
    setServices(prev => [...prev, created]);
  };

  // ── Master handlers ────────────────────────────────────────────────────
  const updateMaster = async (master: Master) => {
    const { id, ...data } = master;
    const result = await api.put(`/api/masters/${id}`, data);
    const updated = result?.master ?? result;
    if (!updated?.id) {
      throw new Error(result?.error || 'Failed to update master');
    }
    setMasters(prev => prev.map(m => m.id === id ? updated : m));

    if (result?.user?.id) {
      setUsers(prev => {
        const existingIndex = prev.findIndex(user => user.id === result.user.id);
        if (existingIndex === -1) return [...prev, result.user];
        const next = [...prev];
        next[existingIndex] = result.user;
        return next;
      });
    }
  };

  const addMaster = async (masterData: Omit<Master, 'id'>) => {
    const response = await fetch('/api/masters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(masterData),
    });
    const created = await response.json();
    const createdMaster = created?.master ?? created;

    if (!response.ok || !createdMaster?.id) {
      throw new Error(created?.error || 'Failed to create master');
    }

    setMasters(prev => [...prev, createdMaster].sort((a, b) => a.name.localeCompare(b.name, 'ru')));

    if (created?.user?.id) {
      setUsers(prev => [...prev, created.user].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
    }
  };

  const deleteMaster = async (id: string) => {
    const response = await fetch(`/api/masters/${id}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok || result?.success === false) {
      throw new Error(result?.error || 'Failed to delete master');
    }

    setMasters(prev => prev.filter(m => m.id !== id));

    if (Array.isArray(result?.deletedUserIds) && result.deletedUserIds.length > 0) {
      const deletedSet = new Set<string>(result.deletedUserIds);
      setUsers(prev => prev.filter(user => !deletedSet.has(user.id)));
    }
  };

  const approveReview = async (id: string) => {
    await api.put(`/api/reviews/${id}`, { status: 'APPROVED' });
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'APPROVED' as const } : r));
  };

  const rejectReview = async (id: string) => {
    await api.put(`/api/reviews/${id}`, { status: 'REJECTED' });
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'REJECTED' as const } : r));
  };

  // ── Auth handlers ──────────────────────────────────────────────────────
  const handleBarberLogin = async (email: string, password: string) => {
    const data = await api.post('/api/auth/login', { email, password, role: 'MASTER' });
    if (data.success) { setBarberUser(data.user); return { success: true, user: data.user }; }
    return { success: false };
  };

  const handleAdminLogin = async (email: string, password: string) => {
    const data = await api.post('/api/auth/login', { email, password, role: 'ADMIN' });
    if (data.success) { setAdminUser(data.user); return { success: true, user: data.user }; }
    return { success: false };
  };

  if (loading) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 tracking-widest uppercase text-sm">Lumière</p>
        </div>
      </div>
    );
  }

  // ── Routes ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-black min-h-screen text-zinc-200 selection:bg-gold-500 selection:text-black">
      <Routes>
        {/* localhost:4000/ — Главный сайт клиента */}
        <Route
          path="/"
          element={<ClientBooking onBook={addBooking} services={services} masters={masters} reviews={reviews} />}
        />

        {/* localhost:4000/confirm — Email confirmation landing */}
        <Route path="/confirm" element={<ConfirmBooking />} />

        {/* localhost:4000/barber — Личный кабинет барбера */}
        <Route
          path="/barber"
          element={
            barberUser ? (
              <StylistCabinet
                master={masters.find(m => m.name === barberUser.name) || null}
                user={barberUser}
                bookings={bookings}
                reviews={reviews}
                onUpdateBooking={updateBooking}
                onUpdateMaster={updateMaster}
                onLogout={() => setBarberUser(null)}
              />
            ) : (
              <Login
                onLogin={handleBarberLogin}
                users={users.filter(u => u.role === 'MASTER')}
              />
            )
          }
        />

        {/* localhost:4000/admin — Админка */}
        <Route
          path="/admin"
          element={
            adminUser ? (
              <AdminDashboard
                bookings={bookings}
                services={services}
                reviews={reviews}
                masters={masters}
                clients={clients}
                waitlist={waitlist}
                users={users}
                onUpdateService={updateService}
                onDeleteService={deleteService}
                onAddService={addService}
                onUpdateMaster={updateMaster}
                onAddMaster={addMaster}
                onDeleteMaster={deleteMaster}
                onApproveReview={approveReview}
                onRejectReview={rejectReview}
                onUpdateBooking={updateBooking}
                onLogout={() => setAdminUser(null)}
                currentUser={adminUser}
              />
            ) : (
              <Login
                onLogin={handleAdminLogin}
                users={users.filter(u => u.role === 'ADMIN')}
                showDemoCredentials={false}
              />
            )
          }
        />
      </Routes>
    </div>
  );
};

export default App;
