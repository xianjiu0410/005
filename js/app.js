/* ============ 《家书·回声》app.js ============ */
(function () {
'use strict';

/* ---------- 状态 ---------- */
let LETTERS = [];
const RATES = [0.75, 1.0, 1.25];
let rateIdx = 1;

const tts = {
  idx: -1,          // 当前朗读句下标
  playing: false,
  paused: false,
  started: false,
};

const $ = (id) => document.getElementById(id);
const views = {
  landing: $('view-landing'), letters: $('view-letters'), reader: $('view-reader'),
  wall: $('view-wall'), epilogue: $('view-epilogue'), about: $('view-about'),
};

/* ---------- 路由 ---------- */
function route() {
  const hash = location.hash || '#/';
  const parts = hash.slice(2).split('/').filter(Boolean); // ['letters'] / ['letter','01']
  stopTTS();
  hideAnno();
  closeSide();

  let name = 'landing';
  if (parts[0] === 'letters') name = 'letters';
  else if (parts[0] === 'letter') name = 'reader';
  else if (parts[0] === 'wall') name = 'wall';
  else if (parts[0] === 'epilogue') name = 'epilogue';
  else if (parts[0] === 'about') name = 'about';

  Object.values(views).forEach(v => v.classList.add('hidden'));
  views[name].classList.remove('hidden');
  $('site-header').classList.toggle('hidden', name === 'landing');

  // 导航高亮
  document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
  const navMap = { letters: 'letters', reader: 'letters', wall: 'wall', about: 'about' };
  const active = document.querySelector(`[data-nav="${navMap[name]}"]`);
  if (active) active.classList.add('active');
  $('mobile-nav').classList.add('hidden');

  if (name === 'letters') renderGrid(currentEra);
  if (name === 'reader') renderReader(parts[1] || '01');
  if (name === 'wall') renderWall();
  if (name === 'epilogue') renderEpilogue();
  if (name === 'about') renderAbout();

  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

/* ---------- 数据 ---------- */
async function load() {
  try {
    const res = await fetch('data/letters.json');
    LETTERS = (await res.json()).letters;
  } catch (e) {
    // file:// 协议下 fetch 失败时的兜底提示
    document.getElementById('app').innerHTML =
      '<div style="text-align:center;padding:80px 20px;font-size:15px;line-height:2">' +
      '请通过本地服务器打开本页（如 <code>python3 -m http.server</code>），<br>直接双击 HTML 无法加载数据文件。</div>';
    throw e;
  }
}

/* ---------- 序厅 ---------- */
$('enter-btn').addEventListener('click', () => { location.hash = '#/letters'; });
document.querySelector('#view-landing').addEventListener('wheel', (e) => {
  if (e.deltaY > 30) location.hash = '#/letters';
}, { passive: true });

/* ---------- 卡片墙 ---------- */
let currentEra = '全部';
function renderGrid(era) {
  currentEra = era;
  const eras = ['全部', ...new Set(LETTERS.map(l => l.era))];
  $('era-filters').innerHTML = eras.map(e =>
    `<button data-era="${e}" class="${e === era ? 'on' : ''}">${e}</button>`).join('');
  const list = LETTERS.filter(l => era === '全部' || l.era === era);
  $('letter-grid').innerHTML = list.map(l => `
    <article class="letter-card ${l.isQinghai ? 'qinghai' : ''}" data-id="${l.id}">
      <span class="no">NO.${l.id}</span>
      <div class="lc-author">${l.author}</div>
      <div class="lc-to">致 ${l.recipient}</div>
      <span class="lc-year">${l.year} · ${l.era}</span>
      <p class="lc-excerpt">“${l.excerpt}”</p>
      <span class="lc-play">▶ 听她/他说</span>
      ${l.isQinghai ? '<span class="lc-badge">青海回声</span>' : ''}
    </article>`).join('');
}
$('era-filters').addEventListener('click', e => {
  const b = e.target.closest('button'); if (b) renderGrid(b.dataset.era);
});
$('letter-grid').addEventListener('click', e => {
  const card = e.target.closest('.letter-card');
  if (card) location.hash = `#/letter/${card.dataset.id}`;
});

/* ---------- 阅读页 ---------- */
let cur = null; // 当前信件

function renderReader(id) {
  cur = LETTERS.find(l => l.id === id) || LETTERS[0];
  const i = LETTERS.indexOf(cur);
  $('reader-no').textContent = `NO.${cur.id} / ${String(LETTERS.length).padStart(2, '0')}`;
  $('reader-title').textContent = `${cur.author} 致 ${cur.recipient}`;
  $('reader-date').textContent = `${cur.title} · ${cur.date}`;

  // 正文（逐句 + 点词）
  $('letter-paper').innerHTML = cur.sentences.map((s, k) => {
    let html = escapeHTML(s);
    cur.annotations.forEach((a, ai) => {
      const t = escapeRegExp(a.term);
      html = html.replace(new RegExp(t, 'g'),
        `<span class="anno-term" data-anno="${ai}">${a.term}</span>`);
    });
    const narration = html.startsWith('（') || html.startsWith('——');
    return `<span class="sent${narration ? ' narration' : ''}" data-i="${k}">${html}</span>`;
  }).join('') + playerHTML();

  // 侧栏
  $('reader-side').innerHTML = `
    <button class="side-toggle" id="side-toggle-btn">▲ 背景与结局</button>
    <div class="side-portrait">
      <div class="ph">肖像<br>待补</div>
      <div class="info"><b>${cur.author}</b><p>${cur.authorLife}</p><p>致 ${cur.recipient}</p></div>
    </div>
    <div class="side-block"><h4>▍背景</h4><p>${cur.context.background}</p></div>
    <div class="side-block"><h4>▍结局</h4><p>${cur.context.ending}</p></div>
    <div class="side-extra">
      <div class="${cur.isFragment ? 'frag' : ''}">史料出处：${cur.source}</div>
      ${cur.fragmentNote ? `<div class="frag">※ ${cur.fragmentNote}</div>` : ''}
    </div>`;

  // 翻页
  const prev = LETTERS[i - 1], next = LETTERS[i + 1];
  setPager($('prev-letter'), prev, '← 上一封');
  setPager($('next-letter'), next, '下一封 →');

  tts.idx = -1; tts.playing = false; tts.started = false; tts.paused = false;
  updatePlayerUI();
}
function setPager(el, target, label) {
  el.innerHTML = label;
  if (target) { el.href = `#/letter/${target.id}`; el.classList.remove('off'); }
  else { el.removeAttribute('href'); el.classList.add('off'); }
}
function playerHTML() {
  return `<div class="player" id="player">
    <button id="play-btn" class="play-btn" aria-label="播放">▶</button>
    <div class="progress" id="progress"><div class="progress-fill" id="progress-fill"></div></div>
    <span class="time" id="time-label">00:00</span>
    <button id="rate-btn" class="rate-btn">1.0x</button>
    <button id="restart-btn" class="restart-btn" aria-label="重播">↺</button>
  </div>`;
}

/* ---------- TTS 播放器 ---------- */
function pickVoice(gender) {
  const vs = speechSynthesis.getVoices().filter(v => /zh|cmn/i.test(v.lang));
  if (!vs.length) return null;
  const female = vs.find(v => /female|xiaoxiao|ting|huihui|yaoyao|tingting/i.test(v.name));
  const male = vs.find(v => /male|yunxi|kang|guyi/i.test(v.name));
  return gender === 'female' ? (female || vs[0]) : (male || vs[0]);
}
function speakFrom(idx) {
  if (idx >= cur.sentences.length) { finishTTS(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(cur.sentences[idx].replace(/[（）]/g, ''));
  const voice = pickVoice(cur.tts.voice);
  if (voice) u.voice = voice;
  u.lang = 'zh-CN'; u.rate = cur.tts.rate * RATES[rateIdx];
  u.onstart = () => highlight(idx);
  u.onend = () => {
    if (!tts.playing) return;
    tts.idx = idx + 1;
    progressUpdate();
    speakFrom(tts.idx);
  };
  speechSynthesis.speak(u);
}
function highlight(idx) {
  document.querySelectorAll('.sent.active').forEach(el => el.classList.remove('active'));
  const el = document.querySelector(`.sent[data-i="${idx}"]`);
  if (el) {
    el.classList.add('active');
    const r = el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > innerHeight - 90) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}
function progressUpdate() {
  const pct = Math.min(100, (tts.idx / cur.sentences.length) * 100);
  const fill = $('progress-fill'); if (fill) fill.style.width = pct + '%';
  const label = $('time-label');
  if (label) label.textContent = `${tts.idx}/${cur.sentences.length} 句`;
}
function playTTS(fromIdx) {
  if (!('speechSynthesis' in window)) { alert('当前浏览器不支持语音合成，已切换为纯阅读模式。'); return; }
  tts.playing = true; tts.paused = false;
  if (fromIdx != null) tts.idx = fromIdx;
  if (tts.idx < 0) tts.idx = 0;
  speakFrom(tts.idx);
  updatePlayerUI();
}
function pauseTTS() {
  tts.paused = true; tts.playing = false;
  speechSynthesis.cancel();
  updatePlayerUI();
}
function stopTTS() {
  tts.playing = false; tts.paused = false; tts.idx = -1; tts.started = false;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
function finishTTS() {
  tts.playing = false; tts.idx = cur.sentences.length;
  progressUpdate();
  document.querySelectorAll('.sent.active').forEach(el => el.classList.remove('active'));
  updatePlayerUI();
  // 读完 → 若在阅读页，提示尾声
}
function updatePlayerUI() {
  const btn = $('play-btn'); if (!btn) return;
  btn.textContent = tts.playing ? '⏸' : '▶';
  $('rate-btn').textContent = RATES[rateIdx].toFixed(2).replace(/0$/, '') + 'x';
  progressUpdate();
}

/* 播放器事件（阅读页重渲染后需重新绑定，用事件委托） */
document.addEventListener('click', (e) => {
  if (!cur || views.reader.classList.contains('hidden')) return;

  if (e.target.id === 'play-btn') {
    tts.playing ? pauseTTS() : playTTS();
  } else if (e.target.id === 'restart-btn') {
    stopTTS(); playTTS(0);
  } else if (e.target.id === 'rate-btn') {
    rateIdx = (rateIdx + 1) % RATES.length;
    const wasPlaying = tts.playing;
    updatePlayerUI();
    if (wasPlaying) { const at = tts.idx; stopTTS(); playTTS(at); }
  } else if (e.target.closest('#progress')) {
    const bar = $('progress'); const r = bar.getBoundingClientRect();
    const target = Math.floor(((e.clientX - r.left) / r.width) * cur.sentences.length);
    stopTTS(); playTTS(Math.max(0, Math.min(cur.sentences.length - 1, target)));
  } else if (e.target.classList.contains('sent') && !e.target.classList.contains('anno-term')) {
    // 点句子跳读
    const i = +e.target.dataset.i;
    stopTTS(); playTTS(i);
  } else if (e.target.classList.contains('anno-term')) {
    showAnno(e.target, +e.target.dataset.anno);
  } else if (e.target.id === 'side-toggle-btn') {
    $('reader-side').classList.toggle('open');
    $('side-mask').classList.toggle('hidden');
    e.target.textContent = $('reader-side').classList.contains('open') ? '▼ 收起' : '▲ 背景与结局';
  }
});
$('side-mask').addEventListener('click', closeSide);
function closeSide() {
  const s = $('reader-side'); if (s) s.classList.remove('open');
  $('side-mask').classList.add('hidden');
}

/* ---------- 点词弹注 ---------- */
function showAnno(el, ai) {
  const a = cur.annotations[ai];
  $('anno-term').textContent = a.term;
  $('anno-text').textContent = a.text;
  $('anno-src').textContent = '出处：' + a.src;
  const pop = $('anno-pop');
  pop.classList.remove('hidden');
  const r = el.getBoundingClientRect();
  const pw = Math.min(330, innerWidth - 24);
  let left = r.left + r.width / 2 - pw / 2;
  left = Math.max(12, Math.min(left, innerWidth - pw - 12));
  pop.style.left = left + 'px';
  pop.style.top = (r.bottom + 10) + 'px';
  if (r.bottom + 10 + pop.offsetHeight > innerHeight - 12) {
    pop.style.top = Math.max(12, r.top - pop.offsetHeight - 10) + 'px';
  }
}
function hideAnno() { $('anno-pop').classList.add('hidden'); }
$('anno-close').addEventListener('click', hideAnno);
document.addEventListener('click', (e) => {
  if (!e.target.closest('.anno-pop') && !e.target.closest('.anno-term')) hideAnno();
});

/* ---------- 回信墙 ---------- */
const WALL_KEY = 'jiashu-wall-v1';
function getWall() { try { return JSON.parse(localStorage.getItem(WALL_KEY)) || []; } catch { return []; } }
function renderWall() {
  const items = getWall();
  $('wall-grid').innerHTML = items.length ? items.map((w, i) => `
    <div class="wall-card">
      <button class="wc-del" data-i="${i}" title="删除">✕</button>
      <div class="wc-to">致 ${escapeHTML(w.to)} 的一封信</div>
      <div class="wc-text">${escapeHTML(w.text)}</div>
    </div>`).join('') : '<div class="wall-empty">还没有回信，来写第一封吧</div>';
}
$('wall-text').addEventListener('input', e => {
  $('wall-count').textContent = `${e.target.value.length} / 200`;
});
$('wall-form').addEventListener('submit', e => {
  e.preventDefault();
  const to = $('wall-to').value.trim(), text = $('wall-text').value.trim();
  const hint = $('wall-hint');
  const bad = ['法轮', '台独', '港独', '爆', '枪', '杀政'];
  if (bad.some(w => text.includes(w) || to.includes(w))) {
    hint.textContent = '内容包含不适宜词汇，请修改后再贴上墙。';
    hint.classList.remove('hidden'); return;
  }
  hint.classList.add('hidden');
  const items = getWall();
  items.unshift({ to, text, ts: Date.now() });
  localStorage.setItem(WALL_KEY, JSON.stringify(items));
  $('wall-form').reset(); $('wall-count').textContent = '0 / 200';
  renderWall();
});
$('wall-grid').addEventListener('click', e => {
  if (e.target.classList.contains('wc-del')) {
    const items = getWall(); items.splice(+e.target.dataset.i, 1);
    localStorage.setItem(WALL_KEY, JSON.stringify(items));
    renderWall();
  }
});

/* ---------- 尾声 ---------- */
function renderEpilogue() {
  $('epilogue-list').innerHTML = LETTERS.map(l =>
    `<a href="#/letter/${l.id}">NO.${l.id} ${l.author}</a>`).join('');
  $('epilogue-qinghai').textContent = '青海回声：从祁连山中熊厚发的“党员介绍信”，到循化红光清真寺屋脊上刻着五角星的青砖——青海的土地记得。';
}
/* ---------- 关于 ---------- */
function renderAbout() {
  fetch('data/letters.json').then(r => r.json()).then(d => {
    $('about-sources').innerHTML = d.sources.map(s => `<li>${s}</li>`).join('');
  });
}

/* ---------- 工具 ---------- */
function escapeHTML(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* 顶栏菜单 */
$('menu-btn').addEventListener('click', () => $('mobile-nav').classList.toggle('hidden'));

/* ---------- 启动 ---------- */
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {}; // 触发音色加载
load().then(route);

})();
