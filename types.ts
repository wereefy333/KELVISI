export type Role = 'CLIENT' | 'MASTER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  password: string; // hashed in production
  name: string;
  role: Role;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  register: (email: string, password: string, name: string, role: Role) => boolean;
}

export enum ServiceCategory {
  MEN = 'MEN',
  WOMEN = 'WOMEN'
}

export type ServiceType = 'STANDARD' | 'VIP';

export type MasterLevel = 'JUNIOR' | 'SENIOR' | 'TOP';

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number; // in minutes
  category: ServiceCategory;
  type: ServiceType;
  // Primary master candidates who can perform this service.
  allowedMasterIds?: string[];
  // Optional second master candidates for combo services.
  secondaryMasterIds?: string[];
  isActive?: boolean;
}

export interface Master {
  id: string;
  name: string;
  role: string;
  rating: number;
  imageUrl: string;
  bio?: string;
  experience?: string;
  languages?: string;
  specialization: ServiceCategory[];
  level: MasterLevel;
  priceMultiplier: number; // Dynamic pricing: TOP = 1.5, SENIOR = 1.2, JUNIOR = 1.0
  workSchedule?: WorkSchedule;
  isActive?: boolean;
}

export interface WorkSchedule {
  [dayOfWeek: number]: { start: string; end: string } | null; // 0 = Sunday, 1 = Monday, etc.
}

export type BookingStatus = 'PENDING' | 'PENDING_EMAIL' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface Booking {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  serviceId: string;
  masterId: string;
  date: string; // ISO Date string
  time: string; // HH:mm
  status: BookingStatus;
  notes?: string;
  totalPrice: number;
  confirmToken?: string;
  createdAt?: string;
}

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Review {
  id: string;
  clientName: string;
  text: string;
  rating: number;
  avatarUrl?: string;
  bookingId?: string;
  status: ReviewStatus;
  createdAt?: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  totalVisits: number;
  totalSpent: number;
  lastVisit?: string;
  createdAt: string;
}

export interface WaitlistEntry {
  id: string;
  clientName: string;
  clientPhone: string;
  masterId: string;
  serviceIds: string[];
  preferredDates: string[];
  createdAt: string;
  notified?: boolean;
}
