import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { appendFile } from 'fs/promises';
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { PrismaClient } from '@prisma/client';

if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('.env'); } catch {}
  try { process.loadEnvFile('.env.local'); } catch {}
}

const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL || 'http://localhost:4000').replace(/\/+$/, '');
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-only-change-me';
const AUTH_TOKEN_TTL_MS = Number(process.env.AUTH_TOKEN_TTL_MS || 12 * 60 * 60 * 1000);
const PASSWORD_HASH_PREFIX = 'scrypt';
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:4000,http://127.0.0.1:4000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

if (!CORS_ORIGINS.includes(APP_PUBLIC_URL)) {
  CORS_ORIGINS.push(APP_PUBLIC_URL);
}

app.set('trust proxy', 1);
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json());

const MIN_MASTER_PASSWORD_LENGTH = 8;
const SERVICE_ALLOWED_FIELDS = ['name', 'description', 'price', 'durationMinutes', 'category', 'type', 'isActive'];
const REVIEW_ALLOWED_FIELDS = ['status'];
const auditLogUrl = new URL('./audit.log', import.meta.url);

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Слишком много попыток входа. Повторите позже.' },
});

const bookingSlotsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Слишком много запросов расчета слотов. Повторите позже.' },
});

function unauthorized(res, error = 'Требуется авторизация') {
  return res.status(401).json({ success: false, error });
}

function forbidden(res, error = 'Недостаточно прав') {
  return res.status(403).json({ success: false, error });
}

function signTokenPayload(payload) {
  return createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
}

function encodeAuthToken(user) {
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    role: user.role,
    name: user.name,
    exp: Date.now() + AUTH_TOKEN_TTL_MS,
  })).toString('base64url');
  const signature = signTokenPayload(payload);
  return `${payload}.${signature}`;
}

function decodeAuthToken(token) {
  if (typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expectedSignature = signTokenPayload(payload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== receivedBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, receivedBuffer)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed?.sub || !parsed?.role || !parsed?.exp) return null;
    if (Number(parsed.exp) < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/.exec(authHeader);
  if (!match) return unauthorized(res);

  const tokenPayload = decodeAuthToken(match[1]);
  if (!tokenPayload) return unauthorized(res, 'Сессия недействительна или истекла');

  const user = await prisma.user.findUnique({ where: { id: tokenPayload.sub } });
  if (!user || !user.isActive) return unauthorized(res, 'Пользователь не найден или деактивирован');

  req.auth = { user };
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth?.user) return unauthorized(res);
    if (!roles.includes(req.auth.user.role)) return forbidden(res);
    return next();
  };
}

async function resolveMasterForUser(user) {
  if (!user || user.role !== 'MASTER') return null;
  return prisma.master.findFirst({ where: { userId: user.id, isActive: true } });
}

async function requireMasterAccess(req, res, next) {
  if (!req.auth?.user) return unauthorized(res);
  if (req.auth.user.role === 'ADMIN') return next();
  if (req.auth.user.role !== 'MASTER') return forbidden(res);

  const master = await resolveMasterForUser(req.auth.user);
  if (!master) {
    return forbidden(res, 'Для аккаунта мастера не найден связанный профиль');
  }

  req.auth.master = master;
  return next();
}

function pickAllowedFields(source, allowedFields) {
  const next = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(source, field) && source[field] !== undefined) {
      next[field] = source[field];
    }
  }
  return next;
}

function internalServerError(res, publicMessage, error, context) {
  console.error(`✖ ${context}:`, error);
  return res.status(500).json({ success: false, error: publicMessage });
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${PASSWORD_HASH_PREFIX}$${salt}$${derivedKey}`;
}

function isPasswordHashed(password) {
  return typeof password === 'string' && password.startsWith(`${PASSWORD_HASH_PREFIX}$`);
}

function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string' || !storedHash) return false;
  if (!isPasswordHashed(storedHash)) {
    return password === storedHash;
  }

  const [, salt, expectedKey] = storedHash.split('$');
  if (!salt || !expectedKey) return false;
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  const expectedBuffer = Buffer.from(expectedKey, 'hex');
  const receivedBuffer = Buffer.from(derivedKey, 'hex');
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

function normalizeClientName(value) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!normalized) return null;
  return normalized.slice(0, 120);
}

function normalizeClientPhone(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  const compact = normalized.slice(0, 40);
  const digits = compact.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  if (!/^\+?[\d\s\-()]+$/.test(compact)) return null;
  return compact;
}

function normalizeClientEmail(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  return normalized.slice(0, 254);
}

function isValidEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email ?? ''));
}

async function writeAuditLog(entry) {
  const normalizedEntry = {
    at: new Date().toISOString(),
    ...entry,
  };

  try {
    await appendFile(auditLogUrl, `${JSON.stringify(normalizedEntry)}\n`, 'utf8');
  } catch (error) {
    console.error('✖ audit log write failed:', error);
  }
}

function getAuditActor(req) {
  return {
    id: req.auth?.user?.id ?? null,
    role: req.auth?.user?.role ?? 'ANONYMOUS',
    ip: req.ip,
  };
}

function pickServiceData(rawInput) {
  return pickAllowedFields(rawInput ?? {}, SERVICE_ALLOWED_FIELDS);
}

function normalizeAndValidateServiceData(data, { forCreate }) {
  if (Object.prototype.hasOwnProperty.call(data, 'name')) {
    data.name = String(data.name ?? '').trim().slice(0, 120);
    if (!data.name) return 'Укажите название услуги';
  } else if (forCreate) {
    return 'Укажите название услуги';
  }

  if (Object.prototype.hasOwnProperty.call(data, 'description')) {
    data.description = String(data.description ?? '').trim().slice(0, 1000);
    if (!data.description) return 'Укажите описание услуги';
  } else if (forCreate) {
    return 'Укажите описание услуги';
  }

  if (Object.prototype.hasOwnProperty.call(data, 'price')) {
    const price = Number(data.price);
    if (!Number.isInteger(price) || price < 0 || price > 1_000_000) return 'Некорректная цена услуги';
    data.price = price;
  } else if (forCreate) {
    return 'Укажите цену услуги';
  }

  if (Object.prototype.hasOwnProperty.call(data, 'durationMinutes')) {
    const duration = Number(data.durationMinutes);
    if (!Number.isInteger(duration) || duration <= 0 || duration > 24 * 60) return 'Некорректная длительность услуги';
    data.durationMinutes = duration;
  } else if (forCreate) {
    return 'Укажите длительность услуги';
  }

  if (Object.prototype.hasOwnProperty.call(data, 'category')) {
    if (!['MEN', 'WOMEN'].includes(String(data.category))) return 'Некорректная категория услуги';
  } else if (forCreate) {
    return 'Укажите категорию услуги';
  }

  if (Object.prototype.hasOwnProperty.call(data, 'type')) {
    if (!['STANDARD', 'VIP'].includes(String(data.type))) return 'Некорректный тип услуги';
  } else if (forCreate) {
    return 'Укажите тип услуги';
  }

  if (Object.prototype.hasOwnProperty.call(data, 'isActive')) {
    data.isActive = Boolean(data.isActive);
  } else if (forCreate) {
    data.isActive = true;
  }

  return null;
}

function normalizeAndValidateReviewUpdate(data) {
  if (!Object.prototype.hasOwnProperty.call(data, 'status')) {
    return 'Можно обновлять только статус отзыва';
  }
  if (!['PENDING', 'APPROVED', 'REJECTED'].includes(String(data.status))) {
    return 'Некорректный статус отзыва';
  }
  return null;
}

function mapBookingForConfirmation(booking) {
  return {
    id: booking.id,
    clientName: booking.clientName,
    serviceId: booking.serviceId,
    date: booking.date,
    time: booking.time,
    totalPrice: booking.totalPrice,
    status: booking.status,
  };
}

// SMTP transporter (strictly configured via env)
const MAIL_HOST = (process.env.MAIL_HOST || '').trim();
const MAIL_PORT = Number(process.env.MAIL_PORT || 465);
const MAIL_SECURE = (process.env.MAIL_SECURE ?? String(MAIL_PORT === 465)).toLowerCase() === 'true';
const MAIL_USER = (process.env.MAIL_USER || '').trim();
const MAIL_PASS = process.env.MAIL_PASS || '';
const MAIL_FROM = (process.env.MAIL_FROM || '').trim();
const MAIL_CONNECTION_TIMEOUT_MS = Number(process.env.MAIL_CONNECTION_TIMEOUT_MS || 10000);
const MAIL_SOCKET_TIMEOUT_MS = Number(process.env.MAIL_SOCKET_TIMEOUT_MS || 15000);
const SMTP_ENABLED = Boolean(MAIL_HOST && MAIL_USER && MAIL_PASS && MAIL_FROM);

const transporter = SMTP_ENABLED
  ? nodemailer.createTransport({
      host: MAIL_HOST,
      port: MAIL_PORT,
      secure: MAIL_SECURE,
      auth: { user: MAIL_USER, pass: MAIL_PASS },
      connectionTimeout: MAIL_CONNECTION_TIMEOUT_MS,
      greetingTimeout: MAIL_CONNECTION_TIMEOUT_MS,
      socketTimeout: MAIL_SOCKET_TIMEOUT_MS,
      tls: { servername: MAIL_HOST },
    })
  : null;

if (SMTP_ENABLED) {
  transporter.verify()
    .then(() => {
      console.log(`SMTP ready: ${MAIL_HOST}:${MAIL_PORT} secure=${MAIL_SECURE}`);
    })
    .catch((err) => {
      console.warn(`SMTP verify failed (${MAIL_HOST}:${MAIL_PORT}): ${err.message}`);
    });
} else {
  console.warn('SMTP disabled: set MAIL_HOST, MAIL_USER, MAIL_PASS and MAIL_FROM in env to enable booking confirmation emails.');
}

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// SERVICES
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

app.get('/api/services', async (_req, res) => {
  const services = await prisma.service.findMany({ orderBy: { name: 'asc' } });
  res.json(services);
});

app.post('/api/services', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = pickServiceData(req.body);
    const validationError = normalizeAndValidateServiceData(data, { forCreate: true });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const service = await prisma.service.create({ data });
    await writeAuditLog({
      actor: getAuditActor(req),
      action: 'service.create',
      entity: 'Service',
      entityId: service.id,
    });
    return res.json(service);
  } catch (error) {
    return internalServerError(res, 'Не удалось создать услугу', error, 'create service');
  }
});

app.put('/api/services/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = pickServiceData(req.body);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, error: 'Нет полей для обновления' });
    }
    const validationError = normalizeAndValidateServiceData(data, { forCreate: false });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const service = await prisma.service.update({ where: { id: req.params.id }, data });
    await writeAuditLog({
      actor: getAuditActor(req),
      action: 'service.update',
      entity: 'Service',
      entityId: service.id,
    });
    return res.json(service);
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Услуга не найдена' });
    }
    return internalServerError(res, 'Не удалось обновить услугу', error, 'update service');
  }
});

app.delete('/api/services/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.service.delete({ where: { id: req.params.id } });
    await writeAuditLog({
      actor: getAuditActor(req),
      action: 'service.delete',
      entity: 'Service',
      entityId: req.params.id,
    });
    return res.json({ success: true });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Услуга не найдена' });
    }
    return internalServerError(res, 'Не удалось удалить услугу', error, 'delete service');
  }
});

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// MASTERS
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

app.get('/api/masters', async (_req, res) => {
  const masters = await prisma.master.findMany({ orderBy: { name: 'asc' } });
  res.json(masters);
});

app.post('/api/masters', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = pickMasterData(req.body);
    const validationError = normalizeAndValidateMasterData(data, { forCreate: true });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const userPayload = normalizeMasterUserPayload(req.body?.user, {
      forCreate: true,
      required: true,
      fallbackName: data.name,
      fallbackIsActive: data.isActive,
    });
    if (userPayload.error) {
      return res.status(400).json({ success: false, error: userPayload.error });
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: userPayload.data });
      const master = await tx.master.create({ data: { ...data, userId: user.id } });
      return { master, user: mapUser(user) };
    });

    await writeAuditLog({
      actor: getAuditActor(req),
      action: 'master.create',
      entity: 'Master',
      entityId: result.master.id,
    });

    res.json(result);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Email уже используется другим аккаунтом' });
    }
    return internalServerError(res, 'Не удалось создать мастера', error, 'create master');
  }
});

app.put('/api/masters/:id', authenticate, requireMasterAccess, async (req, res) => {
  try {
    const canManageAnyMaster = req.auth.user.role === 'ADMIN';
    if (!canManageAnyMaster && req.auth.master.id !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Мастер может редактировать только свой профиль' });
    }

    const allowedFields = canManageAnyMaster
      ? MASTER_ALLOWED_FIELDS
      : ['bio', 'experience', 'languages'];
    const data = pickMasterData(pickAllowedFields(req.body, allowedFields));

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, error: 'Нет полей для обновления' });
    }

    const validationError = normalizeAndValidateMasterData(data, { forCreate: false });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const result = await prisma.$transaction(async (tx) => {
      let nextMasterData = data;
      const rawUserPayload = canManageAnyMaster ? req.body?.user : undefined;
      const userPayload = normalizeMasterUserPayload(rawUserPayload, {
        forCreate: false,
        required: false,
        fallbackName: req.body?.name ?? req.auth.master?.name ?? '',
        fallbackIsActive: req.body?.isActive ?? req.auth.master?.isActive ?? true,
      });
      if (userPayload.error) {
        const err = new Error(userPayload.error);
        err.code = 'MASTER_USER_VALIDATION';
        throw err;
      }

      const currentMaster = await tx.master.findUnique({ where: { id: req.params.id } });
      if (!currentMaster) {
        const err = new Error('Мастер не найден');
        err.code = 'P2025';
        throw err;
      }

      let user = null;
      if (userPayload.data) {
        if (userPayload.data.id) {
          const existing = await tx.user.findUnique({ where: { id: userPayload.data.id } });
          if (!existing || existing.role !== 'MASTER') {
            const err = new Error('Аккаунт мастера для обновления не найден');
            err.code = 'MASTER_USER_NOT_FOUND';
            throw err;
          }
          const { id, ...userData } = userPayload.data;
          const updatedUser = await tx.user.update({ where: { id }, data: userData });
          user = mapUser(updatedUser);
          nextMasterData = { ...nextMasterData, userId: updatedUser.id };
        } else {
          const createdUser = await tx.user.create({ data: userPayload.data });
          user = mapUser(createdUser);
          nextMasterData = { ...nextMasterData, userId: createdUser.id };
        }
      }

      const master = await tx.master.update({ where: { id: req.params.id }, data: nextMasterData });

      return { master, user };
    });

    await writeAuditLog({
      actor: getAuditActor(req),
      action: 'master.update',
      entity: 'Master',
      entityId: result.master.id,
    });

    res.json(result);
  } catch (error) {
    if (error?.code === 'MASTER_USER_VALIDATION') {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error?.code === 'MASTER_USER_NOT_FOUND') {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error?.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Email уже используется другим аккаунтом' });
    }
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Мастер не найден' });
    }
    return internalServerError(res, 'Не удалось обновить мастера', error, 'update master');
  }
});

app.delete('/api/masters/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const bookingsCount = await prisma.booking.count({ where: { masterId: req.params.id } });
    if (bookingsCount > 0) {
      return res.status(409).json({
        success: false,
        error: `Нельзя удалить мастера: есть связанные записи (${bookingsCount})`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const master = await tx.master.findUnique({ where: { id: req.params.id } });
      if (!master) {
        const err = new Error('Мастер не найден');
        err.code = 'P2025';
        throw err;
      }
      const deletedUserIds = [];
      if (master.userId) {
        await tx.user.delete({ where: { id: master.userId } });
        deletedUserIds.push(master.userId);
      }
      await tx.master.delete({ where: { id: req.params.id } });
      return deletedUserIds;
    });

    await writeAuditLog({
      actor: getAuditActor(req),
      action: 'master.delete',
      entity: 'Master',
      entityId: req.params.id,
    });

    return res.json({ success: true, deletedUserIds: result });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Мастер не найден' });
    }
    return internalServerError(res, 'Не удалось удалить мастера', error, 'delete master');
  }
});

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// BOOKINGS
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

app.get('/api/bookings', authenticate, requireMasterAccess, async (req, res) => {
  const where = req.auth.user.role === 'ADMIN'
    ? { status: { not: 'PENDING_EMAIL' } }
    : { status: { not: 'PENDING_EMAIL' }, masterId: req.auth.master.id };
  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  res.json(bookings.map(mapBooking));
});

app.get('/api/bookings/:id', authenticate, requireMasterAccess, async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) return res.status(404).json({ error: 'Not found' });
  if (req.auth.user.role === 'MASTER' && booking.masterId !== req.auth.master.id) {
    return forbidden(res, 'Эта запись недоступна данному мастеру');
  }
  res.json(mapBooking(booking));
});

app.put('/api/bookings/:id', authenticate, requireMasterAccess, async (req, res) => {
  try {
    const allowedFields = req.auth.user.role === 'ADMIN'
      ? ['clientName', 'clientPhone', 'clientEmail', 'serviceId', 'masterId', 'date', 'time', 'status', 'notes', 'totalPrice']
      : ['status'];
    const data = pickAllowedFields(req.body ?? {}, allowedFields);
    const existingBooking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!existingBooking) {
      return res.status(404).json({ success: false, error: 'Запись не найдена' });
    }
    if (req.auth.user.role === 'MASTER' && existingBooking.masterId !== req.auth.master.id) {
      return forbidden(res, 'Эта запись недоступна данному мастеру');
    }
    if (Object.prototype.hasOwnProperty.call(data, 'status')) {
      const allowedStatuses = ['PENDING', 'PENDING_EMAIL', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
      if (!allowedStatuses.includes(data.status)) {
        return res.status(400).json({ success: false, error: 'Некорректный статус записи' });
      }
    }
    if (Object.prototype.hasOwnProperty.call(data, 'clientPhone')) {
      const normalizedPhone = normalizeClientPhone(data.clientPhone);
      if (!normalizedPhone) {
        return res.status(400).json({ success: false, error: 'Некорректный телефон клиента' });
      }
      data.clientPhone = normalizedPhone;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'clientEmail')) {
      const normalizedEmail = normalizeClientEmail(data.clientEmail);
      if (normalizedEmail && !isValidEmail(normalizedEmail)) {
        return res.status(400).json({ success: false, error: 'Некорректный email клиента' });
      }
      data.clientEmail = normalizedEmail;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, error: 'Нет доступных полей для обновления' });
    }
    const booking = await prisma.booking.update({ where: { id: req.params.id }, data });
    await syncClientsFromBookings();
    await writeAuditLog({
      actor: getAuditActor(req),
      action: 'booking.update',
      entity: 'Booking',
      entityId: booking.id,
    });
    res.json(mapBooking(booking));
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Запись не найдена' });
    }
    return internalServerError(res, 'Не удалось обновить запись', error, 'update booking');
  }
});

// в”Ђв”Ђ POST /api/booking-slots вЂ” calculate available start times в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
app.post('/api/booking-slots', bookingSlotsRateLimiter, async (req, res) => {
  try {
    const { date, timingMode, services } = req.body ?? {};

    if (!date || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ success: false, error: 'date и services обязательны' });
    }
    if (!parseLocalDateOnly(date)) {
      return res.status(400).json({ success: false, error: 'Некорректный формат даты. Ожидается YYYY-MM-DD' });
    }

    const normalizedServices = services
      .filter(service => service && Number(service.durationMinutes) > 0)
      .map(service => ({
        ...service,
        primaryCandidates: Array.isArray(service.primaryCandidates) ? service.primaryCandidates : [],
        secondaryCandidates: Array.isArray(service.secondaryCandidates) ? service.secondaryCandidates : [],
      }));

    if (normalizedServices.length === 0) {
      return res.status(400).json({ success: false, error: 'services содержит некорректные элементы' });
    }

    const normalizedMode = timingMode === 'PARALLEL' ? 'PARALLEL' : 'SEQUENTIAL';
    const masterIds = new Set();
    for (const service of normalizedServices) {
      if (service.primaryMasterId && service.primaryMasterId !== '__ANY_MASTER__') masterIds.add(service.primaryMasterId);
      if (service.secondaryMasterId && service.secondaryMasterId !== '__ANY_MASTER__') masterIds.add(service.secondaryMasterId);
      service.primaryCandidates.forEach(id => id && masterIds.add(id));
      service.secondaryCandidates.forEach(id => id && masterIds.add(id));
    }

    if (masterIds.size === 0) {
      return res.json({ success: true, slots: [] });
    }

    const masters = await prisma.master.findMany({
      where: { id: { in: [...masterIds] } },
    });
    const masterById = new Map(masters.map(master => [master.id, master]));

    const activeStatuses = ['PENDING', 'PENDING_EMAIL', 'CONFIRMED', 'IN_PROGRESS'];
    const bookings = await prisma.booking.findMany({
      where: {
        date,
        status: { in: activeStatuses },
        masterId: { in: [...masterIds] },
      },
    });

    const knownServices = await prisma.service.findMany({
      select: { name: true, durationMinutes: true },
    });
    const durationByServiceName = new Map(knownServices.map(service => [service.name, service.durationMinutes]));

    const busyByMaster = new Map();
    for (const booking of bookings) {
      const start = toMinutes(booking.time);
      const duration = inferBookingDurationMinutes(booking, durationByServiceName);
      const end = start + duration;
      const list = busyByMaster.get(booking.masterId) ?? [];
      list.push([start, end]);
      busyByMaster.set(booking.masterId, list);
    }
    for (const [masterId, intervals] of busyByMaster) {
      intervals.sort((a, b) => a[0] - b[0]);
      busyByMaster.set(masterId, intervals);
    }

    const slots = [];
    const SLOT_STEP_MINUTES = 15;
    const DAY_START = 8 * 60;
    const DAY_END = 21 * 60;
    const earliestStart = getEarliestBookableStartMinutes(date, SLOT_STEP_MINUTES);
    if (earliestStart === null) {
      return res.status(400).json({ success: false, error: 'Некорректный формат даты. Ожидается YYYY-MM-DD' });
    }
    if (!Number.isFinite(earliestStart)) {
      return res.json({ success: true, slots: [] });
    }
    const latestServiceEnd = normalizedMode === 'PARALLEL'
      ? Math.max(...normalizedServices.map(service => Number(service.durationMinutes) || 0))
      : normalizedServices.reduce((sum, service) => sum + (Number(service.durationMinutes) || 0), 0);

    const firstStart = Math.max(DAY_START, earliestStart);
    for (let start = firstStart; start + latestServiceEnd <= DAY_END; start += SLOT_STEP_MINUTES) {
      const plan = normalizedMode === 'PARALLEL'
        ? buildParallelPlan(normalizedServices, start, masterById, busyByMaster, date)
        : buildSequentialPlan(normalizedServices, start, masterById, busyByMaster, date);
      if (plan) {
        slots.push({ time: toHHmm(start), plan });
        if (slots.length >= 40) break;
      }
    }

    return res.json({ success: true, slots });
  } catch (error) {
    return internalServerError(res, 'Ошибка расчета слотов на сервере', error, 'calculate booking slots');
  }
});

// в”Ђв”Ђ POST /api/bookings вЂ” create + send confirmation email в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
app.post('/api/bookings', async (req, res) => {
  const { clientName, clientPhone, clientEmail, serviceId, masterId, date, time, totalPrice, notes } = req.body;
  const normalizedClientName = normalizeClientName(clientName);
  const normalizedClientPhone = normalizeClientPhone(clientPhone);
  const normalizedClientEmail = normalizeClientEmail(clientEmail);
  const normalizedNotes = normalizeOptionalString(notes, 1000);

  if (!normalizedClientName) {
    return res.status(400).json({ success: false, error: 'Имя клиента обязательно' });
  }
  if (!normalizedClientPhone) {
    return res.status(400).json({ success: false, error: 'Телефон клиента обязателен' });
  }
  if (!normalizedClientEmail) {
    return res.status(400).json({ success: false, error: 'Email клиента обязателен' });
  }
  if (!isValidEmail(normalizedClientEmail)) {
    return res.status(400).json({ success: false, error: 'Некорректный email клиента' });
  }
  if (!date || !time) {
    return res.status(400).json({ success: false, error: 'Дата и время обязательны' });
  }
  if (!parseLocalDateOnly(date) || parseTimeToMinutes(time) === null) {
    return res.status(400).json({ success: false, error: 'Некорректный формат даты или времени' });
  }
  if (!isFutureDateTime(date, time)) {
    return res.status(400).json({ success: false, error: 'Нельзя записаться на прошедшее время' });
  }
  if (!masterId) {
    return res.status(400).json({ success: false, error: 'Мастер не выбран' });
  }

  // Validate master exists and is active
  const master = await prisma.master.findUnique({ where: { id: masterId } });
  if (!master || !master.isActive) {
    return res.status(400).json({ success: false, error: 'Выбранный мастер не найден или неактивен' });
  }

  // Server-side price calculation
  const serviceNames = String(serviceId || '').split(',').map(n => n.trim()).filter(Boolean);
  let computedPrice = Number(totalPrice);
  if (serviceNames.length > 0) {
    const dbServices = await prisma.service.findMany({ where: { name: { in: serviceNames }, isActive: true } });
    if (dbServices.length > 0) {
      const rawSum = dbServices.reduce((sum, s) => sum + s.price, 0);
      computedPrice = Math.round(rawSum * master.priceMultiplier);
    }
  }

  // Conflict check: ensure master is free at the requested time
  const knownServices = await prisma.service.findMany({ select: { name: true, durationMinutes: true } });
  const durationByServiceName = new Map(knownServices.map(s => [s.name, s.durationMinutes]));
  const requestedDurations = serviceNames.map(n => durationByServiceName.get(n)).filter(Number.isFinite);
  const isParallel = /параллел|4 руки|в 4 руки/i.test(String(normalizedNotes || ''));
  const requestedDuration = requestedDurations.length > 0
    ? (isParallel ? Math.max(...requestedDurations) : requestedDurations.reduce((a, b) => a + b, 0))
    : 60;
  const requestedStart = toMinutes(time);
  const requestedEnd = requestedStart + requestedDuration;

  const token = randomUUID();

  if (!SMTP_ENABLED || !transporter) {
    return res.status(503).json({
      success: false,
      error: 'Почтовый сервис не настроен. Укажите MAIL_HOST, MAIL_USER, MAIL_PASS и MAIL_FROM в переменных окружения.',
    });
  }

  const activeStatuses = ['PENDING', 'PENDING_EMAIL', 'CONFIRMED', 'IN_PROGRESS'];

  let booking;
  try {
    booking = await prisma.$transaction(async (tx) => {
      await acquireBookingSlotLock(tx, masterId, date);

      const existingBookings = await tx.booking.findMany({
        where: { date, masterId, status: { in: activeStatuses } },
      });
      const hasConflict = bookingHasConflict(existingBookings, {
        requestedStart,
        requestedEnd,
        durationByServiceName,
      });

      if (hasConflict) {
        const error = new Error('Выбранное время уже занято. Пожалуйста, выберите другой слот.');
        error.code = 'BOOKING_SLOT_CONFLICT';
        throw error;
      }

      return tx.booking.create({
        data: {
          clientName: normalizedClientName,
          clientPhone: normalizedClientPhone,
          clientEmail: normalizedClientEmail,
          serviceId,
          masterId,
          date, time,
          totalPrice: computedPrice,
          notes: normalizedNotes,
          status: 'PENDING_EMAIL',
          confirmToken: token,
        },
      });
    }, {
      isolationLevel: 'Serializable',
    });
  } catch (error) {
    if (error?.code === 'BOOKING_SLOT_CONFLICT' || error?.code === 'P2034') {
      return res.status(409).json({
        success: false,
        error: 'Выбранное время уже занято. Пожалуйста, выберите другой слот.',
      });
    }
    return internalServerError(res, 'Не удалось создать запись. Попробуйте еще раз.', error, 'create booking transaction');
  }

  const confirmUrl = `${APP_PUBLIC_URL}/confirm?token=${token}`;
  const safeClientName = escapeHtml(normalizedClientName);
  const safeServiceName = escapeHtml(serviceId);
  const safeMasterName = escapeHtml(master.name);
  const displayDate = new Date(`${date}T00:00:00`).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const displayTotalPrice = `${computedPrice.toLocaleString('ru-RU')} ₽`;
  const htmlBody = `
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Подтверждение записи Kelvisi</title>
      </head>
      <body style="margin:0; padding:24px; background:#f5f5f5;">
        <div style="font-family: Georgia, serif; background:#0a0a0a; color:#e4e4e7; padding:48px 32px; max-width:580px; margin:0 auto; border:1px solid #27272a;">
          <h1 style="color:#f59e0b; font-size:32px; letter-spacing:6px; text-transform:uppercase; margin:0 0 4px;">Kelvisi</h1>
          <p style="color:#71717a; font-size:12px; letter-spacing:4px; text-transform:uppercase; margin:0 0 32px;">Luxury Hair Salon</p>

          <p style="font-size:18px; line-height:1.5; margin:0 0 16px;">Здравствуйте, <strong style="color:#fff;">${safeClientName}</strong>!</p>
          <p style="color:#c4c4cc; line-height:1.7; margin:0 0 24px;">
            Вы оставили запись в салон <strong style="color:#fff;">Kelvisi</strong>.
            Чтобы бронь стала активной, подтвердите её по кнопке ниже.
          </p>

          <div style="background:#18181b; border-left:3px solid #f59e0b; padding:20px 24px; margin:0 0 28px; border-radius:2px;">
            <p style="margin:0 0 10px; font-size:15px;"><span style="color:#8d8d99;">Услуга:&nbsp;</span><strong>${safeServiceName}</strong></p>
            <p style="margin:0 0 10px; font-size:15px;"><span style="color:#8d8d99;">Мастер:&nbsp;</span><strong>${safeMasterName}</strong></p>
            <p style="margin:0 0 10px; font-size:15px;"><span style="color:#8d8d99;">Дата:&nbsp;</span><strong>${escapeHtml(displayDate)}</strong></p>
            <p style="margin:0 0 10px; font-size:15px;"><span style="color:#8d8d99;">Время:&nbsp;</span><strong>${escapeHtml(time)}</strong></p>
            <p style="margin:0; font-size:15px;"><span style="color:#8d8d99;">Итого:&nbsp;</span><strong style="color:#f59e0b; font-size:20px;">${escapeHtml(displayTotalPrice)}</strong></p>
          </div>

          <a href="${confirmUrl}" style="display:inline-block; background:#f59e0b; color:#000; padding:16px 36px; text-decoration:none; font-weight:bold; font-size:15px; letter-spacing:1px; text-transform:uppercase; margin-bottom:28px;">
            Подтвердить запись
          </a>

          <p style="color:#71717a; font-size:13px; line-height:1.6; margin:0 0 12px;">
            Если кнопка не сработала, откройте ссылку вручную:
          </p>
          <p style="margin:0 0 28px;">
            <a href="${confirmUrl}" style="color:#c4c4cc; font-size:13px; word-break:break-all;">${confirmUrl}</a>
          </p>

          <hr style="border:none; border-top:1px solid #27272a; margin:0 0 20px;" />
          <p style="color:#71717a; font-size:12px; line-height:1.6; margin:0;">
            Если вы не оставляли заявку, просто проигнорируйте это письмо.<br />
            Неподтвержденная запись будет автоматически отменена через 24 часа.
          </p>
        </div>
      </body>
    </html>`;
  const textBody = [
    `Здравствуйте, ${normalizedClientName}!`,
    '',
    'Вы оставили запись в салон Kelvisi.',
    'Подтвердите её по ссылке ниже:',
    confirmUrl,
    '',
    `Услуга: ${serviceId}`,
    `Мастер: ${master.name}`,
    `Дата: ${displayDate}`,
    `Время: ${time}`,
    `Итого: ${displayTotalPrice}`,
    '',
    'Если вы не оставляли заявку, просто проигнорируйте это письмо.',
  ].join('\n');

  try {
    await transporter.sendMail({
      from: MAIL_FROM,
      to: normalizedClientEmail,
      subject: '✂ Подтвердите запись в Kelvisi',
      text: textBody,
      html: htmlBody,
    });
    console.log(`✓ Email sent -> ${normalizedClientEmail} | token: ${token}`);
    await syncClientsFromBookings();
    res.json({ success: true, bookingId: booking.id });
  } catch (err) {
    console.error('✖ Email error:', err.message);
    try {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          confirmToken: null,
          notes: appendSystemNote(booking.notes, 'SMTP_ERROR: confirmation email was not sent; booking auto-cancelled.'),
        },
      });
      await syncClientsFromBookings();
    } catch (cleanupError) {
      console.error('✖ Booking cleanup after email failure error:', cleanupError.message);
    }
    const networkHint = `SMTP ${MAIL_HOST}:${MAIL_PORT} недоступен. Для этой сети обычно работают smtp.yandex.ru:465 или smtp.mail.ru:465.`;
    res.status(500).json({ success: false, error: `Не удалось отправить письмо. ${networkHint}` });
  }
});

// в”Ђв”Ђ GET /api/confirm-booking?token=xxx в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
app.get('/api/confirm-booking', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ success: false, error: 'Токен не передан' });

  const booking = await prisma.booking.findUnique({ where: { confirmToken: String(token) } });
  if (!booking) return res.status(404).json({ success: false, error: 'Токен не найден или уже использован' });

  // Don't allow confirming bookings that were cancelled or completed
  if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) {
    return res.status(410).json({ success: false, error: 'Эта запись была отменена или уже завершена. Подтверждение невозможно.' });
  }

  const alreadyConfirmed = booking.status === 'CONFIRMED';
  const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED' } });
  await syncClientsFromBookings();

  console.log(`✓ Booking confirmed: ${updated.id} (${updated.clientName})`);
  res.json({ success: true, booking: mapBookingForConfirmation(updated), alreadyConfirmed });
});

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// REVIEWS
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

app.get('/api/reviews', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/.exec(authHeader);
  const tokenPayload = match ? decodeAuthToken(match[1]) : null;
  const isAdmin = tokenPayload
    ? await prisma.user.findFirst({ where: { id: tokenPayload.sub, role: 'ADMIN', isActive: true } })
    : null;
  const reviews = await prisma.review.findMany({
    where: isAdmin ? undefined : { status: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
  });
  res.json(reviews.map(mapReview));
});

app.put('/api/reviews/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = pickAllowedFields(req.body ?? {}, REVIEW_ALLOWED_FIELDS);
    const validationError = normalizeAndValidateReviewUpdate(data);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const review = await prisma.review.update({ where: { id: req.params.id }, data });
    await writeAuditLog({
      actor: getAuditActor(req),
      action: 'review.update',
      entity: 'Review',
      entityId: review.id,
    });
    res.json(mapReview(review));
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Отзыв не найден' });
    }
    return internalServerError(res, 'Не удалось обновить отзыв', error, 'update review');
  }
});

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// CLIENTS
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

app.get('/api/clients', authenticate, requireRole('ADMIN'), async (_req, res) => {
  await syncClientsFromBookings();
  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } });
  res.json(clients.map(mapClient));
});

app.get('/api/clients/:id/bookings', authenticate, requireRole('ADMIN'), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) {
    return res.status(404).json({ success: false, error: 'Клиент не найден' });
  }

  const bookings = await prisma.booking.findMany({ orderBy: { createdAt: 'desc' } });
  const clientBookings = bookings
    .filter((booking) => bookingMatchesClient(client, booking))
    .sort(compareBookingDatesDesc);

  return res.json(clientBookings.map(mapBooking));
});

app.post('/api/clients/:id/contact', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) {
      return res.status(404).json({ success: false, error: 'Клиент не найден' });
    }

    const subject = normalizeOptionalString(req.body?.subject, 120) || 'Связаться с клиентом';
    const message = normalizeOptionalString(req.body?.message, 2000);
    if (!message) {
      return res.status(400).json({ success: false, error: 'Введите текст сообщения' });
    }

    await writeAuditLog({
      actor: getAuditActor(req),
      action: 'client.contact.prepare',
      entity: 'Client',
      entityId: client.id,
      details: {
        subject,
        hasEmail: Boolean(client.email),
        messageLength: message.length,
      },
    });

    return res.json({
      success: true,
      client: mapClient(client),
      draft: {
        to: client.email || '',
        subject,
        message,
      },
    });
  } catch (error) {
    return internalServerError(res, 'Не удалось подготовить сообщение клиенту', error, 'prepare client contact');
  }
});

app.post('/api/clients/:id/promo', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) {
      return res.status(404).json({ success: false, error: 'Клиент не найден' });
    }

    const code = normalizeOptionalString(req.body?.code, 40)?.toUpperCase();
    const discount = normalizeOptionalString(req.body?.discount, 60);
    const message = normalizeOptionalString(req.body?.message, 500);
    if (!code) {
      return res.status(400).json({ success: false, error: 'Укажите промокод' });
    }
    if (!discount) {
      return res.status(400).json({ success: false, error: 'Укажите выгоду по промокоду' });
    }

    const promoMessage = message || `Промокод ${code}: ${discount}`;

    await writeAuditLog({
      actor: getAuditActor(req),
      action: 'client.promo.issue',
      entity: 'Client',
      entityId: client.id,
      details: {
        code,
        discount,
      },
    });

    return res.json({
      success: true,
      client: mapClient(client),
      promo: {
        code,
        discount,
        message: promoMessage,
      },
    });
  } catch (error) {
    return internalServerError(res, 'Не удалось подготовить промокод', error, 'issue client promo');
  }
});

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// WAITLIST
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

app.get('/api/waitlist', authenticate, requireRole('ADMIN'), async (_req, res) => {
  await archiveExpiredWaitlistEntries();
  const entries = await prisma.waitlistEntry.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  res.json(entries.map(mapWaitlist));
});

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// USERS вЂ” auth
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
  const { email, password, role } = req.body;
  const user = await prisma.user.findFirst({ where: { email, role, isActive: true } });
  if (!user || !verifyPassword(String(password ?? ''), user.password)) {
    return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
  }

  if (!isPasswordHashed(user.password)) {
    const hashedPassword = hashPassword(String(password ?? ''));
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
    user.password = hashedPassword;
  }
  res.json({ success: true, user: mapUser(user), token: encodeAuthToken(user) });
});

app.get('/api/users', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { role } = req.query;
  const users = await prisma.user.findMany({
    where: role ? { role: String(role), isActive: true } : { isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json(users.map(mapUser));
});

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// Helpers
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

function mapBooking(b)  {
  const { confirmToken: _token, ...safe } = b;
  return { ...safe, createdAt: safe.createdAt?.toISOString() };
}
function mapReview(r)   { return { ...r, createdAt: r.createdAt?.toISOString() }; }
function mapClient(c)   { return { ...c, createdAt: c.createdAt?.toISOString() }; }
function mapWaitlist(w) { return { ...w, createdAt: w.createdAt?.toISOString(), archivedAt: w.archivedAt?.toISOString() ?? null }; }
function mapUser(u)     { const { password: _p, ...safe } = u; return { ...safe, createdAt: safe.createdAt?.toISOString() }; }

function toMinutes(hhmm) {
  const [hh, mm] = String(hhmm).split(':').map(Number);
  return hh * 60 + mm;
}

function toHHmm(minutes) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function parseLocalDateOnly(dateStr) {
  if (typeof dateStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;

  date.setHours(0, 0, 0, 0);
  return date;
}

function parseTimeToMinutes(hhmm) {
  if (typeof hhmm !== 'string') return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getEarliestBookableStartMinutes(dateStr, stepMinutes = 15) {
  const targetDate = parseLocalDateOnly(dateStr);
  if (!targetDate) return null;

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (targetDate.getTime() < today.getTime()) return Number.POSITIVE_INFINITY;
  if (targetDate.getTime() > today.getTime()) return 0;

  const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  return Math.ceil(currentMinutes / stepMinutes) * stepMinutes;
}

function isFutureDateTime(dateStr, timeStr) {
  const date = parseLocalDateOnly(dateStr);
  const minutes = parseTimeToMinutes(timeStr);
  if (!date || minutes === null) return false;

  const dateTime = new Date(date);
  dateTime.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return dateTime.getTime() > Date.now();
}

function getMasterWorkWindow(master, date) {
  if (!master?.workSchedule || typeof master.workSchedule !== 'object') return null;
  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const raw = master.workSchedule[dayOfWeek] ?? master.workSchedule[String(dayOfWeek)];
  if (!raw || !raw.start || !raw.end) return null;
  return [toMinutes(raw.start), toMinutes(raw.end)];
}

function isMasterFree(masterId, start, end, masterById, busyByMaster, date) {
  const master = masterById.get(masterId);
  if (!master) return false;
  const window = getMasterWorkWindow(master, date);
  if (!window) return false;
  if (start < window[0] || end > window[1]) return false;
  const busy = busyByMaster.get(masterId) ?? [];
  return !busy.some(([busyStart, busyEnd]) => start < busyEnd && busyStart < end);
}

function candidatesFor(service, field, fieldCandidates) {
  if (service[field] && service[field] !== '__ANY_MASTER__') return [service[field]];
  return Array.isArray(service[fieldCandidates]) ? service[fieldCandidates] : [];
}

function reserveLocal(localBusyByMaster, masterId, start, end) {
  const current = localBusyByMaster.get(masterId) ?? [];
  current.push([start, end]);
  localBusyByMaster.set(masterId, current);
}

function isMasterFreeWithLocal(masterId, start, end, masterById, busyByMaster, localBusyByMaster, date) {
  if (!isMasterFree(masterId, start, end, masterById, busyByMaster, date)) return false;
  const localBusy = localBusyByMaster.get(masterId) ?? [];
  return !localBusy.some(([busyStart, busyEnd]) => start < busyEnd && busyStart < end);
}

function pickMaster(candidates, start, end, options = {}) {
  const { masterById, busyByMaster, localBusyByMaster, date, exclude = [] } = options;
  for (const masterId of candidates) {
    if (!masterId || exclude.includes(masterId)) continue;
    if (isMasterFreeWithLocal(masterId, start, end, masterById, busyByMaster, localBusyByMaster, date)) {
      return masterId;
    }
  }
  return null;
}

function buildSequentialPlan(services, start, masterById, busyByMaster, date) {
  let cursor = start;
  const localBusyByMaster = new Map();
  const plan = [];

  for (const service of services) {
    const duration = Number(service.durationMinutes) || 0;
    const end = cursor + duration;

    const primaryCandidates = candidatesFor(service, 'primaryMasterId', 'primaryCandidates');
    const primaryMasterId = pickMaster(primaryCandidates, cursor, end, { masterById, busyByMaster, localBusyByMaster, date });
    if (!primaryMasterId) return null;
    reserveLocal(localBusyByMaster, primaryMasterId, cursor, end);

    const secondaryCandidates = candidatesFor(service, 'secondaryMasterId', 'secondaryCandidates');
    let secondaryMasterId = null;
    if (secondaryCandidates.length > 0) {
      secondaryMasterId = pickMaster(secondaryCandidates, cursor, end, {
        masterById,
        busyByMaster,
        localBusyByMaster,
        date,
        exclude: [primaryMasterId],
      });
      if (!secondaryMasterId) return null;
      reserveLocal(localBusyByMaster, secondaryMasterId, cursor, end);
    }

    plan.push({
      serviceId: service.serviceName ?? service.serviceId,
      start: toHHmm(cursor),
      end: toHHmm(end),
      primaryMasterId,
      primaryMasterName: masterById.get(primaryMasterId)?.name ?? primaryMasterId,
      secondaryMasterId,
      secondaryMasterName: secondaryMasterId ? (masterById.get(secondaryMasterId)?.name ?? secondaryMasterId) : null,
    });
    cursor = end;
  }
  return plan;
}

function buildParallelPlan(services, start, masterById, busyByMaster, date) {
  const localBusyByMaster = new Map();
  const plan = [];

  for (const service of services) {
    const duration = Number(service.durationMinutes) || 0;
    const end = start + duration;

    const primaryCandidates = candidatesFor(service, 'primaryMasterId', 'primaryCandidates');
    const primaryMasterId = pickMaster(primaryCandidates, start, end, { masterById, busyByMaster, localBusyByMaster, date });
    if (!primaryMasterId) return null;
    reserveLocal(localBusyByMaster, primaryMasterId, start, end);

    const secondaryCandidates = candidatesFor(service, 'secondaryMasterId', 'secondaryCandidates');
    let secondaryMasterId = null;
    if (secondaryCandidates.length > 0) {
      secondaryMasterId = pickMaster(secondaryCandidates, start, end, {
        masterById,
        busyByMaster,
        localBusyByMaster,
        date,
        exclude: [primaryMasterId],
      });
      if (!secondaryMasterId) return null;
      reserveLocal(localBusyByMaster, secondaryMasterId, start, end);
    }

    plan.push({
      serviceId: service.serviceName ?? service.serviceId,
      start: toHHmm(start),
      end: toHHmm(end),
      primaryMasterId,
      primaryMasterName: masterById.get(primaryMasterId)?.name ?? primaryMasterId,
      secondaryMasterId,
      secondaryMasterName: secondaryMasterId ? (masterById.get(secondaryMasterId)?.name ?? secondaryMasterId) : null,
    });
  }
  return plan;
}

function inferBookingDurationMinutes(booking, durationByServiceName) {
  const names = String(booking.serviceId || '')
    .split(',')
    .map(name => name.trim())
    .filter(Boolean);
  const durations = names
    .map(name => durationByServiceName.get(name))
    .filter(Number.isFinite);
  if (durations.length === 0) return 60;
  const isParallel = /параллел|4 руки|в 4 руки/i.test(String(booking.notes || ''));
  return isParallel ? Math.max(...durations) : durations.reduce((sum, duration) => sum + duration, 0);
}

function bookingHasConflict(existingBookings, options) {
  const { requestedStart, requestedEnd, durationByServiceName } = options;
  return existingBookings.some((booking) => {
    const bookedStart = toMinutes(booking.time);
    const bookedDuration = inferBookingDurationMinutes(booking, durationByServiceName);
    const bookedEnd = bookedStart + bookedDuration;
    return requestedStart < bookedEnd && bookedStart < requestedEnd;
  });
}

async function acquireBookingSlotLock(tx, masterId, date) {
  const lockKey = `booking:${masterId}:${date}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
}

const MASTER_ALLOWED_FIELDS = [
  'name',
  'role',
  'rating',
  'imageUrl',
  'bio',
  'experience',
  'languages',
  'specialization',
  'level',
  'priceMultiplier',
  'workSchedule',
  'isActive',
];

function pickMasterData(rawInput) {
  const input = rawInput ?? {};
  const data = {};
  for (const field of MASTER_ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field) && input[field] !== undefined) {
      data[field] = input[field];
    }
  }
  return data;
}

function defaultMasterWorkSchedule() {
  return {
    1: { start: '10:00', end: '20:00' },
    2: { start: '10:00', end: '20:00' },
    3: { start: '10:00', end: '20:00' },
    4: { start: '10:00', end: '20:00' },
    5: { start: '10:00', end: '20:00' },
    6: { start: '11:00', end: '18:00' },
    0: null,
  };
}

function parseFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeWorkSchedule(workSchedule) {
  if (!workSchedule || typeof workSchedule !== 'object') return defaultMasterWorkSchedule();

  const normalized = {};
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    const slot = workSchedule[day] ?? workSchedule[String(day)];
    if (!slot || typeof slot !== 'object' || !slot.start || !slot.end) {
      normalized[day] = null;
      continue;
    }
    const start = String(slot.start).trim().slice(0, 5);
    const end = String(slot.end).trim().slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end) {
      return null;
    }
    normalized[day] = { start, end };
  }
  return normalized;
}

function normalizeAndValidateMasterData(data, { forCreate }) {
  if (Object.prototype.hasOwnProperty.call(data, 'name')) {
    data.name = String(data.name ?? '').trim().slice(0, 120);
    if (!data.name) return 'Укажите имя мастера';
  } else if (forCreate) {
    return 'Укажите имя мастера';
  }

  if (Object.prototype.hasOwnProperty.call(data, 'role')) {
    data.role = String(data.role ?? '').trim().slice(0, 100);
    if (!data.role) return 'Укажите роль мастера';
  } else if (forCreate) {
    return 'Укажите роль мастера';
  }

  if (Object.prototype.hasOwnProperty.call(data, 'imageUrl')) {
    data.imageUrl = String(data.imageUrl ?? '').trim().slice(0, 2_000_000);
    if (!data.imageUrl) return 'Укажите фото мастера';
  } else if (forCreate) {
    return 'Укажите фото мастера';
  }

  if (Object.prototype.hasOwnProperty.call(data, 'rating')) {
    const parsedRating = parseFiniteNumber(data.rating);
    if (parsedRating === null || parsedRating < 0 || parsedRating > 5) return 'Рейтинг должен быть в диапазоне 0..5';
    data.rating = parsedRating;
  } else if (forCreate) {
    data.rating = 5;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'priceMultiplier')) {
    const parsedMultiplier = parseFiniteNumber(data.priceMultiplier);
    if (parsedMultiplier === null || parsedMultiplier <= 0 || parsedMultiplier > 3) return 'Множитель цены должен быть в диапазоне 0.1..3';
    data.priceMultiplier = parsedMultiplier;
  } else if (forCreate) {
    data.priceMultiplier = 1;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'level')) {
    if (!['JUNIOR', 'SENIOR', 'TOP'].includes(data.level)) return 'Некорректный уровень мастера';
  } else if (forCreate) {
    data.level = 'JUNIOR';
  }

  if (Object.prototype.hasOwnProperty.call(data, 'specialization')) {
    if (!Array.isArray(data.specialization)) return 'Специализация должна быть массивом';
    const normalizedSpecialization = [...new Set(
      data.specialization
        .map((value) => String(value).trim())
        .filter((value) => ['MEN', 'WOMEN'].includes(value))
    )];
    if (normalizedSpecialization.length === 0) return 'Выберите хотя бы одну специализацию';
    data.specialization = normalizedSpecialization;
  } else if (forCreate) {
    data.specialization = ['MEN'];
  }

  if (Object.prototype.hasOwnProperty.call(data, 'isActive')) {
    data.isActive = Boolean(data.isActive);
  } else if (forCreate) {
    data.isActive = true;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'bio')) {
    data.bio = normalizeOptionalString(data.bio, 1000);
  } else if (forCreate) {
    data.bio = null;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'experience')) {
    data.experience = normalizeOptionalString(data.experience, 100);
  } else if (forCreate) {
    data.experience = null;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'languages')) {
    data.languages = normalizeOptionalString(data.languages, 150);
  } else if (forCreate) {
    data.languages = null;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'workSchedule')) {
    const normalizedSchedule = normalizeWorkSchedule(data.workSchedule);
    if (!normalizedSchedule) return 'Некорректный формат графика работы';
    data.workSchedule = normalizedSchedule;
  } else if (forCreate) {
    data.workSchedule = defaultMasterWorkSchedule();
  }

  return null;
}

function normalizeMasterUserPayload(rawUser, options = {}) {
  const { forCreate = false, required = false, fallbackName = '', fallbackIsActive = true } = options;
  if (rawUser === undefined || rawUser === null) {
    if (required) return { error: 'Для мастера требуется создать аккаунт входа' };
    return { data: null };
  }
  if (typeof rawUser !== 'object') {
    return { error: 'Некорректный формат данных аккаунта мастера' };
  }

  const normalized = {};
  const email = String(rawUser.email ?? '').trim().toLowerCase();
  const phone = normalizeOptionalString(rawUser.phone, 40);
  const passwordRaw = rawUser.password === undefined || rawUser.password === null ? '' : String(rawUser.password).trim();
  const name = String(rawUser.name ?? fallbackName ?? '').trim();
  const isActive = typeof rawUser.isActive === 'boolean' ? rawUser.isActive : Boolean(fallbackIsActive);
  const userId = rawUser.id ? String(rawUser.id).trim() : '';

  if (userId) normalized.id = userId;
  if (!email) return { error: 'Укажите email для аккаунта мастера' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Некорректный email аккаунта мастера' };

  normalized.email = email;
  normalized.phone = phone;
  normalized.name = name || fallbackName || email;
  normalized.role = 'MASTER';
  normalized.isActive = isActive;

  if (forCreate || !userId) {
    if (!passwordRaw) return { error: 'Укажите пароль для аккаунта мастера' };
    if (passwordRaw.length < MIN_MASTER_PASSWORD_LENGTH) {
      return { error: `Пароль аккаунта мастера должен содержать минимум ${MIN_MASTER_PASSWORD_LENGTH} символов` };
    }
    normalized.password = hashPassword(passwordRaw);
  } else if (passwordRaw) {
    if (passwordRaw.length < MIN_MASTER_PASSWORD_LENGTH) {
      return { error: `Пароль аккаунта мастера должен содержать минимум ${MIN_MASTER_PASSWORD_LENGTH} символов` };
    }
    normalized.password = hashPassword(passwordRaw);
  }

  return { data: normalized };
}

function normalizeOptionalString(value, maxLength) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeIsoDateOnly(value) {
  const normalized = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function getTodayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getRelevantWaitlistDates(entry, todayIso = getTodayIsoDate()) {
  return Array.isArray(entry?.preferredDates)
    ? entry.preferredDates
        .map(normalizeIsoDateOnly)
        .filter((date) => date && date >= todayIso)
    : [];
}

function isWaitlistEntryExpired(entry, todayIso = getTodayIsoDate()) {
  return getRelevantWaitlistDates(entry, todayIso).length === 0;
}

async function archiveExpiredWaitlistEntries() {
  const todayIso = getTodayIsoDate();
  const entries = await prisma.waitlistEntry.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  const expiredIds = entries
    .filter((entry) => isWaitlistEntryExpired(entry, todayIso))
    .map((entry) => entry.id);

  if (expiredIds.length === 0) {
    return { archivedCount: 0, todayIso };
  }

  await prisma.waitlistEntry.updateMany({
    where: { id: { in: expiredIds } },
    data: { archivedAt: new Date() },
  });

  return { archivedCount: expiredIds.length, todayIso };
}

function appendSystemNote(existingNotes, systemNote) {
  const current = normalizeOptionalString(existingNotes, 4000);
  if (!current) return systemNote;
  if (current.includes(systemNote)) return current;
  return `${current}\n[system] ${systemNote}`.slice(0, 4000);
}

function getClientIdentity(bookingOrClient) {
  const name = normalizeClientName(bookingOrClient?.clientName ?? bookingOrClient?.name ?? '');
  const phone = normalizeClientPhone(bookingOrClient?.clientPhone ?? bookingOrClient?.phone ?? '');
  const email = normalizeClientEmail(bookingOrClient?.clientEmail ?? bookingOrClient?.email ?? '');

  if (!name || !phone) return null;

  return {
    name,
    phone,
    email,
    key: `${name.toLowerCase()}|${phone}|${email ?? ''}`,
  };
}

function compareBookingDatesDesc(a, b) {
  const left = `${a.date || ''}T${a.time || '00:00'}`;
  const right = `${b.date || ''}T${b.time || '00:00'}`;
  return right.localeCompare(left);
}

function compareDateStringsDesc(a, b) {
  return String(b || '').localeCompare(String(a || ''));
}

function bookingMatchesClient(client, booking) {
  const clientIdentity = getClientIdentity(client);
  const bookingIdentity = getClientIdentity(booking);
  if (!clientIdentity || !bookingIdentity) return false;
  return clientIdentity.key === bookingIdentity.key;
}

function buildClientStatsFromBookings(bookings, existingClient) {
  const sortedBookings = [...bookings].sort(compareBookingDatesDesc);
  const completedBookings = sortedBookings.filter((booking) => booking.status === 'COMPLETED');
  const lastVisitBooking = sortedBookings.find((booking) => booking.status !== 'PENDING_EMAIL');
  const identity = getClientIdentity(sortedBookings[0]);

  return {
    name: identity?.name ?? existingClient?.name ?? 'Клиент',
    phone: identity?.phone ?? existingClient?.phone ?? '',
    email: identity?.email ?? existingClient?.email ?? null,
    notes: existingClient?.notes ?? null,
    totalVisits: sortedBookings.length,
    totalSpent: completedBookings.reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0),
    lastVisit: lastVisitBooking?.date ?? existingClient?.lastVisit ?? null,
  };
}

async function syncClientsFromBookings(prismaClient = prisma) {
  const [clients, bookings] = await Promise.all([
    prismaClient.client.findMany({ orderBy: { createdAt: 'asc' } }),
    prismaClient.booking.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);

  const existingClientByKey = new Map();
  const existingClientByPhone = new Map();
  for (const client of clients) {
    const identity = getClientIdentity(client);
    if (identity) {
      existingClientByKey.set(identity.key, client);
      existingClientByPhone.set(identity.phone, client);
    }
  }

  const groupedBookings = new Map();
  for (const booking of bookings) {
    const identity = getClientIdentity(booking);
    if (!identity) continue;
    const bucket = groupedBookings.get(identity.key) ?? [];
    bucket.push(booking);
    groupedBookings.set(identity.key, bucket);
  }

  for (const [key, clientBookings] of groupedBookings.entries()) {
    const identity = getClientIdentity(clientBookings[0]);
    const existingClient = existingClientByKey.get(key)
      ?? (identity?.phone ? existingClientByPhone.get(identity.phone) : null)
      ?? null;
    const nextData = buildClientStatsFromBookings(clientBookings, existingClient);

    if (existingClient) {
      const updatedClient = await prismaClient.client.update({
        where: { id: existingClient.id },
        data: nextData,
      });
      const updatedIdentity = getClientIdentity(updatedClient);
      if (updatedIdentity) {
        existingClientByKey.set(updatedIdentity.key, updatedClient);
        existingClientByPhone.set(updatedIdentity.phone, updatedClient);
      }
      continue;
    }

    const createdClient = await prismaClient.client.create({ data: nextData });
    existingClientByKey.set(key, createdClient);
    if (identity?.phone) {
      existingClientByPhone.set(identity.phone, createdClient);
    }
  }
}

// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// Start
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

// ── Auto-expire unconfirmed PENDING_EMAIL bookings older than 24h ──────────────
const EXPIRE_INTERVAL_MS = 15 * 60 * 1000; // check every 15 minutes
setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expired = await prisma.booking.updateMany({
      where: {
        status: 'PENDING_EMAIL',
        createdAt: { lt: cutoff },
      },
      data: { status: 'CANCELLED' },
    });
    if (expired.count > 0) {
      await syncClientsFromBookings();
      console.log(`♻ Auto-cancelled ${expired.count} unconfirmed PENDING_EMAIL booking(s)`);
    }
  } catch (err) {
    console.error('♻ PENDING_EMAIL auto-expire error:', err.message);
  }
}, EXPIRE_INTERVAL_MS);

const WAITLIST_ARCHIVE_INTERVAL_MS = 60 * 60 * 1000; // check every hour
setInterval(async () => {
  try {
    const result = await archiveExpiredWaitlistEntries();
    if (result.archivedCount > 0) {
      console.log(`Archive waitlist -> ${result.archivedCount} expired entr${result.archivedCount === 1 ? 'y' : 'ies'}`);
    }
  } catch (err) {
    console.error('Waitlist archive error:', err.message);
  }
}, WAITLIST_ARCHIVE_INTERVAL_MS);

app.listen(PORT, HOST, async () => {
  await prisma.$connect();
  try {
    const result = await archiveExpiredWaitlistEntries();
    if (result.archivedCount > 0) {
      console.log(`Archive waitlist on startup -> ${result.archivedCount}`);
    }
  } catch (error) {
    console.error('Waitlist startup archive error:', error.message);
  }
  console.log(`\nKelvisi API -> http://${HOST}:${PORT} (PostgreSQL via Prisma)`);
  console.log(`Public app URL -> ${APP_PUBLIC_URL}`);
  console.log(`CORS origins -> ${CORS_ORIGINS.join(', ')}`);
  console.log(`   GET/POST/PUT/DELETE /api/services`);
  console.log(`   GET/POST/PUT/DELETE /api/masters`);
  console.log(`   GET/POST/PUT        /api/bookings`);
  console.log(`   POST                /api/booking-slots`);
  console.log(`   GET                 /api/confirm-booking`);
  console.log(`   GET/PUT             /api/reviews`);
  console.log(`   GET                 /api/clients  /api/waitlist  /api/users`);
  console.log(`   POST                /api/auth/login\n`);
});
