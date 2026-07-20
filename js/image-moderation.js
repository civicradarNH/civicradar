/**
 * CivicRadar — client-side photo moderation
 * Validates uploads, strips EXIF (via canvas re-encode), blocks NSFW content,
 * and rejects blank / document-like / selfie-heavy images before they are shared.
 */
(function (global) {
  'use strict';

  const DEFAULTS = {
    enabled: true,
    maxUploadBytes: 5 * 1024 * 1024,
    minWidth: 120,
    minHeight: 120,
    minColorVariance: 7,
    minUniqueColors: 12,
    maxSkinRatio: 0.52,
    minOutdoorRatio: 0.08,
    maxDocumentScore: 0.42,
    nsfwEnabled: true,
    nsfwThresholds: { Porn: 0.55, Hentai: 0.55, Sexy: 0.88 },
    nsfwCombinedAdult: 0.62,
    requireOnlineNsfw: false,
  };

  // image/jpg + image/pjpeg: some Android camera/gallery stacks use these aliases.
  const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp']);
  const BLOCKED_EXT = /\.(gif|svg|bmp|heic|heif|tiff?)$/i;

  let nsfwModelPromise = null;
  let scriptLoadPromise = null;

  function mergeConfig(overrides) {
    const cfg = { ...DEFAULTS, ...(overrides || {}) };
    cfg.nsfwThresholds = { ...DEFAULTS.nsfwThresholds, ...(overrides && overrides.nsfwThresholds) };
    return cfg;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }

  async function loadNsfwModel(cfg) {
    if (!cfg.nsfwEnabled || !navigator.onLine) return null;
    if (!nsfwModelPromise) {
      nsfwModelPromise = (async () => {
        if (!scriptLoadPromise) {
          scriptLoadPromise = loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js')
            .then(() => loadScript('https://cdn.jsdelivr.net/npm/nsfwjs@2.4.2/dist/nsfwjs.min.js'));
        }
        await scriptLoadPromise;
        if (!global.nsfwjs || typeof global.nsfwjs.load !== 'function') {
          throw new Error('NSFW model unavailable');
        }
        return global.nsfwjs.load();
      })().catch((err) => {
        nsfwModelPromise = null;
        throw err;
      });
    }
    return nsfwModelPromise;
  }

  function fail(code, message, i18nKey) {
    return { ok: false, code, message, i18nKey: i18nKey || `moderation.blocked.${code}` };
  }

  function pass(extra) {
    return { ok: true, ...extra };
  }

  function validateFile(file, cfgInput) {
    const cfg = mergeConfig(cfgInput);
    if (!cfg.enabled) return pass();

    if (!file || !(file instanceof Blob)) {
      return fail('fileType', 'Choose a JPEG, PNG, or WebP photo.', 'moderation.blocked.fileType');
    }

    if (file.size > cfg.maxUploadBytes) {
      return fail('fileSize', 'Photo is too large. Use a smaller image (max 8 MB).', 'moderation.blocked.fileSize');
    }

    if (file.size < 2048) {
      return fail('lowQuality', 'Photo file is too small to be useful evidence.', 'moderation.blocked.lowQuality');
    }

    const mime = (file.type || '').toLowerCase();
    if (mime && !ALLOWED_MIME.has(mime)) {
      return fail('fileType', 'Only JPEG, PNG, or WebP hazard photos are allowed.', 'moderation.blocked.fileType');
    }

    if (file.name && BLOCKED_EXT.test(file.name)) {
      return fail('fileType', 'That file type is not allowed.', 'moderation.blocked.fileType');
    }

    return pass();
  }

  function samplePixels(ctx, width, height, sampleSize) {
    const target = sampleSize || 48;
    const tmp = document.createElement('canvas');
    tmp.width = target;
    tmp.height = target;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, target, target);
    return tctx.getImageData(0, 0, target, target).data;
  }

  function luminance(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function isSkinPixel(r, g, b) {
    return r > 95 && g > 40 && b > 20 && r > g && r > b && (r - g) > 15 && (r - b) > 15;
  }

  function isOutdoorPixel(r, g, b) {
    if (g > r + 8 && g > 50) return true;
    if (b > r + 6 && b > 55 && g > 40) return true;
    if (r > 60 && g > 35 && b < 55 && r > b + 10) return true;
    return false;
  }

  function analyzePixels(ctx, width, height, cfg) {
    if (width < cfg.minWidth || height < cfg.minHeight) {
      return fail('lowQuality', 'Photo is too small. Move closer to the hazard and try again.', 'moderation.blocked.lowQuality');
    }

    const data = samplePixels(ctx, width, height, 48);
    const pixels = data.length / 4;
    let lumSum = 0;
    let lumSq = 0;
    let skin = 0;
    let outdoor = 0;
    let nearWhite = 0;
    let nearBlack = 0;
    const colorBuckets = new Set();

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = luminance(r, g, b);
      lumSum += lum;
      lumSq += lum * lum;
      if (isSkinPixel(r, g, b)) skin++;
      if (isOutdoorPixel(r, g, b)) outdoor++;
      if (lum > 235) nearWhite++;
      if (lum < 25) nearBlack++;
      colorBuckets.add(`${(r >> 4)},${(g >> 4)},${(b >> 4)}`);
    }

    const lumMean = lumSum / pixels;
    const lumVar = Math.max(0, lumSq / pixels - lumMean * lumMean);
    const lumStd = Math.sqrt(lumVar);
    const skinRatio = skin / pixels;
    const outdoorRatio = outdoor / pixels;
    const whiteRatio = nearWhite / pixels;
    const blackRatio = nearBlack / pixels;
    const documentScore = whiteRatio * blackRatio * 4;
    const uniqueColors = colorBuckets.size;

    if (lumStd < cfg.minColorVariance) {
      return fail('irrelevant', 'Photo looks blank or unusable. Capture the actual hazard.', 'moderation.blocked.irrelevant');
    }

    if (uniqueColors < cfg.minUniqueColors && lumStd < cfg.minColorVariance + 6) {
      return fail('irrelevant', 'Photo does not look like outdoor hazard evidence.', 'moderation.blocked.irrelevant');
    }

    if (
      documentScore > cfg.maxDocumentScore ||
      (whiteRatio > 0.28 && blackRatio > 0.035 && outdoorRatio < 0.07 && uniqueColors < 40) ||
      (whiteRatio > 0.38 && lumStd > 18 && outdoorRatio < 0.08)
    ) {
      return fail('sensitive', 'Avoid photos of documents, IDs, or screenshots. Show the hazard only.', 'moderation.blocked.sensitive');
    }

    if (skinRatio > cfg.maxSkinRatio && outdoorRatio < cfg.minOutdoorRatio) {
      return fail('irrelevant', 'Use a photo of the hazard — not a selfie or portrait.', 'moderation.blocked.irrelevant');
    }

    return pass({ lumStd, skinRatio, outdoorRatio, documentScore, uniqueColors });
  }

  function shouldSkipHeavyNsfw(cfg) {
    if (!cfg.nsfwEnabled) return true;
    // TF.js + nsfwjs is a large peak-RAM hit; Android camera launch already
    // competes for memory (system toast: "Unable to complete… low memory").
    try {
      if (cfg.nsfwForce === true) return false;
      if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory > 0 && navigator.deviceMemory <= 2) {
        return true;
      }
      if (/Android/i.test(navigator.userAgent || '') && cfg.nsfwOnAndroid !== true) {
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  async function classifyNsfw(source, cfg) {
    if (!cfg.nsfwEnabled) return pass({ nsfwSkipped: true });
    if (shouldSkipHeavyNsfw(cfg)) return pass({ nsfwSkipped: true, lowMemory: true });

    if (!navigator.onLine) {
      if (cfg.requireOnlineNsfw) {
        return fail('offline', 'Connect to the internet to verify photo safety.', 'moderation.blocked.offline');
      }
      return pass({ nsfwSkipped: true, offline: true });
    }

    try {
      const model = await loadNsfwModel(cfg);
      if (!model) return pass({ nsfwSkipped: true });
      const preds = await model.classify(source);
      const map = {};
      preds.forEach((p) => { map[p.className] = p.probability; });

      const adult =
        (map.Porn || 0) +
        (map.Hentai || 0) +
        Math.max(0, (map.Sexy || 0) - 0.35);

      if ((map.Porn || 0) >= cfg.nsfwThresholds.Porn) {
        return fail('nsfw', 'This photo was blocked for inappropriate content.', 'moderation.blocked.nsfw');
      }
      if ((map.Hentai || 0) >= cfg.nsfwThresholds.Hentai) {
        return fail('nsfw', 'This photo was blocked for inappropriate content.', 'moderation.blocked.nsfw');
      }
      if ((map.Sexy || 0) >= cfg.nsfwThresholds.Sexy) {
        return fail('nsfw', 'This photo was blocked for inappropriate content.', 'moderation.blocked.nsfw');
      }
      if (adult >= cfg.nsfwCombinedAdult) {
        return fail('nsfw', 'This photo was blocked for inappropriate content.', 'moderation.blocked.nsfw');
      }

      return pass({ nsfw: map });
    } catch {
      if (cfg.requireOnlineNsfw) {
        return fail('offline', 'Could not verify photo safety. Try again when online.', 'moderation.blocked.offline');
      }
      return pass({ nsfwSkipped: true, nsfwError: true });
    }
  }

  async function scanCanvas(canvas, cfgInput) {
    const cfg = mergeConfig(cfgInput);
    if (!cfg.enabled) return pass();

    if (!canvas || !canvas.getContext) {
      return fail('lowQuality', 'No photo to scan.', 'moderation.blocked.lowQuality');
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;

    const pixelResult = analyzePixels(ctx, width, height, cfg);
    if (!pixelResult.ok) return pixelResult;

    // nsfwjs's classify() accepts a canvas directly (it wraps tf.browser.fromPixels) —
    // no need to encode to a JPEG data URL and decode it back into an <img> first.
    const nsfwResult = await classifyNsfw(canvas, cfg);
    if (!nsfwResult.ok) return nsfwResult;

    return pass({ ...pixelResult, ...nsfwResult });
  }

  function clearPhotoCanvas(canvas, photoInput) {
    if (photoInput) photoInput.value = '';
    if (!canvas) return;
    canvas.classList.remove('visible');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  global.ImageModeration = {
    validateFile,
    scanCanvas,
    clearPhotoCanvas,
    mergeConfig,
  };
})(window);
