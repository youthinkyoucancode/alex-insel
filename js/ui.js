// All DOM interface: icon buttons, hotbar with counts, word labels, cards, book, crafting, parent settings.
import { UI, WORDS, RECIPES } from './content.js';

const S = (inner, vb = '0 0 48 48') => `<svg viewBox="${vb}" fill="none" stroke="#3a3850" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
export const ICONS = {
  hammer: S('<path d="M10 14l12-6 6 6-4 4-6-2z" fill="#9aa3b2"/><path d="M22 18l18 18-4 4-18-18" fill="#d9a566"/>'),
  bench: S('<path d="M6 18h36v8H6z" fill="#d9a566"/><path d="M10 26v14M38 26v14"/><path d="M14 18l6-10 4 4-4 6" fill="#9aa3b2"/><path d="M28 18v-8h8v8" fill="#c4955a"/>'),
  book: S('<path d="M6 11c6-3 12-3 18 1v27c-6-4-12-4-18-1z" fill="#ffd27a"/><path d="M42 11c-6-3-12-3-18 1v27c6-4 12-4 18-1z" fill="#ffe3ad"/>'),
  gear: S('<circle cx="24" cy="24" r="7" fill="#fff"/><path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.5 10.5l4.2 4.2M33.3 33.3l4.2 4.2M10.5 37.5l4.2-4.2M33.3 14.7l4.2-4.2"/><circle cx="24" cy="24" r="13"/>'),
  speaker: S('<path d="M8 19h7l9-8v26l-9-8H8z" fill="#ffb648"/><path d="M31 17c3 4 3 10 0 14M36 12c6 7 6 17 0 24"/>'),
  person: S('<circle cx="24" cy="14" r="7" fill="#ffd9b8"/><path d="M11 42c0-9 6-15 13-15s13 6 13 15z" fill="#e8423f"/>'),
  eye: S('<path d="M4 24s7-12 20-12 20 12 20 12-7 12-20 12S4 24 4 24z" fill="#fff"/><circle cx="24" cy="24" r="6" fill="#3a3850"/>'),
  rocket: S('<path d="M24 4c8 6 10 16 7 27H17C14 20 16 10 24 4z" fill="#fff"/><circle cx="24" cy="17" r="4" fill="#6cc4ff"/><path d="M17 31l-6 7 7-1M31 31l6 7-7-1" fill="#e5413d"/><path d="M20 35l4 8 4-8" fill="#ffb648"/>'),
  wheel: S('<circle cx="24" cy="24" r="17" fill="#fff"/><circle cx="24" cy="24" r="5" fill="#3a3850"/><path d="M7 24h12M29 24h12M24 29v12"/>'),
  exit: S('<path d="M20 8H9v32h11" /><path d="M22 24h20M34 16l8 8-8 8"/>'),
  jump: S('<path d="M24 8L10 24h8v14h12V24h8z" fill="#7ed6a5"/>'),
  close: S('<path d="M14 14l20 20M34 14L14 34"/>'),
  play: S('<path d="M15 9l24 15-24 15z" fill="#fff"/>'),
  arrow: S('<path d="M24 6l13 20h-8v16H19V26h-8z" fill="#ffb648"/>'),
  star: S('<path d="M24 5l5.6 11.6 12.8 1.7-9.3 8.9 2.3 12.6L24 33.8l-11.4 6 2.3-12.6-9.3-8.9 12.8-1.7z" fill="#ffd23f"/>'),
  fire: S('<path d="M24 6c6 8 12 12 12 21a12 12 0 0 1-24 0c0-6 4-9 6-13 2 4 4 5 6 5-2-5-1-9 0-13z" fill="#ffb12e"/>'),
  home: S('<path d="M7 23L24 8l17 15" /><path d="M11 21v19h26V21" fill="#ffe3ad"/><path d="M20 40V29h8v11" fill="#e8423f"/>'),
  bricks: S('<path d="M5 30h18v12H5zM25 30h18v12H25zM15 17h18v12H15z" fill="#e8423f"/><path d="M9 30v-3M19 30v-3M29 30v-3M39 30v-3M19 17v-3M29 17v-3" stroke-width="4"/>'),
  camera: S('<path d="M6 16h9l3-5h12l3 5h9v22H6z" fill="#fff"/><circle cx="24" cy="26" r="7" fill="#6cc4ff"/><circle cx="37" cy="20" r="1.5" fill="#3a3850"/>'),
  left: S('<path d="M30 8L12 24l18 16z" fill="#ffd23f"/>'),
  right: S('<path d="M18 8l18 16-18 16z" fill="#ffd23f"/>'),
  up: S('<path d="M24 8L8 32h32z" fill="#7ed6a5"/>'),
  down: S('<path d="M24 40L8 16h32z" fill="#ff8a7a"/>'),
  bulb: S('<path d="M24 5a13 13 0 0 0-8 23c2 2 3 4 3 7h10c0-3 1-5 3-7A13 13 0 0 0 24 5z" fill="#ffd23f"/><path d="M19 39h10M20 43h8"/><path d="M24 12v6M18 16l3 3M30 16l-3 3"/>'),
  more: S('<circle cx="12" cy="24" r="4" fill="#3a3850"/><circle cx="24" cy="24" r="4" fill="#3a3850"/><circle cx="36" cy="24" r="4" fill="#3a3850"/>'),
  hand: S('<path d="M16 26V12a3 3 0 0 1 6 0v10M22 22V9a3 3 0 0 1 6 0v13M28 22v-9a3 3 0 0 1 6 0v15c0 8-5 14-12 14s-10-4-13-10l-3-7a3 3 0 0 1 5-3l3 4" fill="#ffd9b8"/>'),
};

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const wordHTML = (w) => { const [a, ...r] = w.split(' '); return `<span class="art">${a}</span> ${r.join(' ')}`; };

export class HUD {
  constructor(root, iconOf, modelIcon) {
    this.root = root; this.iconOf = iconOf; this.modelIcon = modelIcon;
    this.handlers = {};
    this.build();
  }
  on(name, fn) { this.handlers[name] = fn; }
  emit(name, ...a) { this.handlers[name]?.(...a); }
  iconFor(key) { const w = WORDS[key]; if (!w) return ''; return this.photoOf?.(key) || (w.model ? this.modelIcon[w.model] : this.iconOf(w.icon)); }
  build() {
    const r = this.root;
    this.goal = el('div'); this.goal.id = 'goal';
    this.goal.innerHTML = `<div class="gicon"></div><div class="gbody"><span class="ghead"></span><span class="gtext"></span><div class="gbar"><i></i></div></div><button class="speak" aria-label="Vorlesen">${ICONS.speaker}</button><div class="arrow hidden">${ICONS.arrow}</div>`;
    this.goal.querySelector('.speak').onclick = () => this.emit('goalSpeak');
    r.append(this.goal);
    const tr = el('div'); tr.id = 'topright';
    this.camBtn = el('button', 'btn', ICONS.person); this.camBtn.onclick = () => this.emit('camera');
    this.bookBtn = el('button', 'btn', ICONS.book); this.bookBtn.onclick = () => this.emit('book');
    this.gearBtn = el('button', 'btn', ICONS.gear + '<div class="ring"></div>'); this.gearBtn.id = 'gear';
    this.setupHold(this.gearBtn, () => this.emit('settings'), () => this.emit('gearTap'));
    this.homeBtn = el('button', 'btn', ICONS.home); this.homeBtn.onclick = () => this.emit('home');
    this.buildBtn = el('button', 'btn', ICONS.bricks); this.buildBtn.id = 'buildmode'; this.buildBtn.onclick = () => this.emit('creative');
    [this.camBtn, this.bookBtn, this.gearBtn, this.homeBtn, this.buildBtn].forEach((b, i) => b.setAttribute('aria-label', ['Kamera', 'Buch', 'Eltern', 'Zuhause', 'Baukasten'][i]));
    this.ideasBtn = el('button', 'btn hidden', ICONS.bulb); this.ideasBtn.id = 'ideasbtn'; this.ideasBtn.setAttribute('aria-label', 'Bauideen');
    this.ideasBtn.onclick = () => this.emit('ideas');
    tr.append(this.homeBtn, this.buildBtn, this.ideasBtn, this.camBtn, this.bookBtn, this.gearBtn); r.append(tr);

    this.hotbar = el('div'); this.hotbar.id = 'hotbar';
    this.craftBtn = el('button', '', ICONS.bench + '<span class="dot hidden"></span>'); this.craftBtn.id = 'bag';
    this.craftBtn.onclick = () => this.emit('craft');
    this.craftBtn.setAttribute('aria-label', 'Werkbank');
    // touch: the pickaxe button = "chop mode" (tap blocks to break them); a block slot = "build mode"
    this.tool = el('button', 'hidden'); this.tool.id = 'tool'; this.tool.setAttribute('aria-label', 'Hacken');
    this.tool.onclick = () => this.emit('mineMode');
    this.moreBtn = el('button', 'hidden', ICONS.more); this.moreBtn.id = 'more'; this.moreBtn.setAttribute('aria-label', 'Alle Bloecke');
    this.moreBtn.onclick = () => this.emit('palette');
    this.hotbar.append(this.craftBtn, this.tool); r.append(this.hotbar);
    this.banner = el('div', 'hidden'); this.banner.id = 'banner'; r.append(this.banner);
    this.selName = el('div', 'hidden'); this.selName.id = 'selname'; r.append(this.selName);
    this.hand = el('div', 'hidden', ICONS.hand); this.hand.id = 'handhint'; r.append(this.hand);

    const act = el('div'); act.id = 'actions';
    this.jumpBtn = el('button', 'btn big', ICONS.jump);
    const press = (v) => (e) => { e.preventDefault(); this.emit('jump', v); };
    this.jumpBtn.addEventListener('pointerdown', press(true)); this.jumpBtn.addEventListener('pointerup', press(false)); this.jumpBtn.addEventListener('pointerleave', press(false));
    act.append(this.jumpBtn); r.append(act); this.actions = act;

    this.cross = el('div', 'hidden'); this.cross.id = 'crosshair'; r.append(this.cross);
    this.itemName = el('div'); this.itemName.id = 'itemname'; r.append(this.itemName);
    this.label = el('div', 'hidden'); this.label.id = 'label';
    this.label.onclick = () => this.emit('labelTap'); r.append(this.label);
    this.subtitle = el('div'); this.subtitle.id = 'subtitle'; r.append(this.subtitle);
    this.launchWrap = el('div', 'hidden', `<button class="go">${ICONS.rocket}${UI.launch}</button>`); this.launchWrap.id = 'launch';
    this.launchWrap.querySelector('button').onclick = () => this.emit('launch'); r.append(this.launchWrap);
    this.driveBar = el('div', 'hidden', `<button class="pill exitbtn">${ICONS.exit}${UI.exit}</button>`); this.driveBar.id = 'drivebar';
    this.driveBar.querySelector('button').onclick = () => this.emit('exitDrive'); r.append(this.driveBar);
    // RC-remote style driving: steer on the left, gas / reverse on the right (hold the buttons)
    this.drive = el('div', 'hidden', `<div class="steer"><button data-k="left">${ICONS.left}</button><button data-k="right">${ICONS.right}</button></div>
      <div class="pedals"><button data-k="gas" class="gas">${ICONS.up}<b>${UI.gas}</b></button><button data-k="back" class="back">${ICONS.down}</button></div>`);
    this.drive.id = 'drive';
    this.drive.querySelectorAll('button').forEach((b) => {
      const set = (v) => (e) => { e.preventDefault(); b.classList.toggle('down', v); this.emit('driveKey', b.dataset.k, v); };
      b.addEventListener('pointerdown', (e) => { try { b.setPointerCapture(e.pointerId); } catch {} set(true)(e); });
      b.addEventListener('pointerup', set(false)); b.addEventListener('pointercancel', set(false));
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    r.append(this.drive);
    this.enterBtn = el('button', 'hidden', `${ICONS.wheel}<b>${UI.enter}</b>`); this.enterBtn.id = 'enter';
    this.enterBtn.onclick = () => this.emit('enter'); r.append(this.enterBtn);
    this.stuntBtn = el('button', 'hidden', `${ICONS.up}<b>${UI.stunt}</b>`); this.stuntBtn.id = 'stunt';
    this.stuntBtn.onclick = () => this.emit('stunt'); r.append(this.stuntBtn);
    this.photoBtn = el('button', 'hidden', `${ICONS.camera}<b>${UI.photo}</b>`); this.photoBtn.id = 'photo';
    this.photoBtn.onclick = () => this.emit('photo'); r.append(this.photoBtn);
    this.fps = el('div', 'hidden'); this.fps.id = 'fps'; r.append(this.fps);
    this.clickHint = el('div', 'hidden', `<div class="big">${ICONS.hand}<b>${UI.click_to_play}</b></div><p>${UI.keys_help}</p>`); this.clickHint.id = 'clickhint';
    r.append(this.clickHint);
  }
  setupHold(btn, fn, onShort) {
    const ring = btn.querySelector('.ring'); let t = null, start = 0, raf = 0;
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / 2000);
      ring.style.clipPath = `inset(${100 - k * 100}% 0 0 0)`;
      if (k >= 1) { stop(); fn(); return; }
      raf = requestAnimationFrame(tick);
    };
    const stop = () => { cancelAnimationFrame(raf); ring.style.clipPath = 'inset(100% 0 0 0)'; t = null; };
    // touch-safe: capture the finger so small wobbles don't cancel the hold, and block the long-press menu
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch {} start = performance.now(); t = 1; raf = requestAnimationFrame(tick); });
    btn.addEventListener('pointerup', () => { if (!t) return; const short = performance.now() - start < 600; stop(); if (short) onShort?.(); });
    btn.addEventListener('pointercancel', () => t && stop());
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // slots: array of {id, count} (length 9, id 0 = empty)
  setHotbar(slots, sel) {
    if (!this.slots) {
      this.slots = slots.map((_, i) => {
        const s = el('button', 'slot', '<img alt=""><span class="n"></span>');
        s.onclick = () => this.emit('select', i);
        this.hotbar.append(s); return s;
      });
      this.hotbar.append(this.moreBtn);
    }
    slots.forEach((st, i) => {
      const s = this.slots[i], img = s.querySelector('img'), n = s.querySelector('.n');
      if (st.id) { const src = this.iconOf(st.id); if (img.dataset.id !== String(st.id)) { img.src = src; img.dataset.id = st.id; } img.style.visibility = 'visible'; n.textContent = st.count === Infinity ? '' : st.count > 1 ? st.count : ''; }
      else { img.style.visibility = 'hidden'; img.dataset.id = ''; n.textContent = ''; }
      s.classList.toggle('sel', i === sel);
      s.classList.toggle('empty', !st.id);
    });
    // the selected block's name stays visible above the bar (with its article: learning the word)
    const name = sel >= 0 ? slots[sel]?.name : '';
    this.selName.classList.toggle('hidden', !name);
    if (name && this.selName.dataset.n !== name) { this.selName.dataset.n = name; this.selName.innerHTML = wordHTML(name); }
  }
  showItemName(word) {
    if (!word) return;
    this.itemName.innerHTML = wordHTML(word);
    this.itemName.classList.remove('show'); void this.itemName.offsetWidth; this.itemName.classList.add('show');
  }
  bumpSlot(i) { const s = this.slots?.[i]; if (!s) return; s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); }
  setTool(id, show, sel) {
    this.tool.classList.toggle('hidden', !show);
    this.tool.classList.toggle('sel', !!sel);
    const key = String(id || 0);
    if (this.tool.dataset.id !== key) { this.tool.dataset.id = key; this.tool.innerHTML = (id ? `<img alt="" src="${this.iconOf(id)}">` : ICONS.hand) + `<b>${UI.mode_mine}</b>`; }
  }
  setCreative(on) { this.buildBtn.classList.toggle('on', on); this.moreBtn.classList.toggle('hidden', !on); this.root.classList.toggle('creative', on); }
  // which button should glow to show the next thing to press: 'bag' | 'launch' | 'tool' | slot index
  setHint(h) {
    this.craftBtn.classList.toggle('hint', h === 'bag');
    this.enterBtn.classList.toggle('hint', h === 'enter');
    this.photoBtn.classList.toggle('hint', h === 'photo');
    this.ideasBtn.classList.toggle('hint', h === 'ideas');
    this.stuntBtn.classList.toggle('hint', h === 'stunt');
    this.drive.querySelector('.gas').classList.toggle('hint', h === 'gas');
    this.driveBar.querySelector('button').classList.toggle('hint', h === 'exit');
    this.launchWrap.classList.toggle('hint', h === 'launch');
    this.tool.classList.toggle('hint', h === 'tool');
    this.slots?.forEach((s, i) => s.classList.toggle('hint', h === i));
  }
  showBanner(top, title, ms = 2600, img = '') {
    this.banner.innerHTML = `<small>${top}</small><b>${title}</b>${img ? `<img alt="" src="${img}">` : ''}`;
    this.banner.style.animationDuration = ms + 'ms';
    this.banner.classList.remove('hidden', 'show'); void this.banner.offsetWidth; this.banner.classList.add('show');
    clearTimeout(this.bannerT); this.bannerT = setTimeout(() => this.banner.classList.add('hidden'), ms);
  }
  confetti(calm) {
    const colors = ['#ffd23f', '#e8423f', '#2f7de1', '#34a853', '#ff9de0', '#ffb648'];
    const n = calm ? 18 : 60;
    for (let i = 0; i < n; i++) {
      const c = el('i', 'confetti'); c.style.left = Math.random() * 100 + 'vw'; c.style.background = colors[i % colors.length];
      c.style.animationDelay = Math.random() * 0.5 + 's'; c.style.animationDuration = 1.8 + Math.random() * 1.4 + 's';
      c.style.setProperty('--dx', (Math.random() - 0.5) * 160 + 'px'); c.style.setProperty('--r', Math.random() * 720 + 'deg');
      document.body.append(c); setTimeout(() => c.remove(), 3800);
    }
  }
  setDriving(on) { this.drive.classList.toggle('hidden', !on || !this.touch); this.driveBar.classList.toggle('hidden', !on); }
  // hero editor: picture on the left; parts and colours on the right
  heroEditor(cfg, parts, hats, pic, onChange, onDone) {
    let cur = { ...cfg }, sel = parts[0].key;
    const box = el('div', '', `<h2>${ICONS.person}${UI.hero}</h2><div class="hero-ed"><img class="hero-pic" alt=""><div class="hero-side"><div class="parts"></div><div class="colors"></div></div></div>`);
    const img = box.querySelector('.hero-pic'), partsEl = box.querySelector('.parts'), colorsEl = box.querySelector('.colors');
    const render = () => {
      img.src = pic(cur);
      partsEl.innerHTML = '';
      for (const p of [...parts, { key: 'hat', word: 'der Hut' }]) {
        const b = el('button', 'pill' + (p.key === sel ? ' on' : ''), p.word.split(' ').slice(1).join(' ') || p.word);
        b.onclick = () => { sel = p.key; render(); onChange(cur, p.word); }; partsEl.append(b);
      }
      colorsEl.innerHTML = '';
      if (sel === 'hat') for (const h of hats) {
        const b = el('button', 'pill hatbtn' + (cur.hat === h.key ? ' on' : ''), h.word);
        b.onclick = () => { cur = { ...cur, hat: h.key }; render(); onChange(cur, h.word); }; colorsEl.append(b);
      } else for (const c of parts.find((p) => p.key === sel).colors) {
        const b = el('button', 'colorbtn' + (cur[sel] === c ? ' on' : '')); b.style.background = c;
        b.onclick = () => { cur = { ...cur, [sel]: c }; render(); onChange(cur); }; colorsEl.append(b);
      }
    };
    render();
    const done = el('button', 'go', `${ICONS.play}${UI.hero_done}`); box.append(done);
    const close = this.modal(box, 'heroed', () => onDone());
    done.onclick = () => close();
    return close;
  }
  pop(text) { const p = el('div', 'pow', text); this.root.append(p); setTimeout(() => p.remove(), 1300); }
  ideas(list, onPick, onClose) {
    const box = el('div', '', `<h2>${ICONS.bulb}${UI.ideas_title}</h2><div class="grid"></div>`);
    const g = box.querySelector('.grid');
    for (const i of list) {
      const t = el('button', 'tile idea' + (i.done ? ' done' : ''), `<img alt="" src="${i.pic}"><div>${i.name}</div>${i.done ? `<span class="tick">${ICONS.star}</span>` : ''}`);
      t.onclick = () => onPick(i.id); g.append(t);
    }
    return this.modal(box, 'book ideasheet', onClose);
  }
  flash() { const f = el('div', 'flash'); document.body.append(f); setTimeout(() => f.remove(), 700); }
  // the photo pops up as a polaroid, then flies into the book
  polaroid(url, caption) {
    const p = el('div', 'polaroid', `<img alt="" src="${url}"><div>${caption}</div>`); document.body.append(p);
    setTimeout(() => {
      const b = this.bookBtn.getBoundingClientRect(), r = p.getBoundingClientRect();
      p.style.transform = `translate(${b.left + b.width / 2 - (r.left + r.width / 2)}px, ${b.top + b.height / 2 - (r.top + r.height / 2)}px) scale(.12) rotate(20deg)`;
      p.style.opacity = '0.4';
    }, 2300);
    setTimeout(() => { p.remove(); this.bookBtn.classList.remove('bump'); void this.bookBtn.offsetWidth; this.bookBtn.classList.add('bump'); }, 3100);
  }
  showHand(x, y) {
    if (x == null) { this.hand.classList.add('hidden'); return; }
    this.hand.classList.remove('hidden'); this.hand.style.left = x + 'px'; this.hand.style.top = y + 'px';
  }
  palette(ids, onPick, onClose) {
    const box = el('div', '', `<h2>${ICONS.bricks}${UI.palette}</h2><div class="grid"></div>`);
    const g = box.querySelector('.grid');
    for (const id of ids) { const t = el('button', 'tile', `<img alt="" src="${this.iconOf(id)}">`); t.onclick = () => onPick(id); g.append(t); }
    return this.modal(box, 'book palette', onClose);
  }
  setCraftDot(on) { this.craftBtn.querySelector('.dot').classList.toggle('hidden', !on); }
  setCamera(first) { this.camBtn.innerHTML = first ? ICONS.eye : ICONS.person; }
  setGoal(iconHTML, text, progress = null, head = '') {
    this.goal.querySelector('.ghead').textContent = head;
    this.goal.querySelector('.gicon').innerHTML = iconHTML;
    this.goal.querySelector('.gtext').textContent = text;
    const bar = this.goal.querySelector('.gbar');
    bar.classList.toggle('hidden', progress == null);
    if (progress != null) bar.querySelector('i').style.width = Math.round(progress * 100) + '%';
  }
  goalDone() { this.goal.classList.remove('done'); void this.goal.offsetWidth; this.goal.classList.add('done'); }
  setGoalArrow(angle) {
    const a = this.goal.querySelector('.arrow');
    if (angle == null) { a.classList.add('hidden'); return; }
    a.classList.remove('hidden'); a.style.transform = `rotate(${angle}rad)`;
  }
  showLabel(key, x, y) {
    const w = WORDS[key]; if (!w) { this.hideLabel(); return; }
    if (this.label.dataset.key !== key) {
      this.label.innerHTML = `<span>${wordHTML(w.word)}</span><span class="speak">${ICONS.speaker}</span>`;
      this.label.dataset.key = key;
    }
    this.label.classList.remove('hidden');
    this.label.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
  }
  hideLabel() { this.label.classList.add('hidden'); this.label.dataset.key = ''; }
  showSubtitle(text, on) { if (on) { this.subtitle.textContent = text; this.subtitle.classList.add('show'); } else if (this.subtitle.textContent === text) this.subtitle.classList.remove('show'); }
  flyTo(url, x, y, target) {
    const f = el('img', 'flyer'); f.src = url; f.style.left = x - 22 + 'px'; f.style.top = y - 22 + 'px';
    document.body.append(f);
    const b = (target || this.hotbar).getBoundingClientRect();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      f.style.transform = `translate(${b.left + b.width / 2 - x}px, ${b.top + b.height / 2 - y}px) scale(.7)`;
      f.style.opacity = '0.3';
    }));
    setTimeout(() => f.remove(), 750);
  }
  toast(url, html) {
    const t = el('div', 'toast', `<img src="${url}" alt=""><div>${html}</div>`); this.root.append(t);
    setTimeout(() => t.classList.add('out'), 2800); setTimeout(() => t.remove(), 3300);
  }
  modal(inner, cls, onClose) {
    const m = el('div', 'modal'); const sh = el('div', 'sheet ' + cls); sh.append(...[].concat(inner));
    const c = el('button', 'close', ICONS.close); sh.append(c); m.append(sh); document.body.append(m);
    const close = () => { m.remove(); onClose?.(); };
    c.onclick = close; m.addEventListener('pointerdown', (e) => { if (e.target === m) close(); });
    this.openModal = close;
    return close;
  }
  card(key, { onSpeakWord, onSpeakFact, extra, onClose } = {}) {
    const w = WORDS[key];
    const box = el('div', '', `<img class="pic${this.photoOf?.(key) ? ' photo' : ''}" alt="" src="${this.iconFor(key)}"><h2>${wordHTML(w.word)}</h2>${w.fact ? `<p class="fact">${w.fact}</p>` : ''}<div class="row"></div>`);
    const row = box.querySelector('.row');
    const b1 = el('button', 'pill', ICONS.speaker + 'Wort'); b1.onclick = onSpeakWord; row.append(b1);
    if (w.fact) { const b2 = el('button', 'pill blue', ICONS.speaker + 'Wissen'); b2.onclick = onSpeakFact; row.append(b2); }
    if (extra) row.append(extra);
    return this.modal(box, 'card', onClose);
  }
  book(found, order, onPick, onClose, stickers = []) {
    const box = el('div', '', `<h2>${ICONS.book}${UI.book} · ${found.size} / ${order.length}</h2><div class="stickers"></div><div class="grid"></div>`);
    const st = box.querySelector('.stickers');
    for (const k of stickers) st.append(el('div', 'sticker' + (k.have ? '' : ' locked'), `<img alt="" src="${k.icon}"><div>${k.have ? k.name : '?'}</div>`));
    const g = box.querySelector('.grid');
    for (const key of order) {
      const has = found.has(key);
      const t = el('div', 'tile' + (has ? '' : ' locked') + (this.photoOf?.(key) ? ' photo' : ''), `<img alt="" src="${this.iconFor(key)}"><div>${has ? WORDS[key].word : '?'}</div>`);
      if (has) t.onclick = () => onPick(key);
      g.append(t);
    }
    return this.modal(box, 'book', onClose);
  }
  // inv: {count(id)}, onMake(recipe)
  crafting(inv, onMake, wordOf, onClose, hintIds = []) {
    const box = el('div', '', `<h2>${ICONS.bench}${UI.craft}</h2><div class="recipes"></div>`);
    const list = box.querySelector('.recipes');
    const render = () => {
      list.innerHTML = '';
      const rank = (r) => (r.in.every(([id, n]) => inv.count(id) >= n) ? 0 : r.in.some(([id]) => inv.count(id) > 0) ? 1 : 2);
      for (const r of [...RECIPES].sort((a, b) => rank(a) - rank(b))) {
        const can = r.in.every(([id, n]) => inv.count(id) >= n);
        const known = r.in.some(([id]) => inv.count(id) > 0) || can;
        const row = el('div', 'recipe' + (can ? ' can' : '') + (known ? '' : ' unknown') + (can && hintIds.includes(r.out[0]) ? ' hint' : ''));
        const ins = r.in.map(([id, n]) => `<span class="ing ${inv.count(id) >= n ? 'ok' : ''}"><img alt="" src="${this.iconOf(id)}"><b>${n}</b></span>`).join('<span class="plus">+</span>');
        const outWord = WORDS[wordOf(r.out[0])]?.word || '';
        row.innerHTML = `<div class="ins">${ins}${r.heat ? `<span class="plus">+</span><span class="ing heat">${ICONS.fire}</span>` : ''}</div><span class="eq">→</span>
          <div class="out"><img alt="" src="${this.iconOf(r.out[0])}"><b>${r.out[1] > 1 ? r.out[1] : ''}</b></div><div class="oname">${known ? wordHTML(outWord) : '?'}</div>`;
        const b = el('button', 'pill green', UI.make); b.disabled = !can;
        b.onclick = () => { onMake(r); render(); };
        row.append(b); list.append(row);
      }
    };
    render();
    return this.modal(box, 'craftsheet', onClose);
  }
  settings(state, cb, onClose) {
    const box = el('div', '', `<h2>${UI.settings}</h2>
      <div class="r"><span>${UI.s_music}</span><input type="range" min="0" max="1" step="0.05" data-k="music" value="${state.music}"></div>
      <div class="r"><span>${UI.s_voice}</span><input type="range" min="0" max="1" step="0.05" data-k="voice" value="${state.voice}"></div>
      <div class="r"><span>${UI.s_sfx}</span><input type="range" min="0" max="1" step="0.05" data-k="sfx" value="${state.sfx}"></div>
      <div class="r"><span>${UI.s_calm}</span><input type="checkbox" data-k="calm" ${state.calm ? 'checked' : ''}></div>
      <div class="r"><span>${UI.s_quality}</span><input type="range" min="0.5" max="1" step="0.05" data-k="quality" value="${state.quality}"></div>
      <div class="r"><span>${UI.s_boom}</span><input type="checkbox" data-k="boom" ${state.boom ? 'checked' : ''}></div>
      <div class="r"><span>${UI.s_fps}</span><input type="checkbox" data-k="fps" ${state.fps ? 'checked' : ''}></div>
      <div class="r"><span>${UI.s_time}</span><div class="seg"><button data-a="day">${UI.s_day}</button><button data-a="night">${UI.s_night}</button></div></div>
      <div class="r"><span>${UI.s_pause_time}</span><input type="checkbox" data-k="pauseTime" ${state.pauseTime ? 'checked' : ''}></div>
      <div class="r"><span></span><button class="pill danger" data-a="reset">${UI.s_reset}</button></div>
      <p class="credits">${UI.credits}</p>`);
    box.querySelectorAll('input').forEach((i) => i.addEventListener('input', () => cb.change(i.dataset.k, i.type === 'checkbox' ? i.checked : +i.value)));
    box.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => {
      if (b.dataset.a === 'reset') { if (confirm(UI.s_reset_q)) cb.action('reset'); } else cb.action(b.dataset.a);
    });
    return this.modal(box, 'settings', onClose);
  }
}
