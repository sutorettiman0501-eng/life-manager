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

// ===== 初期化 =====
async function init() {
  setupEventListeners();
  await loadVisionData();
  renderYear();
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
