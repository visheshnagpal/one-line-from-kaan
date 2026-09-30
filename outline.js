// A second view of the reader, not a second reading history.
export function groupOutline(sessions, cards, current) {
  const recordings = new Map(sessions.map(s => [s.video, { ...s, cards: [] }]));
  const unique = new Map(cards.map(c => [c.id, c]));
  if (current) unique.set(current.id, current);
  for (const c of unique.values()) {
    if (!recordings.has(c.video)) recordings.set(c.video, { video: c.video, session: c.session, date: c.date, cards: [] });
    recordings.get(c.video).cards.push(c);
  }
  const months = new Map();
  const sorted = [...recordings.values()].sort((a,b) => (b.date || '').localeCompare(a.date || '') || a.session.localeCompare(b.session));
  for (const s of sorted) {
    s.cards.sort((a,b) => a.t - b.t || a.id.localeCompare(b.id));
    const month = /^\d{4}-\d{2}-\d{2}$/.test(s.date || '') ? s.date.slice(0,7) : 'Undated';
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(s);
  }
  return [...months].map(([month, recordings]) => ({ month, recordings }));
}

// Reuse source-backed chapter labels; do not invent a second summary of the teaching.
export function recordingTopics(chapters = []) {
  const seen = new Set();
  return chapters.map(c => c.title.trim()).filter(title => {
    const key = title.toLocaleLowerCase();
    if (!title || seen.has(key)) return false;
    seen.add(key); return true;
  }).join(' · ');
}

export function recordingSwipe(dx, dy) {
  return Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2 ? (dx < 0 ? -1 : 1) : 0;
}

export function createOutline({ getData, getCurrent, onOpen, onClose, onSelect, textOf, provenanceOf, esc, fmtTime }) {
  let dialog = null;
  const dateLabel = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '')
    ? new Date(date + 'T12:00:00').toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date unknown';
  function close() { dialog?.close(); }
  async function open(trigger, { recording = false } = {}) {
    if (dialog) return;
    const scroll = window.scrollY;
    onOpen();
    const box = document.createElement('dialog');
    dialog = box;
    let selection = null, recordings = [], active = null, picker = true, swipe = null, practiceFilter = 'All';
    box.className = 'recordings-view';
    box.setAttribute('aria-label', 'Recordings');
    box.innerHTML = '<header class="recordings-head"><span>Recordings</span><button type="button" data-close aria-label="Return to reading">×</button></header><div class="recordings-body">Loading recordings…</div>';
    box.querySelector('[data-close]').onclick = close;
    box.addEventListener('close', () => {
      box.remove(); dialog = null;
      document.documentElement.classList.remove('outline-open');
      onClose();
      window.scrollTo({ top: scroll, behavior: 'instant' });
      (trigger?.isConnected ? trigger : document.querySelector('[data-act="outline"]'))?.focus({ preventScroll: true });
      if (selection) onSelect(selection);
    }, { once: true });
    document.body.append(box);
    document.documentElement.classList.add('outline-open');
    box.showModal();
    const body = box.querySelector('.recordings-body');
    function setPicker(visible) {
      picker = visible;
      body.querySelector('.recording-page').hidden = visible;
      body.querySelector('.recording-picker').hidden = !visible;
      body.querySelector('[data-picker-back]').hidden = !active;
      if (visible) {
        body.querySelectorAll('[data-recording]').forEach(b => {
          if (b.dataset.recording === active?.video) b.setAttribute('aria-current', 'location');
          else b.removeAttribute('aria-current');
        });
        // The picker begins at the newest sessions so last week's recording is easy to find.
        box.scrollTo({top: 0, behavior: 'instant'});
        body.querySelector('[data-recording]:not([hidden])')?.focus({preventScroll: true});
      } else body.querySelector('[data-date]')?.focus({preventScroll: true});
    }
    function applyFilter() {
      body.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === practiceFilter)));
      body.querySelectorAll('[data-recording]').forEach(b => {
        const s = recordings.find(s => s.video === b.dataset.recording);
        b.hidden = practiceFilter !== 'All' && !s.chapters.some(c => c.group === practiceFilter);
      });
      const count = recordings.filter(s => practiceFilter === 'All' || s.chapters.some(c => c.group === practiceFilter)).length;
      body.querySelector('.practice-coverage').textContent = practiceFilter === 'All' ? '' : `${count} recordings${recordings.some(s => !s.chapters.length) ? ' · some chapters await review' : ''}`;
    }
    function navigate(delta) {
      if (picker || !active) return;
      const dated = recordings.filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.date || ""));
      const i = dated.findIndex(s => s.video === active.video);
      if (i < 0) return;
      const next = dated[i + delta];
      if (next) showRecording(next);
    }
    function showRecording(session) {
      active = session;
      const dated = recordings.filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.date || ""));
      const i = dated.indexOf(session), older = i < 0 ? null : dated[i + 1], newer = i < 0 ? null : dated[i - 1];
      const panel = body.querySelector('.recording-page');
      panel.innerHTML = `<button class="recording-date" data-date aria-label="Choose recording by date">${esc(dateLabel(session.date))} <span aria-hidden="true">⌄</span></button>
        <h1>${esc(session.session)}</h1>
        ${session.topics ? `<p class="recording-topics">${esc(session.topics)}</p>` : ''}
        <div class="recording-player"><button class="recording-play" data-play aria-label="Play ${esc(session.session)}"><img src="https://i.ytimg.com/vi/${esc(session.video)}/hqdefault.jpg" alt="" loading="lazy"><span>▶ <span>Play recording</span></span></button></div>
        <a class="recording-youtube" href="https://youtu.be/${esc(session.video)}" target="_blank" rel="noopener">Open in YouTube ↗</a>
        ${session.chapters.length ? `<section class="recording-chapters" aria-label="Chapters"><h2>In this recording</h2><p class="chapter-note">Chapters from captions · timings unverified</p>${session.chapters.map((c,j) => `<button data-chapter="${j}"><time>${fmtTime(c.t)}</time><span>${esc(c.title)}</span><span aria-hidden="true">↗</span></button>`).join('')}</section>` : '<p class="chapter-note">Chapters awaiting review.</p>'}
        ${session.sourceNote ? `<details class="chapter-source"><summary>Chapter notes</summary><p>${esc(session.sourceNote)}</p></details>` : ''}
        <nav class="recording-nav" aria-label="Recordings by date"><button data-older ${older ? '' : 'disabled'} aria-label="Previous recording">← Earlier<small>${older ? esc(dateLabel(older.date)) : (i < 0 ? 'Date unknown' : 'First recording')}</small></button><button data-newer ${newer ? '' : 'disabled'} aria-label="Next recording">Later →<small>${newer ? esc(dateLabel(newer.date)) : (i < 0 ? 'Date unknown' : 'Latest recording')}</small></button></nav>
        <details class="recording-excerpts"><summary>Excerpts <span>${session.cards.length}</span></summary><ul>${session.cards.map((c,j) => `<li><button data-excerpt="${j}"><span>${esc(textOf(c))}</span><small>${fmtTime(c.t)}${provenanceOf(c) === 'reviewed' ? '' : ' · awaiting review'}</small></button></li>`).join('') || '<li>No excerpts selected yet.</li>'}</ul></details>`;
      function playAt(t, chapterIndex = null) {
        panel.querySelector('.recording-player').innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(session.video)}?rel=0&autoplay=1&start=${t}" title="${esc(session.session)} at ${fmtTime(t)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
        panel.querySelector('.recording-youtube').href = `https://youtu.be/${session.video}?t=${t}`;
        panel.querySelectorAll('[data-chapter]').forEach(b => {
          if (Number(b.dataset.chapter) === chapterIndex) b.setAttribute('aria-current', 'true');
          else b.removeAttribute('aria-current');
        });
      }
      panel.querySelector('[data-play]').onclick = () => playAt(0);
      panel.querySelectorAll('[data-chapter]').forEach(b => b.onclick = () => {
        const i = Number(b.dataset.chapter);
        playAt(session.chapters[i].t, i);
        panel.querySelector('.recording-player').scrollIntoView({block:'center',behavior:'instant'});
      });
      panel.querySelector('[data-date]').onclick = () => setPicker(true);
      panel.querySelector('[data-older]').onclick = () => navigate(1);
      panel.querySelector('[data-newer]').onclick = () => navigate(-1);
      panel.querySelectorAll('[data-excerpt]').forEach(b => b.onclick = () => {
        const card = session.cards[Number(b.dataset.excerpt)];
        selection = card.id === getCurrent()?.id ? null : card;
        close();
      });
      setPicker(false);
      box.scrollTo({top: 0, behavior: 'instant'});
    }
    box.addEventListener('keydown', e => {
      if (picker || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); navigate(e.key === 'ArrowLeft' ? 1 : -1);
      }
    });
    box.addEventListener('touchstart', e => {
      const t = e.touches[0];
      swipe = !picker && e.touches.length === 1 && t.clientX > 24 && t.clientX < innerWidth - 24 ? {x:t.clientX,y:t.clientY} : null;
    }, {passive:true});
    box.addEventListener('touchcancel', () => { swipe = null; });
    box.addEventListener('touchend', e => {
      if (!swipe) return;
      const t=e.changedTouches[0], dx=t.clientX-swipe.x, dy=t.clientY-swipe.y; swipe=null;
      const delta = recordingSwipe(dx, dy);
      if (delta && !window.getSelection()?.toString()) navigate(delta);
    }, {passive:true});
    try {
      const {sessions,cards,chapters={}}=await getData();
      if (dialog!==box) return;
      recordings=groupOutline(sessions,cards,getCurrent()).flatMap(g=>g.recordings).map(s => ({...s, chapters: chapters[s.video]?.chapters || [], topics: recordingTopics(chapters[s.video]?.chapters), sourceNote: chapters[s.video]?.sourceNote || null}));
      active=recordings.find(s=>s.video===getCurrent()?.video) || null;
      body.innerHTML='<section class="recording-picker"><button class="recording-picker-back" data-picker-back>← Back to recording</button><div class="practice-filters" role="group" aria-label="Filter recordings by practice"></div><p class="practice-coverage" role="status"></p><div class="recording-list"></div></section><section class="recording-page" hidden></section>';
      body.querySelector('.practice-filters').innerHTML = ['All','Awareness','Compassion','Wisdom'].map(f => `<button data-filter="${f}" aria-pressed="${f === practiceFilter}">${f}</button>`).join('');
      body.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { practiceFilter = b.dataset.filter; applyFilter(); });
      body.querySelector('.recording-list').innerHTML=recordings.map((s,i)=>`<button class="recording-row" data-recording="${esc(s.video)}"><span class="recording-row-date">${esc(dateLabel(s.date))}${i===0 ? ' · latest' : ''}</span><span>${esc(s.session)}</span>${s.topics ? `<span class="recording-topics">${esc(s.topics)}</span>` : ''}<small>${esc(s.minutes || '')}${s.minutes ? ' min' : ''}${s.video===getCurrent()?.video ? ' · your passage' : ''}</small></button>`).join('');
      body.querySelectorAll('[data-recording]').forEach(b=>b.onclick=()=> {
        const selected=recordings.find(s=>s.video===b.dataset.recording);
        if (selected === active && body.querySelector('.recording-player')) setPicker(false);
        else showRecording(selected);
      });
      body.querySelector('[data-picker-back]').onclick=()=> {
        if (body.querySelector('.recording-player')) setPicker(false);
        else if (active) showRecording(active);
      };
      applyFilter();
      if (recording && active) showRecording(active); else setPicker(true);
    } catch {
      if (dialog===box) body.textContent='Could not load recordings. Close and try again.';
    }
  }
  return {open,close};
}
