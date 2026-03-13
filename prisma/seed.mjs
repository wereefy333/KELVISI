/**
 * Prisma seed script - populate the DB with the initial Kelvisi data.
 * Run: npx prisma db seed
 */

import { randomBytes, scryptSync } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PASSWORD_HASH_PREFIX = 'scrypt';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${PASSWORD_HASH_PREFIX}$${salt}$${derivedKey}`;
}

async function main() {
  console.log('Seeding Kelvisi database...');

  // в”Ђв”Ђ Users в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const usersData = [
    { id: 'u1', email: 'aleksandr@salon.ru', password: hashPassword('pass123'), name: 'Александр Громов', role: 'MASTER', phone: '+7 900 111 22 33', isActive: true },
    { id: 'u2', email: 'elena@salon.ru', password: hashPassword('pass123'), name: 'Елена Вишневская', role: 'MASTER', phone: '+7 900 222 33 44', isActive: true },
    { id: 'u3', email: 'dmitry@salon.ru', password: hashPassword('pass123'), name: 'Дмитрий Волков', role: 'MASTER', phone: '+7 900 333 44 55', isActive: true },
    { id: 'u4', email: 'anna@salon.ru', password: hashPassword('pass123'), name: 'Анна Соколова', role: 'MASTER', phone: '+7 900 444 55 66', isActive: true },
    { id: 'u5', email: 'maria@salon.ru', password: hashPassword('pass123'), name: 'Мария Козлова', role: 'MASTER', phone: '+7 900 555 66 77', isActive: true },
    { id: 'u6', email: 'artem@salon.ru', password: hashPassword('pass123'), name: 'Артем Новиков', role: 'MASTER', phone: '+7 900 666 77 88', isActive: true },
    { id: 'u_admin', email: 'admin@salon.ru', password: hashPassword('admin123'), name: '\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440 \u0441\u0430\u043b\u043e\u043d\u0430', role: 'ADMIN', phone: '+7 900 000 00 00', isActive: true },
    { id: 'u_client', email: 'client@email.com', password: hashPassword('client123'), name: 'Клиент Тестовый', role: 'CLIENT', phone: '+7 900 999 99 99', isActive: true },
  ];

  for (const user of usersData) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: user,
      create: user,
    });
  }

  // в”Ђв”Ђ Services в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  await prisma.service.createMany({
    skipDuplicates: true,
    data: [
      // MEN вЂ” STANDARD
      { id: 'm1', name: 'Мужская стрижка',         description: 'Мытье, стрижка, укладка',                         price: 1500, durationMinutes: 45,  category: 'MEN',   type: 'STANDARD' },
      { id: 'm2', name: 'Стрижка машинкой',         description: 'Один-два насадки, окантовка',                      price: 1000, durationMinutes: 30,  category: 'MEN',   type: 'STANDARD' },
      { id: 'm3', name: 'Оформление бороды',        description: 'Моделирование формы',                              price: 1200, durationMinutes: 30,  category: 'MEN',   type: 'STANDARD' },
      { id: 'm4', name: 'Классическое бритье',      description: 'Опасной бритвой, с распариванием',                 price: 1800, durationMinutes: 45,  category: 'MEN',   type: 'STANDARD' },
      { id: 'm5', name: 'Камуфляж седины',          description: 'Мягкое тонирование головы или бороды',             price: 1500, durationMinutes: 30,  category: 'MEN',   type: 'STANDARD' },
      // MEN вЂ” VIP
      { id: 'm6', name: 'Комплекс "Total Look"',    description: 'Стрижка + Борода + Воск + Патчи',                 price: 4500, durationMinutes: 90,  category: 'MEN',   type: 'VIP'      },
      { id: 'm7', name: 'SPA-уход за кожей головы', description: 'Пилинг, массаж, ампула против выпадения',          price: 3000, durationMinutes: 60,  category: 'MEN',   type: 'VIP'      },
      { id: 'm8', name: 'Мужской маникюр "Бизнес"', description: 'Обработка, матовое покрытие, увлажнение',          price: 2500, durationMinutes: 60,  category: 'MEN',   type: 'VIP'      },
      { id: 'm9', name: 'Детокс-уход за лицом',     description: 'Очищение, черная маска, увлажнение',               price: 2000, durationMinutes: 40,  category: 'MEN',   type: 'VIP'      },
      // WOMEN вЂ” STANDARD
      { id: 'w1', name: 'Женская стрижка с укладкой', description: 'Мытье, форма, сушка',                           price: 2500, durationMinutes: 60,  category: 'WOMEN', type: 'STANDARD' },
      { id: 'w2', name: 'Окрашивание в один тон',     description: 'Корни или вся длина',                              price: 4000, durationMinutes: 120, category: 'WOMEN', type: 'STANDARD' },
      { id: 'w3', name: 'Сложное окрашивание',        description: 'AirTouch, Шатуш, Балаяж',                         price: 8000, durationMinutes: 240, category: 'WOMEN', type: 'STANDARD' },
      { id: 'w4', name: 'Маникюр с покрытием',        description: 'Классика или аппаратный',                          price: 2000, durationMinutes: 90,  category: 'WOMEN', type: 'STANDARD' },
      { id: 'w5', name: 'Укладка / Локоны',           description: 'Дневная или вечерняя',                             price: 2500, durationMinutes: 45,  category: 'WOMEN', type: 'STANDARD' },
      // WOMEN вЂ” VIP
      { id: 'w6', name: 'Услуга в 4 руки',                description: 'Окрашивание + Маникюр одновременно',           price: 12000, durationMinutes: 120, category: 'WOMEN', type: 'VIP'     },
      { id: 'w7', name: 'Интеллектуальная реконструкция', description: 'Tokio Inkarami или «Счастье для волос»',       price: 6000,  durationMinutes: 90,  category: 'WOMEN', type: 'VIP'     },
      { id: 'w8', name: 'Образ "Red Carpet"',             description: 'Макияж + Вечерняя прическа',                   price: 7000,  durationMinutes: 120, category: 'WOMEN', type: 'VIP'     },
      { id: 'w9', name: 'Диагностика кожи головы',        description: 'Трихологический уход: очищение для объема и роста', price: 3500, durationMinutes: 60, category: 'WOMEN', type: 'VIP' },
    ],
  });

  // в”Ђв”Ђ Masters в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const mastersData = [
    {
      id: 'mst2', userId: 'u2', name: '\u0415\u043b\u0435\u043d\u0430 \u0412\u0438\u0448\u043d\u0435\u0432\u0441\u043a\u0430\u044f', role: 'ART DIRECTOR', rating: 5.0, specialization: ['WOMEN'], level: 'TOP', priceMultiplier: 1.5,
      imageUrl: '/masters/elena-vishnevskaya.webp',
      workSchedule: { 1: {start:'10:00',end:'20:00'}, 2: {start:'10:00',end:'20:00'}, 3: {start:'10:00',end:'20:00'}, 4: {start:'10:00',end:'20:00'}, 5: {start:'10:00',end:'20:00'}, 6: {start:'11:00',end:'18:00'}, 0: null },
    },
    {
      id: 'mst1', userId: 'u1', name: '\u0410\u043b\u0435\u043a\u0441\u0430\u043d\u0434\u0440 \u0413\u0440\u043e\u043c\u043e\u0432', role: 'TOP BARBER', rating: 5.0, specialization: ['MEN'], level: 'TOP', priceMultiplier: 1.5,
      imageUrl: '/masters/aleksandr-gromov.jpg',
      workSchedule: { 1: {start:'10:00',end:'20:00'}, 2: {start:'10:00',end:'20:00'}, 3: {start:'10:00',end:'20:00'}, 4: {start:'10:00',end:'20:00'}, 5: {start:'10:00',end:'20:00'}, 6: {start:'11:00',end:'18:00'}, 0: null },
    },
    {
      id: 'mst7', name: '\u0421\u043e\u0444\u0438\u044f \u0420\u043e\u043c\u0430\u043d\u043e\u0432\u0430', role: 'TOP NAIL ARTIST', rating: 4.9, specialization: ['WOMEN'], level: 'TOP', priceMultiplier: 1.5,
      imageUrl: '/masters/sofiya-romanova.jpg',
      workSchedule: { 1: {start:'10:00',end:'20:00'}, 2: {start:'10:00',end:'20:00'}, 3: {start:'10:00',end:'20:00'}, 4: {start:'10:00',end:'20:00'}, 5: {start:'10:00',end:'20:00'}, 6: {start:'11:00',end:'18:00'}, 0: null },
    },
    {
      id: 'mst3', userId: 'u3', name: '\u0414\u043c\u0438\u0442\u0440\u0438\u0439 \u0412\u043e\u043b\u043a\u043e\u0432', role: 'SENIOR BARBER', rating: 5.0, specialization: ['MEN'], level: 'SENIOR', priceMultiplier: 1.2,
      imageUrl: '/masters/dmitry-volkov.jpg',
      workSchedule: { 1: {start:'10:00',end:'20:00'}, 2: {start:'10:00',end:'20:00'}, 3: null, 4: {start:'10:00',end:'20:00'}, 5: {start:'10:00',end:'20:00'}, 6: {start:'11:00',end:'18:00'}, 0: null },
    },
    {
      id: 'mst8', name: '\u041a\u0441\u0435\u043d\u0438\u044f \u041c\u0438\u0440\u043e\u043d\u043e\u0432\u0430', role: 'MAKEUP ARTIST', rating: 5.0, specialization: ['WOMEN'], level: 'SENIOR', priceMultiplier: 1.2,
      imageUrl: '/masters/ksenia-mironova.jpg',
      workSchedule: { 1: {start:'10:00',end:'20:00'}, 2: {start:'10:00',end:'20:00'}, 3: {start:'10:00',end:'20:00'}, 4: null, 5: {start:'10:00',end:'20:00'}, 6: {start:'11:00',end:'18:00'}, 0: null },
    },
    {
      id: 'mst4', userId: 'u4', name: '\u0410\u043d\u043d\u0430 \u0421\u043e\u043a\u043e\u043b\u043e\u0432\u0430', role: 'STYLIST', rating: 5.0, specialization: ['WOMEN'], level: 'SENIOR', priceMultiplier: 1.2,
      imageUrl: '/masters/anna-sokolova.webp',
      workSchedule: { 1: {start:'10:00',end:'20:00'}, 2: {start:'10:00',end:'20:00'}, 3: {start:'10:00',end:'20:00'}, 4: null, 5: {start:'10:00',end:'20:00'}, 6: {start:'11:00',end:'18:00'}, 0: null },
    },
    {
      id: 'mst5', userId: 'u5', name: '\u041c\u0430\u0440\u0438\u044f \u041a\u043e\u0437\u043b\u043e\u0432\u0430', role: 'JUNIOR STYLIST', rating: 4.9, specialization: ['WOMEN'], level: 'JUNIOR', priceMultiplier: 1.0,
      imageUrl: '/masters/maria-kozlova.jpg',
      workSchedule: { 1: {start:'10:00',end:'20:00'}, 2: {start:'10:00',end:'20:00'}, 3: {start:'10:00',end:'20:00'}, 4: {start:'10:00',end:'20:00'}, 5: {start:'10:00',end:'20:00'}, 6: null, 0: null },
    },
    {
      id: 'mst6', userId: 'u6', name: '\u0410\u0440\u0442\u0435\u043c \u041d\u043e\u0432\u0438\u043a\u043e\u0432', role: 'JUNIOR BARBER', rating: 4.9, specialization: ['MEN'], level: 'JUNIOR', priceMultiplier: 1.0,
      imageUrl: '/masters/artem-novikov.jpg',
      workSchedule: { 1: {start:'12:00',end:'20:00'}, 2: {start:'12:00',end:'20:00'}, 3: {start:'12:00',end:'20:00'}, 4: {start:'12:00',end:'20:00'}, 5: {start:'12:00',end:'20:00'}, 6: {start:'11:00',end:'18:00'}, 0: null },
    },
  ];

  for (const m of mastersData) {
    const profileBio = m.bio ?? 'Профессиональный мастер с вниманием к деталям и сервису.';
    const profileExperience = m.experience ?? '5 лет';
    const profileLanguages = m.languages ?? 'Русский';
    await prisma.master.upsert({
      where: { id: m.id },
      update: {
        name: m.name,
        role: m.role,
        rating: m.rating,
        specialization: m.specialization,
        level: m.level,
        priceMultiplier: m.priceMultiplier,
        imageUrl: m.imageUrl,
        bio: profileBio,
        experience: profileExperience,
        languages: profileLanguages,
        workSchedule: m.workSchedule,
        isActive: true,
      },
      create: {
        ...m,
        bio: profileBio,
        experience: profileExperience,
        languages: profileLanguages,
      },
    });
  }

  // в”Ђв”Ђ Bookings в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const bookingsData = [
    { id: 'bk001', clientName: 'Дмитрий Иванов',  clientPhone: '+7 900 123 45 67', masterId: 'mst1', serviceId: 'Комплекс "Total Look"',            status: 'COMPLETED',  totalPrice: 4500,  date: '2026-02-11', time: '10:00', notes: 'Любит кофе с корицей. VIP клиент.' },
    { id: 'bk002', clientName: 'Анна Петрова',    clientPhone: '+7 900 987 65 43', masterId: 'mst2', serviceId: 'Сложное окрашивание',              status: 'CONFIRMED',  totalPrice: 8000,  date: '2026-02-11', time: '12:00', notes: 'Аллергия на некоторые красители' },
    { id: 'bk003', clientName: 'Максим Сидоров',  clientPhone: '+7 900 555 12 34', masterId: 'mst3', serviceId: 'Мужская стрижка, Оформление бороды', status: 'CONFIRMED',  totalPrice: 2700,  date: '2026-02-11', time: '14:00' },
    { id: 'bk004', clientName: 'Ольга Кузнецова', clientPhone: '+7 900 333 44 55', masterId: 'mst4', serviceId: 'Укладка / Локоны',                 status: 'PENDING',    totalPrice: 2500,  date: '2026-02-11', time: '15:00' },
    { id: 'bk005', clientName: 'Игорь Волков',    clientPhone: '+7 900 777 88 99', masterId: 'mst1', serviceId: 'Классическое бритье',             status: 'CONFIRMED',  totalPrice: 1800,  date: '2026-02-11', time: '16:00' },
    { id: 'bk006', clientName: 'Елена Смирнова',  clientPhone: '+7 900 222 33 44', masterId: 'mst2', serviceId: 'Услуга в 4 руки',                 status: 'CONFIRMED',  totalPrice: 12000, date: '2026-02-11', time: '17:00', notes: 'VIP клиент. Приготовить шампанское.' },
  ];

  for (const b of bookingsData) {
    await prisma.booking.upsert({
      where: { id: b.id },
      update: b,
      create: b,
    });
  }

  // в”Ђв”Ђ Reviews в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const reviewsData = [
    { id: 'r1', clientName: 'Максим А.',  text: 'Сервис на высшем уровне. Total Look полностью оправдал ожидания. Мастер Александр - настоящий профессионал!', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg', status: 'APPROVED' },
    { id: 'r2', clientName: 'Виктория С.',    text: 'Услуга в 4 руки спасла мой вечер! Успела на мероприятие. Прическа держится идеально уже неделю.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/44.jpg', status: 'APPROVED' },
    { id: 'r3', clientName: 'Игорь К.',       text: 'Отличная атмосфера, вкусный кофе и профессиональные мастера. Стал постоянным клиентом.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/52.jpg', status: 'APPROVED' },
    { id: 'r4', clientName: 'Елена П.',       text: 'Сложное окрашивание сделали идеально. Волосы живые и блестящие. Цвет держится отлично!', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/68.jpg', status: 'APPROVED' },
    { id: 'r5', clientName: 'Андрей М.',      text: 'Классическое бритье - это отдельный вид искусства. Рекомендую! Впервые испытал такой сервис.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/22.jpg', status: 'APPROVED'  },
    { id: 'r6', clientName: 'Настя В.',  text: 'Маникюр с покрытием держится неделями! Девушки чувствуют руку. Советую всем подругам.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/25.jpg', status: 'APPROVED' },
    { id: 'r7', clientName: 'Сергей П.',  text: 'Мужская стрижка + оформление бороды. Вышел как с журнала моды. Отличный результат!', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/36.jpg', status: 'APPROVED' },
    { id: 'r8', clientName: 'Ирина С.', text: 'SPA-уход за кожей головы - просто волшебство! Волосы стали здоровыми и блестящими.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/50.jpg', status: 'APPROVED' },
    { id: 'r9', clientName: 'Дмитрий Х.', text: 'Комплекс Total Look - лучшая вещь в моей жизни! Почувствовал себя королем.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/54.jpg', status: 'APPROVED' },
    { id: 'r10', clientName: 'Мария К.', text: 'Интеллектуальная реконструкция волос реально работает! Волосы ожили, спасибо мастерам.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/62.jpg', status: 'APPROVED' },
    { id: 'r11', clientName: 'Кристина Л.',   text: 'Записали без ожидания, мастер сразу понял, какой результат мне нужен.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/12.jpg', status: 'APPROVED' },
    { id: 'r12', clientName: 'Павел Н.',      text: 'Борода и стрижка выглядят аккуратно уже вторую неделю. Отличная работа.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/28.jpg', status: 'APPROVED' },
    { id: 'r13', clientName: 'Ольга Р.',      text: 'Сложное окрашивание сделали чисто, цвет получился ровный и дорогой.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/33.jpg', status: 'APPROVED' },
    { id: 'r14', clientName: 'Никита В.',     text: 'Приятная атмосфера и высокий уровень сервиса от входа до финальной укладки.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/46.jpg', status: 'APPROVED' },
    { id: 'r15', clientName: 'Алина С.',      text: 'Маникюр и укладка в четыре руки сэкономили кучу времени перед мероприятием.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/57.jpg', status: 'APPROVED' },
    { id: 'r16', clientName: 'Владимир Т.',   text: 'Очень точная работа с формой стрижки. Получилось даже лучше, чем ожидал.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/63.jpg', status: 'APPROVED' },
    { id: 'r17', clientName: 'Дарья М.',      text: 'Волосы после ухода стали мягче и плотнее. Результат заметен сразу.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/65.jpg', status: 'APPROVED' },
    { id: 'r18', clientName: 'Илья П.',       text: 'Четко по времени, быстро и без суеты. Буду записываться снова.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/72.jpg', status: 'APPROVED' },
    { id: 'r19', clientName: 'Юлия К.',       text: 'Идеальный тон и блеск волос, плюс очень деликатное отношение мастера.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/women/74.jpg', status: 'APPROVED' },
    { id: 'r20', clientName: 'Роман Д.',      text: 'Премиальный подход: комфортно, спокойно и очень качественный итог.', rating: 5, avatarUrl: 'https://randomuser.me/api/portraits/men/81.jpg', status: 'APPROVED' },
  ];

  for (const review of reviewsData) {
    await prisma.review.upsert({
      where: { id: review.id },
      update: review,
      create: review,
    });
  }

  // в”Ђв”Ђ Clients в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const clientsData = [
    { id: 'c1', name: 'Дмитрий Иванов', phone: '+7 900 123 45 67', email: 'dmitry@email.com', notes: 'Любит кофе с корицей', totalVisits: 12, totalSpent: 45000, lastVisit: '2026-02-10' },
    { id: 'c2', name: 'Анна Петрова', phone: '+7 900 987 65 43', email: 'anna@email.com', totalVisits: 8, totalSpent: 64000, lastVisit: '2026-02-09' },
    { id: 'c3', name: 'Максим Сидоров', phone: '+7 900 555 12 34', totalVisits: 5, totalSpent: 22500, lastVisit: '2026-01-15' },
    { id: 'c4', name: 'Ольга Кузнецова', phone: '+7 900 333 44 55', notes: 'Аллергия на аммиак', totalVisits: 15, totalSpent: 120000, lastVisit: '2026-02-08' },
  ];

  for (const client of clientsData) {
    await prisma.client.upsert({
      where: { id: client.id },
      update: client,
      create: client,
    });
  }

  // в”Ђв”Ђ Waitlist в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const waitlistData = [
    { id: 'wl1', clientName: '\u0421\u0432\u0435\u0442\u043b\u0430\u043d\u0430 \u0420.', clientPhone: '+7 900 111 22 33', masterId: 'mst2', serviceIds: ['w3'], preferredDates: ['2026-02-14', '2026-02-15'], notified: false },
  ];

  for (const entry of waitlistData) {
    await prisma.waitlistEntry.upsert({
      where: { id: entry.id },
      update: entry,
      create: entry,
    });
  }

  console.log('Seed complete!');
}

main()
  .catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());



