// Build a Brand — client. Handles auth forms, chat streaming, checkout,
// onboarding submit, mark-complete, mark-welcomed, sign-out, PDF download.
// No framework. Plain ES2020.

(function () {
  'use strict';

  // ------- helpers -------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  // Escape HTML special chars before any innerHTML use. Defense against XSS.
  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = String(s ?? '');
    return div.innerHTML;
  }

  // Light markdown renderer for AI chat output. Handles: bold, italic, headings,
  // bullet/numbered lists, line breaks. Always escape-then-transform so prompt
  // injection can't introduce HTML.
  function renderMarkdown(text) {
    let s = escapeHtml(text);

    // Headings (### / ## / #) — convert to bold paragraph-style
    s = s.replace(/^#{1,3}\s+(.+)$/gm, '<strong>$1</strong>');

    // Bold: **text**
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    // Italic: *text* (single asterisks not adjacent to bold)
    s = s.replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
    // Italic: _text_
    s = s.replace(/(^|[^_])_(?!\s)([^_\n]+?)_(?!_)/g, '$1<em>$2</em>');

    // Lists: convert blocks of consecutive `- ` or `* ` lines to <ul><li>...</li></ul>
    s = s.replace(/(?:^|\n)((?:[-*]\s+.+(?:\n|$))+)/g, (_m, block) => {
      const items = block.trim().split('\n').map(l => l.replace(/^[-*]\s+/, '').trim());
      return '\n<ul class="msg__list">' + items.map(i => `<li>${i}</li>`).join('') + '</ul>\n';
    });
    // Numbered lists: 1. Item
    s = s.replace(/(?:^|\n)((?:\d+\.\s+.+(?:\n|$))+)/g, (_m, block) => {
      const items = block.trim().split('\n').map(l => l.replace(/^\d+\.\s+/, '').trim());
      return '\n<ol class="msg__list">' + items.map(i => `<li>${i}</li>`).join('') + '</ol>\n';
    });

    // Paragraph breaks (blank line) and soft line breaks
    s = s.replace(/\n{2,}/g, '</p><p>');
    s = s.replace(/\n/g, '<br>');
    s = '<p>' + s + '</p>';
    // Clean up: paragraphs that ended up empty around list blocks
    s = s.replace(/<p>(\s|<br>)*<\/p>/g, '');
    s = s.replace(/<p>(<(ul|ol)[^>]*>)/g, '$1').replace(/(<\/(ul|ol)>)<\/p>/g, '$1');

    return s;
  }

  async function postJSON(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      credentials: 'same-origin',
    });
    let data = null;
    try { data = await r.json(); } catch {}
    return { ok: r.ok, status: r.status, data };
  }

  function setBusy(btn, busy, busyText) {
    if (!btn) return;
    if (busy) {
      btn.dataset._origText = btn.textContent;
      btn.disabled = true;
      btn.textContent = busyText || 'Working…';
    } else {
      btn.disabled = false;
      if (btn.dataset._origText) btn.textContent = btn.dataset._origText;
    }
  }

  function showError(form, msg) {
    let el = form.querySelector('.auth__error');
    if (!el) {
      el = document.createElement('p');
      el.className = 'auth__error';
      form.parentNode.insertBefore(el, form);
    }
    el.textContent = msg;
  }

  // ============================================================
  // 1. Auth forms (sign-in, sign-up)
  // ============================================================
  $$('form[data-auth]').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const mode = form.dataset.auth; // 'signin' | 'signup'
      const email = form.email.value.trim().toLowerCase();
      const password = form.password.value;
      const submitBtn = form.querySelector('button[type="submit"]');
      setBusy(submitBtn, true, mode === 'signin' ? 'Signing in…' : 'Creating account…');
      try {
        const path = mode === 'signin' ? '/api/auth/signin' : '/api/auth/signup';
        const { ok, data } = await postJSON(path, { email, password });
        if (!ok) {
          showError(form, (data && data.error) || 'Something went wrong. Please try again.');
          setBusy(submitBtn, false);
          return;
        }
        // Unified login: server returns admin_token when the user is also an admin.
        // Stash it so /admin opens without a second login.
        if (data && data.admin_token) {
          try { localStorage.setItem('admin_token', data.admin_token); } catch {}
        }
        // Decide where to send them next. The server cookie is now set.
        // Hit /api/auth/me, then route based on user state.
        const r = await fetch('/api/auth/me', { credentials: 'same-origin' });
        const j = await r.json().catch(() => ({}));
        const u = j.user;
        if (!u) { window.location.href = '/'; return; }
        if (!u.has_access) { window.location.href = '/#pricing'; return; }
        if (!u.onboarded)  { window.location.href = '/onboarding'; return; }
        if (!u.welcomed)   { window.location.href = '/lisa'; return; }
        window.location.href = '/dashboard';
      } catch (err) {
        showError(form, 'Network error. Please try again.');
        setBusy(submitBtn, false);
      }
    });
  });

  // ============================================================
  // 2. Stripe checkout buttons
  // ============================================================
  $$('[data-checkout]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const tier = btn.dataset.checkout;
      setBusy(btn, true, 'Loading…');
      const { ok, data } = await postJSON('/api/stripe/checkout', { tier });
      if (ok && data?.url) {
        window.location.href = data.url;
      } else {
        alert(data?.error || 'Could not start checkout. Please try again.');
        setBusy(btn, false);
      }
    });
  });

  // ============================================================
  // 3. Lisa letter — mark welcomed
  // ============================================================
  const welcomedForm = $('form[data-mark-welcomed]');
  if (welcomedForm) {
    welcomedForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = welcomedForm.querySelector('button[type="submit"]');
      setBusy(btn, true, 'Loading…');
      await postJSON('/api/profile', { mark_welcomed: true });
      window.location.href = '/dashboard';
    });
  }

  // ============================================================
  // 4. Onboarding form
  // ============================================================
  const onboardingForm = $('form[data-onboarding]');
  if (onboardingForm) {
    onboardingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = onboardingForm.querySelector('button[type="submit"]');
      setBusy(btn, true, 'Saving…');
      await postJSON('/api/profile', {
        first_name: onboardingForm.first_name.value,
        business_name: onboardingForm.business_name.value,
        website: onboardingForm.website.value,
        mark_onboarded: true,
      });
      window.location.href = '/lisa';
    });

    const skipBtn = $('[data-skip-onboarding]', onboardingForm);
    if (skipBtn) skipBtn.addEventListener('click', async () => {
      setBusy(skipBtn, true, 'One sec…');
      await postJSON('/api/profile', { mark_onboarded: true });
      window.location.href = '/lisa';
    });
  }

  // ============================================================
  // 5. Sign-out form
  // ============================================================
  $$('form[data-signout]').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await postJSON('/api/auth/signout');
      window.location.href = '/';
    });
  });

  // ============================================================
  // 6. Brand Guide download
  // ============================================================
  $$('[data-download-guide]').forEach(btn => {
    btn.addEventListener('click', async () => {
      setBusy(btn, true, 'Generating PDF…');
      try {
        const r = await fetch('/api/brand-guide', { credentials: 'same-origin' });
        if (!r.ok) throw new Error('PDF generation failed');
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Brand-Guide.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        alert('We hit a snag generating your PDF. Please try again in a moment.');
      } finally {
        setBusy(btn, false);
      }
    });
  });

  // ============================================================
  // 7. CHAT (Brand Builder pages)
  // ============================================================
  initChat();

  function initChat() {
    const chat = $('#chat');
    if (!chat) return;

    let state;
    try { state = JSON.parse(chat.dataset.state); } catch { return; }

    const transcript = $('[data-transcript]', chat);
    const input = $('[data-input]', chat);
    const sendBtn = $('[data-send]', chat);
    const autosaveEl = $('[data-autosave]', chat);
    const completeBtn = $('[data-mark-complete]', chat);
    const readyBanner = $('[data-ready-banner]', chat);
    const readyBtn = $('[data-mark-complete-ready]', chat);

    // Detect completion signals in an assistant message. Lisa's prompts each end
    // with a SUMMARY block and "next step is the X session." We surface the
    // ready banner the moment the AI signals it's done.
    function looksLikeCompletion(text) {
      if (!text) return false;
      const t = text.toLowerCase();
      return /\bnext\s+step\s+is\s+the\s+(value|voice|visuals|visibility)/i.test(text)
          || /your\s+brand\s+guide\s+is\s+now\s+complete/i.test(text)
          || (/\bsummary\b/i.test(text) && t.length > 400);
    }

    function showReadyBanner() {
      if (!readyBanner) return;
      readyBanner.hidden = false;
      readyBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    let messages = Array.isArray(state.messages) ? state.messages.slice() : [];
    let isStreaming = false;
    let saveTimer = null;

    if (messages.length === 0) {
      messages.push({ role: 'assistant', content: state.intro || '' });
    }

    function render() {
      transcript.innerHTML = '';
      messages.forEach(m => transcript.appendChild(messageEl(m)));
      transcript.scrollTop = transcript.scrollHeight;
    }

    function messageEl(m, opts = {}) {
      const wrap = document.createElement('div');
      wrap.className = 'msg ' + (m.role === 'user' ? 'msg--user' : 'msg--asst');
      const av = document.createElement('div');
      av.className = 'msg__avatar';
      av.textContent = m.role === 'assistant' ? 'L' : 'You';
      wrap.appendChild(av);
      const bubble = document.createElement('div');
      bubble.className = 'msg__bubble';
      if (opts.typing) {
        bubble.innerHTML = '<span class="chat__typing"><span></span><span></span><span></span></span>';
      } else if (m.role === 'assistant') {
        // Light markdown for AI output (escapes HTML then applies bold/italic/lists)
        bubble.innerHTML = renderMarkdown(m.content || '');
      } else {
        // User messages stay plain text — preserve newlines via white-space CSS
        bubble.textContent = m.content || '';
      }
      wrap.appendChild(bubble);
      return wrap;
    }

    function setAutosave(text, persist) {
      if (!autosaveEl) return;
      autosaveEl.textContent = text;
      if (persist) clearTimeout(saveTimer);
    }

    function scheduleSave() {
      setAutosave('Saving…');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        await postJSON('/api/progress', { tool: state.tool, messages, completed: false });
        setAutosave('Saved');
      }, 800);
    }

    async function send() {
      const text = (input.value || '').trim();
      if (!text || isStreaming) return;

      messages.push({ role: 'user', content: text });
      input.value = '';
      isStreaming = true;
      sendBtn.disabled = true;

      // Render user msg + typing indicator
      transcript.appendChild(messageEl({ role: 'user', content: text }));
      const typingEl = messageEl({ role: 'assistant' }, { typing: true });
      transcript.appendChild(typingEl);
      transcript.scrollTop = transcript.scrollHeight;

      let assistantText = '';
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: state.tool, messages }),
        });
        if (!res.ok || !res.body) throw new Error('chat failed');

        // Replace typing indicator with empty assistant bubble
        const asstEl = messageEl({ role: 'assistant', content: '' });
        typingEl.replaceWith(asstEl);
        const bubble = asstEl.querySelector('.msg__bubble');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          assistantText += decoder.decode(value, { stream: true });
          bubble.innerHTML = renderMarkdown(assistantText);
          transcript.scrollTop = transcript.scrollHeight;
        }
      } catch (err) {
        typingEl.querySelector('.msg__bubble').textContent = 'Something went sideways. Try again in a moment.';
      } finally {
        isStreaming = false;
        sendBtn.disabled = false;
      }

      messages.push({ role: 'assistant', content: assistantText });
      if (looksLikeCompletion(assistantText)) showReadyBanner();
      scheduleSave();
      input.focus();
    }

    // If the latest persisted assistant message already signals completion
    // (user reopened the page after wrapping up), show the banner on load.
    {
      const lastAsst = [...messages].reverse().find(m => m.role === 'assistant');
      if (lastAsst && looksLikeCompletion(lastAsst.content)) showReadyBanner();
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    sendBtn.addEventListener('click', send);

    async function markComplete(triggerBtn) {
      if (triggerBtn) { triggerBtn.disabled = true; triggerBtn.textContent = 'Saving…'; }
      // Best-effort summary extraction from the latest assistant message.
      const lastAsst = [...messages].reverse().find(m => m.role === 'assistant');
      const summary = lastAsst ? lastAsst.content : null;
      await postJSON('/api/progress', {
        tool: state.tool, messages, completed: true, summary,
      });
      window.location.href = '/v-complete/' + state.tool;
    }

    if (completeBtn) completeBtn.addEventListener('click', () => markComplete(completeBtn));
    if (readyBtn) readyBtn.addEventListener('click', () => markComplete(readyBtn));

    render();
  }
})();

// ============================================================
// V Page: chip-rail video swap + workbook click tracking.
// Independent of the chat IIFE — runs on /brand-builder/<v> pages.
// ============================================================
(function () {
  const page = document.querySelector('.v-page');
  if (!page) return;
  const tool = page.getAttribute('data-tool');
  if (!tool) return;

  // ---- Section 1: Watch (chip-rail swap) ----
  const frame = page.querySelector('[data-video-frame]');
  const caption = page.querySelector('[data-video-caption]');
  const chips = page.querySelectorAll('.v-chip');

  function postStep(payload) {
    fetch('/api/progress/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, ...payload }),
    }).catch(() => {});
  }

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const videoId = chip.getAttribute('data-video-id');
      const title = chip.querySelector('.v-chip__title')?.textContent || '';
      if (!videoId || !frame) return;
      frame.src = 'https://www.youtube.com/embed/' + encodeURIComponent(videoId) + '?rel=0&autoplay=1';
      if (caption) caption.textContent = title;
      // Swap "current" chip
      chips.forEach(c => c.classList.remove('is-current'));
      chip.classList.add('is-current');
      // Mark watched
      chip.classList.add('is-watched');
      postStep({ op: 'video', value: videoId });
    });
  });

  // Auto-select chip from #lesson=<slug> hash (legacy /learn/<slug> redirects).
  function applyHash() {
    const m = location.hash.match(/lesson=([^&]+)/);
    if (!m) return;
    const slug = decodeURIComponent(m[1]);
    const target = page.querySelector('.v-chip[data-lesson-slug="' + CSS.escape(slug) + '"]');
    if (target) {
      target.click();
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  if (location.hash.includes('lesson=')) applyHash();
  window.addEventListener('hashchange', applyHash);

  // ---- Section 2: Workbook click tracking ----
  const workbookLink = page.querySelector('[data-workbook-link]');
  if (workbookLink) {
    workbookLink.addEventListener('click', () => {
      // Don't preventDefault — we WANT the link to navigate to the PDF.
      workbookLink.classList.add('is-done');
      postStep({ op: 'workbook' });
    });
  }
})();

// ============================================================
// Journey: client-side handlers for the new step engine
// (wordcloud, fillblank, pick-3, rank, summary)
// ============================================================
(function journeyInit() {
  const stepBody = document.querySelector('.step-body[data-step-id]');
  const nextBtn = document.querySelector('[data-journey-next]');
  if (!stepBody || !nextBtn) return;

  const kind = stepBody.dataset.stepKind;
  const stepId = stepBody.dataset.stepId;

  // ---- Per-kind interaction wiring ----
  if (kind === 'wordcloud') {
    stepBody.addEventListener('click', (e) => {
      const chip = e.target.closest('.word-chip');
      if (!chip) return;
      chip.classList.toggle('is-selected');
      const count = stepBody.querySelectorAll('.word-chip.is-selected').length;
      const el = stepBody.querySelector('[data-count]');
      if (el) el.textContent = count + ' picked';
    });
  } else if (kind === 'pick-3') {
    const max = parseInt(stepBody.dataset.maxPicks || '3', 10);
    stepBody.addEventListener('click', (e) => {
      const card = e.target.closest('.pick-card');
      if (!card) return;
      const wasSel = card.classList.contains('is-selected');
      const selected = stepBody.querySelectorAll('.pick-card.is-selected');
      if (wasSel) {
        card.classList.remove('is-selected');
      } else if (selected.length < max) {
        card.classList.add('is-selected');
      }
      const count = stepBody.querySelectorAll('.pick-card.is-selected').length;
      const el = stepBody.querySelector('[data-count]');
      if (el) el.textContent = count + '/' + max;
    });
  } else if (kind === 'rank') {
    wireRank(stepBody);
  }
  // fillblank: textareas are uncontrolled, just read on save
  // summary: nothing to interact

  // ---- Save & continue ----
  nextBtn.addEventListener('click', async () => {
    const tool = nextBtn.dataset.tool;
    const nextSlug = nextBtn.dataset.nextSlug;
    const response = readJourneyResponse(stepBody, kind);

    nextBtn.disabled = true;
    const originalLabel = nextBtn.textContent;
    nextBtn.textContent = 'Saving...';

    try {
      const res = await fetch('/api/progress/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool,
          op: 'journey_response',
          value: { step_id: stepId, response },
        }),
      });
      if (!res.ok) throw new Error('save failed: ' + res.status);
      const url = nextSlug ? '/brand-builder/' + tool + '?s=' + encodeURIComponent(nextSlug) : '/dashboard';
      window.location.href = url;
    } catch (err) {
      console.error('Journey save failed:', err);
      nextBtn.disabled = false;
      nextBtn.textContent = originalLabel;
      alert('Could not save right now. Please try again.');
    }
  });

  function readJourneyResponse(body, kind) {
    if (kind === 'wordcloud') {
      return {
        selected: Array.from(body.querySelectorAll('.word-chip.is-selected'))
          .map((c) => c.dataset.wordId),
      };
    }
    if (kind === 'pick-3') {
      return {
        selected: Array.from(body.querySelectorAll('.pick-card.is-selected'))
          .map((c) => c.dataset.optionId),
      };
    }
    if (kind === 'rank') {
      return {
        ranking: Array.from(body.querySelectorAll('.rank-item'))
          .map((li) => li.dataset.itemId),
      };
    }
    if (kind === 'fillblank') {
      const fields = {};
      body.querySelectorAll('.fill-field__input').forEach((t) => {
        fields[t.dataset.fieldId] = t.value;
      });
      return { fields };
    }
    if (kind === 'summary') return { acknowledged: true };
    return {};
  }

  function wireRank(body) {
    const list = body.querySelector('[data-rank-list]');
    if (!list) return;
    let dragId = null;

    list.addEventListener('dragstart', (e) => {
      const li = e.target.closest('.rank-item');
      if (!li) return;
      dragId = li.dataset.itemId;
      li.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    list.addEventListener('dragend', (e) => {
      const li = e.target.closest('.rank-item');
      if (li) li.classList.remove('is-dragging');
      dragId = null;
    });
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    });
    list.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!dragId) return;
      const dropTarget = e.target.closest('.rank-item');
      if (!dropTarget) return;
      const fromEl = list.querySelector('.rank-item[data-item-id="' + CSS.escape(dragId) + '"]');
      if (!fromEl || fromEl === dropTarget) return;
      // Insert fromEl before dropTarget. If fromEl is below dropTarget, this moves it up.
      // If fromEl is above dropTarget, we want it to land after dropTarget. Use position comparison.
      const items = Array.from(list.querySelectorAll('.rank-item'));
      const fromIdx = items.indexOf(fromEl);
      const toIdx = items.indexOf(dropTarget);
      if (fromIdx < toIdx) {
        list.insertBefore(fromEl, dropTarget.nextElementSibling);
      } else {
        list.insertBefore(fromEl, dropTarget);
      }
      renumberRank(list);
    });

    list.addEventListener('click', (e) => {
      const upBtn = e.target.closest('[data-rank-up]');
      const downBtn = e.target.closest('[data-rank-down]');
      if (!upBtn && !downBtn) return;
      const li = e.target.closest('.rank-item');
      if (!li) return;
      if (upBtn && li.previousElementSibling) {
        list.insertBefore(li, li.previousElementSibling);
      } else if (downBtn && li.nextElementSibling) {
        list.insertBefore(li.nextElementSibling, li);
      }
      renumberRank(list);
    });
  }

  function renumberRank(list) {
    Array.from(list.querySelectorAll('.rank-item')).forEach((li, idx) => {
      const numEl = li.querySelector('[data-rank-num]');
      if (numEl) numEl.textContent = idx + 1;
    });
  }
})();
