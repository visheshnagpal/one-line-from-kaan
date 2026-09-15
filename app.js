// Cookies from Kaan — a Moment. Open or refresh: one checked line. Tap it: that second on YouTube.
// Search is a closed lens. Deck / index / log stay behind this face.
import { buildBags, rankKeyword, rankHybrid } from "./rank.js";
import { faceCard, faceOpen, furtherAfter, takePassage, textOf as voiceText, loadReaderEdits, isReviewedCookie, provenanceOf } from "./voice.js";

const app = document.getElementById("app");
const [deck] = await Promise.all([
  fetch("data/deck.json").then((r) => r.json()),
]);
for (const l of deck) l.type = "line";
const byId = new Map(deck.map((l) => [l.id, l]));

const readerP = fetch("data/reader.json").then((r) => {
  if (!r.ok) throw new Error(`reader.json ${r.status}`);
  return r.json();
}).then((edits) => loadReaderEdits(edits, { loaded: true })).catch((err) => {
  console.warn("reader edits failed; builtin withhold still applies", err);
  loadReaderEdits({}, { loaded: false });
});
let autoP = null, indexP = null;
const getAuto = () => (autoP ??= fetch("data/auto.json").then((r) => r.json()).then((a) => {
  for (const x of a) { x.type = "auto"; byId.set(x.id, x); }
  return a;
}));
let chunksP = null;
const getChunksByVideo = () => (chunksP ??= fetch("data/chunks.json").then((r) => r.json()).then((chunks) => {
  const byVideo = new Map();
  for (const c of chunks) {
    if (!byVideo.has(c.video)) byVideo.set(c.video, []);
    byVideo.get(c.video).push(c);
  }
  for (const list of byVideo.values()) list.sort((a, b) => a.t - b.t);
  return byVideo;
}));
const getIndex = () => (indexP ??= Promise.all([
  fetch("data/chunks.json").then((r) => r.json()),
  fetch("data/vectors.json").then((r) => r.json()),
  fetch("data/vectors.bin").then((r) => r.arrayBuffer()),
  getAuto(),
]).then(([chunks, meta, bin, auto]) => {
  for (const c of chunks) c.type = "chunk";
  const chunkById = new Map(chunks.map((c) => [c.id, c]));
  const items = meta.ids.map((id) => (id.startsWith("L:") ? byId.get(id.slice(2)) : chunkById.get(id.slice(2))));
  const autoByVideo = new Map();
  for (const a of auto) { if (!autoByVideo.has(a.video)) autoByVideo.set(a.video, []); autoByVideo.get(a.video).push(a); }
  return { chunks, meta, vec: new Int8Array(bin), items, bags: buildBags(items), autoByVideo };
}));

const SEEN_KEY = "moment-seen";
const RECENT_KEY = "moment-recent"; // leftover from the first 16-id window
const LOG_KEY = "usage-log", LOG_MAX = 2000;
const state = {
  card: null,
  asking: false,
  watching: false,
  query: "",
  results: [],
  searchStatus: "",
  along: null, // { turns, pos }: everything Further can show for this card, and how far the reader is
  intro: false,
};
let introReturn = null;
let lastQueryLogged = "";
let embedWatch = null;

function log(event, data = {}) {
  try {
    const entries = JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]");
    entries.push({ at: new Date().toISOString(), event, ...data });
    localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(-LOG_MAX)));
  } catch { /* the site works without the log */ }
}
function seenIds() {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "null");
    if (Array.isArray(seen)) return seen;
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch { return []; }
}
function remember(id) {
  const ids = seenIds();
  if (!ids.includes(id)) ids.push(id);
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)); } catch { /* */ }
}

const fmtTime = (t) => {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h ? h + ":" : ""}${h ? String(m).padStart(2, "0") : m}:${String(s).padStart(2, "0")}`;
};
const yt = (video, t) => `https://youtu.be/${video}?t=${t}`;
const startOf = (c) => c.askedT ?? c.t;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const textOf = voiceText;
function embed(c) {
  const start = startOf(c);
  const origin = encodeURIComponent(location.origin);
  return `https://www.youtube-nocookie.com/embed/${c.video}?start=${start}&autoplay=1&rel=0&modestbranding=1&enablejsapi=1&origin=${origin}`;
}

function pick() {
  const approved = deck.filter((l) => isReviewedCookie(l));
  if (!approved.length) return null;
  const seen = new Set(seenIds());
  let fresh = approved.filter((l) => !seen.has(l.id));
  if (!fresh.length) {
    try { localStorage.removeItem(SEEN_KEY); } catch { /* */ }
    fresh = approved;
  }
  return fresh[Math.floor(Math.random() * fresh.length)];
}
function show(card, { watch = false, hash = false } = {}) {
  const opened = faceOpen(card) ?? card;
  state.card = opened;
  state.watching = !!watch;
  state.asking = false;
  state.along = null;
  if (card?.id) remember(card.id);
  if (hash && card?.id) location.hash = `l=${card.id}`;
  else if (!hash && location.hash) history.replaceState(null, "", location.pathname + location.search);
  render();
  if (state.watching) bindEmbedFallback(opened);
  const token = opened;
  alongOf(token).then((along) => {
    if (state.card !== token) return;
    if (state.along) return;
    if (along.opened && textOf(along.opened) && textOf(along.opened) !== textOf(token)) {
      state.card = along.opened;
    }
    state.along = { turns: along.turns, pos: 0 };
    if (textOf(state.card) !== textOf(token) || !along.turns.length) render();
  });
}
async function alongOf(card) {
  await readerP;
  const byVideo = await getChunksByVideo();
  const list = byVideo.get(card.video) ?? [];
  const opened = faceOpen(card, list) ?? card;
  return { opened, turns: furtherAfter(opened, list), pos: 0 };
}
const shownAlong = () => state.along?.turns.slice(0, state.along.pos) ?? [];
const alongEnded = () => !!state.along && state.along.pos >= state.along.turns.length;
function draw() {
  const card = pick();
  if (!card) {
    state.card = null;
    state.along = null;
    render();
    log("moment", { id: null, empty: true, of: deck.length });
    return;
  }
  show(card);
  log("moment", { id: card.id, kind: card.kind ?? null, seen: seenIds().length, of: deck.length });
}

function bindEmbedFallback(c) {
  if (embedWatch) { embedWatch(); embedWatch = null; }
  const iframe = app.querySelector(".frame iframe");
  if (!iframe) {
    window.open(yt(c.video, startOf(c)), "_blank", "noopener");
    return;
  }
  const onMsg = (e) => {
    if (!/youtube/.test(String(e.origin))) return;
    let data = e.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
    if (data?.event === "onError") {
      cleanup();
      window.open(yt(c.video, startOf(c)), "_blank", "noopener");
    }
  };
  const cleanup = () => {
    window.removeEventListener("message", onMsg);
    if (embedWatch === cleanup) embedWatch = null;
  };
  embedWatch = cleanup;
  window.addEventListener("message", onMsg);
  const ping = () => {
    try { iframe.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*"); } catch { /* */ }
  };
  iframe.addEventListener("load", ping);
  ping();
}

let embedder = null;
let modelState = new URLSearchParams(location.search).has("nomodel") ? "failed" : "idle";
async function loadModel(meta) {
  if (modelState !== "idle") return;
  modelState = "loading";
  try {
    const { pipeline, env } = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0");
    env.allowLocalModels = false;
    const extractor = await pipeline("feature-extraction", meta.model, { dtype: meta.dtype ?? "q8" });
    embedder = async (text) => (await extractor(text, { pooling: "mean", normalize: true })).data;
    modelState = "ready";
  } catch (e) {
    console.warn("model failed to load; keyword search only", e);
    modelState = "failed";
    log("model-failed");
  }
}
function present(idx, it) {
  let card = it;
  if (it.type === "chunk") {
    const near = (idx.autoByVideo.get(it.video) ?? []).find((a) => Math.abs(a.t - it.t) <= 30);
    card = near ?? it;
  }
  const list = (idx.chunks ?? []).filter((c) => c.video === card.video);
  return faceOpen(faceCard(card), list);
}
const FAMILIES = ["Awareness", "Compassion", "Wisdom", "Emotions", "Devotion"];
const KIND_RANK = { practice: 0, prayer: 1, teaching: 2, example: 3, question: 4 };
function familiesNamed(q) {
  const low = q.toLowerCase();
  return FAMILIES.filter((f) => low.includes(f.toLowerCase()));
}
const ARCS = ["Awareness", "Compassion", "Wisdom"];
function gatherResults(ranked, q) {
  const have = new Set(ranked.map((r) => r.id).filter(Boolean));
  const extra = [];
  const named = familiesNamed(q);
  const also = named.some((f) => ARCS.includes(f)) ? ARCS.filter((f) => !named.includes(f)) : [];
  for (const f of [...named, ...also]) {
    const want = named.includes(f) ? 8 : 3;
    for (const l of deck.filter((x) => x.family === f && x.kind === "practice" && !have.has(x.id)).slice(0, want)) {
      extra.push(l);
      have.add(l.id);
    }
  }
  return [...ranked, ...extra];
}
function groupResults(results, q) {
  const named = familiesNamed(q);
  const buckets = new Map();
  for (const it of results) {
    const fam = it.family || (it.type === "chunk" ? "from the captions" : "other");
    if (!buckets.has(fam)) buckets.set(fam, []);
    buckets.get(fam).push(it);
  }
  const order = [
    ...named,
    ...FAMILIES.filter((f) => !named.includes(f) && buckets.has(f)),
    ...[...buckets.keys()].filter((k) => !FAMILIES.includes(k)),
  ].filter((k) => buckets.has(k));
  return order.map((name) => {
    const items = buckets.get(name);
    items.sort((a, b) => (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9));
    const practices = items.filter((x) => x.kind === "practice").length;
    const label = named.includes(name) && practices ? `${name} · practices` : name;
    return { name, label, items };
  });
}
let searchSeq = 0;
async function runSearch() {
  const q = state.query.trim(), seq = ++searchSeq;
  if (q.length < 2) { state.results = []; state.searchStatus = ""; render(); return; }
  const idx = await getIndex();
  if (seq !== searchSeq) return;
  const shown = (it) => textOf(it) && !it.withheld;
  state.results = gatherResults(rankKeyword(idx.items, idx.bags, q, 20).map((it) => present(idx, it)).filter(shown), q);
  state.searchStatus = modelState === "failed" ? "keyword search (the model didn't load)" : modelState === "ready" ? "" : "loading the model once…";
  render();
  setTimeout(() => {
    if (state.query.trim() === q && q !== lastQueryLogged) {
      lastQueryLogged = q;
      log("ask", { q, results: state.results.length, semantic: modelState === "ready" });
    }
  }, 1200);
  loadModel(idx.meta).then(async () => {
    if (modelState !== "ready" || seq !== searchSeq) {
      if (modelState === "failed") { state.searchStatus = "keyword search (the model didn't load)"; render(); }
      return;
    }
    const qvec = await embedder(q);
    if (seq !== searchSeq) return;
    const shown = (it) => textOf(it) && !it.withheld;
    state.results = gatherResults(rankHybrid(idx.items, idx.bags, idx.meta, idx.vec, q, qvec, undefined, 20).map((it) => present(idx, it)).filter(shown), q);
    state.searchStatus = "";
    render();
  });
}

async function readFurther() {
  const card = state.card;
  if (!card) return;
  if (!state.along) {
    const along = await alongOf(card);
    if (state.card !== card) return;
    if (!state.along) state.along = { turns: along.turns, pos: 0 };
  }
  const along = state.along;
  const more = takePassage(along.turns.slice(along.pos), 1);
  along.pos += more.length;
  log("further", { id: card.id, shown: along.pos, of: along.turns.length, added: more.length });
  const button = app.querySelector('[data-act="further"]');
  if (!button) return;
  let container = app.querySelector('.along');
  if (!container) {
    container = document.createElement('div');
    container.className = 'along';
    container.style.animation = 'none';
    button.before(container);
  }
  for (const passage of more) {
    if (passage.asked) {
      const question = document.createElement('p');
      question.className = 'asked new-passage';
      question.textContent = passage.asked;
      container.append(question);
    }
    const paragraph = document.createElement('p');
    paragraph.className = 'new-passage';
    paragraph.textContent = passage.text;
    container.append(paragraph);
  }
  if (alongEnded()) button.remove();
  else button.textContent = 'further';
}

function watch(c, ev) {
  if (ev && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey)) return;
  if (ev) ev.preventDefault();
  if (!c?.video) return;
  const on = !(state.watching && state.card === c);
  state.watching = on;
  log("watch", { id: c.id ?? null, video: c.video, t: startOf(c), on });
  render();
  if (on) bindEmbedFallback(c);
}

function render() {
  document.documentElement.classList.toggle("intro-open", state.intro);
  app.innerHTML = view();
  wire();
}

function viewAsk() {
  const groups = groupResults(state.results, state.query);
  const rows = groups.map((g) => {
    const items = g.items.map((it) => {
      const i = state.results.indexOf(it);
      const text = it.asked ? `${it.asked} — ${it.quote}` : textOf(it);
      const kind = it.kind ? `<span class="result-k">${esc(it.kind === "question" ? "a question" : it.kind)}</span>` : "";
      const src = provenanceOf(it);
      const srcNote = src === "reviewed" ? "" : `<span class="result-src">${esc(src === "draft" ? "awaiting the editor" : "from the captions")}</span>`;
      return `<button class="result" data-open="${i}"><span class="result-q">${esc(text)}</span>${kind}${srcNote}<span class="result-t">${fmtTime(it.t)}</span></button>`;
    }).join("");
    return `<div class="group"><div class="group-k">${esc(g.label)}</div>${items}</div>`;
  }).join("");
  const q = state.query.trim();
  const empty = q.length >= 2 && !state.results.length && !state.searchStatus.startsWith("loading")
    ? `<div class="status">Nothing close. Try other words — or ask Kaan on Saturday.</div>` : "";
  const hint = !q && !state.searchStatus
    ? "Ask in your own words. It finds the moment Kaan talked about it — every recording."
    : state.searchStatus;
  return `<div class="ask">
    <input id="ask" type="search" autocomplete="off" placeholder="What did Kaan say about this?" value="${esc(state.query)}">
    <div class="status">${esc(hint)}</div>
    ${rows ? `<div class="results">${rows}</div>` : empty}
  </div>`;
}

function viewMoment() {
  const c = state.card;
  if (!c) {
    return `<div class="moment"><p class="src-note">No reviewed line to show yet.</p></div>`;
  }
  const start = startOf(c);
  const quote = textOf(c);
  const origin = provenanceOf(c);
  const raw = origin !== "reviewed" && !c.asked;
  const along = shownAlong();
  const originNote = c.readerNote || (c.withheld
    ? "This passage is waiting on a listen"
    : origin === "reviewed" ? "" : origin === "draft"
      ? "drafted — awaiting the editor"
      : "from the captions, not yet reviewed");
  return `<div class="moment">
    ${c.asked ? `<p class="asked">${esc(c.asked)}</p>` : ""}
    ${quote ? `<button class="quote${raw ? " raw" : ""}" data-act="watch" title="Hear Kaan say it">${esc(quote)}</button>` : ""}
    <div class="src">
      <span class="src-session">${esc(c.session)}</span><span aria-hidden="true">·</span>
      <a class="time${state.watching ? " on" : ""}" href="${yt(c.video, start)}" target="_blank" rel="noopener" data-act="watch">${fmtTime(c.t)}</a>
      ${originNote ? `<span class="src-note">${esc(originNote)}</span>` : ""}
    </div>
    ${state.watching ? `<div class="frame"><iframe src="${embed(c)}" title="${esc(c.session)} at ${fmtTime(c.t)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>` : ""}
    ${along.length ? `<div class="along">${along.map((s) => `${s.asked ? `<p class="asked">${esc(s.asked)}</p>` : ""}<p>${esc(s.text)}</p>`).join("")}</div>` : ""}
    ${alongEnded() ? "" : `<button class="further" data-act="further">${along.length ? "further" : "read further"}</button>`}
  </div>`;
}

function viewIntro() {
  if (!state.intro) return "";
  return `<div class="intro-scrim" data-act="intro-close">
    <div class="intro" role="dialog" aria-modal="true" aria-label="How to use this site" tabindex="-1">
      <p>Tap <strong>@insideout.tepetaklak</strong> for another line.<br>
      Tap the <strong>quote or timestamp</strong> to open the original video.<br>
      Tap <strong>Further</strong> to keep reading.<br>
      Tap <strong>search</strong> to find a topic or ask a question.</p>
      <p>Errors or suggestions? <a href="mailto:visheshnagpal@gmail.com">visheshnagpal@gmail.com</a></p>
      <button class="intro-x" data-act="intro-close" type="button">Close</button>
    </div>
  </div>`;
}

function view() {
  const inert = state.intro ? " inert" : "";
  return `<div class="page">
    <div class="chrome"${inert}>
    <div class="bar">
      <button class="mark" data-act="refresh" type="button" title="another line">@insideout.tepetaklak</button>
      <button class="lens${state.asking ? " on" : ""}" data-act="ask" title="ask anything" aria-label="ask anything">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 L21 21"/></svg>
      </button>
    </div>
    ${state.asking ? viewAsk() : viewMoment()}
    <footer class="foot">
      <button class="about" data-act="intro" type="button" aria-label="How to use this site" aria-expanded="${state.intro ? "true" : "false"}">about</button>
    </footer>
    </div>
    ${viewIntro()}
  </div>`;
}

function wire() {
  const openResult = (i) => {
    const it = state.results[i];
    log("ask-open", { q: state.query.trim(), rank: i + 1, type: it.type, id: it.id });
    show(it, { hash: true });
  };
  app.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openResult(+b.dataset.open)));
  const introBox = app.querySelector(".intro");
  if (introBox) {
    introBox.addEventListener("click", (ev) => ev.stopPropagation());
    const focusable = [...introBox.querySelectorAll("button, [href], [tabindex]:not([tabindex='-1'])")];
    introBox.addEventListener("keydown", (e) => {
      if (e.key !== "Tab" || !focusable.length) return;
      const i = focusable.indexOf(document.activeElement);
      const last = focusable.length - 1;
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); focusable[last].focus(); }
      else if (!e.shiftKey && i === last) { e.preventDefault(); focusable[0].focus(); }
    });
    (focusable[0] ?? introBox).focus();
  }
  app.querySelectorAll("[data-act]").forEach((el) => el.addEventListener("click", (ev) => {
    const act = el.dataset.act;
    if (act === "ask") {
      state.asking = !state.asking;
      if (!state.asking) { state.query = ""; state.results = []; state.searchStatus = ""; }
      log("lens", { on: state.asking });
      render();
      return;
    }
    if (act === "watch") watch(state.card, ev);
    if (act === "further") readFurther();
    if (act === "intro") {
      introReturn = el;
      state.intro = true;
      render();
      return;
    }
    if (act === "intro-close") {
      state.intro = false;
      render();
      app.querySelector('[data-act="intro"]')?.focus();
      return;
    }
    if (act === "refresh") {
      log("refresh", { from: state.card?.id ?? null });
      draw();
    }
  }));
  const ask = document.getElementById("ask");
  if (ask) {
    ask.addEventListener("input", () => { state.query = ask.value; runSearch(); });
    ask.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && state.results[0]) openResult(0);
      if (e.key === "Escape") {
        state.asking = false; state.query = ""; state.results = []; state.searchStatus = "";
        render();
      }
    });
    const v = ask.value.length;
    ask.focus();
    ask.setSelectionRange(v, v);
  }
}

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.key === "Escape") {
    if (state.intro) { state.intro = false; render(); app.querySelector('[data-act="intro"]')?.focus(); }
    else if (state.asking) { state.asking = false; state.query = ""; state.results = []; render(); }
    else if (state.watching) { state.watching = false; render(); }
  }
});

window.addEventListener("pageshow", (e) => {
  if (e.persisted && !location.hash) draw();
});

(async () => {
  await readerP;
  const nav = performance.getEntriesByType?.("navigation")?.[0];
  const reloaded = nav?.type === "reload";
  const h = location.hash;
  let m;
  if (!reloaded && (m = h.match(/^#l=([A-Za-z0-9_-]{11}-\d+)$/))) {
    if (!byId.has(m[1])) await getAuto();
    const c = byId.get(m[1]);
    if (c) { log("deep-link", { id: c.id }); show(c); return; }
  }
  log("visit", { screen: "moment" });
  draw();
})();
