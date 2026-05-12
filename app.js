// ===== Supabase 設定（task-app と同じプロジェクトを使用）=====
const SUPABASE_URL = 'https://dohodudlajausbnemqbo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaG9kdWRsYWphdXNibmVtcWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NTI0MTgsImV4cCI6MjA5MzAyODQxOH0.XUVMCPStcJ794qzR3Qdlfy8uwrNIvRcVyfSME-6hRdA';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 状態管理 =====
let currentYear = new Date().getFullYear();
let currentView = 'vision';

// Vision データ
let visions = [];
let yearlyGoals = [];
let editingVisionRole = null;

// Tracker データ
let habits = [];
let trackerLogs = [];
let trackerDate = new Date();
let selectedTod = 'morning';

// Wishlist データ
let wishlistItems = [];
let wishlistShowDone = false;
let editingWishId = null;

// Journal データ
let journalEntries = [];
let currentJournalView = 'daily';
let journalDay = new Date();
let journalWeek = getWeekStart(new Date());
let journalMonth = new Date();

// Tasks データ
let tasks = [];
let categories = [];
let completions = [];
let editingTaskId = null;
let defaultTimeBlock = 9;
let currentTaskView = 'gtd';
let currentDate = new Date();
let currentMonth = new Date();
let activePanel = 'inbox';
let blockSortables = [];
let inboxSortable = null;

const TIME_BLOCKS = [
  { start: 9,  label: '09:00 〜 13:00' },
  { start: 13, label: '13:00 〜 17:00' },
  { start: 17, label: '17:00 〜 21:00' },
  { start: 21, label: '21:00 〜' },
];

// ===== 初期化 =====
async function init() {
  setupEventListeners();
  await Promise.all([loadVisionData(), loadTaskData(), loadTrackerData(), loadJournalData(), loadWishlistData()]);
  renderYear();
}

// ===== Tracker データ読み込み =====
async function loadTrackerData() {
  const { data: h } = await db.from('tracker_habits').select('*').order('sort_order').order('created_at');
  if (h) habits = h;
  const { data: l } = await db.from('tracker_logs').select('*');
  if (l) trackerLogs = l;
}

// ===== Tracker レンダー =====
function renderTracker() {
  const dateStr = toDateStr(trackerDate);
  document.getElementById('tracker-date').textContent = formatDateJP(trackerDate);

  const body = document.getElementById('tracker-body');
  body.innerHTML = '';

  const groups = [
    { key: 'morning',   label: '朝' },
    { key: 'afternoon', label: '昼' },
    { key: 'evening',   label: '夜' },
  ];

  groups.forEach(({ key, label }) => {
    const groupHabits = habits.filter(h => h.time_of_day === key);
    if (!groupHabits.length) return;

    const group = document.createElement('div');
    group.className = 'tracker-time-group';
    group.innerHTML = `<div class="tracker-time-label">${label}</div>`;

    groupHabits.forEach(habit => {
      const done = trackerLogs.some(l => l.habit_id === habit.id && l.date === dateStr);
      const item = document.createElement('div');
      item.className = 'habit-item';

      const checkBtn = document.createElement('button');
      checkBtn.className = `habit-check${done ? ' checked' : ''}`;
      checkBtn.textContent = done ? '✓' : '';
      checkBtn.addEventListener('click', () => toggleHabit(habit.id, dateStr, done));

      const nameSpan = document.createElement('span');
      nameSpan.className = `habit-name${done ? ' checked' : ''}`;
      nameSpan.textContent = habit.name;

      const delBtn = document.createElement('button');
      delBtn.className = 'habit-delete';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', () => deleteHabit(habit.id));

      item.appendChild(checkBtn);
      item.appendChild(nameSpan);
      item.appendChild(delBtn);
      group.appendChild(item);
    });

    body.appendChild(group);
  });

  if (!habits.length) {
    body.innerHTML = '<div style="padding:40px;text-align:center;color:#aaa;font-size:14px">習慣がまだありません<br>「＋ 習慣を追加」から追加してください</div>';
  }

  renderTrackerStats();
}

function renderTrackerStats() {
  const stats = document.getElementById('tracker-stats');
  stats.innerHTML = '';

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  habits.forEach(habit => {
    const doneCount = trackerLogs.filter(l => {
      if (l.habit_id !== habit.id) return false;
      const d = new Date(l.date);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length;

    const item = document.createElement('div');
    item.className = 'stat-item';

    const dots = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const done = trackerLogs.some(l => l.habit_id === habit.id && l.date === dateStr);
      if (day > today) return `<span class="stat-dot future"></span>`;
      return `<span class="stat-dot ${done ? 'done' : ''}"></span>`;
    }).join('');

    item.innerHTML = `
      <div class="stat-header">
        <span class="stat-name">${escapeHtml(habit.name)}</span>
        <span class="stat-count">${doneCount} / ${today} 日</span>
      </div>
      <div class="stat-dots">${dots}</div>
    `;
    stats.appendChild(item);
  });

  if (!habits.length) stats.innerHTML = '';
}

// ===== 習慣チェック =====
async function toggleHabit(habitId, dateStr, currentDone) {
  if (!currentDone) {
    const { data } = await db.from('tracker_logs').insert({ habit_id: habitId, date: dateStr }).select().single();
    if (data) trackerLogs.push(data);
  } else {
    await db.from('tracker_logs').delete().eq('habit_id', habitId).eq('date', dateStr);
    trackerLogs = trackerLogs.filter(l => !(l.habit_id === habitId && l.date === dateStr));
  }
  renderTracker();
}

// ===== 習慣追加・削除 =====
async function saveHabit() {
  const name = document.getElementById('habit-name').value.trim();
  if (!name) return;
  const { data, error } = await db.from('tracker_habits')
    .insert({ name, time_of_day: selectedTod, sort_order: habits.length })
    .select().single();
  if (error) { alert('追加に失敗しました: ' + error.message); return; }
  habits.push(data);
  document.getElementById('habit-modal').classList.add('hidden');
  document.getElementById('habit-name').value = '';
  renderTracker();
}

async function deleteHabit(habitId) {
  if (!confirm('この習慣を削除しますか？')) return;
  await db.from('tracker_habits').delete().eq('id', habitId);
  habits = habits.filter(h => h.id !== habitId);
  trackerLogs = trackerLogs.filter(l => l.habit_id !== habitId);
  renderTracker();
}

// ===== Wishlist データ読み込み =====
async function loadWishlistData() {
  const { data } = await db.from('wishlist_items').select('*').order('created_at', { ascending: false });
  if (data) wishlistItems = data;
}

// ===== Wishlist レンダー =====
function renderWishlist() {
  const items = wishlistItems.filter(i => i.done === wishlistShowDone);
  const container = document.getElementById('wishlist-grid');
  container.innerHTML = '';

  if (!items.length) {
    container.innerHTML = `<div class="wishlist-empty">${wishlistShowDone ? '完了したアイテムはありません' : 'まだアイテムがありません<br>「＋ 追加」から登録しましょう'}</div>`;
    return;
  }

  // カテゴリ順
  const categoryOrder = ['なりたい姿', 'やりたいこと', '行きたい場所', 'ほしいもの', ''];
  const grouped = {};
  categoryOrder.forEach(cat => { grouped[cat] = []; });
  items.forEach(item => {
    const key = categoryOrder.includes(item.category) ? item.category : '';
    grouped[key].push(item);
  });

  categoryOrder.forEach(cat => {
    const catItems = grouped[cat];
    if (!catItems.length) return;

    const section = document.createElement('div');
    section.className = 'wishlist-category-section';

    const label = document.createElement('div');
    label.className = 'wishlist-category-label';
    label.textContent = cat || 'カテゴリなし';
    section.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'wishlist-grid';
    grid.style.padding = '0';

    catItems.forEach(item => {
      grid.appendChild(makeWishCard(item));
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

function makeWishCard(item) {
  const card = document.createElement('div');
  card.className = 'wish-card';

  // 画像エリア
  const imgArea = document.createElement('div');
  imgArea.className = `wish-card-img${item.url ? ' has-link' : ''}`;
  if (item.image_url) {
    const img = document.createElement('img');
    img.src = item.image_url;
    img.alt = item.name;
    img.onerror = () => { imgArea.textContent = '画像なし'; };
    imgArea.appendChild(img);
  } else {
    imgArea.textContent = '画像なし';
  }
  if (item.url) {
    imgArea.addEventListener('click', () => window.open(item.url, '_blank'));
  }

  // カード本文
  const body = document.createElement('div');
  body.className = 'wish-card-body';
  body.innerHTML = `
    <div class="wish-card-name">${escapeHtml(item.name)}</div>
    ${item.price ? `<div class="wish-card-price">¥${Number(item.price).toLocaleString()}</div>` : ''}
  `;

  // ボタンエリア
  const actions = document.createElement('div');
  actions.className = 'wish-card-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'wish-action-btn';
  editBtn.textContent = '編集';
  editBtn.addEventListener('click', () => editWish(item.id));

  const completeBtn = document.createElement('button');
  completeBtn.className = `wish-action-btn${!item.done ? ' complete-btn' : ''}`;
  completeBtn.textContent = item.done ? '未着手に戻す' : '完了';
  completeBtn.addEventListener('click', () => toggleWishDone(item.id, item.done));

  actions.appendChild(editBtn);
  actions.appendChild(completeBtn);

  card.appendChild(imgArea);
  card.appendChild(body);
  card.appendChild(actions);
  return card;
}

// ===== Wishlist モーダル =====
function openWishModal() {
  editingWishId = null;
  document.getElementById('wish-modal-title').textContent = 'アイテムを追加';
  document.getElementById('wish-name').value = '';
  document.getElementById('wish-category').value = '';
  document.getElementById('wish-price').value = '';
  document.getElementById('wish-image-url').value = '';
  document.getElementById('wish-url').value = '';
  document.getElementById('wish-memo').value = '';
  document.getElementById('delete-wish-btn').classList.add('hidden');
  document.getElementById('wish-modal').classList.remove('hidden');
}

function editWish(id) {
  const item = wishlistItems.find(i => i.id === id);
  if (!item) return;
  editingWishId = id;
  document.getElementById('wish-modal-title').textContent = 'アイテムを編集';
  document.getElementById('wish-name').value = item.name || '';
  document.getElementById('wish-category').value = item.category || '';
  document.getElementById('wish-price').value = item.price || '';
  document.getElementById('wish-image-url').value = item.image_url || '';
  document.getElementById('wish-url').value = item.url || '';
  document.getElementById('wish-memo').value = item.memo || '';
  document.getElementById('delete-wish-btn').classList.remove('hidden');
  document.getElementById('wish-modal').classList.remove('hidden');
}

function closeWishModal() {
  document.getElementById('wish-modal').classList.add('hidden');
  editingWishId = null;
}

async function saveWish() {
  const name = document.getElementById('wish-name').value.trim();
  if (!name) { alert('アイテム名を入力してください'); return; }
  const payload = {
    name,
    category: document.getElementById('wish-category').value.trim(),
    price: parseInt(document.getElementById('wish-price').value) || null,
    image_url: document.getElementById('wish-image-url').value.trim() || null,
    url: document.getElementById('wish-url').value.trim() || null,
    memo: document.getElementById('wish-memo').value.trim(),
  };
  if (editingWishId) {
    const { data, error } = await db.from('wishlist_items').update(payload).eq('id', editingWishId).select().single();
    if (error) { alert('更新に失敗しました: ' + error.message); return; }
    const idx = wishlistItems.findIndex(i => i.id === editingWishId);
    if (idx > -1) wishlistItems[idx] = data;
  } else {
    const { data, error } = await db.from('wishlist_items').insert({ ...payload, done: false }).select().single();
    if (error) { alert('追加に失敗しました: ' + error.message); return; }
    wishlistItems.unshift(data);
  }
  closeWishModal();
  renderWishlist();
}

async function toggleWishDone(id, currentDone) {
  const { error } = await db.from('wishlist_items').update({ done: !currentDone }).eq('id', id);
  if (!error) {
    const item = wishlistItems.find(i => i.id === id);
    if (item) item.done = !currentDone;
  }
  renderWishlist();
}

async function deleteWish(id) {
  if (!confirm('このアイテムを削除しますか？')) return;
  await db.from('wishlist_items').delete().eq('id', id);
  wishlistItems = wishlistItems.filter(i => i.id !== id);
  closeWishModal();
  renderWishlist();
}

// ===== Journal データ読み込み =====
async function loadJournalData() {
  const { data } = await db.from('journal_entries').select('*');
  if (data) journalEntries = data;
}

// ===== Journal ユーティリティ =====
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // 月曜始まり
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ===== Journal レンダー =====
function renderJournal() {
  if (currentJournalView === 'daily') renderDailyJournal();
  else if (currentJournalView === 'weekly') renderWeeklyJournal();
  else if (currentJournalView === 'monthly') renderMonthlyJournal();
}

function switchJournalView(view) {
  currentJournalView = view;
  document.querySelectorAll('.journal-subview').forEach(v => v.classList.remove('active'));
  document.getElementById(`journal-${view}`).classList.add('active');
  document.querySelectorAll('[data-journal-view]').forEach(b => {
    b.classList.toggle('active', b.dataset.journalView === view);
  });
  renderJournal();
}

function renderDailyJournal() {
  const dateStr = toDateStr(journalDay);
  document.getElementById('journal-daily-label').textContent = formatDateJP(journalDay);

  const dayTasks = getTasksForDate(dateStr);
  const entry = journalEntries.find(e => e.date === dateStr && e.period === 'daily');
  const doneTasks = dayTasks.filter(t => isTaskDoneOnDate(t, dateStr));

  const dayHabits = habits.map(h => ({
    ...h,
    done: trackerLogs.some(l => l.habit_id === h.id && l.date === dateStr)
  }));
  const doneHabits = dayHabits.filter(h => h.done);

  const content = document.getElementById('journal-daily-content');
  content.innerHTML = '';

  // タスク
  const taskSection = makeJournalSection(
    'TASKS',
    `${doneTasks.length} / ${dayTasks.length} 完了`,
    dayTasks.length
      ? dayTasks.map(t => makeTaskRow(t.title, isTaskDoneOnDate(t, dateStr))).join('')
      : '<div class="journal-empty">タスクなし</div>'
  );
  content.appendChild(taskSection);

  // 習慣
  const habitSection = makeJournalSection(
    'HABITS',
    `${doneHabits.length} / ${dayHabits.length} 達成`,
    dayHabits.length
      ? dayHabits.map(h => makeTaskRow(h.name, h.done)).join('')
      : '<div class="journal-empty">習慣なし</div>'
  );
  content.appendChild(habitSection);

  // メモ
  content.appendChild(makeMemoSection(entry?.content || '', dateStr, 'daily', '今日の振り返りを書きましょう...'));
}

function renderWeeklyJournal() {
  const weekStart = new Date(journalWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekKey = toDateStr(weekStart);

  document.getElementById('journal-weekly-label').textContent =
    `${weekStart.getMonth()+1}/${weekStart.getDate()} 〜 ${weekEnd.getMonth()+1}/${weekEnd.getDate()}`;

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return toDateStr(d);
  });

  // タスク（重複排除）
  const seen = new Set();
  const weekTasks = tasks.filter(t => {
    if (!weekDates.some(d => isTaskOnDate(t, d))) return false;
    if (seen.has(t.id)) return false;
    seen.add(t.id); return true;
  });
  const doneWeekTasks = weekTasks.filter(t => weekDates.some(d => isTaskDoneOnDate(t, d)));

  // 習慣
  const habitStats = habits.map(h => {
    const count = weekDates.filter(d => trackerLogs.some(l => l.habit_id === h.id && l.date === d)).length;
    return { ...h, count, total: 7 };
  });

  const entry = journalEntries.find(e => e.date === weekKey && e.period === 'weekly');
  const content = document.getElementById('journal-weekly-content');
  content.innerHTML = '';

  content.appendChild(makeJournalSection(
    'TASKS',
    `${doneWeekTasks.length} / ${weekTasks.length} 完了`,
    weekTasks.length
      ? weekTasks.map(t => makeTaskRow(t.title, weekDates.some(d => isTaskDoneOnDate(t, d)))).join('')
      : '<div class="journal-empty">タスクなし</div>'
  ));

  content.appendChild(makeJournalSection(
    'HABITS',
    '',
    habitStats.length
      ? habitStats.map(h => makeHabitStatRow(h.name, h.count, h.total)).join('')
      : '<div class="journal-empty">習慣なし</div>'
  ));

  content.appendChild(makeMemoSection(entry?.content || '', weekKey, 'weekly', '今週の振り返りを書きましょう...'));
}

function renderMonthlyJournal() {
  const year = journalMonth.getFullYear();
  const month = journalMonth.getMonth();
  const monthKey = `${year}-${String(month+1).padStart(2,'0')}`;
  const daysInMonth = new Date(year, month+1, 0).getDate();
  document.getElementById('journal-monthly-label').textContent = `${year}年${month+1}月`;

  const monthDates = Array.from({ length: daysInMonth }, (_, i) =>
    `${year}-${String(month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`
  );

  const seen = new Set();
  const monthTasks = tasks.filter(t => {
    if (!monthDates.some(d => isTaskOnDate(t, d))) return false;
    if (seen.has(t.id)) return false;
    seen.add(t.id); return true;
  });
  const doneMonthTasks = monthTasks.filter(t => monthDates.some(d => isTaskDoneOnDate(t, d)));

  const today = new Date();
  const passedDays = (year === today.getFullYear() && month === today.getMonth())
    ? today.getDate() : daysInMonth;

  const habitStats = habits.map(h => {
    const count = monthDates.slice(0, passedDays).filter(d =>
      trackerLogs.some(l => l.habit_id === h.id && l.date === d)
    ).length;
    return { ...h, count, total: passedDays };
  });

  const entry = journalEntries.find(e => e.date === monthKey && e.period === 'monthly');
  const content = document.getElementById('journal-monthly-content');
  content.innerHTML = '';

  content.appendChild(makeJournalSection(
    'TASKS',
    `${doneMonthTasks.length} / ${monthTasks.length} 完了`,
    monthTasks.length
      ? monthTasks.map(t => makeTaskRow(t.title, monthDates.some(d => isTaskDoneOnDate(t, d)))).join('')
      : '<div class="journal-empty">タスクなし</div>'
  ));

  content.appendChild(makeJournalSection(
    'HABITS',
    '',
    habitStats.length
      ? habitStats.map(h => makeHabitStatRow(h.name, h.count, h.total)).join('')
      : '<div class="journal-empty">習慣なし</div>'
  ));

  content.appendChild(makeMemoSection(entry?.content || '', monthKey, 'monthly', '今月の振り返りを書きましょう...'));
}

// ===== Journal ヘルパー =====
function makeJournalSection(title, badge, innerHtml) {
  const sec = document.createElement('div');
  sec.className = 'journal-section';
  sec.innerHTML = `
    <div class="journal-section-title">
      ${title}
      ${badge ? `<span class="journal-badge">${badge}</span>` : ''}
    </div>
    ${innerHtml}
  `;
  return sec;
}

function makeTaskRow(title, done) {
  return `
    <div class="journal-task-item${done ? ' done' : ''}">
      <span class="journal-check-icon">${done ? '✓' : ''}</span>
      <span>${escapeHtml(title)}</span>
    </div>`;
}

function makeHabitStatRow(name, count, total) {
  const pct = total > 0 ? Math.round(count / total * 100) : 0;
  return `
    <div class="journal-habit-stat">
      <span class="journal-habit-name">${escapeHtml(name)}</span>
      <span class="journal-habit-count">${count}/${total}日</span>
      <div class="journal-habit-bar">
        <div class="journal-habit-bar-fill" style="width:${pct}%"></div>
      </div>
    </div>`;
}

function makeMemoSection(value, date, period, placeholder) {
  const sec = document.createElement('div');
  sec.className = 'journal-section';
  sec.innerHTML = `
    <div class="journal-section-title">振り返りメモ</div>
    <div class="journal-memo-wrap">
      <textarea class="journal-textarea" id="journal-memo-input" placeholder="${placeholder}">${escapeHtml(value)}</textarea>
      <button class="journal-save-btn" id="journal-save-btn">保存</button>
    </div>
  `;
  sec.querySelector('#journal-save-btn').addEventListener('click', () => saveJournalEntry(date, period));
  return sec;
}

async function saveJournalEntry(date, period) {
  const textarea = document.getElementById('journal-memo-input');
  if (!textarea) return;
  const content = textarea.value;
  const existing = journalEntries.find(e => e.date === date && e.period === period);
  if (existing) {
    const { error } = await db.from('journal_entries')
      .update({ content, updated_at: new Date().toISOString() }).eq('id', existing.id);
    if (!error) existing.content = content;
  } else {
    const { data, error } = await db.from('journal_entries')
      .insert({ date, period, content }).select().single();
    if (error) { alert('保存に失敗しました: ' + error.message); return; }
    journalEntries.push(data);
  }
  const btn = document.getElementById('journal-save-btn');
  if (btn) { btn.textContent = '保存しました！'; setTimeout(() => { if (btn) btn.textContent = '保存'; }, 1500); }
}

// ===== Tasks データ読み込み =====
async function loadTaskData() {
  const { data: t } = await db.from('tasks').select('*').order('created_at');
  if (t) tasks = t;
  const { data: c } = await db.from('categories').select('*').order('created_at');
  if (c) categories = c;
  const { data: co } = await db.from('task_completions').select('*');
  if (co) completions = co;
}

// ===== Vision データ読み込み =====
async function loadVisionData() {
  const { data: v } = await db.from('visions').select('*');
  if (v) visions = v;
  const { data: g } = await db.from('yearly_goals').select('*');
  if (g) yearlyGoals = g;
}

// ===== Vision レンダー =====
function renderVision() {
  // 年タイトル
  document.getElementById('vision-year-title').textContent = currentYear;
  document.getElementById('goals-heading').textContent = `${currentYear} GOALS`;

  // ビジョンカード
  const grid = document.getElementById('vision-grid');
  grid.innerHTML = '';
  const roles = ['Husband', 'Father', 'Health', 'Work'];
  roles.forEach(role => {
    const vision = visions.find(v => v.role === role);
    const content = vision?.content || '';
    const card = document.createElement('div');
    card.className = 'vision-card';
    card.innerHTML = `
      <div>
        <div class="vision-card-role">${role}</div>
        <div class="vision-card-content ${!content ? 'vision-card-empty' : ''}">
          ${content ? escapeHtml(content) : 'タップして入力'}
        </div>
      </div>
      <div class="vision-card-edit">編集 ›</div>
    `;
    card.addEventListener('click', () => openVisionModal(role, content));
    grid.appendChild(card);
  });

  // 年別目標
  const goal = yearlyGoals.find(g => g.year === currentYear);
  const goalContent = goal?.content || '';
  const display = document.getElementById('goals-display');
  display.textContent = goalContent;
  display.className = `goals-card${!goalContent ? ' empty' : ''}`;
  if (!goalContent) display.textContent = 'まだ目標が入力されていません';
}

// ===== Vision モーダル =====
function openVisionModal(role, content) {
  editingVisionRole = role;
  document.getElementById('vision-modal-title').textContent = `${role} — Vision`;
  document.getElementById('vision-textarea').value = content;
  document.getElementById('vision-modal').classList.remove('hidden');
}

function closeVisionModal() {
  document.getElementById('vision-modal').classList.add('hidden');
  editingVisionRole = null;
}

async function saveVision() {
  const content = document.getElementById('vision-textarea').value;
  const { error } = await db.from('visions')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('role', editingVisionRole);
  if (error) { alert('保存に失敗しました: ' + error.message); return; }
  const v = visions.find(v => v.role === editingVisionRole);
  if (v) v.content = content;
  closeVisionModal();
  renderVision();
}

// ===== 年別目標 =====
function openGoalsEdit() {
  const goal = yearlyGoals.find(g => g.year === currentYear);
  document.getElementById('goals-textarea').value = goal?.content || '';
  document.getElementById('goals-display').classList.add('hidden');
  document.getElementById('goals-edit').classList.remove('hidden');
  document.getElementById('edit-goals-btn').classList.add('hidden');
}

function closeGoalsEdit() {
  document.getElementById('goals-display').classList.remove('hidden');
  document.getElementById('goals-edit').classList.add('hidden');
  document.getElementById('edit-goals-btn').classList.remove('hidden');
}

async function saveGoals() {
  const content = document.getElementById('goals-textarea').value;
  const existing = yearlyGoals.find(g => g.year === currentYear);
  let error;
  if (existing) {
    ({ error } = await db.from('yearly_goals')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('year', currentYear));
    if (!error) existing.content = content;
  } else {
    const { data, error: e } = await db.from('yearly_goals')
      .insert({ year: currentYear, content }).select().single();
    error = e;
    if (!error) yearlyGoals.push(data);
  }
  if (error) { alert('保存に失敗しました: ' + error.message); return; }
  closeGoalsEdit();
  renderVision();
}

// ===== 年の表示 =====
function renderYear() {
  document.getElementById('current-year').textContent = currentYear;
  renderCurrentView();
}

// ===== ビュー切り替え =====
function renderCurrentView() {
  if (currentView === 'vision') renderVision();
  if (currentView === 'tasks') renderTasksSection();
  if (currentView === 'tracker') renderTracker();
  if (currentView === 'journal') renderJournal();
  if (currentView === 'wishlist') renderWishlist();
}

// ===== Tasks セクション =====
function renderTasksSection() {
  if (currentTaskView === 'gtd') renderGTD();
  else if (currentTaskView === 'cal') renderCalendar();
  else if (currentTaskView === 'cat') renderCategoryView();
}

function switchTaskView(view) {
  currentTaskView = view;
  document.querySelectorAll('.task-subview').forEach(v => v.classList.remove('active'));
  document.getElementById(`task-${view}`).classList.add('active');
  document.querySelectorAll('.sub-nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.taskView === view);
  });
  renderTasksSection();
}

// ===== 日付ユーティリティ =====
function toDateStr(date) { return date.toLocaleDateString('sv-SE'); }

function formatDateJP(date) {
  const days = ['日','月','火','水','木','金','土'];
  return `${date.getMonth()+1}月${date.getDate()}日（${days[date.getDay()]}）`;
}

// ===== 繰り返し判定 =====
function isTaskOnDate(task, dateStr) {
  if (task.date === dateStr) return true;
  if (!task.repeat || task.repeat === 'none') return false;
  const base = new Date(task.date);
  const target = new Date(dateStr);
  if (target <= base) return false;
  if (task.repeat === 'daily') return true;
  if (task.repeat === 'weekday') return target.getDay() !== 0 && target.getDay() !== 6;
  if (task.repeat === 'weekly') return base.getDay() === target.getDay();
  if (task.repeat === 'monthly') return base.getDate() === target.getDate();
  return false;
}

function isTaskDoneOnDate(task, dateStr) {
  if (!task.repeat || task.repeat === 'none') return task.done;
  return completions.some(c => c.task_id === task.id && c.date === dateStr);
}

function getTasksForDate(dateStr) {
  return tasks.filter(t => !t.in_inbox && isTaskOnDate(t, dateStr));
}

function timeToBlock(t) {
  if (!t) return null;
  const h = parseInt(t.split(':')[0]);
  if (h < 13) return 9;
  if (h < 17) return 13;
  if (h < 21) return 17;
  return 21;
}

// ===== GTD =====
function renderGTD() {
  renderInbox();
  renderDailyBlocks();
  updatePanelVisibility();
}

function updatePanelVisibility() {
  const isTablet = window.innerWidth >= 768;
  const inboxCol = document.getElementById('inbox-col');
  const todayCol = document.getElementById('today-col');
  if (!inboxCol || !todayCol) return;
  if (isTablet) {
    inboxCol.classList.add('active');
    todayCol.classList.add('active');
  } else {
    inboxCol.classList.toggle('active', activePanel === 'inbox');
    todayCol.classList.toggle('active', activePanel === 'today');
  }
}

function renderInbox() {
  const inboxTasks = tasks.filter(t => t.in_inbox === true);
  const count = inboxTasks.length;
  document.getElementById('inbox-count').textContent = count;
  document.getElementById('inbox-badge').textContent = count;

  const list = document.getElementById('inbox-list');
  list.innerHTML = '';

  if (!inboxTasks.length) {
    list.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:#aaa">タスクなし</div>';
  } else {
    inboxTasks.forEach(task => {
      const cat = categories.find(c => c.id === task.category_id);
      const el = document.createElement('div');
      el.className = `inbox-item${task.done ? ' done' : ''}`;
      el.dataset.taskId = task.id;
      el.innerHTML = `
        <span class="drag-handle">⠿</span>
        <button class="check-btn" onclick="toggleInboxTask('${task.id}')">${task.done ? '✓' : ''}</button>
        <div class="task-content">
          <span class="task-title">${escapeHtml(task.title)}</span>
          ${cat ? `<div class="task-badges"><span class="task-cat">${escapeHtml(cat.name)}</span></div>` : ''}
        </div>
        <button class="edit-btn" onclick="editTask('${task.id}')">編集</button>
        <button class="delete-btn" onclick="deleteTask('${task.id}')">×</button>
      `;
      list.appendChild(el);
    });
  }
  setupInboxSortable();
}

function setupInboxSortable() {
  if (typeof Sortable === 'undefined') return;
  if (inboxSortable) { inboxSortable.destroy(); inboxSortable = null; }
  const list = document.getElementById('inbox-list');
  inboxSortable = new Sortable(list, {
    group: { name: 'tasks', pull: true, put: true },
    animation: 150,
    ghostClass: 'sortable-ghost',
    handle: '.drag-handle',
    onAdd: async (evt) => { if (evt.item.dataset.taskId) await moveTaskToInbox(evt.item.dataset.taskId); },
    onStart: () => document.querySelectorAll('.block-task-zone').forEach(z => z.classList.add('drop-highlight')),
    onEnd: () => document.querySelectorAll('.block-task-zone').forEach(z => z.classList.remove('drop-highlight')),
  });
}

function renderDailyBlocks() {
  document.getElementById('current-date').textContent = formatDateJP(currentDate);
  const dateStr = toDateStr(currentDate);
  blockSortables.forEach(s => s.destroy());
  blockSortables = [];
  const container = document.getElementById('time-blocks');
  container.innerHTML = '';

  TIME_BLOCKS.forEach(block => {
    const blockTasks = getTasksForDate(dateStr)
      .filter(t => t.time_block === block.start)
      .sort((a, b) => (a.task_time || '99:99').localeCompare(b.task_time || '99:99'));

    const blockEl = document.createElement('div');
    blockEl.className = 'time-block';
    blockEl.innerHTML = `<div class="time-block-header"><span class="time-label">${block.label}</span><span class="task-count">${blockTasks.length}件</span></div>`;

    const zone = document.createElement('div');
    zone.className = 'block-task-zone';
    zone.dataset.block = block.start;
    blockTasks.forEach(t => zone.appendChild(createTaskEl(t, dateStr)));
    blockEl.appendChild(zone);

    const addBtn = document.createElement('button');
    addBtn.className = 'add-in-block';
    addBtn.textContent = '＋ タスクを追加';
    addBtn.addEventListener('click', () => openTaskModal(block.start, dateStr));
    blockEl.appendChild(addBtn);
    container.appendChild(blockEl);

    if (typeof Sortable !== 'undefined') {
      const s = new Sortable(zone, {
        group: { name: 'tasks', pull: true, put: true },
        animation: 150,
        ghostClass: 'sortable-ghost',
        filter: '.is-repeat',
        preventOnFilter: false,
        onAdd: async (evt) => { if (evt.item.dataset.taskId) await moveTaskToBlock(evt.item.dataset.taskId, block.start, dateStr); },
        onStart: () => document.querySelectorAll('.block-task-zone').forEach(z => z.classList.add('drop-highlight')),
        onEnd: () => document.querySelectorAll('.block-task-zone').forEach(z => z.classList.remove('drop-highlight')),
      });
      blockSortables.push(s);
    }
  });
}

function createTaskEl(task, dateStr) {
  const done = isTaskDoneOnDate(task, dateStr);
  const cat = categories.find(c => c.id === task.category_id);
  const isRepeat = task.repeat && task.repeat !== 'none';
  const repeatLabel = { daily: '毎日', weekday: '平日', weekly: '毎週', monthly: '毎月' }[task.repeat] || '';
  const badges = [];
  if (cat) badges.push(`<span class="task-cat">${escapeHtml(cat.name)}</span>`);
  if (repeatLabel) badges.push(`<span class="task-repeat">${repeatLabel}</span>`);

  const el = document.createElement('div');
  el.className = `task-item${done ? ' done' : ''}${isRepeat ? ' is-repeat' : ''}`;
  el.dataset.taskId = task.id;
  el.innerHTML = `
    ${!isRepeat ? '<span class="drag-handle">⠿</span>' : '<span style="width:8px;flex-shrink:0"></span>'}
    <button class="check-btn" onclick="toggleTask('${task.id}','${dateStr}',${done})">${done ? '✓' : ''}</button>
    <div class="task-content">
      <span class="task-title">${escapeHtml(task.title)}</span>
      ${task.task_time ? `<span class="task-time-range">${task.task_time.slice(0,5)}${task.task_time_end ? ' 〜 '+task.task_time_end.slice(0,5) : ''}</span>` : ''}
      ${badges.length ? `<div class="task-badges">${badges.join('')}</div>` : ''}
    </div>
    <button class="edit-btn" onclick="editTask('${task.id}')">編集</button>
    <button class="delete-btn" onclick="deleteTask('${task.id}')">×</button>
  `;
  return el;
}

// ===== タスク移動 =====
async function moveTaskToBlock(taskId, block, dateStr) {
  const task = tasks.find(t => t.id === taskId);
  if (task?.repeat && task.repeat !== 'none') { setTimeout(() => renderGTD(), 50); return; }
  const { error } = await db.from('tasks').update({ in_inbox: false, time_block: block, date: dateStr }).eq('id', taskId);
  if (!error && task) { task.in_inbox = false; task.time_block = block; task.date = dateStr; }
  setTimeout(() => renderGTD(), 100);
}

async function moveTaskToInbox(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task?.repeat && task.repeat !== 'none') { setTimeout(() => renderGTD(), 50); return; }
  const { error } = await db.from('tasks').update({ in_inbox: true }).eq('id', taskId);
  if (!error && task) task.in_inbox = true;
  setTimeout(() => renderGTD(), 100);
}

// ===== タスク操作 =====
async function toggleInboxTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  await db.from('tasks').update({ done: !task.done }).eq('id', taskId);
  task.done = !task.done;
  renderInbox();
}

async function toggleTask(taskId, dateStr, currentDone) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  if (!task.repeat || task.repeat === 'none') {
    await db.from('tasks').update({ done: !currentDone }).eq('id', taskId);
    task.done = !currentDone;
  } else {
    if (!currentDone) {
      const { data } = await db.from('task_completions').insert({ task_id: taskId, date: dateStr }).select().single();
      if (data) completions.push(data);
    } else {
      await db.from('task_completions').delete().eq('task_id', taskId).eq('date', dateStr);
      completions = completions.filter(c => !(c.task_id === taskId && c.date === dateStr));
    }
  }
  renderDailyBlocks();
}

async function deleteTask(taskId) {
  if (!confirm('このタスクを削除しますか？')) return;
  await db.from('tasks').delete().eq('id', taskId);
  tasks = tasks.filter(t => t.id !== taskId);
  renderTasksSection();
}

async function quickAddTask() {
  const input = document.getElementById('quick-add-input');
  const title = input.value.trim();
  if (!title) return;
  const { data, error } = await db.from('tasks').insert({ title, in_inbox: true, done: false, repeat: 'none' }).select().single();
  if (error) { alert('追加に失敗しました: ' + error.message); return; }
  tasks.push(data);
  input.value = '';
  renderInbox();
}

async function saveTask() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) { alert('タスク名を入力してください'); return; }
  const categoryId = document.getElementById('task-category').value || null;
  const date = document.getElementById('task-date').value || null;
  const taskTimeStart = document.getElementById('task-time-start').value || null;
  const taskTimeEnd = document.getElementById('task-time-end').value || null;
  const repeat = document.getElementById('task-repeat').value;
  if (repeat !== 'none' && !date) { alert('繰り返しタスクには開始日を入力してください'); return; }
  const inInbox = repeat === 'none' && !date;
  const timeBlock = taskTimeStart ? timeToBlock(taskTimeStart) : (date || repeat !== 'none') ? defaultTimeBlock : null;
  const payload = { title, category_id: categoryId, date, time_block: timeBlock, task_time: taskTimeStart, task_time_end: taskTimeEnd, repeat, done: false, in_inbox: inInbox };

  if (editingTaskId) {
    const { data, error } = await db.from('tasks').update(payload).eq('id', editingTaskId).select().single();
    if (error) { alert('更新に失敗しました: ' + error.message); return; }
    const idx = tasks.findIndex(t => t.id === editingTaskId);
    if (idx > -1) tasks[idx] = data;
  } else {
    const { data, error } = await db.from('tasks').insert(payload).select().single();
    if (error) { alert('追加に失敗しました: ' + error.message); return; }
    tasks.push(data);
  }
  closeTaskModal();
  renderTasksSection();
}

// ===== カテゴリ =====
function renderCategoryView() {
  const container = document.getElementById('category-list');
  container.innerHTML = '';
  const noCat = tasks.filter(t => !t.category_id);
  if (noCat.length) container.appendChild(makeCategorySection('カテゴリなし', noCat));
  categories.forEach(cat => {
    container.appendChild(makeCategorySection(cat.name, tasks.filter(t => t.category_id === cat.id)));
  });
}

function makeCategorySection(name, catTasks) {
  const section = document.createElement('div');
  section.className = 'category-section';
  section.innerHTML = `
    <div class="category-header">
      <span class="category-name">${escapeHtml(name)}</span>
      <span class="category-count">${catTasks.length}件</span>
    </div>
    <div>${catTasks.map(t => `
      <div class="task-item-simple">
        <span>${escapeHtml(t.title)}</span>
        <span class="task-date-label">${t.in_inbox ? 'INBOX' : (t.date || '-')}</span>
      </div>`).join('') || '<div style="padding:10px 14px;font-size:13px;color:#aaa">タスクなし</div>'}
    </div>`;
  return section;
}

async function saveCategory() {
  const name = document.getElementById('new-category-name').value.trim();
  if (!name) return;
  const { data, error } = await db.from('categories').insert({ name }).select().single();
  if (!error) { categories.push(data); document.getElementById('new-category-name').value = ''; renderCategoryModalList(); refreshCategorySelect(); }
}

async function deleteCategory(id) {
  if (!confirm('このカテゴリを削除しますか？')) return;
  await db.from('categories').delete().eq('id', id);
  categories = categories.filter(c => c.id !== id);
  renderCategoryModalList(); refreshCategorySelect(); renderTasksSection();
}

function renderCategoryModalList() {
  document.getElementById('category-modal-list').innerHTML =
    categories.map(c => `<div class="cat-modal-item"><span>${escapeHtml(c.name)}</span><button onclick="deleteCategory('${c.id}')">削除</button></div>`).join('') ||
    '<div style="padding:10px 0;font-size:13px;color:#aaa">カテゴリがありません</div>';
}

function refreshCategorySelect() {
  const sel = document.getElementById('task-category');
  const cur = sel.value;
  sel.innerHTML = '<option value="">カテゴリなし</option>' + categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  sel.value = cur;
}

// ===== モーダル =====
function openTaskModal(timeBlock, dateStr) {
  editingTaskId = null;
  defaultTimeBlock = timeBlock || 9;
  document.getElementById('task-modal-title').textContent = 'タスクを追加';
  document.getElementById('task-title').value = '';
  document.getElementById('task-category').value = '';
  document.getElementById('task-date').value = dateStr || '';
  document.getElementById('task-time-start').value = '';
  document.getElementById('task-time-end').value = '';
  document.getElementById('task-repeat').value = 'none';
  refreshCategorySelect();
  updateDestinationHint();
  document.getElementById('task-modal').classList.remove('hidden');
}

function editTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  editingTaskId = taskId;
  defaultTimeBlock = task.time_block || 9;
  document.getElementById('task-modal-title').textContent = 'タスクを編集';
  document.getElementById('task-title').value = task.title || '';
  document.getElementById('task-date').value = task.date || '';
  document.getElementById('task-time-start').value = task.task_time ? task.task_time.slice(0,5) : '';
  document.getElementById('task-time-end').value = task.task_time_end ? task.task_time_end.slice(0,5) : '';
  document.getElementById('task-repeat').value = task.repeat || 'none';
  refreshCategorySelect();
  document.getElementById('task-category').value = task.category_id || '';
  updateDestinationHint();
  document.getElementById('task-modal').classList.remove('hidden');
}

function closeTaskModal() {
  document.getElementById('task-modal').classList.add('hidden');
  editingTaskId = null;
}

function updateDestinationHint() {
  const date = document.getElementById('task-date').value;
  const repeat = document.getElementById('task-repeat').value;
  const hint = document.getElementById('task-destination');
  if (repeat !== 'none') hint.textContent = '→ 繰り返しタスクとして時間ブロックに追加されます';
  else if (date) hint.textContent = `→ ${date} の時間ブロックに追加されます`;
  else hint.textContent = '→ 日付なしの場合は INBOX に追加されます';
}

// ===== カレンダー =====
function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  document.getElementById('current-month').textContent = `${year}年${month+1}月`;
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';
  ['日','月','火','水','木','金','土'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-header';
    el.textContent = d;
    grid.appendChild(el);
  });
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month+1, 0);
  const todayStr = toDateStr(new Date());
  for (let i = 0; i < firstDay.getDay(); i++) {
    const b = document.createElement('div'); b.className = 'cal-day empty'; grid.appendChild(b);
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    const dateStr = toDateStr(date);
    const count = getTasksForDate(dateStr).length;
    const isToday = dateStr === todayStr;
    const div = document.createElement('div');
    div.className = `cal-day${isToday ? ' today' : ''}`;
    div.innerHTML = `<span class="cal-date">${d}</span>${count > 0 ? `<span class="cal-count">${count}</span>` : ''}`;
    div.onclick = () => { currentDate = date; activePanel = 'today'; switchTaskView('gtd'); };
    grid.appendChild(div);
  }
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`${view}-view`).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  renderCurrentView();
}

// ===== ユーティリティ =====
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== イベントリスナー =====
function setupEventListeners() {
  // ナビゲーション
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // 年選択
  document.getElementById('prev-year').addEventListener('click', () => {
    currentYear--;
    renderYear();
  });
  document.getElementById('next-year').addEventListener('click', () => {
    currentYear++;
    renderYear();
  });

  // Tasks サブナビ
  document.querySelectorAll('.sub-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTaskView(btn.dataset.taskView));
  });

  // パネル切り替え（モバイル）
  document.querySelectorAll('.panel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.panel-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activePanel = btn.dataset.panel;
      if (btn.dataset.panel === 'today') {
        currentDate = new Date();
        renderDailyBlocks();
      }
      updatePanelVisibility();
    });
  });

  // 日付移動
  document.getElementById('prev-day').addEventListener('click', () => { currentDate.setDate(currentDate.getDate()-1); renderDailyBlocks(); });
  document.getElementById('next-day').addEventListener('click', () => { currentDate.setDate(currentDate.getDate()+1); renderDailyBlocks(); });

  // 月移動
  document.getElementById('prev-month').addEventListener('click', () => { currentMonth.setMonth(currentMonth.getMonth()-1); renderCalendar(); });
  document.getElementById('next-month').addEventListener('click', () => { currentMonth.setMonth(currentMonth.getMonth()+1); renderCalendar(); });

  // クイック追加
  document.getElementById('quick-add-btn').addEventListener('click', quickAddTask);
  document.getElementById('quick-add-input').addEventListener('keydown', e => { if (e.key === 'Enter') quickAddTask(); });

  // FAB
  document.getElementById('add-task-btn').addEventListener('click', () => openTaskModal());

  // タスクモーダル
  document.getElementById('save-task').addEventListener('click', saveTask);
  document.getElementById('cancel-task').addEventListener('click', closeTaskModal);
  document.getElementById('task-date').addEventListener('change', updateDestinationHint);
  document.getElementById('task-repeat').addEventListener('change', updateDestinationHint);
  document.getElementById('task-modal').addEventListener('click', e => { if (e.target === document.getElementById('task-modal')) closeTaskModal(); });

  // カテゴリモーダル
  document.getElementById('manage-cat-btn').addEventListener('click', () => { renderCategoryModalList(); document.getElementById('category-modal').classList.remove('hidden'); });
  document.getElementById('save-category').addEventListener('click', saveCategory);
  document.getElementById('close-category-modal').addEventListener('click', () => document.getElementById('category-modal').classList.add('hidden'));
  document.getElementById('category-modal').addEventListener('click', e => { if (e.target === document.getElementById('category-modal')) document.getElementById('category-modal').classList.add('hidden'); });

  window.addEventListener('resize', updatePanelVisibility);

  // Tracker 日付移動
  document.getElementById('tracker-prev-day').addEventListener('click', () => {
    trackerDate.setDate(trackerDate.getDate() - 1);
    renderTracker();
  });
  document.getElementById('tracker-next-day').addEventListener('click', () => {
    trackerDate.setDate(trackerDate.getDate() + 1);
    renderTracker();
  });

  // 習慣追加モーダルを開く
  document.getElementById('add-habit-btn').addEventListener('click', () => {
    document.getElementById('habit-name').value = '';
    selectedTod = 'morning';
    document.querySelectorAll('.tod-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tod === 'morning');
    });
    document.getElementById('habit-modal').classList.remove('hidden');
  });

  // 時間帯ボタン（朝/昼/夜）
  document.querySelectorAll('.tod-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tod-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTod = btn.dataset.tod;
    });
  });

  // 習慣保存・キャンセル
  document.getElementById('save-habit').addEventListener('click', saveHabit);
  document.getElementById('cancel-habit').addEventListener('click', () => {
    document.getElementById('habit-modal').classList.add('hidden');
  });

  // 習慣モーダル背景クリックで閉じる
  document.getElementById('habit-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('habit-modal')) {
      document.getElementById('habit-modal').classList.add('hidden');
    }
  });

  // Wishlist タブ切り替え
  document.querySelectorAll('.wishlist-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      wishlistShowDone = btn.dataset.done === 'true';
      document.querySelectorAll('.wishlist-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderWishlist();
    });
  });

  // Wishlist モーダル
  document.getElementById('add-wish-btn').addEventListener('click', openWishModal);
  document.getElementById('save-wish').addEventListener('click', saveWish);
  document.getElementById('cancel-wish').addEventListener('click', closeWishModal);
  document.getElementById('delete-wish-btn').addEventListener('click', () => {
    if (editingWishId) deleteWish(editingWishId);
  });
  document.getElementById('wish-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('wish-modal')) closeWishModal();
  });

  // Journal サブナビ
  document.querySelectorAll('[data-journal-view]').forEach(btn => {
    btn.addEventListener('click', () => switchJournalView(btn.dataset.journalView));
  });

  // Journal 日次 日付移動
  document.getElementById('journal-prev-day').addEventListener('click', () => {
    journalDay.setDate(journalDay.getDate() - 1); renderDailyJournal();
  });
  document.getElementById('journal-next-day').addEventListener('click', () => {
    journalDay.setDate(journalDay.getDate() + 1); renderDailyJournal();
  });

  // Journal 週次 週移動
  document.getElementById('journal-prev-week').addEventListener('click', () => {
    journalWeek.setDate(journalWeek.getDate() - 7); renderWeeklyJournal();
  });
  document.getElementById('journal-next-week').addEventListener('click', () => {
    journalWeek.setDate(journalWeek.getDate() + 7); renderWeeklyJournal();
  });

  // Journal 月次 月移動
  document.getElementById('journal-prev-month-j').addEventListener('click', () => {
    journalMonth.setMonth(journalMonth.getMonth() - 1); renderMonthlyJournal();
  });
  document.getElementById('journal-next-month-j').addEventListener('click', () => {
    journalMonth.setMonth(journalMonth.getMonth() + 1); renderMonthlyJournal();
  });

  // Visionモーダル
  document.getElementById('save-vision').addEventListener('click', saveVision);
  document.getElementById('cancel-vision').addEventListener('click', closeVisionModal);
  document.getElementById('vision-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('vision-modal')) closeVisionModal();
  });

  // 年別目標
  document.getElementById('edit-goals-btn').addEventListener('click', openGoalsEdit);
  document.getElementById('save-goals').addEventListener('click', saveGoals);
  document.getElementById('cancel-goals').addEventListener('click', closeGoalsEdit);
}

// ===== 起動 =====
init();
