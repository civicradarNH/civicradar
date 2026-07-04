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

    function label(key) {
      const v = cfg[key];
      return typeof v === 'function' ? v() : v;
    }

    function allOptions() {
      const opts = cfg.getOptions();
      return Array.isArray(opts) ? opts : [];
    }

    function filterOptions(query) {
      const q = query.trim().toLowerCase();
      const opts = allOptions();
      if (!q) return opts;
      return opts.filter(function (o) {
        return String(o).toLowerCase().indexOf(q) !== -1;
      });
    }

    function setToggleAria() {
      toggleBtn.setAttribute('aria-label', label('toggleLabel'));
    }

    function highlightActive() {
      const buttons = listbox.querySelectorAll('.civic-combobox__option');
      buttons.forEach(function (btn, i) {
        btn.classList.toggle('is-active', i === activeIndex);
        if (i === activeIndex) {
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
        return '<button type="button" class="civic-combobox__option" role="option" id="' +
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
    }

    function closeList() {
      isOpen = false;
      listbox.classList.add('hidden');
      input.setAttribute('aria-expanded', 'false');
      wrap.classList.remove('is-open');
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
    }

    function selectOption(value) {
      input.value = value;
      closeList();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function scheduleClose() {
      clearTimeout(blurTimer);
      blurTimer = setTimeout(closeList, 150);
    }

    input.addEventListener('focus', function () {
      openList(false);
    });

    input.addEventListener('input', function () {
      if (!isOpen) openList(false);
      else renderList(filterOptions(input.value));
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
        activeIndex = Math.min(activeIndex + 1, filteredOptions.length - 1);
        highlightActive();
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        activeIndex = Math.max(activeIndex - 1, 0);
        highlightActive();
        e.preventDefault();
      } else if (e.key === 'Enter' && activeIndex >= 0 && filteredOptions[activeIndex]) {
        selectOption(filteredOptions[activeIndex]);
        e.preventDefault();
      }
    });

    input.addEventListener('blur', scheduleClose);

    toggleBtn.addEventListener('mousedown', function (e) {
      e.preventDefault();
    });

    toggleBtn.addEventListener('click', function () {
      if (isOpen) {
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

    listbox.addEventListener('click', function (e) {
      const btn = e.target.closest('.civic-combobox__option');
      if (!btn) return;
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      if (filteredOptions[idx] != null) selectOption(filteredOptions[idx]);
    });

    document.addEventListener('touchstart', function onDocTouch(e) {
      if (!wrap.contains(e.target)) closeList();
    }, { passive: true });

    const api = {
      refresh: function () {
        if (isOpen) renderList(filterOptions(input.value));
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
