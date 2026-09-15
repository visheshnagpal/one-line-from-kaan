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

const BIND_NEXT = /^(because|so|means|that is|that's|which|and mainly|like it's)\b/i;
const NEW_SCENE = /^(when i |then i |so let's|let's |i will |now |first,|there is a |i asked|i had an accident)/i;
const SHORT_YES = /\b(yes|no|exactly|right|true|correct)\.?$/i;
const SPAN_THOUGHT = 55;

export function isCompleteThought(s) {
  const t = tidy(s);
  const w = wordCount(t);
  if (!t || w < 7) return false;
  if (SHORT_YES.test(t) && w <= 12) return false;
  if (/\b(this|that)\.?$/i.test(t) && w <= 16) return false;
  if (/basically\.?$/i.test(t) && w <= 12) return false;
  return /[.!?]$/.test(t) || w >= 12;
}

/** Keep a yes/no or heading with the sentence it needs. Never cut inside a sentence. */
export function shouldBind(a, b) {
  const left = tidy(a);
  const right = tidy(b);
  if (!left || !right) return false;
  if (NEW_SCENE.test(right)) return false;
  if (wordCount(left) + wordCount(right) > SPAN_THOUGHT) return false;
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

/** Opening drip: first beat of recorded text. Remainder stays on `sourceQuote`. */
export function faceOpen(card) {
  const base = faceCard(card);
  if (!base) return base;
  const full = textOf(base);
  const beats = beatsOf(full);
  return {
    ...base,
    quote: beats[0] || full,
    sourceQuote: full,
    restBeats: beats.slice(1),
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
      if (text && !isClassAdmin(text) && fresh(text)) out.push({ text, t: t.t, source: "caption" });
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
      if (asked && text && fresh(text)) out.push({ asked, text, t: next.t, kind: "question" });
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

export function sentenceStream(card, chunks) {
  const quote = card.sourceQuote || textOf(card);
  const shown = new Set([quote, card.asked].filter(Boolean).map((s) => wordsOf(s).join(" ")));
  const list = [...chunks].sort((a, b) => a.t - b.t);
  const spans = card._spans ?? alignQuoteSpans(quote, list, card.t);
  const lastEnd = [...spans].reverse().find((s) => s.tEnd != null)?.tEnd;
  const fromT = lastEnd ?? card.t;
  const before = list.filter((c) => c.t < card.t).at(-1);
  const around = [before, ...list.filter((c) => c.t >= card.t && c.t <= card.t + QUOTE_SPAN_S)].filter(Boolean);
  const joined = around.map((c) => c.text).join(" ");
  const cut = lastEnd == null ? quoteEnd(quote, joined) : 0;
  const starts = new Map();
  let offset = 0;
  for (const c of around) { starts.set(c, offset); offset += c.text.length + 1; }
  const stream = [];
  const horizon = fromT + 8 * 60;
  for (const ch of list) {
    if (ch.t > horizon) break;
    if (inEllipsisGap(ch.t, spans)) continue;
    if (ch.t < fromT && !(starts.has(ch) && lastEnd == null)) continue;
    let text = ch.text;
    if (lastEnd == null && starts.has(ch)) {
      const from = Math.max(cut, starts.get(ch));
      text = from < starts.get(ch) + ch.text.length ? joined.slice(from, starts.get(ch) + ch.text.length) : "";
      if (ch === before && !cut) text = "";
    } else if (ch.t < fromT) continue;
    if (!text) continue;
    text = text.replace(/\([^)]*whisper hallucinated[^)]*\)/ig, " ").replace(/\s+/g, " ").trim();
    for (const s of splitSentences(text)) {
      const key = wordsOf(s).join(" ");
      if (key.length < 12 || shown.has(key) || containedIn(quote, s) || isClassAdmin(s) || skipCaption(s) || /whisper hallucinated|likely silence/i.test(s)) continue;
      shown.add(key);
      stream.push({ text: s, t: Math.max(ch.t, card.t) });
    }
  }
  return stream;
}

/** Remaining editor beats, then caption beats after the last aligned span. */
export function furtherAfter(card, chunks) {
  const base = faceCard({ ...card, quote: card.sourceQuote || textOf(card), type: card.type });
  const full = card.sourceQuote || textOf(base);
  const rest = card.restBeats ?? beatsOf(full).slice(1);
  const spans = alignQuoteSpans(full, chunks, card.t);
  const quoteTurns = rest.map((text, i) => ({
    text,
    t: spans[Math.min(i + 1, Math.max(spans.length - 1, 0))]?.tStart ?? card.t,
    source: "quote",
  }));
  const captions = alongTurns(sentenceStream({ ...card, sourceQuote: full, asked: base.asked, _spans: spans }, chunks));
  const quoted = [beatsOf(full)[0], ...rest].filter(Boolean);
  const seen = new Set(quoted.map((t) => wordsOf(t).join(" ")));
  const out = [...quoteTurns];
  for (const x of captions) {
    const key = wordsOf(x.text).join(" ");
    if (key.length < 12 || seen.has(key)) continue;
    if (quoted.some((q) => containedIn(q, x.text) || containedIn(x.text, q))) continue;
    if (out.some((y) => containedIn(y.text, x.text) || containedIn(x.text, y.text))) continue;
    seen.add(key);
    out.push(x);
  }
  return out.slice(0, 48);
}

/** One beat per click. `want` is kept for callers and ignored. */
export function takePassage(turns, _want) {
  return turns.length ? [turns[0]] : [];
}
