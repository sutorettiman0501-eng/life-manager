// ===== Supabase 設定（task-app と同じプロジェクトを使用）=====
const SUPABASE_URL = 'https://dohodudlajausbnemqbo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaG9kdWRsYWphdXNibmVtcWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NTI0MTgsImV4cCI6MjA5MzAyODQxOH0.XUVMCPStcJ794qzR3Qdlfy8uwrNIvRcVyfSME-6hRdA';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 状態管理 =====
let currentYear = new Date().getFullYear();
let currentView = 'vision';

// ===== 初期化 =====
function init() {
  setupEventListeners();
  renderYear();
}

// ===== 年の表示 =====
function renderYear() {
  document.getElementById('current-year').textContent = currentYear;
  renderCurrentView();
}

// ===== ビュー切り替え =====
function renderCurrentView() {
  // 各セクションのレンダー関数をここに追加していく
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
}

// ===== 起動 =====
init();
