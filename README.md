# CraftManager UI

Vue 3 SPA-клиент для [craftmanager-api](https://github.com/AnnVatlina/craftmanager-api). Тонкий клиент — вся бизнес-логика, расчёты и валидация живут на бэкенде; подробности о том, что реализовано и как это работает — в [`docs/` бэкенд-репозитория](https://github.com/AnnVatlina/craftmanager-api/tree/main/docs).

Инструкция для пользователей приложения — [USER_GUIDE.md](USER_GUIDE.md).

## Стек технологий

- Vue 3 (Composition API), Vue Router 4 (hash history)
- Vite
- Без стейт-менеджера — состояние в двух `reactive`-объектах (`stores/auth.js`, `stores/settings.js`), без сторонней библиотеки компонентов

## Локальная разработка

```bash
git clone https://github.com/AnnVatlina/craftmanager-ui.git
cd craftmanager-ui
npm install

echo "VITE_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Приложение — `http://localhost:5173`. Требует запущенный [craftmanager-api](https://github.com/AnnVatlina/craftmanager-api) (по умолчанию ожидается на `http://localhost:8000`).

## Структура проекта

```
src/
├── main.js              # Точка входа, инициализация Vue + Router
├── App.vue               # Корневой компонент
├── style.css              # Глобальные стили
├── api/                    # По файлу на сущность API — тонкие обёртки над client.js
│   └── client.js            # fetch-обёртка: JWT-заголовок, auto-refresh на 401, скачивание файлов
├── stores/
│   ├── auth.js              # isAuthenticated, logout()
│   └── settings.js          # currency/categories/units, грузится из API при старте
├── composables/
│   └── useProductPicker.js   # Поиск/дебаунс/пагинация для ProductPicker — вынесено для тестируемости без монтирования компонента
├── router/
│   └── index.js             # Маршруты + guard на авторизацию
├── components/
│   ├── AppLayout.vue         # Сайдбар, мобильная шапка, <router-view>
│   ├── BaseModal.vue          # Переиспользуемый модальный диалог
│   └── ProductPicker.vue      # Поиск изделия — используется в Fair Prep и в позициях продажи
└── views/                     # По странице на сущность

tests/                    # Vitest + @vue/test-utils, зеркалирует структуру src/
├── composables/
├── components/
└── views/
```

## Тестирование

```bash
npm test
```

Vitest + `@vue/test-utils`, окружение `jsdom` (см. `vite.config.js`). CI (`.github/workflows/deploy.yml`) гоняет их в отдельном job перед деплоем — красные тесты блокируют публикацию на GitHub Pages.

## Сборка и деплой

```bash
VITE_API_URL=https://<railway-domain> npm run build
```

`vite.config.js` задаёт `base: '/craftmanager-ui/'` — обязательно для корректной работы на GitHub Pages в подпути. GitHub Actions (`.github/workflows/`) публикует `dist/` в ветку `gh-pages` при push в `main`.

## Известные особенности

- Компонент `views/BuyersView.vue` и `api/buyers.js` существуют в коде, но роут `/buyers` не зарегистрирован в `router/index.js` — страница недостижима из UI. Соответствующий backend-роутер тоже не подключён (см. [DOMAIN.md](https://github.com/AnnVatlina/craftmanager-api/blob/main/docs/DOMAIN.md#buyers) в api-репозитории) — сущность "покупатель" заменена на "канал продаж" (`ChannelsView.vue`).
