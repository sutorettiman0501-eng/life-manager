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
  await Promise.all([loadVisionData(), loadTaskData()]);
  renderYear();
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
  const repeatLabel = { daily: '毎日', weekly: '毎週', monthly: '毎月' }[task.repeat] || '';
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
