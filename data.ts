import { Master, Review, Service, ServiceCategory, Client, WaitlistEntry, User } from "./types";

// USERS DATABASE
export const USERS: User[] = [
  {
    id: 'u1',
    email: 'aleksandr@salon.ru',
    name: 'Александр Громов',
    role: 'MASTER',
    phone: '+7 900 111 22 33',
    isActive: true,
    createdAt: '2026-01-10'
  },
  {
    id: 'u2',
    email: 'elena@salon.ru',
    name: 'Елена Вишневская',
    role: 'MASTER',
    phone: '+7 900 222 33 44',
    isActive: true,
    createdAt: '2026-01-10'
  },
  {
    id: 'u3',
    email: 'dmitry@salon.ru',
    name: 'Дмитрий Волков',
    role: 'MASTER',
    phone: '+7 900 333 44 55',
    isActive: true,
    createdAt: '2026-01-10'
  },
  {
    id: 'u4',
    email: 'anna@salon.ru',
    name: 'Анна Соколова',
    role: 'MASTER',
    phone: '+7 900 444 55 66',
    isActive: true,
    createdAt: '2026-01-10'
  },
  {
    id: 'u5',
    email: 'maria@salon.ru',
    name: 'Мария Козлова',
    role: 'MASTER',
    phone: '+7 900 555 66 77',
    isActive: true,
    createdAt: '2026-01-10'
  },
  {
    id: 'u6',
    email: 'artem@salon.ru',
    name: 'Артем Новиков',
    role: 'MASTER',
    phone: '+7 900 666 77 88',
    isActive: true,
    createdAt: '2026-01-10'
  },
  {
    id: 'u_admin',
    email: 'admin@salon.ru',
    name: 'Администратор салона',
    role: 'ADMIN',
    phone: '+7 900 000 00 00',
    isActive: true,
    createdAt: '2026-01-01'
  },
  {
    id: 'u_client',
    email: 'client@email.com',
    name: 'Клиент Тестовый',
    role: 'CLIENT',
    phone: '+7 900 999 99 99',
    isActive: true,
    createdAt: '2026-01-15'
  },
];

export const SERVICES: Service[] = [
  // MEN - Standard
  { id: 'm1', name: 'Мужская стрижка', description: 'Мытье, стрижка, укладка', price: 1500, durationMinutes: 45, category: ServiceCategory.MEN, type: 'STANDARD', allowedMasterIds: ['mst1', 'mst3', 'mst6'], isActive: true },
  { id: 'm2', name: 'Стрижка машинкой', description: 'Один-два насадки, окантовка', price: 1000, durationMinutes: 30, category: ServiceCategory.MEN, type: 'STANDARD', allowedMasterIds: ['mst1', 'mst3', 'mst6'], isActive: true },
  { id: 'm3', name: 'Оформление бороды', description: 'Моделирование формы', price: 1200, durationMinutes: 30, category: ServiceCategory.MEN, type: 'STANDARD', allowedMasterIds: ['mst1', 'mst3', 'mst6'], isActive: true },
  { id: 'm4', name: 'Классическое бритье', description: 'Опасной бритвой, с распариванием', price: 1800, durationMinutes: 45, category: ServiceCategory.MEN, type: 'STANDARD', allowedMasterIds: ['mst1', 'mst3'], isActive: true },
  { id: 'm5', name: 'Камуфляж седины', description: 'Мягкое тонирование головы или бороды', price: 1500, durationMinutes: 30, category: ServiceCategory.MEN, type: 'STANDARD', allowedMasterIds: ['mst1', 'mst3', 'mst6'], isActive: true },
  // MEN - VIP
  { id: 'm6', name: 'Комплекс "Total Look"', description: 'Стрижка + Борода + Воск + Патчи', price: 4500, durationMinutes: 90, category: ServiceCategory.MEN, type: 'VIP', allowedMasterIds: ['mst1', 'mst3'], isActive: true },
  { id: 'm7', name: 'SPA-уход за кожей головы', description: 'Пилинг, массаж, ампула против выпадения', price: 3000, durationMinutes: 60, category: ServiceCategory.MEN, type: 'VIP', allowedMasterIds: ['mst1', 'mst3'], isActive: true },
  { id: 'm8', name: 'Мужской маникюр "Бизнес"', description: 'Обработка, матовое покрытие, увлажнение', price: 2500, durationMinutes: 60, category: ServiceCategory.MEN, type: 'VIP', allowedMasterIds: ['mst7'], isActive: true },
  { id: 'm9', name: 'Детокс-уход за лицом', description: 'Очищение, черная маска, увлажнение', price: 2000, durationMinutes: 40, category: ServiceCategory.MEN, type: 'VIP', allowedMasterIds: ['mst8'], isActive: true },

  // WOMEN - Standard
  { id: 'w1', name: 'Женская стрижка с укладкой', description: 'Мытье, форма, сушка', price: 2500, durationMinutes: 60, category: ServiceCategory.WOMEN, type: 'STANDARD', allowedMasterIds: ['mst2', 'mst4', 'mst5'], isActive: true },
  { id: 'w2', name: 'Окрашивание в один тон', description: 'Корни или вся длина', price: 4000, durationMinutes: 120, category: ServiceCategory.WOMEN, type: 'STANDARD', allowedMasterIds: ['mst2', 'mst4', 'mst5'], isActive: true },
  { id: 'w3', name: 'Сложное окрашивание', description: 'AirTouch, Шатуш, Балаяж', price: 8000, durationMinutes: 240, category: ServiceCategory.WOMEN, type: 'STANDARD', allowedMasterIds: ['mst2', 'mst4'], isActive: true },
  { id: 'w4', name: 'Маникюр с покрытием', description: 'Классика или аппаратный', price: 2000, durationMinutes: 90, category: ServiceCategory.WOMEN, type: 'STANDARD', allowedMasterIds: ['mst7'], isActive: true },
  { id: 'w5', name: 'Укладка / Локоны', description: 'Дневная или вечерняя', price: 2500, durationMinutes: 45, category: ServiceCategory.WOMEN, type: 'STANDARD', allowedMasterIds: ['mst2', 'mst4', 'mst5'], isActive: true },
  // WOMEN - VIP
  { id: 'w6', name: 'Услуга в 4 руки', description: 'Окрашивание + Маникюр одновременно', price: 12000, durationMinutes: 120, category: ServiceCategory.WOMEN, type: 'VIP', allowedMasterIds: ['mst2', 'mst4', 'mst5'], secondaryMasterIds: ['mst7'], isActive: true },
  { id: 'w7', name: 'Интеллектуальная реконструкция', description: 'Tokio Inkarami или «Счастье для волос»', price: 6000, durationMinutes: 90, category: ServiceCategory.WOMEN, type: 'VIP', allowedMasterIds: ['mst2', 'mst4'], isActive: true },
  { id: 'w8', name: 'Образ "Red Carpet"', description: 'Макияж + Вечерняя прическа', price: 7000, durationMinutes: 120, category: ServiceCategory.WOMEN, type: 'VIP', allowedMasterIds: ['mst2', 'mst4'], secondaryMasterIds: ['mst8'], isActive: true },
  { id: 'w9', name: 'Диагностика кожи головы', description: 'Трихологический уход: очищение для объема и роста', price: 3500, durationMinutes: 60, category: ServiceCategory.WOMEN, type: 'VIP', allowedMasterIds: ['mst2'], isActive: true },
];

export const MASTERS: Master[] = [
  {
    id: 'mst2',
    name: '\u0415\u043b\u0435\u043d\u0430 \u0412\u0438\u0448\u043d\u0435\u0432\u0441\u043a\u0430\u044f',
    role: 'ART DIRECTOR',
    rating: 5.0,
    specialization: [ServiceCategory.WOMEN],
    imageUrl: '/masters/elena-vishnevskaya.webp',
    level: 'TOP',
    priceMultiplier: 1.5,
    isActive: true,
    workSchedule: {
      1: { start: '10:00', end: '20:00' },
      2: { start: '10:00', end: '20:00' },
      3: { start: '10:00', end: '20:00' },
      4: { start: '10:00', end: '20:00' },
      5: { start: '10:00', end: '20:00' },
      6: { start: '11:00', end: '18:00' },
      0: null
    }
  },
  {
    id: 'mst1',
    name: '\u0410\u043b\u0435\u043a\u0441\u0430\u043d\u0434\u0440 \u0413\u0440\u043e\u043c\u043e\u0432',
    role: 'TOP BARBER',
    rating: 5.0,
    specialization: [ServiceCategory.MEN],
    imageUrl: '/masters/aleksandr-gromov.jpg',
    level: 'TOP',
    priceMultiplier: 1.5,
    isActive: true,
    workSchedule: {
      1: { start: '10:00', end: '20:00' },
      2: { start: '10:00', end: '20:00' },
      3: { start: '10:00', end: '20:00' },
      4: { start: '10:00', end: '20:00' },
      5: { start: '10:00', end: '20:00' },
      6: { start: '11:00', end: '18:00' },
      0: null
    }
  },
  {
    id: 'mst7',
    name: '\u0421\u043e\u0444\u0438\u044f \u0420\u043e\u043c\u0430\u043d\u043e\u0432\u0430',
    role: 'TOP NAIL ARTIST',
    rating: 4.9,
    specialization: [ServiceCategory.WOMEN],
    imageUrl: '/masters/sofiya-romanova.jpg',
    level: 'TOP',
    priceMultiplier: 1.5,
    isActive: true,
    workSchedule: {
      1: { start: '10:00', end: '20:00' },
      2: { start: '10:00', end: '20:00' },
      3: { start: '10:00', end: '20:00' },
      4: { start: '10:00', end: '20:00' },
      5: { start: '10:00', end: '20:00' },
      6: { start: '11:00', end: '18:00' },
      0: null
    }
  },
  {
    id: 'mst3',
    name: '\u0414\u043c\u0438\u0442\u0440\u0438\u0439 \u0412\u043e\u043b\u043a\u043e\u0432',
    role: 'SENIOR BARBER',
    rating: 5.0,
    specialization: [ServiceCategory.MEN],
    imageUrl: '/masters/dmitry-volkov.jpg',
    level: 'SENIOR',
    priceMultiplier: 1.2,
    isActive: true,
    workSchedule: {
      1: { start: '10:00', end: '20:00' },
      2: { start: '10:00', end: '20:00' },
      3: null,
      4: { start: '10:00', end: '20:00' },
      5: { start: '10:00', end: '20:00' },
      6: { start: '11:00', end: '18:00' },
      0: null
    }
  },
  {
    id: 'mst8',
    name: '\u041a\u0441\u0435\u043d\u0438\u044f \u041c\u0438\u0440\u043e\u043d\u043e\u0432\u0430',
    role: 'MAKEUP ARTIST',
    rating: 5.0,
    specialization: [ServiceCategory.WOMEN],
    imageUrl: '/masters/ksenia-mironova.jpg',
    level: 'SENIOR',
    priceMultiplier: 1.2,
    isActive: true,
    workSchedule: {
      1: { start: '10:00', end: '20:00' },
      2: { start: '10:00', end: '20:00' },
      3: { start: '10:00', end: '20:00' },
      4: null,
      5: { start: '10:00', end: '20:00' },
      6: { start: '11:00', end: '18:00' },
      0: null
    }
  },
  {
    id: 'mst4',
    name: '\u0410\u043d\u043d\u0430 \u0421\u043e\u043a\u043e\u043b\u043e\u0432\u0430',
    role: 'STYLIST',
    rating: 5.0,
    specialization: [ServiceCategory.WOMEN],
    imageUrl: '/masters/anna-sokolova.webp',
    level: 'SENIOR',
    priceMultiplier: 1.2,
    isActive: true,
    workSchedule: {
      1: { start: '10:00', end: '20:00' },
      2: { start: '10:00', end: '20:00' },
      3: { start: '10:00', end: '20:00' },
      4: null,
      5: { start: '10:00', end: '20:00' },
      6: { start: '11:00', end: '18:00' },
      0: null
    }
  },
  {
    id: 'mst5',
    name: '\u041c\u0430\u0440\u0438\u044f \u041a\u043e\u0437\u043b\u043e\u0432\u0430',
    role: 'JUNIOR STYLIST',
    rating: 4.9,
    specialization: [ServiceCategory.WOMEN],
    imageUrl: '/masters/maria-kozlova.jpg',
    level: 'JUNIOR',
    priceMultiplier: 1.0,
    isActive: true,
    workSchedule: {
      1: { start: '10:00', end: '20:00' },
      2: { start: '10:00', end: '20:00' },
      3: { start: '10:00', end: '20:00' },
      4: { start: '10:00', end: '20:00' },
      5: { start: '10:00', end: '20:00' },
      6: null,
      0: null
    }
  },
  {
    id: 'mst6',
    name: '\u0410\u0440\u0442\u0435\u043c \u041d\u043e\u0432\u0438\u043a\u043e\u0432',
    role: 'JUNIOR BARBER',
    rating: 4.9,
    specialization: [ServiceCategory.MEN],
    imageUrl: '/masters/artem-novikov.jpg',
    level: 'JUNIOR',
    priceMultiplier: 1.0,
    isActive: true,
    workSchedule: {
      1: { start: '12:00', end: '20:00' },
      2: { start: '12:00', end: '20:00' },
      3: { start: '12:00', end: '20:00' },
      4: { start: '12:00', end: '20:00' },
      5: { start: '12:00', end: '20:00' },
      6: { start: '11:00', end: '18:00' },
      0: null
    }
  },
];

export const REVIEWS: Review[] = [
  { id: 'r1', clientName: 'Максим А.', text: 'Сервис на высшем уровне. Total Look полностью оправдал ожидания. Мастер Александр - настоящий профессионал!', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg', status: 'APPROVED', createdAt: '2026-02-10' },
  { id: 'r2', clientName: 'Виктория С.', text: 'Услуга в 4 руки спасла мой вечер! Успела на мероприятие. Прическа держится идеально уже неделю.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/44.jpg', status: 'APPROVED', createdAt: '2026-02-09' },
  { id: 'r3', clientName: 'Игорь К.', text: 'Отличная атмосфера, вкусный кофе и профессиональные мастера. Стал постоянным клиентом.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/52.jpg', status: 'APPROVED', createdAt: '2026-02-08' },
  { id: 'r4', clientName: 'Елена П.', text: 'Сложное окрашивание сделали идеально. Волосы живые и блестящие. Цвет держится отлично!', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/68.jpg', status: 'APPROVED', createdAt: '2026-02-07' },
  { id: 'r5', clientName: 'Андрей М.', text: 'Классическое бритье - это отдельный вид искусства. Рекомендую! Впервые испытал такой сервис.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/22.jpg', status: 'APPROVED', createdAt: '2026-02-06' },
  { id: 'r6', clientName: 'Настя В.', text: 'Маникюр с покрытием держится неделями! Девушки чувствуют руку. Советую всем подругам.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/25.jpg', status: 'APPROVED', createdAt: '2026-02-05' },
  { id: 'r7', clientName: 'Сергей П.', text: 'Мужская стрижка + оформление бороды. Вышел как с журнала моды. Отличный результат!', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/36.jpg', status: 'APPROVED', createdAt: '2026-02-04' },
  { id: 'r8', clientName: 'Ирина С.', text: 'SPA-уход за кожей головы - просто волшебство! Волосы стали здоровыми и блестящими.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/50.jpg', status: 'APPROVED', createdAt: '2026-02-03' },
  { id: 'r9', clientName: 'Дмитрий Х.', text: 'Комплекс Total Look - лучшая вещь в моей жизни! Почувствовал себя королем.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/54.jpg', status: 'APPROVED', createdAt: '2026-02-02' },
  { id: 'r10', clientName: 'Мария К.', text: 'Интеллектуальная реконструкция волос реально работает! Волосы ожили, спасибо мастерам.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/62.jpg', status: 'APPROVED', createdAt: '2026-02-01' },
  { id: 'r11', clientName: 'Кристина Л.', text: 'Записали без ожидания, мастер сразу понял, какой результат мне нужен.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/12.jpg', status: 'APPROVED', createdAt: '2026-01-31' },
  { id: 'r12', clientName: 'Павел Н.', text: 'Борода и стрижка выглядят аккуратно уже вторую неделю. Отличная работа.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/28.jpg', status: 'APPROVED', createdAt: '2026-01-30' },
  { id: 'r13', clientName: 'Ольга Р.', text: 'Сложное окрашивание сделали чисто, цвет получился ровный и дорогой.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/33.jpg', status: 'APPROVED', createdAt: '2026-01-29' },
  { id: 'r14', clientName: 'Никита В.', text: 'Приятная атмосфера и высокий уровень сервиса от входа до финальной укладки.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/46.jpg', status: 'APPROVED', createdAt: '2026-01-28' },
  { id: 'r15', clientName: 'Алина С.', text: 'Маникюр и укладка в четыре руки сэкономили кучу времени перед мероприятием.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/57.jpg', status: 'APPROVED', createdAt: '2026-01-27' },
  { id: 'r16', clientName: 'Владимир Т.', text: 'Очень точная работа с формой стрижки. Получилось даже лучше, чем ожидал.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/63.jpg', status: 'APPROVED', createdAt: '2026-01-26' },
  { id: 'r17', clientName: 'Дарья М.', text: 'Волосы после ухода стали мягче и плотнее. Результат заметен сразу.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/65.jpg', status: 'APPROVED', createdAt: '2026-01-25' },
  { id: 'r18', clientName: 'Илья П.', text: 'Четко по времени, быстро и без суеты. Буду записываться снова.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/72.jpg', status: 'APPROVED', createdAt: '2026-01-24' },
  { id: 'r19', clientName: 'Юлия К.', text: 'Идеальный тон и блеск волос, плюс очень деликатное отношение мастера.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/74.jpg', status: 'APPROVED', createdAt: '2026-01-23' },
  { id: 'r20', clientName: 'Роман Д.', text: 'Премиальный подход: комфортно, спокойно и очень качественный итог.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/81.jpg', status: 'APPROVED', createdAt: '2026-01-22' },
];

export const CLIENTS: Client[] = [
  { id: 'c1', name: 'Дмитрий Иванов', phone: '+7 900 123 45 67', email: 'dmitry@email.com', notes: 'Любит кофе с корицей', totalVisits: 12, totalSpent: 45000, lastVisit: '2026-02-10', createdAt: '2026-01-15' },
  { id: 'c2', name: 'Анна Петрова', phone: '+7 900 987 65 43', email: 'anna@email.com', totalVisits: 8, totalSpent: 64000, lastVisit: '2026-02-09', createdAt: '2026-01-20' },
  { id: 'c3', name: 'Максим Сидоров', phone: '+7 900 555 12 34', totalVisits: 5, totalSpent: 22500, lastVisit: '2026-01-15', createdAt: '2026-01-10' },
  { id: 'c4', name: 'Ольга Кузнецова', phone: '+7 900 333 44 55', notes: 'Аллергия на аммиак', totalVisits: 15, totalSpent: 120000, lastVisit: '2026-02-08', createdAt: '2026-01-05' },
];

export const WAITLIST: WaitlistEntry[] = [
  { id: 'wl1', clientName: 'Светлана Р.', clientPhone: '+7 900 111 22 33', masterId: 'mst2', serviceIds: ['w3'], preferredDates: ['2026-02-14', '2026-02-15'], createdAt: '2026-02-10', notified: false },
];

export const TIME_SLOTS = [
  '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];
