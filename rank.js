// Shared ranking — imported by the browser (app.js) and the terminal check (scripts/query.mjs),
// so "what the site would show" is one function, not two.

const STOP = new Set("the and for with that this what when how why about you your are can into from not but have does should was were will just like them they then there than very some any all our who its it's i'm i am is to of in on a an be do my me we us".split(" "));

export function stem(w) {
  let s = w.toLowerCase().replace(/[^a-z']/g, "").replace(/'s$/, "");
  if (s.length <= 3) return s;
  for (const suf of ["ations", "ation", "ness", "ing", "ies", "ers", "ed", "ly", "es", "s"]) {
    if (s.endsWith(suf) && s.length - suf.length >= 3) { s = s.slice(0, -suf.length); if (suf === "ies") s += "y"; break; }
  }
  return s;
}

export const tokens = (text) => text.split(/\s+/).map(stem).filter((w) => w.length >= 3 && !STOP.has(w));

export const itemText = (it) => (it.type === "line" ? `${it.asked ?? ""} ${it.quote}` : it.text);

export function buildBags(items) {
  return items.map((it) => {
    const bag = new Map();
    for (const t of tokens(itemText(it))) bag.set(t, (bag.get(t) ?? 0) + 1);
    return bag;
  });
}

export function keywordScores(items, bags, q) {
  const qt = tokens(q);
  const phrase = q.trim().toLowerCase();
  return items.map((it, r) => {
    let s = 0;
    const bag = bags[r];
    for (const t of qt) {
      const hit = bag.get(t);
      if (hit) s += 1 + Math.min(hit, 3) * 0.3;
      else for (const k of bag.keys()) if (k.length >= 4 && t.length >= 4 && (k.startsWith(t) || t.startsWith(k))) { s += 0.5; break; }
    }
    if (phrase.length >= 5 && itemText(it).toLowerCase().includes(phrase)) s += 2;
    return s;
  });
}

export function semanticScores(meta, vec, qvec, count) {
  const { dim, scale } = meta;
  const out = new Float32Array(count);
  for (let r = 0; r < count; r++) {
    let s = 0; const off = r * dim;
    for (let d = 0; d < dim; d++) s += qvec[d] * vec[off + d];
    out[r] = s / scale;
  }
  return out;
}

const bucket = (it) => `${it.video}-${Math.round(it.t / 45)}`; // a line and its own transcript chunk are one moment

/** Top results for a score array; the curated line always represents its moment, whatever its chunk scored. */
export function topItems(items, score, limit = 8) {
  const order = [...score.keys()].filter((r) => score[r] > 0).sort((a, b) => score[b] - score[a]);
  const lineFor = new Map();
  for (const r of order) { const it = items[r]; if (it.type === "line" && !lineFor.has(bucket(it))) lineFor.set(bucket(it), it); }
  const seen = new Set(), out = [];
  for (const r of order) {
    const key = bucket(items[r]);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(lineFor.get(key) ?? items[r]);
    if (out.length >= limit) break;
  }
  return out;
}

/** Keyword-only ranking (before the model is ready, or when it never loads). */
export function rankKeyword(items, bags, q, limit = 8) {
  return topItems(items, keywordScores(items, bags, q).map((s) => s * 0.1), limit);
}

/**
 * Ranking parameters. Chosen by measured recall on eval/queries.jsonl (see eval/RESULTS.md),
 * not by taste. Change them there, then rerun `npm run eval`.
 */
export const DEFAULT_PARAMS = {
  kwWeightShort: 0.12, // literal-match weight when the query is one or two words (eval is indifferent; kept for "dedicate", "cookie")
  kwWeightLong: 0.10,  // …and when it is longer (+3% recall@5 over 0.06)
  lineBonus: 0,        // a bonus for curated lines lifted lines from the wrong moment above the right chunk (−2%); same-moment preference lives in topItems
  cutoff: 0.22,        // below this combined score a result is noise (eval indifferent 0.15–0.30)
};

/** Hybrid ranking: meaning + literal match + a small preference for curated lines. */
export function rankHybrid(items, bags, meta, vec, q, qvec, params = DEFAULT_PARAMS, limit = 8) {
  const kw = keywordScores(items, bags, q);
  const sem = semanticScores(meta, vec, qvec, items.length);
  const kwWeight = tokens(q).length <= 2 ? params.kwWeightShort : params.kwWeightLong;
  const combined = sem.map((s, r) => s + Math.min(kw[r], 4) * kwWeight + (items[r].type === "line" ? params.lineBonus : 0));
  return topItems(items, combined.map((s) => (s > params.cutoff ? s : 0)), limit);
}
