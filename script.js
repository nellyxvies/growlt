// ============================================
// Growlt — картинки цветка + два счётчика
//
// Цель: { id, title, deadline, status, completedAt }
//   status: 'active' | 'done' | 'expired'
//
// localStorage:
//   growlt_goals    — массив целей
//   growlt_current  — currentProgress (текущий прогресс)
//   growlt_total    — totalCompleted  (за всё время)
//   growlt_wilted   — цветок увял после просрочки (true/false)
// ============================================

// ---------- Ключи и константы ----------

const KEY_GOALS   = 'growlt_goals';
const KEY_CURRENT = 'growlt_current';
const KEY_TOTAL   = 'growlt_total';
const KEY_WILTED  = 'growlt_wilted';

const IMG_WIDTH = 150; // ширина картинки цветка

// ---------- Ссылки на элементы ----------

const $ = id => document.getElementById(id);

const form      = $('goal-form');
const goalInput = $('goal-input');
const dateInput = $('date-input');
const flowerEl  = $('flower');
const statsEl   = $('stats');
const listEl    = $('goals-list');
const tabActive = $('tab-active');
const tabDone   = $('tab-done');

// Если какого-то элемента нет — напишем в консоль (проще искать баг)
[['goal-form', form], ['goal-input', goalInput], ['date-input', dateInput],
 ['flower', flowerEl], ['stats', statsEl], ['goals-list', listEl],
 ['tab-active', tabActive], ['tab-done', tabDone]]
  .forEach(([id, el]) => {
    if (!el) console.error('[Growlt] Не найден элемент #' + id);
  });

let currentTab = 'active'; // 'active' | 'done'

// ---------- localStorage: цели ----------

function loadGoals() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY_GOALS) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveGoals(goals) {
  localStorage.setItem(KEY_GOALS, JSON.stringify(goals));
}

// ---------- localStorage: числа и флаги ----------

function loadNumber(key, def) {
  const raw = localStorage.getItem(key);
  if (raw === null) return def;
  const n = parseInt(raw, 10);
  return isNaN(n) ? def : n;
}
function saveNumber(key, n) {
  localStorage.setItem(key, String(n));
}
function loadBool(key, def) {
  const raw = localStorage.getItem(key);
  if (raw === null) return def;
  return raw === 'true' || raw === '1';
}
function saveBool(key, b) {
  localStorage.setItem(key, b ? 'true' : 'false');
}

// ---------- Даты ----------

// Дедлайн → миллисекунды.
// "YYYY-MM-DD" (type="date")     → конец этого дня
// "YYYY-MM-DDTHH:MM" (datetime-local) → локальное время
function deadlineToMs(value) {
  if (!value) return NaN;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  }
  return new Date(value).getTime();
}

function formatDateTime(value) {
  if (!value) return '';
  const ms = deadlineToMs(value);
  if (isNaN(ms)) return String(value);
  const d = new Date(ms);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- Картинка по прогрессу (5 стадий) ----------

//  wilted=true  → wilted.png  (увядший) — приоритет выше всего
//  current=0    → seed.png    (семечко/росток)
//  current=1–2  → sprout.png  (росток)
//  current=3–4  → bud.png     (бутон)
//  current>=5   → flower.png  (расцветший цветок)
function imageForProgress(current, wilted) {
  if (wilted)        return { src: 'wilted.png', alt: 'Увядший цветок' };
  if (current >= 5)  return { src: 'flower.png', alt: 'Расцветший цветок' };
  if (current >= 3)  return { src: 'bud.png',    alt: 'Бутон' };
  if (current >= 1)  return { src: 'sprout.png', alt: 'Росток' };
  return { src: 'seed.png', alt: 'Семечко' };
}

// ---------- Просрочка ----------

// Находит все active-цели с прошедшим дедлайном:
//   • ставит им status = 'expired'
//   • сбрасывает currentProgress = 0
//   • ставит флаг wilted = true (цветок покажет wilted.png)
// totalCompleted НЕ меняется — это счётчик «за всё время».
function enforceExpiry() {
  const goals = loadGoals();
  const now = Date.now();
  let expiredNow = false;

  goals.forEach(g => {
    if (g.status === 'active' && deadlineToMs(g.deadline) < now) {
      g.status = 'expired';
      expiredNow = true;
    }
  });

  if (expiredNow) {
    saveGoals(goals);
    saveNumber(KEY_CURRENT, 0);
    saveBool(KEY_WILTED, true);
  }
}

// ---------- Отрисовка: цветок ----------

function renderFlower() {
  if (!flowerEl) return;

  const current = loadNumber(KEY_CURRENT, 0);
  const wilted  = loadBool(KEY_WILTED, false);
  const info    = imageForProgress(current, wilted);

  // Полностью пересобираем блок с картинкой
  flowerEl.innerHTML = '';

  const img = document.createElement('img');
  img.src = info.src;
  img.alt = info.alt;
  img.setAttribute('width', String(IMG_WIDTH));
  img.style.maxWidth = '100%';
  img.style.height = 'auto';
  img.style.display = 'block';
  img.style.margin = '0 auto';

  // Если файл не загрузился — показываем alt-текст вместо «сломанной» иконки
  img.addEventListener('error', () => {
    img.style.display = 'none';
    const fallback = document.createElement('div');
    fallback.textContent = info.alt;
    fallback.style.color = '#7a5c3e';
    fallback.style.fontSize = '1.1rem';
    fallback.style.textAlign = 'center';
    flowerEl.appendChild(fallback);
  });

  flowerEl.appendChild(img);
  flowerEl.title = wilted ? 'Цветок увял из-за просрочки' : info.alt;
}

// ---------- Отрисовка: статистика ----------

function renderStats() {
  if (!statsEl) return;
  const current = loadNumber(KEY_CURRENT, 0);
  const total   = loadNumber(KEY_TOTAL, 0);
  statsEl.innerHTML =
    `<div>Текущий прогресс: ${current}</div>` +
    `<div>Всего выполнено: ${total}</div>`;
}

// ---------- Отрисовка: вкладки ----------

function renderTabs() {
  const isActive = currentTab === 'active';
  if (tabActive) {
    tabActive.classList.toggle('active', isActive);
    tabActive.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }
  if (tabDone) {
    tabDone.classList.toggle('active', !isActive);
    tabDone.setAttribute('aria-selected', !isActive ? 'true' : 'false');
  }
}

// ---------- Отрисовка: список целей ----------

function renderList() {
  if (!listEl) return;
  listEl.innerHTML = '';

  const goals = loadGoals();
  let filtered;

  if (currentTab === 'active') {
    filtered = goals.filter(g => g.status === 'active');
    filtered.sort((a, b) => deadlineToMs(a.deadline) - deadlineToMs(b.deadline));
  } else {
    filtered = goals.filter(g => g.status === 'done' || g.status === 'expired');
    filtered.sort((a, b) => {
      const ta = a.completedAt ? new Date(a.completedAt).getTime() : deadlineToMs(a.deadline);
      const tb = b.completedAt ? new Date(b.completedAt).getTime() : deadlineToMs(b.deadline);
      return tb - ta;
    });
  }

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = currentTab === 'active'
      ? 'Нет активных целей — посади новый цветок!'
      : 'Пока нет выполненных или просроченных целей.';
    listEl.appendChild(empty);
    return;
  }

  filtered.forEach(goal => {
    const card = document.createElement('div');
    card.className = `goal-item goal-item--${goal.status}`;
    card.dataset.id = goal.id;

    let html =
      `<div class="goal-title">${escapeHtml(goal.title)}</div>` +
      `<div class="goal-deadline">Дедлайн: ${formatDateTime(goal.deadline)}</div>`;

    if (goal.status === 'done') {
      html += `<div class="goal-completed">Выполнено: ${formatDateTime(goal.completedAt)}</div>`;
    } else if (goal.status === 'expired') {
      html += `<div class="goal-expired">Просрочено</div>`;
    } else {
      html += `<button type="button" class="complete-btn" data-id="${goal.id}">Выполнено!</button>`;
    }

    card.innerHTML = html;
    listEl.appendChild(card);
  });
}

// ---------- Общая перерисовка ----------

function renderAll() {
  enforceExpiry(); // сначала обрабатываем просрочки
  renderFlower();
  renderStats();
  renderTabs();
  renderList();
}

// ---------- Форма: «Посадить цветок» ----------

form.addEventListener('submit', event => {
  event.preventDefault();

  const title    = goalInput.value.trim();
  const deadline = dateInput.value;

  if (!title) { alert('Введи название цели.'); goalInput.focus(); return; }
  if (!deadline) { alert('Выбери дедлайн.'); dateInput.focus(); return; }

  const ms = deadlineToMs(deadline);
  if (isNaN(ms)) { alert('Не удалось распознать дату.'); return; }
  if (ms < Date.now() - 60_000) {
    alert('Дедлайн уже прошёл. Выбери будущие дату и время.');
    return;
  }

  const goals = loadGoals();
  goals.push({
    id: Date.now(),
    title: title,
    deadline: deadline,
    status: 'active',
    completedAt: null
  });
  saveGoals(goals);

  // Очищаем форму и переключаемся на «Активные»
  goalInput.value = '';
  dateInput.value = '';
  currentTab = 'active';

  renderAll();
});

// ---------- Клик по «Выполнено!» в карточке ----------

listEl.addEventListener('click', event => {
  const btn = event.target.closest('.complete-btn');
  if (!btn) return;

  const id = Number(btn.dataset.id);
  const goals = loadGoals();
  const goal = goals.find(g => g.id === id);
  if (!goal || goal.status !== 'active') return;

  // Помечаем выполненной + время ставится автоматически
  goal.status = 'done';
  goal.completedAt = new Date().toISOString();
  saveGoals(goals);

  // Прогресс растёт — и текущий, и за всё время
  saveNumber(KEY_CURRENT, loadNumber(KEY_CURRENT, 0) + 1);
  saveNumber(KEY_TOTAL,   loadNumber(KEY_TOTAL, 0)   + 1);

  // Если цветок был увядшим — он оживает
  saveBool(KEY_WILTED, false);

  renderAll();
});

// ---------- Переключение вкладок ----------

if (tabActive) tabActive.addEventListener('click', () => { currentTab = 'active'; renderAll(); });
if (tabDone)   tabDone.addEventListener('click',   () => { currentTab = 'done';   renderAll(); });

// ---------- Инициализация ----------

(function init() {
  // Минимальное значение для поля дедлайна
  if (dateInput) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const ymd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    if (dateInput.type === 'datetime-local') {
      dateInput.min = `${ymd}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    } else if (dateInput.type === 'date') {
      dateInput.min = ymd;
    }
  }

  // Первый запуск: инициализируем счётчики
  if (localStorage.getItem(KEY_TOTAL) === null) {
    const done = loadGoals().filter(g => g.status === 'done').length;
    saveNumber(KEY_TOTAL, done);
  }
  if (localStorage.getItem(KEY_CURRENT) === null) {
    saveNumber(KEY_CURRENT, loadNumber(KEY_TOTAL, 0));
  }
  if (localStorage.getItem(KEY_WILTED) === null) {
    saveBool(KEY_WILTED, false);
  }

  // Первая отрисовка (внутри проверяются просрочки)
  renderAll();

  // При возврате на вкладку перерисовываем — просрочки завянут вовремя
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderAll();
  });
})();