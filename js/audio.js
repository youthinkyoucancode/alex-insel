// Voice lines (recorded mp3, browser-voice fallback) and gentle synthesized sound effects.
import { RECORDED } from './content.js';

export const settings = { voice: 0.9, sfx: 0.6, music: 0.35 };

// Pre-rendered German voice for every spoken line (dev/make-voice.mjs). Many tablets, like the
// Fire HD 8, have no German browser voice at all, so the game must never rely on it.
export function lineId(text) {   // FNV-1a hash of the text -> file name
  let h = 0x811c9dc5;
  for (const ch of text) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
let voiced = new Set();
fetch('audio/tts/index.json').then((r) => (r.ok ? r.json() : [])).then((ids) => { voiced = new Set(ids); }).catch(() => {});
// Natural voice (ElevenLabs "Carlotta"): lines recorded in a few long files; index = id -> [file, start, end] seconds
let natural = {};
fetch('audio/el/index.json').then((r) => (r.ok ? r.json() : {})).then((m) => { natural = m; }).catch(() => {});
let ctx = null;
let current = null;
let onSubtitle = () => {};
export function setSubtitleHandler(fn) { onSubtitle = fn; }

export function unlockAudio() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function germanVoice() {
  const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  return voices.find((v) => v.lang === 'de-DE' && /Google|Natural|Online/i.test(v.name)) || voices.find((v) => v.lang?.startsWith('de'));
}

// Speech queue: lines wait their turn instead of cutting each other off.
//   now:   the child tapped something -> say it right away. Other chatter is dropped, but a mission
//          instruction ('step') is never lost: an interrupted one starts again afterwards.
//   low:   nice-to-have (a word on discovery, "click!") -> dropped if something else is talking
//   tag:   a newer line with the same tag replaces an older one that hasn't started yet (mission steps)
//   valid: checked just before the line starts; a line that no longer fits (step already done) is skipped
const queue = [];
const GAP_MS = 520;   // a short breath between two lines
let playing = null, gap = 0;
export function stopVoice(clear = true) {
  if (clear) queue.length = 0;
  if (current) { current.onended = null; current.pause(); current = null; }
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (playing?.subtitle) onSubtitle(playing.text, false);
  playing = null;
}
export function dropTag(tag) { for (let i = queue.length - 1; i >= 0; i--) if (queue[i].tag === tag) queue.splice(i, 1); }
export const isTalking = () => !!playing || queue.length > 0;
export function say(key, text, { now = false, low = false, tag = null, subtitle = true, valid = null } = {}) {
  if (!text) return;
  const item = { key, text, subtitle, tag, valid, replays: 0 };
  if (now) {   // asked for by the child: right away
    const was = playing;
    stopVoice(false); clearTimeout(gap); gap = 0;
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].tag !== 'step' || queue[i].text === text) queue.splice(i, 1);
    if (was && was.tag === 'step' && was.text !== text && was.replays < 2 && !queue.some((q) => q.tag === 'step')) {
      was.replays++; queue.unshift(was);   // the interrupted instruction comes back after the child's line
    }
    queue.unshift(item);
  } else {
    if (playing?.text === text || queue.some((q) => q.text === text)) return;
    if (low && (playing || queue.length)) return;
    if (tag) dropTag(tag);
    queue.push(item);
  }
  if (!playing && !gap) next();
}
function next() {
  if (playing) return;
  let it = queue.shift();
  while (it && it.valid && !it.valid()) it = queue.shift();
  if (!it) return;
  playing = it;
  const run = {}; it.run = run;   // a replayed line gets a new run, so the old run's timers can't end it early
  window.__probeSend?.('say', { text: it.text.slice(0, 90) });   // dev playtest log only (no-op in the real game)
  if (it.subtitle) onSubtitle(it.text, true);
  const done = () => {
    if (playing !== it || it.run !== run) return;
    if (it.subtitle) onSubtitle(it.text, false);
    playing = null; current = null;
    gap = setTimeout(() => { gap = 0; next(); }, GAP_MS);
  };
  play(it.key, it.text, done);
  setTimeout(done, 5000 + it.text.length * 130);   // safety: a stalled audio file must never block the queue
}
// each long recording is loaded once into memory (a blob URL is always seekable, whatever the web server supports)
const partUrls = new Map();
function partUrl(file) {
  if (!partUrls.has(file)) partUrls.set(file, fetch(`audio/el/${file}.mp3`).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); }).then((b) => URL.createObjectURL(b)));
  return partUrls.get(file);
}
export function preloadVoice() { for (const f of new Set(Object.values(natural).map((v) => v[0]))) partUrl(f).catch(() => {}); }
// rate < 1 slows a line that was spoken too fast in the recording (dev/el-rates.mjs); the pitch stays natural
function playPart(file, start, end, rate, done, fallback) {   // play one line out of a long recording, stop at its end
  let cancelled = false, timer = 0, a = null;
  current = { pause: () => { cancelled = true; clearInterval(timer); a?.pause(); }, onended: null };
  partUrl(file).then((url) => {
    if (cancelled) return;
    a = new Audio(url); a.volume = settings.voice;
    a.preservesPitch = true; a.webkitPreservesPitch = true;
    a.defaultPlaybackRate = rate; a.playbackRate = rate;
    const finish = () => { clearInterval(timer); a.pause(); done(); };
    a.onerror = () => { clearInterval(timer); fallback(); };
    const go = () => {
      if (cancelled) return;
      try { a.currentTime = start; } catch {}
      a.play().then(() => { timer = setInterval(() => { if (cancelled) { clearInterval(timer); return; } if (a.currentTime >= end || a.ended) finish(); }, 30); }).catch(() => setTimeout(done, 400));
    };
    if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
  }).catch(() => { if (!cancelled) fallback(); });
}
function play(key, text, done) {
  if (settings.voice <= 0) { setTimeout(done, 1200 + text.length * 45); return; }
  const nat = natural[lineId(text)];
  if (nat && !(key && RECORDED.has(key))) { playPart(nat[0], nat[1], nat[2], nat[3] || 1, done, () => playOther(key, text, done)); return; }
  playOther(key, text, done);
}
function playOther(key, text, done) {
  const file = key && RECORDED.has(key) ? `audio/${key}.mp3` : voiced.has(lineId(text)) ? `audio/tts/${lineId(text)}.wav` : null;
  if (file) {
    const a = new Audio(file);
    a.volume = settings.voice; a.onended = done; a.onerror = done;
    a.play().catch(() => setTimeout(done, 400));
    current = a;
    return;
  }
  if (window.speechSynthesis && germanVoice()) {
    const u = new SpeechSynthesisUtterance(text.replace(/…/g, ','));
    u.lang = 'de-DE'; u.rate = 0.92; u.pitch = 1.05; u.volume = settings.voice;
    u.voice = germanVoice();
    u.onend = done; u.onerror = done;
    speechSynthesis.speak(u);
  } else setTimeout(done, 1200 + text.length * 60);
}

function env(g, t0, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}
function tone(freq, dur, type = 'sine', vol = 0.3, delay = 0, slide = 0) {
  if (!ctx || settings.sfx <= 0) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
  env(g, t0, 0.01, dur, vol * settings.sfx);
  o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur, freq, vol = 0.3, delay = 0) {
  if (!ctx || settings.sfx <= 0) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); env(g, t0, 0.005, dur, vol * settings.sfx);
  src.connect(f).connect(g).connect(ctx.destination); src.start(t0);
}

// Gentle generative music: soft plucked notes from a pentatonic scale (never clashes),
// a slow pad underneath, and an echo for space. Calmer and lower at night and in caves.
const PENTA = [0, 2, 4, 7, 9];
let music = null;
export function startMusic() {
  if (!ctx || music) return;
  const out = ctx.createGain(); out.gain.value = settings.music ?? 0.35;
  const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.42;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
  delay.connect(fb).connect(delay); delay.connect(lp);
  lp.connect(out); out.connect(ctx.destination);
  const dry = ctx.createGain(); dry.gain.value = 0.7; dry.connect(lp);
  music = { out, delay, dry, mood: 'day', step: 0, deg: 2, timer: null };
  const pluck = (freq, t, vol) => {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = freq; o2.frequency.value = freq * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    o.connect(g); o2.connect(g2).connect(g); g.connect(music.dry); g.connect(music.delay);
    o.start(t); o2.start(t); o.stop(t + 2.4); o2.stop(t + 2.4);
  };
  const pad = (freqs, t, dur, vol) => {
    for (const f of freqs) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(music.dry); o.start(t); o.stop(t + dur + 0.1);
    }
  };
  const tick = () => {
    if (!music) return;
    const m = music.mood;
    const base = m === 'night' ? 196 : m === 'cave' ? 174.6 : 261.6;  // G3 / F3 / C4
    const note = (deg) => base * Math.pow(2, (PENTA[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5)) / 12);
    const t = ctx.currentTime + 0.05;
    if (music.step % 8 === 0) pad([note(0) / 2, note(2) / 2, note(4) / 2], t, 7, m === 'day' ? 0.035 : 0.03);
    if (Math.random() < (m === 'day' ? 0.75 : 0.5)) {
      music.deg = Math.max(0, Math.min(9, music.deg + [-2, -1, -1, 1, 1, 2, 0][(Math.random() * 7) | 0]));
      pluck(note(music.deg), t, m === 'day' ? 0.07 : 0.05);
      if (Math.random() < 0.25) pluck(note(music.deg + 2), t + 0.35, 0.04);
    }
    music.step++;
    music.timer = setTimeout(tick, (m === 'day' ? 900 : 1300) + Math.random() * 500);
  };
  tick();
}
export function setMusicMood(mood) { if (music) music.mood = mood; }
export function setMusicVolume(v) { settings.music = v; if (music) music.out.gain.setTargetAtTime(v, ctx.currentTime, 0.3); }

export const sfx = {
  foot(kind) { if (kind === 'stone') noise(0.05, 2400, 0.07); else if (kind === 'sand') noise(0.07, 900, 0.08); else noise(0.06, 600, 0.09); },
  dig() { noise(0.16, 900, 0.35); tone(140, 0.12, 'triangle', 0.15); },
  place() { tone(330, 0.09, 'triangle', 0.25); tone(495, 0.07, 'sine', 0.12, 0.03); },
  pickup() { tone(660, 0.12, 'sine', 0.18); tone(880, 0.14, 'sine', 0.15, 0.09); },
  tap() { tone(520, 0.06, 'sine', 0.15); },
  card() { tone(523, 0.18, 'sine', 0.18); tone(659, 0.18, 'sine', 0.16, 0.12); tone(784, 0.3, 'sine', 0.15, 0.24); },
  nope() { tone(220, 0.12, 'sine', 0.12); },
  step(i) { tone(i % 2 ? 180 : 200, 0.05, 'triangle', 0.05); },
  rocket() { noise(3.5, 400, 0.4); noise(2.5, 1500, 0.15, 0.4); tone(70, 3, 'sawtooth', 0.08, 0, 1.6); },
  // a lion's roar: a deep rumble that swells and fades (kept soft: it should be exciting, not scary)
  roar(small) {
    if (small) { tone(420, 0.45, 'triangle', 0.14, 0, 0.6); tone(300, 0.35, 'sawtooth', 0.04, 0.05, 0.7); return; }
    tone(150, 1.5, 'sawtooth', 0.09, 0, 0.5); tone(98, 1.6, 'sawtooth', 0.08, 0.05, 0.6); noise(1.5, 380, 0.3);
  },
  chuff() { noise(0.12, 700, 0.25); noise(0.12, 700, 0.22, 0.2); },   // tigers greet friends with a soft snort ("Prusten")
  shutter() { noise(0.04, 5000, 0.35); tone(1500, 0.03, 'square', 0.04, 0.05); noise(0.05, 3500, 0.25, 0.09); },
  hiss() { if (!ctx || settings.sfx <= 0) return; noise(1.7, 2600, 0.12); noise(1.7, 5000, 0.05, 0.2); tone(300, 1.7, 'sine', 0.05, 0, 2.5); },
  boom() { noise(1.2, 220, 0.6); noise(0.5, 1200, 0.35); tone(55, 0.9, 'sine', 0.4, 0, 0.5); [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, 0.5 + i * 0.08)); },
  beep() { [880, 1320, 990].forEach((f, i) => tone(f, 0.09, 'square', 0.06, i * 0.1)); },
  rattle() { for (let i = 0; i < 6; i++) tone(500 + Math.random() * 600, 0.04, 'triangle', 0.08, i * 0.06); },
  land() { noise(0.25, 260, 0.45); tone(80, 0.22, 'sine', 0.25); },
  done() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'sine', 0.16, i * 0.11)); },
};
