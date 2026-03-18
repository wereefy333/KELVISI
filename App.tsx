import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ClientBooking } from './views/ClientBooking';
import { AdminDashboard } from './views/AdminDashboard';
import { Login } from './views/Login';
import { StylistCabinet } from './views/StylistCabinet';
import { ConfirmBooking } from './views/ConfirmBooking';
import { Booking, Service, Master, Review, Client, User, WaitlistEntry } from './types';
import { MASTERS as MASTERS_SEED, REVIEWS as REVIEWS_SEED, SERVICES as SERVICES_SEED } from './data';

type AuthSession = {
  token: string;
  user: User;
};

const STORAGE_KEYS = {
  barber: 'kelvisi.barberSession',
  admin: 'kelvisi.adminSession',
} as const;

function readStoredSession(key: string): AuthSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(key: string, session: AuthSession | null) {
  if (typeof window === 'undefined') return;
  if (!session) {
    window.sessionStorage.removeItem(key);
    return;
  }
  window.sessionStorage.setItem(key, JSON.stringify(session));
}

const api = {
  async request(url: string, options: RequestInit = {}, token?: string) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return data;
  },
  get(url: string, token?: string) {
    return api.request(url, {}, token);
  },
  post(url: string, body: object, token?: string) {
    return api.request(url, { method: 'POST', body: JSON.stringify(body) }, token);
  },
  put(url: string, body: object, token?: string) {
    return api.request(url, { method: 'PUT', body: JSON.stringify(body) }, token);
  },
  delete(url: string, token?: string) {
    return api.request(url, { method: 'DELETE' }, token);
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

  const [barberSession, setBarberSession] = useState<AuthSession | null>(() => readStoredSession(STORAGE_KEYS.barber));
  const [adminSession, setAdminSession] = useState<AuthSession | null>(() => readStoredSession(STORAGE_KEYS.admin));

  const barberUser = barberSession?.user ?? null;
  const barberToken = barberSession?.token;
  const adminUser = adminSession?.user ?? null;
  const adminToken = adminSession?.token;
  const activePrivateToken = adminToken || barberToken;
  const activePrivateRole = adminToken ? 'ADMIN' : barberToken ? 'MASTER' : null;

  useEffect(() => {
    Promise.all([
      api.get('/api/services'),
      api.get('/api/masters'),
      api.get('/api/reviews'),
    ]).then(([svcs, msts, rvs]) => {
      setServices(svcs);
      setMasters(msts);
      setReviews(rvs);
    }).catch((err: Error) => {
      console.warn('Public API unavailable, running in offline mode:', err.message);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activePrivateToken) {
      setBookings([]);
      setClients([]);
      setWaitlist([]);
      setUsers([]);
      return;
    }

    if (activePrivateRole === 'ADMIN') {
      Promise.all([
        api.get('/api/bookings', activePrivateToken),
        api.get('/api/reviews', activePrivateToken),
        api.get('/api/clients', activePrivateToken),
        api.get('/api/waitlist', activePrivateToken),
        api.get('/api/users', activePrivateToken),
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
      api.get('/api/bookings', activePrivateToken),
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
  }, [activePrivateRole, activePrivateToken]);

  const persistBarberSession = (session: AuthSession | null) => {
    setBarberSession(session);
    writeStoredSession(STORAGE_KEYS.barber, session);
  };

  const persistAdminSession = (session: AuthSession | null) => {
    setAdminSession(session);
    writeStoredSession(STORAGE_KEYS.admin, session);
  };

  const adminApiToken = adminToken;
  const masterApiToken = barberToken;
  const bookingApiToken = adminToken || barberToken;

  const addBooking = (_bookingData: Omit<Booking, 'id' | 'status'>) => {
    // Booking creation is handled directly in the public client flow.
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    const updated = await api.put(`/api/bookings/${id}`, updates, bookingApiToken);
    setBookings(prev => prev.map(booking => (booking.id === id ? { ...booking, ...updated } : booking)));
  };

  const updateService = async (service: Service) => {
    const { id, ...data } = service;
    const updated = await api.put(`/api/services/${id}`, data, adminApiToken);
    setServices(prev => prev.map(item => (item.id === id ? updated : item)));
  };

  const deleteService = async (id: string) => {
    await api.delete(`/api/services/${id}`, adminApiToken);
    setServices(prev => prev.filter(service => service.id !== id));
  };

  const addService = async (serviceData: Omit<Service, 'id'>) => {
    const created = await api.post('/api/services', serviceData, adminApiToken);
    setServices(prev => [...prev, created]);
  };

  const updateMaster = async (master: Master) => {
    const { id, ...data } = master;
    const token = adminApiToken || masterApiToken;
    const result = await api.put(`/api/masters/${id}`, data, token);
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
    const created = await api.post('/api/masters', masterData, adminApiToken);
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
    const result = await api.delete(`/api/masters/${id}`, adminApiToken);
    setMasters(prev => prev.filter(master => master.id !== id));

    if (Array.isArray(result?.deletedUserIds) && result.deletedUserIds.length > 0) {
      const deletedSet = new Set<string>(result.deletedUserIds);
      setUsers(prev => prev.filter(user => !deletedSet.has(user.id)));
    }
  };

  const approveReview = async (id: string) => {
    await api.put(`/api/reviews/${id}`, { status: 'APPROVED' }, adminApiToken);
    setReviews(prev => prev.map(review => (review.id === id ? { ...review, status: 'APPROVED' as const } : review)));
  };

  const rejectReview = async (id: string) => {
    await api.put(`/api/reviews/${id}`, { status: 'REJECTED' }, adminApiToken);
    setReviews(prev => prev.map(review => (review.id === id ? { ...review, status: 'REJECTED' as const } : review)));
  };

  const prepareClientContact = async (clientId: string, payload: { subject: string; message: string }) => {
    return api.post(`/api/clients/${clientId}/contact`, payload, adminApiToken);
  };

  const issueClientPromo = async (clientId: string, payload: { code: string; discount: string; message?: string }) => {
    return api.post(`/api/clients/${clientId}/promo`, payload, adminApiToken);
  };

  const handleBarberLogin = async (email: string, password: string) => {
    try {
      const data = await api.post('/api/auth/login', { email, password, role: 'MASTER' });
      if (!data?.token || !data?.user) return { success: false };

      persistBarberSession({ token: data.token, user: data.user });
      return { success: true, user: data.user };
    } catch {
      return { success: false };
    }
  };

  const handleAdminLogin = async (email: string, password: string) => {
    try {
      const data = await api.post('/api/auth/login', { email, password, role: 'ADMIN' });
      if (!data?.token || !data?.user) return { success: false };

      persistAdminSession({ token: data.token, user: data.user });
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
                master={masters.find(master => master.userId === barberUser.id) || null}
                user={barberUser}
                bookings={bookings}
                reviews={reviews}
                onUpdateBooking={updateBooking}
                onUpdateMaster={updateMaster}
                onLogout={() => persistBarberSession(null)}
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
                onApproveReview={approveReview}
                onRejectReview={rejectReview}
                onUpdateBooking={updateBooking}
                onPrepareClientContact={prepareClientContact}
                onIssueClientPromo={issueClientPromo}
                onLogout={() => persistAdminSession(null)}
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
