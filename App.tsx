import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ClientBooking } from './views/ClientBooking';
import { AdminDashboard } from './views/AdminDashboard';
import { Login } from './views/Login';
import { StylistCabinet } from './views/StylistCabinet';
import { ConfirmBooking } from './views/ConfirmBooking';
import { Booking, Service, Master, Review, Client, User, WaitlistEntry } from './types';
import { MASTERS as MASTERS_SEED, REVIEWS as REVIEWS_SEED, SERVICES as SERVICES_SEED } from './data';

const api = {
  async request(url: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, { ...options, headers, credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return data;
  },
  get(url: string) {
    return api.request(url, {});
  },
  post(url: string, body?: object) {
    return api.request(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  },
  put(url: string, body: object) {
    return api.request(url, { method: 'PUT', body: JSON.stringify(body) });
  },
  delete(url: string) {
    return api.request(url, { method: 'DELETE' });
  },
};

const App: React.FC = () => {
  const [services, setServices] = useState<Service[]>(SERVICES_SEED);
  const [masters, setMasters] = useState<Master[]>(MASTERS_SEED);
  const [reviews, setReviews] = useState<Review[]>(REVIEWS_SEED);
  const [clients, setClients] = useState<Client[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const barberUser = currentUser?.role === 'MASTER' ? currentUser : null;
  const adminUser = currentUser?.role === 'ADMIN' ? currentUser : null;
  const activePrivateRole = currentUser?.role || null;
  const activeBarberMaster = barberUser
    ? masters.find((master) => master.userId === barberUser.id)
      || masters.find((master) => master.name.trim().toLowerCase() === barberUser.name.trim().toLowerCase())
      || null
    : null;

  useEffect(() => {
    Promise.all([
      api.get('/api/services'),
      api.get('/api/masters'),
      api.get('/api/reviews'),
      api.get('/api/auth/me').then(data => data.user).catch(() => null),
    ]).then(([svcs, msts, rvs, user]) => {
      setServices(svcs);
      setMasters(msts);
      setReviews(rvs);
      if (user) setCurrentUser(user);
    }).catch((err: Error) => {
      console.warn('Public API unavailable, running in offline mode:', err.message);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setBookings([]);
      setClients([]);
      setWaitlist([]);
      setUsers([]);
      return;
    }

    if (activePrivateRole === 'ADMIN') {
      Promise.all([
        api.get('/api/bookings'),
        api.get('/api/reviews'),
        api.get('/api/clients'),
        api.get('/api/waitlist'),
        api.get('/api/users'),
      ]).then(([bks, rvs, cls, wl, usrs]) => {
        setBookings(bks);
        setReviews(rvs);
        setClients(cls);
        setWaitlist(wl);
        setUsers(usrs);
      }).catch((err: Error) => {
        console.warn('Failed to load admin data:', err.message);
      });
      return;
    }

    Promise.all([
      api.get('/api/bookings'),
      api.get('/api/reviews'),
    ]).then(([bks, rvs]) => {
      setBookings(bks);
      setReviews(rvs);
      setClients([]);
      setWaitlist([]);
      setUsers([]);
    }).catch((err: Error) => {
      console.warn('Failed to load master data:', err.message);
    });
  }, [activePrivateRole, currentUser]);

  const handleLogout = async () => {
    try { await api.post('/api/auth/logout'); } catch {}
    setCurrentUser(null);
  };

  const addBooking = (_bookingData: Omit<Booking, 'id' | 'status'>) => {
    // Booking creation is handled directly in the public client flow.
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    const updated = await api.put(`/api/bookings/${id}`, updates);
    setBookings(prev => prev.map(booking => (booking.id === id ? { ...booking, ...updated } : booking)));
  };

  const updateService = async (service: Service) => {
    const { id, ...data } = service;
    const updated = await api.put(`/api/services/${id}`, data);
    setServices(prev => prev.map(item => (item.id === id ? updated : item)));
  };

  const deleteService = async (id: string) => {
    await api.delete(`/api/services/${id}`);
    setServices(prev => prev.filter(service => service.id !== id));
  };

  const addService = async (serviceData: Omit<Service, 'id'>) => {
    const created = await api.post('/api/services', serviceData);
    setServices(prev => [...prev, created]);
  };

  const updateMaster = async (master: Master) => {
    const { id, ...data } = master;
    const result = await api.put(`/api/masters/${id}`, data);
    const updated = result?.master ?? result;
    if (!updated?.id) {
      throw new Error(result?.error || 'Failed to update master');
    }

    setMasters(prev => prev.map(item => (item.id === id ? updated : item)));

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
    const created = await api.post('/api/masters', masterData);
    const createdMaster = created?.master ?? created;
    if (!createdMaster?.id) {
      throw new Error(created?.error || 'Failed to create master');
    }

    setMasters(prev => [...prev, createdMaster].sort((a, b) => a.name.localeCompare(b.name, 'ru')));

    if (created?.user?.id) {
      setUsers(prev => [...prev, created.user].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
    }
  };

  const deleteMaster = async (id: string) => {
    const result = await api.delete(`/api/masters/${id}`);
    setMasters(prev => prev.filter(master => master.id !== id));

    if (Array.isArray(result?.deletedUserIds) && result.deletedUserIds.length > 0) {
      const deletedSet = new Set<string>(result.deletedUserIds);
      setUsers(prev => prev.filter(user => !deletedSet.has(user.id)));
    }
  };

  const updateUser = async (id: string, updates: Partial<User>) => {
    const updated = await api.put(`/api/users/${id}`, updates);
    setUsers(prev => prev.map(user => (user.id === id ? { ...user, ...updated } : user)));
  };

  const approveReview = async (id: string) => {
    await api.put(`/api/reviews/${id}`, { status: 'APPROVED' });
    setReviews(prev => prev.map(review => (review.id === id ? { ...review, status: 'APPROVED' as const } : review)));
  };

  const rejectReview = async (id: string) => {
    await api.put(`/api/reviews/${id}`, { status: 'REJECTED' });
    setReviews(prev => prev.map(review => (review.id === id ? { ...review, status: 'REJECTED' as const } : review)));
  };

  const prepareClientContact = async (clientId: string, payload: { subject: string; message: string }) => {
    return api.post(`/api/clients/${clientId}/contact`, payload);
  };

  const issueClientPromo = async (clientId: string, payload: { code: string; discount: string; message?: string }) => {
    return api.post(`/api/clients/${clientId}/promo`, payload);
  };

  const getClientBookings = async (clientId: string) => {
    return api.get(`/api/clients/${clientId}/bookings`);
  };

  const handleBarberLogin = async (email: string, password: string) => {
    try {
      const data = await api.post('/api/auth/login', { email, password, role: 'MASTER' });
      if (!data?.user) return { success: false };

      setCurrentUser(data.user);
      return { success: true, user: data.user };
    } catch {
      return { success: false };
    }
  };

  const handleAdminLogin = async (email: string, password: string) => {
    try {
      const data = await api.post('/api/auth/login', { email, password, role: 'ADMIN' });
      if (!data?.user) return { success: false };

      setCurrentUser(data.user);
      return { success: true, user: data.user };
    } catch {
      return { success: false };
    }
  };

  if (loading) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 tracking-widest uppercase text-sm">Kelvisi</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen text-zinc-200 selection:bg-gold-500 selection:text-black">
      <Routes>
        <Route
          path="/"
          element={<ClientBooking onBook={addBooking} services={services} masters={masters} reviews={reviews} />}
        />
        <Route path="/confirm" element={<ConfirmBooking />} />

        <Route
          path="/barber"
          element={
            barberUser ? (
              <StylistCabinet
                master={activeBarberMaster}
                user={barberUser}
                bookings={bookings}
                reviews={reviews}
                onUpdateBooking={updateBooking}
                onUpdateMaster={updateMaster}
                onLogout={handleLogout}
              />
            ) : (
              <Login
                onLogin={handleBarberLogin}
                users={[]}
                showDemoCredentials={false}
              />
            )
          }
        />

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
                onUpdateUser={updateUser}
                onApproveReview={approveReview}
                onRejectReview={rejectReview}
                onUpdateBooking={updateBooking}
                onPrepareClientContact={prepareClientContact}
                onIssueClientPromo={issueClientPromo}
                onGetClientBookings={getClientBookings}
                onLogout={handleLogout}
                currentUser={adminUser}
              />
            ) : (
              <Login
                onLogin={handleAdminLogin}
                users={[]}
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
