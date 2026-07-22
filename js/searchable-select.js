/**
 * CivicRadar — lightweight searchable combobox for ward / neighbourhood fields.
 * Replaces native datalist with a touch-friendly, filterable option list.
 */
(function (global) {
  'use strict';

  const registry = new WeakMap();

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initSearchableSelect(input, options) {
    if (!input || registry.has(input)) return registry.get(input);

    const cfg = Object.assign({
      getOptions: function () { return []; },
      allowCustom: true,
      emptyLabel: function () { return 'No matches'; },
      toggleLabel: function () { return 'Show options'; },
    }, options || {});

    input.removeAttribute('list');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('aria-expanded', 'false');

    const wrap = document.createElement('div');
    wrap.className = 'civic-combobox';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'civic-combobox__toggle';
    toggleBtn.setAttribute('tabindex', '-1');
    toggleBtn.innerHTML = '<i class="ph ph-caret-down" aria-hidden="true"></i>';
    wrap.appendChild(toggleBtn);

    const listbox = document.createElement('div');
    listbox.className = 'civic-combobox__list hidden';
    listbox.setAttribute('role', 'listbox');
    const listId = 'civic-combobox-' + Math.random().toString(36).slice(2, 9);
    listbox.id = listId;
    input.setAttribute('aria-controls', listId);
    wrap.appendChild(listbox);

    let filteredOptions = [];
    let activeIndex = -1;
    let isOpen = false;
    let blurTimer = null;
    // When the user scrolls the option list, blur the input to dismiss the
    // keyboard but keep the list open for tapping an option.
    let keepOpenOnBlur = false;
    // Ignore sheet scroll fired by our own scrollIntoView / keyboard resize
    // so we don't immediately close the list we just opened.
    let ignoreSheetScrollUntil = 0;
    // When we set input.value programmatically (on selection) we still need to
    // fire 'input'/'change' so app.js reacts — but the component's OWN 'input'
    // listener must ignore that self-dispatched event, otherwise it re-opens
    // the list filtered to the just-picked value (the "selected value shows
    // again below the dropdown" bug). This flag brackets the programmatic set.
    let suppressInput = false;

    function label(key) {
      const v = cfg[key];
      return typeof v === 'function' ? v() : v;
    }

    function allOptions() {
      const opts = cfg.getOptions();
      return Array.isArray(opts) ? opts : [];
    }

    /** Case-insensitive substring match against getOptions() (includes). */
    function filterOptions(query) {
      const q = String(query == null ? '' : query).trim().toLowerCase();
      const opts = allOptions();
      if (!q) return opts;
      return opts.filter(function (o) {
        return String(o).toLowerCase().includes(q);
      });
    }

    function setToggleAria() {
      toggleBtn.setAttribute('aria-label', label('toggleLabel'));
    }

    function highlightActive() {
      const buttons = listbox.querySelectorAll('.civic-combobox__option');
      buttons.forEach(function (btn, i) {
        const active = i === activeIndex;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        if (active) {
          input.setAttribute('aria-activedescendant', btn.id);
          btn.scrollIntoView({ block: 'nearest' });
        }
      });
      if (activeIndex < 0) input.removeAttribute('aria-activedescendant');
    }

    function renderList(options) {
      filteredOptions = options;
      setToggleAria();
      if (!options.length) {
        listbox.innerHTML = '<div class="civic-combobox__empty" role="status">' +
          escapeHtml(label('emptyLabel')) + '</div>';
        activeIndex = -1;
        return;
      }
      listbox.innerHTML = options.map(function (opt, i) {
        const optId = listId + '-opt-' + i;
        return '<button type="button" class="civic-combobox__option" role="option" aria-selected="false" id="' +
          optId + '" data-index="' + i + '">' + escapeHtml(opt) + '</button>';
      }).join('');
      if (activeIndex >= options.length) activeIndex = options.length - 1;
      highlightActive();
    }

    function openList(showAll) {
      clearTimeout(blurTimer);
      isOpen = true;
      listbox.classList.remove('hidden');
      input.setAttribute('aria-expanded', 'true');
      wrap.classList.add('is-open');
      renderList(filterOptions(showAll ? '' : input.value));
      ensureAboveKeyboard();
    }

    function syncViewportVars(sheet) {
      if (!sheet) return;
      const vv = window.visualViewport;
      const h = vv ? Math.round(vv.height) : Math.round(window.innerHeight || 0);
      const offsetTop = vv ? Math.round(vv.offsetTop || 0) : 0;
      const inset = vv
        ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
        : 0;
      const heightPx = (h || window.innerHeight) + 'px';
      sheet.style.setProperty('--vv-height', heightPx);
      sheet.style.setProperty('--vv-offset-top', offsetTop + 'px');
      sheet.style.setProperty('--kb-inset', inset + 'px');
      const overlay = sheet.closest('.modal-overlay');
      if (overlay) {
        overlay.classList.add('sheet-kb-active');
        overlay.style.setProperty('--vv-height', heightPx);
        overlay.style.setProperty('--vv-offset-top', offsetTop + 'px');
        overlay.style.setProperty('--kb-inset', inset + 'px');
      }
    }

    /**
     * Scroll only inside the sheet (or its .modal__sheet-body flex scroller).
     * Native scrollIntoView can scroll the document / visualViewport and shove
     * a fixed overlay off-screen.
     */
    function scrollFieldInsideSheet(sheet, target) {
      if (!sheet || !target || !sheet.contains(target)) return;
      const scroller = sheet.querySelector('.modal__sheet-body') || sheet;
      try {
        const sheetRect = scroller.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const pad = 12;
        const visibleBottom = sheetRect.bottom - pad;
        const visibleTop = sheetRect.top + pad;
        let delta = 0;
        if (targetRect.bottom > visibleBottom) {
          delta = targetRect.bottom - visibleBottom;
        } else if (targetRect.top < visibleTop) {
          delta = targetRect.top - visibleTop;
        }
        if (delta) scroller.scrollTop += delta;
      } catch (e) { /* ignore */ }
    }

    function bindViewportSyncOnce() {
      if (global.__civicComboboxVvBound) return;
      global.__civicComboboxVvBound = true;
      function syncAll() {
        document.querySelectorAll('.modal.sheet--kb-expanded').forEach(syncViewportVars);
      }
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncAll);
        window.visualViewport.addEventListener('scroll', syncAll);
      }
      window.addEventListener('resize', syncAll);
    }

    /**
     * Expand parent sheet toward visualViewport height, then scroll the
     * focused combobox (input + in-flow list) so both stay above the soft
     * keyboard (onboarding + Profile Edit).
     */
    function ensureAboveKeyboard() {
      const sheet = input.closest('.modal');
      if (!sheet) return;
      bindViewportSyncOnce();
      sheet.classList.add('sheet--kb-expanded');
      syncViewportVars(sheet);
      // Programmatic scroll must not trip the sheet-scroll closer.
      ignoreSheetScrollUntil = Date.now() + 450;
      requestAnimationFrame(function () {
        // In-sheet scroll only — native scrollIntoView can shove a fixed overlay off-screen.
        scrollFieldInsideSheet(sheet, wrap);
      });
    }

    /**
     * Sheet scroll while open can leave menus visually orphaned over the map
     * (transform + overflow + visualViewport). Close + blur — listbox has its
     * own scroll container so this does not fire when browsing options.
     */
    function onSheetScrollClose() {
      if (!isOpen || Date.now() < ignoreSheetScrollUntil) return;
      closeList();
      try {
        if (document.activeElement === input) input.blur();
      } catch (e) { /* ignore */ }
    }

    function collapseSheetIfIdle() {
      const sheet = input.closest('.modal');
      if (!sheet) return;
      const busy = sheet.querySelector(
        '.civic-combobox.is-open, .civic-combobox input:focus'
      );
      if (busy) return;
      sheet.classList.remove('sheet--kb-expanded');
      const overlay = sheet.closest('.modal-overlay');
      if (overlay && !overlay.querySelector('.modal.sheet--kb-expanded')) {
        overlay.classList.remove('sheet-kb-active');
        overlay.style.removeProperty('--vv-height');
        overlay.style.removeProperty('--vv-offset-top');
        overlay.style.removeProperty('--kb-inset');
      }
      sheet.style.removeProperty('--vv-height');
      sheet.style.removeProperty('--vv-offset-top');
      sheet.style.removeProperty('--kb-inset');
    }

    function closeList() {
      isOpen = false;
      keepOpenOnBlur = false;
      listbox.classList.add('hidden');
      input.setAttribute('aria-expanded', 'false');
      wrap.classList.remove('is-open');
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
      // Defer so a focus move to another combobox can claim expanded state first.
      setTimeout(collapseSheetIfIdle, 0);
    }

    /**
     * Live-filter path: always reopen + re-render from getOptions().
     * Critical when the list was closed externally (E2E dismiss_civic_comboboxes
     * only adds .hidden / aria-expanded=false and leaves our isOpen flag true) —
     * the old "if (!isOpen) open else render" path re-rendered into a still-hidden
     * list, so filtering looked broken.
     */
    function filterFromInput() {
      activeIndex = -1;
      openList(false);
    }

    // Find the next focusable form control after `input` in DOM order, so we
    // can advance focus after a selection. Returns null when there's nothing
    // sensible to move to (so focus-advance becomes a safe no-op).
    function findNextField() {
      const form = input.closest('form') || document;
      const focusable = Array.prototype.slice.call(
        form.querySelectorAll(
          'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
        )
      ).filter(function (el) {
        // Skip our own combobox internals (toggle button, the input itself)
        // and anything hidden/without layout.
        if (el === input || el === toggleBtn) return false;
        if (el.closest('.civic-combobox__list')) return false;
        if (el.offsetParent === null && el.type !== 'hidden') return false;
        return true;
      });
      // Locate the first focusable that comes after `input` in the DOM.
      for (let i = 0; i < focusable.length; i++) {
        const pos = input.compareDocumentPosition(focusable[i]);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return focusable[i];
      }
      return null;
    }

    function selectOption(value) {
      suppressInput = true;
      input.value = value;
      closeList();
      // Fire events app.js depends on (e.g. refreshing neighbourhood options
      // for the chosen ward) — the suppress flag stops our own input handler
      // from re-opening the list in response.
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      suppressInput = false;

      // Always blur immediately so the soft keyboard dismisses.
      input.blur();

      // In bottom sheets (onboarding / Profile Edit), do not auto-focus the
      // next field — that would re-open the keyboard and fight scroll layout.
      if (input.closest('.modal')) {
        collapseSheetIfIdle();
        return;
      }

      // Outside sheets: auto-advance focus to the next field.
      const next = findNextField();
      if (next) {
        next.dataset.civicQuietFocus = '1';
        setTimeout(function () {
          try { next.focus({ preventScroll: false }); } catch (e) { next.focus(); }
          if (document.activeElement !== next) delete next.dataset.civicQuietFocus;
        }, 0);
      }
    }

    function scheduleClose() {
      clearTimeout(blurTimer);
      blurTimer = setTimeout(closeList, 150);
    }

    input.addEventListener('focus', function () {
      // If this focus came from another combobox's auto-advance, honor it
      // quietly: consume the marker and don't spring the dropdown open. The
      // user can still open it with a tap, arrow key, or the toggle caret.
      if (input.dataset.civicQuietFocus === '1') {
        delete input.dataset.civicQuietFocus;
        ensureAboveKeyboard();
        return;
      }
      openList(false);
    });

    input.addEventListener('input', function () {
      if (suppressInput) return;   // ignore our own programmatic value-set
      filterFromInput();
    });

    input.addEventListener('keydown', function (e) {
      if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        openList(true);
        e.preventDefault();
        return;
      }
      if (!isOpen) return;
      if (e.key === 'Escape') {
        closeList();
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (!filteredOptions.length) return;
        activeIndex = Math.min(activeIndex + 1, filteredOptions.length - 1);
        highlightActive();
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        if (!filteredOptions.length) return;
        activeIndex = Math.max(activeIndex - 1, 0);
        highlightActive();
        e.preventDefault();
      } else if (e.key === 'Enter' && activeIndex >= 0 && filteredOptions[activeIndex]) {
        selectOption(filteredOptions[activeIndex]);
        e.preventDefault();
      }
    });

    input.addEventListener('blur', function () {
      if (keepOpenOnBlur) {
        keepOpenOnBlur = false;
        // Keyboard dismissed; leave the list open so the user can tap an option.
        return;
      }
      scheduleClose();
    });

    toggleBtn.addEventListener('mousedown', function (e) {
      e.preventDefault();
    });

    toggleBtn.addEventListener('click', function () {
      if (isOpen && !listbox.classList.contains('hidden')) {
        closeList();
        input.focus();
      } else {
        input.focus();
        openList(true);
      }
    });

    listbox.addEventListener('mousedown', function (e) {
      e.preventDefault();
    });

    // Dismiss keyboard when the user scrolls/drags the option list, but keep
    // the list open (see keepOpenOnBlur). Does not affect dismiss_civic_comboboxes.
    function blurInputKeepList() {
      if (document.activeElement !== input) return;
      keepOpenOnBlur = true;
      // Keyboard dismiss resizes the sheet; suppress scroll-close briefly.
      ignoreSheetScrollUntil = Date.now() + 500;
      try { input.blur(); } catch (e) { /* ignore */ }
    }
    listbox.addEventListener('touchmove', blurInputKeepList, { passive: true });
    listbox.addEventListener('scroll', blurInputKeepList, { passive: true });

    listbox.addEventListener('click', function (e) {
      const btn = e.target.closest('.civic-combobox__option');
      if (!btn) return;
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      if (filteredOptions[idx] != null) selectOption(filteredOptions[idx]);
    });

    document.addEventListener('touchstart', function onDocTouch(e) {
      if (!wrap.contains(e.target)) closeList();
    }, { passive: true });

    // Close on sheet / sheet-body scroll (onboarding flex body + Profile Edit).
    const sheetEl = input.closest('.modal');
    if (sheetEl) {
      const scrollEl = sheetEl.querySelector('.modal__sheet-body') || sheetEl;
      scrollEl.addEventListener('scroll', onSheetScrollClose, { passive: true });
      if (scrollEl !== sheetEl) {
        sheetEl.addEventListener('scroll', onSheetScrollClose, { passive: true });
      }
    }

    const api = {
      refresh: function () {
        // City/source changes call this while the list may be open — re-filter
        // from fresh getOptions(). Also recover visual/state desync.
        if (isOpen || !listbox.classList.contains('hidden')) {
          openList(false);
        }
      },
      open: function () { openList(true); },
      close: closeList,
    };

    registry.set(input, api);
    setToggleAria();
    return api;
  }

  function refreshSearchableSelect(input) {
    const api = registry.get(input);
    if (api) api.refresh();
  }

  global.CivicSearchableSelect = {
    init: initSearchableSelect,
    refresh: refreshSearchableSelect,
  };
}(typeof window !== 'undefined' ? window : globalThis));
