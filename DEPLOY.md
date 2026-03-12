# Деплой Lumière на виртуальную машину (Cloud.ru)

## Обзор архитектуры

```
   Интернет
      │
      ▼
┌───────────┐     ┌───────────┐     ┌───────────┐
│   nginx   │────▶│  Express  │────▶│ PostgreSQL│
│  :80/:443 │     │   :3001   │     │   :5432   │
│ (фронтенд │     │  (API)    │     │  (данные) │
│ + прокси) │     └───────────┘     └───────────┘
└───────────┘
    docker-compose объединяет всё в единую сеть
```

---

## Шаг 1. Купить домен (~150 ₽)

Регистраторы: **reg.ru**, **timeweb.com**, **beget.com**.

Купи домен в зоне `.ru` / `.site` / `.online` — они дешёвые.

После покупки в панели DNS создай **A-запись**:

```
Тип: A
Имя: @            (или пусто — это корневой домен)
Значение: <IP виртуальной машины>
TTL: 300
```

---

## Шаг 2. Создать виртуальную машину на Cloud.ru

1. Зайди на [cloud.ru](https://cloud.ru), зарегистрируйся
2. Создай **виртуальную машину**:
   - ОС: **Ubuntu 22.04** (или 24.04)
   - RAM: **2 ГБ** минимум (4 ГБ лучше)
   - Диск: **20 ГБ** SSD
   - Сеть: включи **публичный IP**
3. Запомни **IP-адрес** — он понадобится для DNS

---

## Шаг 3. Подключиться к серверу

```bash
ssh ubuntu@<IP_ВАШЕГО_СЕРВЕРА>
```

---

## Шаг 4. Установить Docker + Docker Compose

```bash
# Обновить пакеты
sudo apt update && sudo apt upgrade -y

# Установить Docker
curl -fsSL https://get.docker.com | sudo sh

# Добавить себя в группу docker (чтобы не писать sudo)
sudo usermod -aG docker $USER

# Перелогиниться, чтобы группа применилась
exit
# подключись заново:
ssh ubuntu@<IP_ВАШЕГО_СЕРВЕРА>

# Проверить, что Docker работает
docker --version
docker compose version
```

---

## Шаг 5. Загрузить проект на сервер

### Вариант A — через Git (рекомендуется)

```bash
# На сервере:
git clone https://github.com/<ваш-юзернейм>/lumiere.git
cd lumiere
```

### Вариант B — через SCP (если нет GitHub)

```bash
# На СВОЁМ компьютере (в PowerShell):
scp -r C:\vs\lumiere ubuntu@<IP_СЕРВЕРА>:~/lumiere

# На сервере:
cd ~/lumiere
```

---

## Шаг 6. Настроить .env

```bash
# На сервере, в папке проекта:
cp .env.example .env
nano .env
```

Заполни так (подставь свои значения):

```env
DB_PASSWORD=супер-секретный-пароль-для-бд
AUTH_SECRET=сгенерируй-командой-ниже
APP_PUBLIC_URL=http://твой-домен.ru

# Почта (если нужны подтверждения бронирований)
MAIL_HOST=smtp.example.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=your-mail@example.com
MAIL_PASS=your-app-password
MAIL_FROM=Lumiere <your-mail@example.com>
```

Сгенерировать `AUTH_SECRET`:

```bash
openssl rand -hex 32
```

Сохрани файл: `Ctrl+O`, `Enter`, `Ctrl+X`.

---

## Шаг 7. Запустить!

```bash
docker compose up -d --build
```

Что произойдёт:

1. Соберётся Docker-образ (фронтенд + бэкенд)
2. Запустится PostgreSQL
3. `init`-контейнер прогонит миграции и скопирует фронтенд
4. Nginx начнёт раздавать сайт на порту 80
5. Express API будет доступен через `/api/`

**Проверить, что всё работает:**

```bash
docker compose ps       # все контейнеры должны быть Up
docker compose logs app # логи API-сервера
```

Открой в браузере: `http://твой-домен.ru` 🎉

---

## Шаг 8. Засидить базу (опционально)

Если нужны тестовые данные:

```bash
docker compose exec app npx prisma db seed
```

---

## Шаг 9. HTTPS с Let's Encrypt (бесплатно, опционально)

Когда домен привязан и HTTP работает, можно добавить HTTPS:

```bash
# Установить certbot
sudo apt install -y certbot python3-certbot-nginx

# Получить сертификат (nginx должен быть доступен на 80 порту)
# Сначала остановим наш nginx-контейнер
docker compose stop nginx

sudo certbot certonly --standalone -d твой-домен.ru

# Сертификаты появятся в /etc/letsencrypt/live/твой-домен.ru/
```

Затем обнови `docker-compose.yml`, добавив маппинг сертификатов в nginx:

```yaml
nginx:
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - frontend:/usr/share/nginx/html:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro
```

И обнови `nginx.conf`:

```nginx
server {
    listen 80;
    server_name твой-домен.ru;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name твой-домен.ru;

    ssl_certificate     /etc/letsencrypt/live/твой-домен.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/твой-домен.ru/privkey.pem;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass         http://app:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Перезапусти: `docker compose up -d`

---

## Полезные команды

| Команда                                  | Что делает                  |
| ---------------------------------------- | --------------------------- |
| `docker compose up -d --build`           | Пересобрать и запустить     |
| `docker compose down`                    | Остановить всё              |
| `docker compose logs -f app`             | Логи API в реальном времени |
| `docker compose logs -f nginx`           | Логи nginx                  |
| `docker compose exec app sh`             | Залезть в контейнер         |
| `docker compose exec db psql -U lumiere` | Войти в PostgreSQL          |
| `docker compose restart app`             | Перезапустить только API    |

---

## Обновление проекта

```bash
cd ~/lumiere
git pull                       # подтянуть новый код
docker compose up -d --build   # пересобрать и перезапустить
```
