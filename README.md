# KELVISI

KELVISI - дипломный full-stack проект для управления премиальным салоном красоты. В одном приложении собраны публичная онлайн-запись, email-подтверждение заявок, кабинет мастера и административная CRM-панель.

Подробная документация для диплома сохранена отдельно: [docs/DIPLOMA.md](docs/DIPLOMA.md).

## Возможности

- Многошаговая онлайн-запись для клиентов
- Выбор услуг, мастера, даты и времени
- Подтверждение записи через email-ссылку
- Кабинет мастера с расписанием, статусами записей и редактированием профиля
- Админ-панель для записей, услуг, мастеров, отзывов, клиентов, пользователей и листа ожидания
- Ролевая авторизация для `ADMIN` и `MASTER`
- Prisma-модель данных, миграции PostgreSQL и seed-данные
- Docker Compose для production-style запуска

## Стек

- Frontend: React 19, TypeScript, Vite, React Router, Tailwind CSS
- Backend: Node.js, Express, Prisma ORM
- Database: PostgreSQL
- Email: Nodemailer SMTP
- UI: lucide-react, Recharts
- Deployment: Docker, Docker Compose, nginx

## Структура проекта

```text
.
├── App.tsx                 # Роутинг и общая оркестрация данных
├── views/                  # Основные экраны: клиент, мастер, админ
├── components/             # Общие UI-компоненты
├── server/server.mjs       # Express API
├── prisma/                 # Prisma-схема, миграции и seed
├── public/                 # Static assets
├── scripts/legacy/         # Исторические вспомогательные скрипты
├── docs/DIPLOMA.md         # Полная документация для диплома
├── docs/legacy/            # Старые диагностические артефакты
├── DEPLOY.md               # Инструкция по деплою
└── docker-compose.yml      # Docker Compose для локального/серверного запуска
```

## Быстрый запуск

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить окружение

```bash
cp .env.example .env
```

При необходимости измените `DATABASE_URL`, `AUTH_SECRET` и SMTP-настройки.

### 3. Подготовить базу данных

Убедитесь, что PostgreSQL запущен, затем примените миграции и заполните базу демо-данными:

```bash
npm run db:migrate
npm run db:seed
```

### 4. Запустить приложение

Запустите API-сервер:

```bash
npm run server
```

В другом терминале запустите frontend:

```bash
npm run dev
```

Локальные адреса по умолчанию:

- Frontend: `http://localhost:4000`
- API: `http://localhost:3001`
- Клиентская зона: `/`
- Кабинет мастера: `/barber`
- Админ-панель: `/admin`

## Демо-аккаунты

Доступны после выполнения seed-скрипта:

| Роль | Email | Пароль |
| --- | --- | --- |
| Администратор | `admin@salon.ru` | `admin123` |
| Мастер | `aleksandr@salon.ru` | `pass123` |
| Мастер | `elena@salon.ru` | `pass123` |
| Клиент | `client@email.com` | `client123` |

## Скрипты

```bash
npm run dev          # Запуск Vite frontend
npm run server       # Запуск Express API
npm run build        # Сборка frontend
npm run preview      # Предпросмотр production-сборки
npm run db:migrate   # Prisma-миграции в development
npm run db:seed      # Заполнение базы демо-данными
npm run db:studio    # Prisma Studio
npm run db:generate  # Генерация Prisma Client
```

## Docker

Production-style запуск:

```bash
cp .env.example .env
docker compose up -d --build
```

Подробная инструкция по деплою: [DEPLOY.md](DEPLOY.md).

## Документация

- [Полная дипломная документация](docs/DIPLOMA.md)
- [Инструкция по деплою](DEPLOY.md)

## Примечание

Репозиторий предназначен для дипломного проекта. Демо-аккаунты и seed-данные добавлены для презентации и тестирования; перед реальным развертыванием нужно заменить секреты и SMTP-настройки.
