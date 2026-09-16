let SPEAKER_CUES = { videos: {}, labels: [] };
export function loadSpeakerCues(data = {}) {
  SPEAKER_CUES = { videos: data.videos ?? {}, labels: data.labels ?? [] };
}

// Who is speaking on the face and in "further". Port of scripts/lib/lift.mjs cues
// (the browser cannot import that module). Search may keep a question; a Moment
// or further block that hits Q&A must show asked + his answer — never a mashed
// quote, never an unlabeled student line, never his reply with the question dropped.

const NAMES = "joe|anita|sophia|shane|iris|anna|adria|olivia|reed|patty|neel|vishesh|tatiana|ismed|nia|nha|ada";
const FILLER_SENT = /^(yeah|yes|okay|ok|exactly|mhm|mm+|right|beautiful|perfect|nice|good|thank you|thanks|wow|sure|no|hm+|uh-huh|correct|true|bye(?:\s+bye)*)[.!?]?$/i;
const ADMIN_HARD = /\b(can you hear|hear me|recording|zoom|mute|unmute|whatsapp|share your screen|screen share|are you there|is everyone|let me check|one second|hold on|any (other )?questions)\b/i;
const CLASS_WRAP = /\b(this will be our last class|ask (it )?in our regular class|see you (next week|on the next class|in the next|guys)|thank you (guys )?for joining|i will send you the recording|added you to (the )?(whatsapp|calendar)|can you hear me|share your screen|okay,? anything else|any other questions about this)\b/i;
const NAME_TURN = new RegExp(String.raw`\b(?:yes|okay|ok|thanks?|hi|hello)\s+(${NAMES})\b`, "i");
const NAME_ONLY = new RegExp(String.raw`^(?:yes\.?\s*)+(${NAMES})\.?$`, "i");
const STUDENT_LABEL = /\bstudent\s*(?:\([^)]*\))?\s*:/i;
const KAAN_LABEL = /\bKaan\s*:/i;
const ASKS_HIM = /(?:^|[.!?]\s+)(can you|could you|would you|what were|what was|what did you|what do you|what happens|did you (refer|mean|say)|do you (think|mean)|is that (right|correct)|am i)\b/i;
const ASK_OPEN = /^\s*(uh|um|okay|ok|so|and|but)?[,.]?\s*(what|why|how|when|where|is it|does (it|that)|can i|could you|would you)\b/i;
const STUDENT_STRONG = /\b(i feel|i felt|i was|i wasn'?t|i'?m not sure|i noticed|i notice|for me|my experience|in my case|i have (a )?question|my question|can i ask|i was wondering|i wonder|i wanted to ask|is it (okay|ok|normal)|should i|does that mean|what do you mean|thank you kaan|thanks kaan|i struggle|i understand it now|i don'?t know|i didn'?t (know|want|like|ever)|i just heard|when i was|i was practicing|i remember|i forgot|i needed|i actually|one day i|i had this|i'?m looking|i accepted|i used to|i hurt|for myself|i'?d like to|i would like to (ask|share|know)|in what you said|i see some|the only thing i|i can do is|my (friend|partner|husband|wife|kids|children|job|work|family|knee|life|mind))\b/i;
const KAAN_CUE = /\b(you guys|let'?s|you can|we call|in tibetan|in buddhism|buddha|dharma|sentient|awareness|emptiness|wisdom|compassion|bodhicitta|practice|meditation|i want you to|i will give|i recommend|you see what i mean|right\?|the view|open awareness|shamatha|tonglen|immeasurab|equanim|sympathetic joy)\w*/gi;
const TEACHING_ADDRESS = /\b(you guys|let'?s|you can|we call|we will|we got|so it is|this is why|i want you|i recommend|you see what i mean|you remember)\b/i;
const IMMEDIATE_S = 90;
const QUESTION_TURN_WORDS = 80;

export const textOf = (c) => c?.quote ?? c?.text ?? "";

export function splitSentences(text) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  const parts = t.split(/(?<=[.!?])["”)]?\s+(?=[A-Z"“(])/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [t];
}

function wordCount(s) {
  return String(s ?? "").split(/\s+/).filter(Boolean).length;
}

function countCue(re, text) {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  return (String(text).match(new RegExp(re.source, flags)) ?? []).length;
}

function isAsk(s) {
  if (NAME_TURN.test(s)) return true;
  if (!/\?/.test(s)) return false;
  if (/\bany (other )?questions\b/i.test(s)) return false;
  if (ASKS_HIM.test(s) || ASK_OPEN.test(s)) return true;
  return false;
}

export function tagSentence(text) {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "skip";
  if (FILLER_SENT.test(s) || /^(?:bye\b[\s,]*)+(?:everybody|everyone|guys)?[.!]*$/i.test(s)) return "filler";
  if (NAME_ONLY.test(s)) return "admin";
  if (CLASS_WRAP.test(s)) return "admin";
  if (ADMIN_HARD.test(s) && wordCount(s) < 22) return "admin";
  if (isAsk(s)) return "ask";
  const studentHits = countCue(STUDENT_STRONG, s);
  const kaanHits = countCue(KAAN_CUE, s);
  const words = wordCount(s);
  const addressed = TEACHING_ADDRESS.test(s);
  if (studentHits >= 2) return "student";
  if (studentHits >= 1 && !addressed) return "student";
  if (addressed || (kaanHits >= 2 && studentHits === 0)) return "his";
  if (kaanHits >= 1 && studentHits === 0 && words >= 8) return "his";
  if (words < 7) return "filler";
  return "unknown";
}

function whoOf(tag) {
  if (tag === "ask" || tag === "student" || tag === "admin" || tag === "his") return tag;
  return "unknown";
}

function tidy(s) {
  return String(s ?? "").replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}

function tidyAsked(s) {
  let t = tidy(s);
  t = t.replace(new RegExp(String.raw`^(?:yes|okay|ok|thanks?|hi|hello)\s+(?:${NAMES})\s*[,.]?\s*`, "i"), "");
  t = t.replace(/^(yeah|yes|okay|ok|uh|um)[,.]?\s+/i, "");
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function tidyQuote(s) {
  let t = tidy(s);
  t = t.replace(/^(yeah|yes|okay|ok|so)[,.]?\s+/i, "");
  return t;
}

// Display-only overlays. Raw transcripts stay on disk as fetched.
// heard:false everywhere in the builtin set: no one in this pass listened.
const BUILTIN_WITHHOLD = [
  {
    video: "r8UmVq9O0Fk",
    from: 4139,
    to: 4161,
    cue: "1:08:59",
    raw: "expenditure",
    flag: "uncertain-asr",
    heard: false,
  },
];

let READER = { terms: [], cards: new Map(), withhold: [...BUILTIN_WITHHOLD], loaded: false };

function rawHit(raw, text) {
  if (!raw || !text) return false;
  return new RegExp(`\\b${String(raw).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
}

function mergeWithhold(extra) {
  const out = [...BUILTIN_WITHHOLD];
  for (const w of extra ?? []) {
    if (!w) continue;
    const dup = out.some((x) => x.video === w.video && x.raw === w.raw && x.from === w.from);
    if (!dup) out.push(w);
  }
  return out;
}

export function loadReaderEdits(edits = {}, { loaded = false } = {}) {
  const terms = Array.isArray(edits.terms) ? edits.terms : [];
  const cards = new Map();
  for (const c of edits.cards ?? []) if (c?.id) cards.set(c.id, c);
  READER = {
    terms,
    cards,
    withhold: mergeWithhold(edits.withhold),
    heard: edits.heard === true,
    loaded,
  };
  return READER;
}

export function readerEditsLoaded() {
  return READER.loaded === true;
}

export function applyDisplayTerms(text, extra = "") {
  let s = String(text ?? "");
  const ctx = `${s} ${extra}`;
  for (const term of READER.terms) {
    if (!term?.from || term.to == null) continue;
    if (term.when && !new RegExp(term.when, "i").test(ctx)) continue;
    s = s.replace(new RegExp(term.from, "gi"), term.to);
  }
  return s;
}

function cardEdit(card) {
  return READER.cards.get(card?.id) ?? null;
}

/**
 * Quarantine. A sentence that *starts* before `from` still matches when it
 * contains `raw` on the same video, or when [t, tEnd] overlaps [from, to].
 */
export function isWithheld(video, t, text = "", extra = {}) {
  const tEnd = extra.tEnd ?? extra.end ?? t;
  return READER.withhold.some((w) => {
    if (w.video && w.video !== video) return false;
    if (rawHit(w.raw, text)) return true;
    if (w.from == null && w.to == null) return false;
    const start = t == null ? tEnd : t;
    const end = tEnd == null ? t : tEnd;
    if (start == null) return false;
    const from = w.from ?? w.to;
    const to = w.to ?? w.from;
    return start <= to && end >= from;
  });
}

/** Editor lines that already write `student (Name): … Kaan: …`. */
export function splitLabeled(text) {
  const raw = String(text ?? "");
  if (!STUDENT_LABEL.test(raw) || !KAAN_LABEL.test(raw)) return null;
  const chunks = raw.split(/(?=(?:student(?:\s*\([^)]*\))?|Kaan)\s*:)/i);
  const asked = [];
  const quote = [];
  for (const ch of chunks) {
    const m = ch.match(/^(student(?:\s*\([^)]*\))?|Kaan)\s*:\s*([\s\S]*)$/i);
    if (!m) continue;
    const body = tidy(m[2].replace(/…\s*$/, ""));
    if (!body) continue;
    if (/^student/i.test(m[1])) asked.push(body);
    else quote.push(body);
  }
  if (!asked.length || !quote.length) return null;
  return { asked: tidyAsked(asked[0]), quote: tidyQuote(quote.join(" ")) };
}

export function splitVoices(text) {
  const labeled = splitLabeled(text);
  if (labeled) return labeled;
  const sentences = splitSentences(text);
  const tagged = sentences.map((s) => ({ s, tag: tagSentence(s) }));
  const asked = [];
  const after = [];
  const before = [];
  let seenAsk = false;
  let inStudent = false;
  for (const { s, tag } of tagged) {
    if (tag === "filler" || tag === "admin" || tag === "skip") continue;
    if (tag === "ask") {
      seenAsk = true;
      inStudent = true;
      asked.push(s);
      continue;
    }
    if (tag === "student") {
      inStudent = true;
      continue;
    }
    if (tag === "unknown" && inStudent) continue;
    inStudent = false;
    if (seenAsk) after.push(s);
    else before.push(s);
  }
  const q = tidyQuote(after.join(" ") || (!asked.length ? before.join(" ") : ""));
  const a = tidyAsked(asked.join(" "));
  return { asked: a, quote: q };
}

export function looksMixed(text) {
  const raw = String(text ?? "");
  if (STUDENT_LABEL.test(raw) && KAAN_LABEL.test(raw)) return true;
  if (NAME_TURN.test(raw) && /\?/.test(raw)) return true;
  const tags = splitSentences(raw).map(tagSentence);
  return tags.includes("ask") && (tags.includes("his") || tags.includes("student"));
}

/** Editor convention: `[the question] His answer.` — recorded, not a speaker guess. */
export function splitBracketAsked(text) {
  const m = String(text ?? "").match(/^\s*\[([^\]]{8,280})\]\s+([\s\S]+)$/);
  if (!m) return null;
  const asked = tidyAsked(m[1]);
  const quote = tidyQuote(m[2]);
  if (!asked || !quote || !/\?/.test(asked)) return null;
  return { asked, quote };
}

export function faceCard(card) {
  if (!card) return card;
  if (card.asked && card.quote) return card.kind ? card : { ...card, kind: "question" };
  const raw = textOf(card);
  if (!raw) return card;
  const labeled = splitLabeled(raw);
  if (labeled?.asked && labeled.quote) return { ...card, asked: labeled.asked, quote: labeled.quote, kind: "question" };
  const bracket = splitBracketAsked(raw);
  if (bracket) return { ...card, asked: bracket.asked, quote: bracket.quote, kind: "question" };
  // Checked lines keep the editor's words. Guessing speakers is only for
  // unlabeled caption/auto cards (search), never for the morning opening.
  if (card.type === "line") return card;
  if (!looksMixed(raw)) return card;
  const split = splitVoices(raw);
  if (split.asked && split.quote) return { ...card, asked: split.asked, quote: split.quote, kind: "question" };
  if (split.quote && split.quote !== raw && !split.asked) {
    const next = { ...card, quote: split.quote };
    if (card.text) next.text = split.quote;
    return next;
  }
  return card;
}

const BIND_NEXT = /^(because|so|means|that is|that's|which|and mainly|like it's|generally this is how|this is (why|how))\b/i;
const NEW_SCENE = /^(when i |then i |so let's|let's |i will |now |first,|there is a |i asked|i had an accident)/i;
const SHORT_YES = /\b(yes|no|exactly|right|true|correct)\.?$/i;
const SPAN_THOUGHT = 55;

export function isCompleteThought(s) {
  const t = tidy(s);
  const w = wordCount(t);
  if (!t || w < 3) return false;
  if (SHORT_YES.test(t) && w <= 12) return false;
  if (/\b(this|that)\.?$/i.test(t) && w <= 16) return false;
  if (/basically\.?$/i.test(t) && w <= 12) return false;
  if (looksHanging(t)) return false;
  return /[.!?]$/.test(t) || w >= 12;
}

const HANGING_TAIL = /\b(I|we|you|to|the|a|an|and|or|but|my|his|her|of|for|before|after|if|when|that|this|really|like)\.?$/i;
const HANGING_HEAD = /^(and|but|or|because|if|when|before|after|to|really|like let's|let's say my)\b/i;

function looksHanging(s) {
  const t = tidy(s);
  if (!t) return true;
  if (/[.!?]$/.test(t) && wordCount(t) >= 3 && !HANGING_TAIL.test(t.replace(/[.!?]+$/, ""))) return false;
  return HANGING_TAIL.test(t) || (HANGING_HEAD.test(t) && !/[.!?]$/.test(t) && wordCount(t) < 16);
}

/** Mid-sentence cut. A short finished sentence is not a fragment. */
export function looksFragment(s) {
  const t = tidy(s);
  if (!t) return true;
  if (looksHanging(t)) return true;
  return !isCompleteThought(t);
}

/** Keep a yes/no or heading with the sentence it needs. Never cut inside a sentence. */
export function shouldBind(a, b) {
  const left = tidy(a);
  const right = tidy(b);
  if (!left || !right) return false;
  if (NEW_SCENE.test(right)) return false;
  if (wordCount(left) + wordCount(right) > SPAN_THOUGHT) return false;
  // Continuations after a finished sentence — not a new scene. Bare "So …"
  // stays question-only; it is too common to glue every teaching.
  if (BIND_NEXT.test(right) && !/^so\b/i.test(right)) return true;
  if (/[?]$/.test(left) && (BIND_NEXT.test(right) || wordCount(left) <= 8)) return true;
  if (!isCompleteThought(left)) return true;
  if (/^(it can be|this is|that's|that is)\b/i.test(right) && wordCount(right) <= 12) return true;
  return false;
}

export function quoteSpans(text) {
  return String(text ?? "").split(/\s*(?:…|\.\.\.)\s*/).map(tidy).filter(Boolean);
}

export function beatsOf(text) {
  const out = [];
  // Ellipsis is an editorial cut. Do not glue the pieces — that invents a sentence.
  for (const span of quoteSpans(text)) {
    const sents = splitSentences(span);
    if (wordCount(span) <= SPAN_THOUGHT && sents.length <= 8) {
      if (span) out.push(span);
      continue;
    }
    for (let i = 0; i < sents.length; ) {
      let beat = sents[i];
      while (i + 1 < sents.length && shouldBind(beat, sents[i + 1])) {
        i += 1;
        beat = `${beat} ${sents[i]}`;
      }
      i += 1;
      if (beat) out.push(beat);
    }
  }
  return out.length ? out : (tidy(text) ? [tidy(text)] : []);
}

function finishOpening(text) {
  const beats = beatsOf(text);
  return { quote: beats[0] || text, rest: beats.slice(1), full: text };
}

const JOIN_FAIL_WORDS = 70;

/** Join neighbouring caption chunks, then split sentences. No clause guessing. */
export function thoughtAt(chunks, t, hint = "") {
  const list = [...(chunks ?? [])].sort((a, b) => a.t - b.t);
  const around = list.filter((c) => c.t >= t - 50 && c.t <= t + 90);
  if (!around.length) return "";
  const joined = around.map((c) => c.text).join(" ");
  const sents = splitSentences(joined);
  const needle = wordsOf(hint).filter((w) => w.length > 3).slice(0, 6).join(" ");
  let hit = -1;
  if (needle) hit = sents.findIndex((s) => wordsOf(s).join(" ").includes(needle));
  if (hit < 0) {
    const at = around.find((c) => c.t <= t && c.t + 30 >= t) ?? around[0];
    const key = wordsOf(at.text).slice(0, 5).join(" ");
    hit = sents.findIndex((s) => wordsOf(s).join(" ").includes(key));
  }
  if (hit < 0) return "";
  const thought = sents[hit];
  if (wordCount(thought) > JOIN_FAIL_WORDS) return "";
  return tidy(thought);
}

function alreadyOpen(card) {
  return Boolean(card?.sourceQuote) && Array.isArray(card.restBeats);
}

/** Opening drip: first whole thought. Remainder stays on `sourceQuote`. Idempotent. */
export function faceOpen(card, chunks = []) {
  if (!card) return card;
  if (alreadyOpen(card)) {
    const quote = applyDisplayTerms(card.quote);
    const full = applyDisplayTerms(card.sourceQuote);
    const withheld = isWithheld(card.video, card.t, quote) || isWithheld(card.video, card.t, full);
    return {
      ...card,
      quote: withheld ? "" : quote,
      sourceQuote: full,
      restBeats: card.restBeats.map((t) => applyDisplayTerms(t)),
      withheld,
    };
  }
  const base = faceCard(card);
  if (!base) return base;
  const edit = cardEdit(base);
  const rawFull = textOf(base);
  const full = edit?.open ? edit.open : rawFull;
  const finished = finishOpening(full);
  let quote = finished.quote;
  let rest = finished.rest;
  if (looksFragment(quote) && chunks.length && !edit?.open) {
    const recovered = thoughtAt(chunks, base.t ?? 0, quote);
    if (recovered && !looksFragment(recovered) && wordCount(recovered) <= JOIN_FAIL_WORDS) {
      quote = recovered;
      rest = [];
    }
  }
  quote = applyDisplayTerms(quote);
  const shownWithheld = isWithheld(base.video, base.t, quote);
  return {
    ...base,
    quote: shownWithheld ? "" : quote,
    sourceQuote: applyDisplayTerms(full),
    restBeats: rest.map((t) => applyDisplayTerms(t)),
    withheld: shownWithheld,
    readerNote: edit?.note ?? "",
  };
}

export function isClassAdmin(s) {
  const t = String(s ?? "");
  if (CLASS_WRAP.test(t)) return true;
  if (ADMIN_HARD.test(t) && wordCount(t) < 28) return true;
  return false;
}

// Transcript-marked student report stored as a checked line. Not audio-verified.
// Keep it out of the morning draw until an editor hears the tape.
const UNTRUSTED_FACE = new Set(["JhaJWWTtP7c-0"]);

export function canFace(card) {
  if (UNTRUSTED_FACE.has(card?.id)) return false;
  const f = faceCard(card);
  const quote = textOf(f).trim();
  if (!quote) return false;
  if (f.asked) return true;
  if (NAME_TURN.test(quote) && /\?/.test(quote)) return false;
  if (STUDENT_LABEL.test(quote) && KAAN_LABEL.test(quote)) return false;
  if (isClassAdmin(quote) && wordCount(quote) < 70) return false;
  return true;
}

/**
 * Homepage cookies. `type: "line"` is assigned in the browser to every deck row —
 * it is not a review mark. Only `reviewed: true` (from the source page's
 * `status: reviewed`) or an explicit `approved: true` overlay counts.
 * Editorial review is not audio verification.
 */
export function editorialStatus(card) {
  if (!card) return "unknown";
  if (card.type === "chunk") return "caption";
  if (card.type === "auto" || card.auto === true) return "auto";
  if (card.draft === true || card.reviewed === false) return "draft";
  if (card.approved === true || card.reviewed === true) return "editorial";
  return "unknown";
}

export function isReviewedCookie(card) {
  if (!card || !canFace(card)) return false;
  if (editorialStatus(card) !== "editorial") return false;
  const opened = alreadyOpen(card) ? card : faceOpen(card);
  if (opened.withheld || !textOf(opened).trim()) return false;
  if (!opened.asked && looksFragment(textOf(opened))) return false;
  if (isWithheld(card.video, card.t, textOf(opened))) return false;
  return true;
}

export function provenanceOf(card) {
  const status = editorialStatus(card);
  if (status === "editorial") return "reviewed";
  if (status === "draft") return "draft";
  if (status === "auto") return "auto";
  if (status === "caption") return "caption";
  return "unknown";
}

const FILLER_WORD = /^(uh|um|hm+|mm+|so|okay|ok|yeah|yes)$/;
const QUOTE_SPAN_S = 90; // a long checked quote can run across three captions
const ALIGN_LOOKAHEAD = 4; // quote words an editor may have cut or reworded in a row
const ALIGN_GAP = 16; // caption words with no quote word in them: the quote has ended
const ALIGN_MIN = 0.6; // share of quote words that must be found for the quote to count as located
const ALIGN_WORD = 4; // shorter words ("the", "and", "is") match by chance and are not aligned

/** Comparable words with their place in the raw text: fillers and stutters ("physical physical") dropped. */
function tokens(s) {
  const out = [];
  let prev = "";
  for (const m of String(s ?? "").matchAll(/\S+/g)) {
    const w = m[0].toLowerCase().replace(/[^a-z0-9']/g, "");
    if (w.length <= 1 || FILLER_WORD.test(w) || w === prev) continue;
    out.push({ w, end: m.index + m[0].length });
    prev = w;
  }
  return out;
}

function wordsOf(s) {
  return tokens(s).map((t) => t.w);
}

function containedIn(hay, needle) {
  const h = wordsOf(hay).join(" "), n = wordsOf(needle).join(" ");
  if (n.length < 16) return false;
  return h.includes(n.slice(0, Math.min(72, n.length)));
}

/** Caption restating the opening with a dropped "the"/"so". */
function echoesQuote(quote, text) {
  const n = wordsOf(text).filter((w) => w.length > 2);
  if (n.length < 6) return false;
  const h = new Set(wordsOf(quote).filter((w) => w.length > 2));
  const hit = n.filter((w) => h.has(w)).length;
  return hit / n.length >= 0.84;
}

/**
 * Where the card's quote ends inside the caption text, as a character offset, or 0
 * when the quote is not there. The editor's version differs from the captions by
 * fillers, stutters, small rewordings and "…" elisions, so each elided piece is
 * matched word by word in order with a little slack instead of as an exact substring.
 */
function alignPieceIn(piece, text) {
  const toks = tokens(text).filter((t) => t.w.length >= ALIGN_WORD);
  const q = wordsOf(piece).filter((w) => w.length >= ALIGN_WORD);
  if (!toks.length || q.length < 3) return null;
  const alignFrom = (start) => {
    let j = 0, matched = 0, last = start, first = start;
    for (let i = start; i < toks.length && j < q.length && i - last <= ALIGN_GAP; i++) {
      const k = q.slice(j, j + ALIGN_LOOKAHEAD).indexOf(toks[i].w);
      if (k < 0) continue;
      if (!matched) first = i;
      j += k + 1;
      matched += 1;
      last = i;
    }
    return { matched, start: toks[first].end - toks[first].w.length, end: toks[last].end };
  };
  const heads = q.slice(0, ALIGN_LOOKAHEAD);
  let best = { matched: 0, start: 0, end: 0 };
  for (let i = 0; i < toks.length; i++) {
    if (!heads.includes(toks[i].w)) continue;
    const a = alignFrom(i);
    if (a.matched > best.matched) best = a;
  }
  if (best.matched < ALIGN_MIN * q.length) return null;
  return best;
}

function quoteEnd(quote, text) {
  let cut = 0;
  for (const piece of quoteSpans(quote)) {
    const hit = alignPieceIn(piece, text);
    if (hit) cut = Math.max(cut, hit.end);
  }
  return cut;
}

function locatePiece(piece, chunks, fromT) {
  const t0 = Math.max(0, (fromT ?? 0) - 8);
  const win = chunks.filter((c) => c.t >= t0 && c.t <= t0 + 210);
  if (!win.length) return null;
  const joined = win.map((c) => c.text).join(" ");
  const hit = alignPieceIn(piece, joined);
  if (!hit) return null;
  let off = 0, tStart = win[0].t, tEnd = win[0].t;
  for (const c of win) {
    const next = off + c.text.length + 1;
    if (hit.start >= off && hit.start < next) tStart = c.t;
    if (hit.end > off) tEnd = c.t;
    off = next;
  }
  return { tStart, tEnd };
}

export function alignQuoteSpans(quote, chunks, aroundT) {
  const pieces = quoteSpans(quote);
  if (pieces.length <= 1) {
    const hit = locatePiece(pieces[0] || quote, chunks, aroundT ?? 0);
    return hit ? [{ piece: pieces[0] || quote, ...hit }] : [{ piece: pieces[0] || quote, tStart: aroundT ?? 0, tEnd: aroundT ?? 0 }];
  }
  const list = [...chunks].sort((a, b) => a.t - b.t);
  const spans = [];
  let fromT = Math.max(0, (aroundT ?? 0) - 20);
  for (const piece of pieces) {
    const hit = locatePiece(piece, list, fromT);
    if (hit) {
      spans.push({ piece, ...hit });
      fromT = hit.tEnd;
    } else {
      spans.push({ piece, tStart: null, tEnd: null });
    }
  }
  return spans;
}

const SKIP_CAPTION = [
  /the way i i don't know if it's correct the way i understand/i,
  /i also noticed that like now you mentioned that when i eat less/i,
];

function skipCaption(s) {
  const t = String(s ?? "");
  return SKIP_CAPTION.some((re) => re.test(t));
}

/** One caption sentence per turn. Do not glue a talk into one paragraph. */
export function turnsOf(stream) {
  const turns = [];
  for (const s of stream) {
    if (skipCaption(s.text)) continue;
    const tag = tagSentence(s.text);
    if (tag === "skip" || tag === "filler") continue;
    let who = whoOf(tag);
    if (who === "unknown") who = "his";
    turns.push({ who, tag, parts: [s], text: s.text, t: s.t });
  }
  return turns;
}

/**
 * Further as turns: his teaching stays his; a student question plus an immediate
 * answer becomes asked + text; a student question with no answer yet stops the
 * stream; a student report is skipped. Never emits an unlabeled student line,
 * and never the same paragraph twice.
 */
export function alongTurns(stream) {
  if (stream.some(s => s.speaker)) return stream.map(s => ({ ...s, text: tidyQuote(s.text) }));
  const turns = turnsOf(stream);
  const out = [];
  const fresh = (text) => !out.some((x) => containedIn(x.text, text) || containedIn(text, x.text));
  for (let i = 0; i < turns.length; ) {
    const t = turns[i];
    if (t.who === "admin" || t.who === "student") { i++; continue; }
    if (t.who === "his") {
      let text = tidyQuote(t.text);
      let j = i + 1;
      while (j < turns.length && turns[j].who === "his" && shouldBind(text, turns[j].text)) {
        text = `${text} ${tidyQuote(turns[j].text)}`;
        j += 1;
      }
      if (text && !isClassAdmin(text) && fresh(text)) out.push({ text, t: t.t, source: "caption", speaker: "Speaker unverified" });
      i = j;
      continue;
    }
    // ask: pair with his next turn when he answers immediately; otherwise stop
    let j = i + 1;
    while (j < turns.length && turns[j].who === "admin") j++;
    const next = turns[j];
    const immediate = next?.who === "his" && (next.t - t.t) <= IMMEDIATE_S && wordCount(t.text) <= QUESTION_TURN_WORDS;
    if (immediate) {
      const asked = tidyAsked(t.text);
      const text = tidyQuote(next.text);
      if (asked && text && fresh(text)) out.push({ asked, text, t: next.t, kind: "question", speaker: "Speaker unverified" });
      i = j + 1;
      continue;
    }
    break;
  }
  return out;
}

/**
 * The captions after the card, one sentence at a time. The quote is located in the
 * captions around the card's second and everything up to its last word is dropped;
 * when it cannot be located, the stream starts at the card's second.
 */
function inEllipsisGap(t, spans) {
  for (let i = 0; i < spans.length - 1; i++) {
    const a = spans[i], b = spans[i + 1];
    if (a.tEnd == null || b.tStart == null) continue;
    if (b.tStart > a.tEnd + 2 && t > a.tEnd && t < b.tStart) return true;
  }
  return false;
}

function captionWindow(list, fromT, horizon) {
  const win = list.filter((c) => c.t >= fromT - 8 && c.t <= horizon);
  const parts = [];
  let offset = 0;
  for (const c of win) {
    const text = applyDisplayTerms(c.text);
    parts.push({ c, start: offset, text });
    offset += text.length + 1;
  }
  const joined = parts.map((p) => p.text).join(" ");
  return { parts, joined };
}

function sentencesOnJoin(joined, parts, fromT) {
  const sents = splitSentences(joined);
  const out = [];
  let search = 0;
  for (const s of sents) {
    const at = joined.indexOf(s, search);
    const idx = at >= 0 ? at : search;
    search = idx + s.length;
    const part = parts.find((p) => idx >= p.start && idx < p.start + p.text.length + 1) ?? parts.find((p) => p.start + p.text.length >= idx) ?? parts[0];
    const endAt = idx + s.length;
    const endPart = [...parts].reverse().find((p) => p.start < endAt) ?? part;
    out.push({ text: s, t: part?.c.t ?? fromT, tEnd: endPart?.c.t ?? part?.c.t ?? fromT });
  }
  return out;
}

function attributedStream(card) {
  const cues = SPEAKER_CUES.videos[card.video];
  if (!cues) return null;
  const quote = applyDisplayTerms(card.sourceQuote || textOf(card));
  const near = cues.filter(c => c.t >= card.t - 8 && c.t <= card.t + 210);
  const cut = quoteEnd(quote, near.map(c => c.text).join(" "));
  let offset = 0, end = card.t;
  for (const c of near) {
    offset += c.text.length + 1;
    if (cut && offset >= cut) { end = c.t; break; }
  }
  const groups = [];
  let group;
  for (const [cueIndex, c] of cues.entries()) {
    if (c.t <= end || c.t > end + 480) continue;
    const label = SPEAKER_CUES.labels.find(x => x.video === card.video && c.t >= x.from && c.t < x.to);
    const speaker = label?.speaker ?? "Speaker unverified";
    if (!group || c.turn || group.speaker !== speaker) {
      group = { text: "", t: c.t, tEnd: c.t, speaker, source: "caption", cueStart: cueIndex, cueEnd: cueIndex };
      groups.push(group);
    }
    group.text += (group.text ? " " : "") + c.text;
    group.tEnd = c.t;
    group.cueEnd = cueIndex;
  }
  const out = [];
  for (const g of groups) {
    if (isWithheld(card.video, g.t, g.text, { tEnd: g.tEnd })) break;
    for (const sentence of splitSentences(applyDisplayTerms(g.text))) {
      if (skipCaption(sentence) || FILLER_SENT.test(sentence)) continue;
      if (containedIn(quote, sentence)) continue;
      const residue = wordsOf(sentence).filter(w => !/^(okay|ok|yeah|yes|um|uh)$/.test(w));
      if (residue.length === 1 && residue[0] === wordsOf(quote).at(-1)) continue;
      out.push({ ...g, text: sentence });
    }
  }
  return out;
}

export function sentenceStream(card, chunks) {
  const attributed = attributedStream(card);
  if (attributed) return attributed;
  const quote = applyDisplayTerms(card.sourceQuote || textOf(card));
  const shown = new Set([quote, card.asked].filter(Boolean).map((s) => wordsOf(s).join(" ")));
  const list = [...chunks].sort((a, b) => a.t - b.t);
  const spans = card._spans ?? alignQuoteSpans(quote, list, card.t);
  const lastEnd = [...spans].reverse().find((s) => s.tEnd != null)?.tEnd;
  const fromT = lastEnd ?? card.t;
  const before = list.filter((c) => c.t < card.t).at(-1);
  const around = [before, ...list.filter((c) => c.t >= card.t && c.t <= card.t + QUOTE_SPAN_S)].filter(Boolean);
  const joinedAround = around.map((c) => c.text).join(" ");
  const cut = lastEnd == null ? quoteEnd(quote, joinedAround) : 0;
  const starts = new Map();
  let offset = 0;
  for (const c of around) { starts.set(c, offset); offset += c.text.length + 1; }
  const horizon = fromT + 8 * 60;
  const tail = [];
  for (const ch of list) {
    if (ch.t > horizon) break;
    if (inEllipsisGap(ch.t, spans)) continue;
    if (ch.t < fromT && !(starts.has(ch) && lastEnd == null)) continue;
    let text = ch.text;
    if (lastEnd == null && starts.has(ch)) {
      const from = Math.max(cut, starts.get(ch));
      text = from < starts.get(ch) + ch.text.length ? joinedAround.slice(from, starts.get(ch) + ch.text.length) : "";
      if (ch === before && !cut) text = "";
    } else if (ch.t < fromT) continue;
    if (!text) continue;
    text = text.replace(/\([^)]*whisper hallucinated[^)]*\)/ig, " ").replace(/\s+/g, " ").trim();
    if (text) tail.push({ ...ch, text });
  }
  const { parts, joined } = captionWindow(tail, fromT, horizon);
  const stream = [];
  for (const s of sentencesOnJoin(joined, parts, fromT)) {
    const text = applyDisplayTerms(s.text);
    const key = wordsOf(text).join(" ");
    if (key.length < 12 || shown.has(key) || containedIn(quote, text) || isClassAdmin(text) || skipCaption(text) || /whisper hallucinated|likely silence/i.test(text)) continue;
    if (isWithheld(card.video, s.t, text, { tEnd: s.tEnd })) break;
    if (wordCount(text) > JOIN_FAIL_WORDS) continue;
    shown.add(key);
    stream.push({ text, t: Math.max(s.t, card.t), tEnd: s.tEnd });
  }
  return stream;
}

/** Remaining editor beats, then caption beats after the last aligned span. */
export function furtherAfter(card, chunks) {
  const base = faceCard({ ...card, quote: card.sourceQuote || textOf(card), type: card.type });
  const full = applyDisplayTerms(card.sourceQuote || textOf(base));
  const rest = (card.restBeats ?? beatsOf(full).slice(1)).map((t) => applyDisplayTerms(t));
  const spans = alignQuoteSpans(full, chunks, card.t);
  const quoteTurns = rest.map((text, i) => ({
    text,
    t: spans[Math.min(i + 1, Math.max(spans.length - 1, 0))]?.tStart ?? card.t,
    source: "quote",
  })).filter((x) => !isWithheld(card.video, x.t, x.text));
  const captions = alongTurns(sentenceStream({ ...card, sourceQuote: full, asked: base.asked, _spans: spans }, chunks));
  const quoted = [beatsOf(full)[0], ...rest].filter(Boolean);
  const seen = new Set(quoted.map((t) => wordsOf(t).join(" ")));
  const out = [...quoteTurns];
  for (const x of captions) {
    const text = applyDisplayTerms(x.text);
    const key = wordsOf(text).join(" ");
    if ((!x.speaker && key.length < 12) || seen.has(key)) continue;
    if (isWithheld(card.video, x.t, text, { tEnd: x.tEnd })) continue;
    if (wordCount(text) > JOIN_FAIL_WORDS) continue;
    if (echoesQuote(full, text)) continue;
    if (quoted.some((q) => containedIn(q, text) || containedIn(text, q))) continue;
    if (!x.speaker && out.some((y) => containedIn(y.text, text) || containedIn(text, y.text))) continue;
    seen.add(key);
    out.push({ ...x, text });
  }
  return out.slice(0, 48);
}

/** One beat per click. `want` is kept for callers and ignored. */
export function takePassage(turns, _want) {
  return turns.length ? [turns[0]] : [];
}
