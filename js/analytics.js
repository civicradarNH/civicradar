/**
 * CivicRadar — lightweight client analytics (traffic, errors, performance).
 * Privacy-first: anonymous session id, ward code only, no photos/GPS/PII.
 * Fails silently — must never break the app.
 */
(function (global) {
  'use strict';

  const BUFFER_KEY = 'civicradar_analytics_buffer';
  const SESSION_KEY = 'civicradar_session_id';
  const MAX_BUFFER = 500;
  const MAX_STACK = 800;
  const MAX_UA = 120;

  const DEFAULTS = {
    enabled: true,
    batchSize: 10,
    flushIntervalMs: 30000,
    sampleRate: 1.0,
    debug: false,
  };

  let cfg = { ...DEFAULTS };
  let queue = [];
  let flushTimer = null;
  let consent = false;
  let supabaseClient = null;
  let flushing = false;
  const perfStarts = Object.create(null);

  function config() {
    return Object.assign({}, DEFAULTS, (global.CIVICRADAR_CONFIG || {}).analytics || {}, cfg);
  }

  function logDebug() {
    if (config().debug) console.debug('[CivicAnalytics]', ...arguments);
  }

  function uuid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function getSessionId() {
    try {
      let id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = uuid();
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      return uuid();
    }
  }

  function wardCode(ward) {
    if (!ward) return null;
    const code = String(ward).split('—')[0].trim();
    return code || null;
  }

  const BLOCKED_KEYS = /^(lat|lng|latitude|longitude|image|photo|resolutionimage|email|password|token|notes)$/i;

  function sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') return {};
    const out = {};
    Object.keys(payload).forEach((key) => {
      if (BLOCKED_KEYS.test(key)) return;
      const val = payload[key];
      if (val == null) return;
      if (typeof val === 'string' && val.length > 500) {
        out[key] = val.slice(0, 500);
        return;
      }
      if (typeof val === 'object' && !Array.isArray(val)) return;
      out[key] = val;
    });
    return out;
  }

  function truncateUa() {
    try {
      return (navigator.userAgent || '').slice(0, MAX_UA);
    } catch {
      return '';
    }
  }

  function shouldSample() {
    const rate = config().sampleRate;
    if (rate >= 1) return true;
    if (rate <= 0) return false;
    return Math.random() < rate;
  }

  function loadBuffer() {
    try {
      const raw = localStorage.getItem(BUFFER_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveBuffer(events) {
    try {
      const trimmed = events.slice(-MAX_BUFFER);
      localStorage.setItem(BUFFER_KEY, JSON.stringify(trimmed));
    } catch {
      /* storage full — drop oldest silently */
    }
  }

  function enqueue(row) {
    queue.push(row);
    const c = config();
    if (queue.length >= c.batchSize) flush();
  }

  function buildRow(eventType, payload, ward) {
    return {
      event_type: eventType,
      session_id: getSessionId(),
      ward: wardCode(ward || payload.ward) || null,
      payload: sanitizePayload(payload),
      user_agent: truncateUa(),
      created_at: new Date().toISOString(),
    };
  }

  function track(eventType, payload, ward) {
    try {
      if (!config().enabled || !consent) return;
      if (!shouldSample()) return;
      const row = buildRow(eventType, payload || {}, ward);
      enqueue(row);
      logDebug('track', eventType, row.payload);
    } catch (e) {
      logDebug('track failed', e);
    }
  }

  function trackError(message, meta) {
    try {
      if (!config().enabled || !consent) return;
      const stack = meta && meta.stack ? String(meta.stack).slice(0, MAX_STACK) : '';
      track('error', {
        message: String(message || 'Unknown error').slice(0, 300),
        stack,
        url: meta && meta.url ? String(meta.url).slice(0, 200) : (global.location && location.href ? location.href.slice(0, 200) : ''),
        line: meta && meta.line != null ? meta.line : null,
        col: meta && meta.col != null ? meta.col : null,
        source: meta && meta.source ? String(meta.source).slice(0, 200) : '',
        context: meta && meta.context ? String(meta.context).slice(0, 80) : '',
      });
    } catch (e) {
      logDebug('trackError failed', e);
    }
  }

  function trackPerf(name, durationMs, extra) {
    try {
      if (!config().enabled || !consent) return;
      if (!shouldSample()) return;
      track('perf', Object.assign({ name, durationMs: Math.round(durationMs) }, extra || {}));
    } catch (e) {
      logDebug('trackPerf failed', e);
    }
  }

  function perfStart(name) {
    perfStarts[name] = performance.now();
  }

  function perfEnd(name, extra) {
    const start = perfStarts[name];
    if (start == null) return;
    delete perfStarts[name];
    trackPerf(name, performance.now() - start, extra);
  }

  async function flushToSupabase(rows) {
    if (!supabaseClient || !rows.length) return true;
    try {
      const insertRows = rows.map((r) => ({
        event_type: r.event_type,
        session_id: r.session_id,
        ward: r.ward,
        payload: r.payload,
        user_agent: r.user_agent,
        created_at: r.created_at,
      }));
      const { error } = await supabaseClient.from('analytics_events').insert(insertRows);
      if (error) {
        logDebug('supabase flush error', error.message);
        return false;
      }
      return true;
    } catch (e) {
      logDebug('supabase flush exception', e);
      return false;
    }
  }

  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      const pending = queue.splice(0, queue.length);
      if (!pending.length) return;

      const buffer = loadBuffer().concat(pending);
      saveBuffer(buffer);

      const ok = await flushToSupabase(pending);
      if (ok && supabaseClient) {
        const sent = new Set(pending.map((r) => r.created_at + r.event_type + r.session_id));
        const remaining = loadBuffer().filter(
          (r) => !sent.has(r.created_at + r.event_type + r.session_id)
        );
        saveBuffer(remaining);
      }
    } catch (e) {
      logDebug('flush failed', e);
    } finally {
      flushing = false;
    }
  }

  function startFlushTimer() {
    clearInterval(flushTimer);
    flushTimer = setInterval(() => flush(), config().flushIntervalMs);
  }

  function eventsSince(days) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return loadBuffer().filter((e) => new Date(e.created_at).getTime() >= cutoff);
  }

  function aggregateEvents(events) {
    const counts = {};
    let errors = 0;
    let perfSum = 0;
    let perfCount = 0;
    const wards = {};

    events.forEach((e) => {
      const type = e.event_type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
      if (type === 'error') errors++;
      if (type === 'perf' && e.payload && e.payload.name) {
        const key = 'perf:' + e.payload.name;
        counts[key] = (counts[key] || 0) + 1;
        if (typeof e.payload.durationMs === 'number') {
          perfSum += e.payload.durationMs;
          perfCount++;
        }
      }
      if (e.ward) wards[e.ward] = (wards[e.ward] || 0) + 1;
    });

    return {
      total: events.length,
      counts,
      errors,
      avgPerfMs: perfCount ? Math.round(perfSum / perfCount) : null,
      topWards: Object.entries(wards)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([w, n]) => ({ ward: w, events: n })),
    };
  }

  function getLocalSummary(days) {
    return aggregateEvents(eventsSince(days || 7));
  }

  async function fetchServerSummary(days) {
    if (!supabaseClient) return null;
    try {
      const { data, error } = await supabaseClient.rpc('get_analytics_summary', { p_days: days || 7 });
      if (error) {
        logDebug('server summary error', error.message);
        return null;
      }
      return data;
    } catch (e) {
      logDebug('server summary exception', e);
      return null;
    }
  }

  async function fetchTrackingDashboard(days, scope) {
    if (!supabaseClient) return null;
    const opts = scope || {};
    try {
      const { data, error } = await supabaseClient.rpc('get_tracking_dashboard', {
        p_days: days || 7,
        p_ward: opts.ward || null,
        p_city: opts.city || null,
        p_neighbourhood: opts.neighbourhood || null,
      });
      if (error) {
        logDebug('tracking dashboard error', error.message);
        return null;
      }
      return data;
    } catch (e) {
      logDebug('tracking dashboard exception', e);
      return null;
    }
  }

  function captureNavigationTiming() {
    try {
      if (!global.performance || !performance.timing) return;
      const t = performance.timing;
      if (t.domContentLoadedEventEnd && t.navigationStart) {
        trackPerf('dom_content_loaded', t.domContentLoadedEventEnd - t.navigationStart);
      }
      if (t.loadEventEnd && t.navigationStart) {
        trackPerf('load_complete', t.loadEventEnd - t.navigationStart);
      }
    } catch (e) {
      logDebug('nav timing failed', e);
    }
  }

  function observeLcp() {
    try {
      if (!global.PerformanceObserver) return;
      const po = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) trackPerf('lcp_approx', last.startTime, { element: last.element ? last.element.tagName : '' });
      });
      po.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      logDebug('LCP observer unavailable', e);
    }
  }

  function installErrorHandlers() {
    global.addEventListener('error', (ev) => {
      trackError(ev.message || 'Script error', {
        stack: ev.error && ev.error.stack,
        url: ev.filename,
        line: ev.lineno,
        col: ev.colno,
        source: 'window.onerror',
      });
    });
    global.addEventListener('unhandledrejection', (ev) => {
      const reason = ev.reason;
      trackError(reason && reason.message ? reason.message : String(reason), {
        stack: reason && reason.stack,
        source: 'unhandledrejection',
      });
    });
  }

  function wrapAsync(context, fn) {
    return function wrappedAsync() {
      const args = arguments;
      const self = this;
      try {
        const result = fn.apply(self, args);
        if (result && typeof result.then === 'function') {
          return result.catch((err) => {
            trackError(err && err.message ? err.message : String(err), {
              stack: err && err.stack,
              context,
              source: 'async',
            });
            throw err;
          });
        }
        return result;
      } catch (err) {
        trackError(err && err.message ? err.message : String(err), {
          stack: err && err.stack,
          context,
          source: 'sync',
        });
        throw err;
      }
    };
  }

  function clearLocalData() {
    try {
      localStorage.removeItem(BUFFER_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    queue = [];
  }

  function init(options) {
    try {
      options = options || {};
      if (options.consent != null) consent = !!options.consent;
      if (options.supabaseClient) supabaseClient = options.supabaseClient;
      installErrorHandlers();
      if (consent) {
        track('session_start', { path: global.location && location.pathname });
        captureNavigationTiming();
        observeLcp();
      }
      startFlushTimer();
      global.addEventListener('pagehide', () => flush());
      global.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
      });
      logDebug('init', { consent, enabled: config().enabled });
    } catch (e) {
      logDebug('init failed', e);
    }
  }

  function setConsent(ok) {
    const was = consent;
    consent = !!ok;
    if (consent && !was) {
      track('session_start', { path: global.location && location.pathname, resumed: true });
      captureNavigationTiming();
    }
    if (!consent) {
      clearLocalData();
      flush();
    }
  }

  function setSupabaseClient(client) {
    supabaseClient = client || null;
    if (client) flush();
  }

  global.CivicAnalytics = {
    init,
    setConsent,
    setSupabaseClient,
    track,
    trackError,
    trackPerf,
    perfStart,
    perfEnd,
    flush,
    wrapAsync,
    getLocalSummary,
    fetchServerSummary,
    fetchTrackingDashboard,
    getSessionId,
    clearLocalData,
  };
})(window);
