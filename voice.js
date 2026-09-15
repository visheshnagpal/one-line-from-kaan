// Who is speaking on the face and in "further". Port of scripts/lib/lift.mjs cues
// (the browser cannot import that module). Search may keep a question; a Moment
// or further block that hits Q&A must show asked + his answer — never a mashed
// quote, never an unlabeled student line, never his reply with the question dropped.

const NAMES = "joe|anita|sophia|shane|iris|anna|adria|olivia|reed|patty|neel|vishesh|tatiana|ismed|nia|nha|ada";
const FILLER_SENT = /^(yeah|yes|okay|ok|exactly|mhm|mm+|right|beautiful|perfect|nice|good|thank you|thanks|wow|sure|no|hm+|uh-huh|correct|true)[.!?]?$/i;
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
  if (FILLER_SENT.test(s)) return "filler";
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

export function faceCard(card) {
  if (!card) return card;
  if (card.asked && card.quote) return card.kind ? card : { ...card, kind: "question" };
  const raw = textOf(card);
  if (!raw) return card;
  const labeled = splitLabeled(raw);
  if (labeled?.asked && labeled.quote) return { ...card, asked: labeled.asked, quote: labeled.quote, kind: "question" };
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

export function isClassAdmin(s) {
  const t = String(s ?? "");
  if (CLASS_WRAP.test(t)) return true;
  if (ADMIN_HARD.test(t) && wordCount(t) < 28) return true;
  return false;
}

export function canFace(card) {
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
function quoteEnd(quote, text) {
  const toks = tokens(text).filter((t) => t.w.length >= ALIGN_WORD);
  if (!toks.length) return 0;
  let cut = 0;
  for (const piece of String(quote ?? "").split(/…|\.\.\./)) {
    const q = wordsOf(piece).filter((w) => w.length >= ALIGN_WORD);
    if (q.length < 3) continue;
    const alignFrom = (start) => {
      let j = 0, matched = 0, last = start;
      for (let i = start; i < toks.length && j < q.length && i - last <= ALIGN_GAP; i++) {
        const k = q.slice(j, j + ALIGN_LOOKAHEAD).indexOf(toks[i].w);
        if (k < 0) continue;
        j += k + 1;
        matched += 1;
        last = i;
      }
      return { matched, end: toks[last].end };
    };
    const heads = q.slice(0, ALIGN_LOOKAHEAD);
    let best = { matched: 0, end: 0 };
    for (let i = 0; i < toks.length; i++) {
      if (!heads.includes(toks[i].w)) continue;
      const a = alignFrom(i);
      if (a.matched > best.matched) best = a;
    }
    if (best.matched >= ALIGN_MIN * q.length) cut = Math.max(cut, best.end);
  }
  return cut;
}

/** Group the caption stream into speaker turns: his / ask / student / admin. */
export function turnsOf(stream) {
  const turns = [];
  for (const s of stream) {
    const tag = tagSentence(s.text);
    if (tag === "skip" || tag === "filler") continue;
    let who = whoOf(tag);
    const last = turns.at(-1);
    if (who === "unknown") {
      if (last) {
        last.parts.push(s);
        last.text = last.parts.map((p) => p.text).join(" ");
        continue;
      }
      who = "his";
    }
    if (last && last.who === who) {
      last.parts.push(s);
      last.text = last.parts.map((p) => p.text).join(" ");
    } else {
      turns.push({ who, tag, parts: [s], text: s.text, t: s.t });
    }
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
      const text = tidyQuote(t.text);
      if (text && !isClassAdmin(text) && fresh(text)) out.push({ text, t: t.t });
      i++;
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
export function sentenceStream(card, chunks) {
  const quote = textOf(card);
  const shown = new Set([quote, card.asked].filter(Boolean).map((s) => wordsOf(s).join(" ")));
  const list = [...chunks].sort((a, b) => a.t - b.t);
  const before = list.filter((c) => c.t < card.t).at(-1);
  const around = [before, ...list.filter((c) => c.t >= card.t && c.t <= card.t + QUOTE_SPAN_S)].filter(Boolean);
  const joined = around.map((c) => c.text).join(" ");
  const cut = quoteEnd(quote, joined);
  const starts = new Map();
  let offset = 0;
  for (const c of around) { starts.set(c, offset); offset += c.text.length + 1; }
  const stream = [];
  for (const ch of list) {
    let text = ch.text;
    if (starts.has(ch)) {
      const from = Math.max(cut, starts.get(ch));
      text = from < starts.get(ch) + ch.text.length ? joined.slice(from, starts.get(ch) + ch.text.length) : "";
      if (ch === before && !cut) text = "";
    } else if (ch.t < card.t) continue;
    if (!text) continue;
    text = text.replace(/\([^)]*whisper hallucinated[^)]*\)/ig, " ").replace(/\s+/g, " ").trim();
    for (const s of splitSentences(text)) {
      const key = wordsOf(s).join(" ");
      if (key.length < 12 || shown.has(key) || containedIn(quote, s) || isClassAdmin(s) || /whisper hallucinated|likely silence/i.test(s)) continue;
      shown.add(key);
      stream.push({ text: s, t: Math.max(ch.t, card.t) });
    }
  }
  return stream;
}

/** Everything Further can show for this card, in order. The reader walks it with a cursor. */
export function furtherAfter(card, chunks) {
  const quote = textOf(card);
  return alongTurns(sentenceStream(card, chunks)).filter((x) => !containedIn(quote, x.text));
}

/** The next passage from `turns`: about `want` paragraphs, stopping early at a new question. */
export function takePassage(turns, want) {
  const out = [];
  let words = 0;
  const minWords = want * 12, maxWords = want * 26;
  for (const s of turns) {
    if (s.asked && out.length && words >= minWords) break;
    out.push(s);
    words += `${s.asked ?? ""} ${s.text}`.split(/\s+/).filter(Boolean).length;
    if (out.length >= want && words >= minWords) break;
    if (words >= maxWords) break;
  }
  return out;
}
