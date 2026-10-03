(function () {
  "use strict";

  const SELECTOR = '[data-plugin="parallax"] .svp-root';
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const bool = (value) => String(value).toLowerCase() === "true";
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function isIOSDevice() {
    const ua = String(navigator.userAgent || "");
    const platform = String(navigator.platform || "");
    return /iPad|iPhone|iPod/i.test(ua) || (platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1);
  }

  const PROFILE_PRESETS = {
    "cinema-smooth": { duration: 0, accel: 420, decel: 520, speed: 1.0, maxRate: 1.45, wheel: 38, cooldown: 150 },
    "cinema-premium": { duration: 0, accel: 560, decel: 680, speed: 0.92, maxRate: 1.28, wheel: 40, cooldown: 170 },
    "performance": { duration: 0, accel: 320, decel: 380, speed: 1.0, maxRate: 1.12, wheel: 46, cooldown: 190 },
    "mobile": { duration: 0, accel: 360, decel: 430, speed: 0.92, maxRate: 1.12, wheel: 34, cooldown: 150 }
  };

  function applyExperienceProfile(config, isMobile) {
    if (config.experienceProfile === "custom") return;
    const key = (isMobile && config.mobileAutoAdapt) ? "mobile" : (PROFILE_PRESETS[config.experienceProfile] ? config.experienceProfile : "cinema-smooth");
    const preset = PROFILE_PRESETS[key];
    config.cinematicDurationMs = preset.duration;
    config.cinematicAccelMs = preset.accel;
    config.cinematicDecelMs = preset.decel;
    config.cinematicSpeed = preset.speed;
    config.cinematicMaxRate = preset.maxRate;
    config.wheelThreshold = preset.wheel;
    config.gestureCooldown = preset.cooldown;
  }

  function normalizeMediaSource(value) {
    const source = String(value || "").trim();
    if (!source) return "";
    try {
      const url = new URL(source, document.baseURI);
      if (url.hostname.toLowerCase() === "github.com") {
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length >= 5 && (parts[2] === "raw" || parts[2] === "blob")) {
          const [owner, repo, , ...rest] = parts;
          if (owner && repo && rest.length) return `https://raw.githubusercontent.com/${owner}/${repo}/${rest.join("/")}${url.search || ""}`;
        }
      }
    } catch (_) {}
    return source;
  }

  function mediaMime(source) {
    const raw = String(source || "");
    const data = /^data:(video\/[^;,]+)/i.exec(raw);
    if (data) return data[1].toLowerCase();
    const clean = raw.split(/[?#]/)[0].toLowerCase();
    if (clean.endsWith(".webm")) return "video/webm";
    if (clean.endsWith(".mp4") || clean.endsWith(".m4v")) return "video/mp4";
    if (clean.endsWith(".mov")) return "video/quicktime";
    if (clean.endsWith(".ogv") || clean.endsWith(".ogg")) return "video/ogg";
    return "";
  }

  function mediaDuration(video) {
    const direct = Number(video?.duration);
    if (Number.isFinite(direct) && direct > 0) return direct;
    try {
      if (video?.seekable?.length) {
        const end = Number(video.seekable.end(video.seekable.length - 1));
        if (Number.isFinite(end) && end > 0) return end;
      }
    } catch (_) {}
    try {
      if (video?.buffered?.length) {
        const end = Number(video.buffered.end(video.buffered.length - 1));
        if (Number.isFinite(end) && end > 0) return end;
      }
    } catch (_) {}
    return 0;
  }

  function safeJSON(raw, fallback) {
    try { return JSON.parse(raw || ""); } catch (error) { console.warn("[Parallax] JSON inválido:", error); return fallback; }
  }

  function escapeHTML(value) {
    const node = document.createElement("div");
    node.textContent = String(value == null ? "" : value);
    return node.innerHTML;
  }

  function iconMarkup(value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    if (/^(?:fa[bsrltd]?\s+)?fa-[a-z0-9-]+(?:\s+fa-[a-z0-9-]+)*$/i.test(raw)) return `<i class="${escapeHTML(raw)}" aria-hidden="true"></i>`;
    return `<span aria-hidden="true">${escapeHTML(raw)}</span>`;
  }

  function parsePausePoints(raw) {
    return String(raw || "").split(/\n|,/).map((line) => {
      const [at, duration] = line.trim().split(":").map(Number);
      return Number.isFinite(at) && Number.isFinite(duration) && duration > 0 ? { at, duration } : null;
    }).filter(Boolean).sort((a, b) => a.at - b.at);
  }

  function parseBezier(raw, fallback = [0.42, 0, 0.58, 1]) {
    const values = String(raw || "").split(/[;,\s]+/).map(Number).filter(Number.isFinite);
    if (values.length !== 4) return fallback.slice();
    let [x1, y1, x2, y2] = values;
    x1 = clamp(x1, 0, 1); x2 = clamp(x2, 0, 1);
    y1 = clamp(y1, 0, 1); y2 = clamp(y2, 0, 1);
    if (x2 < x1) [x1, x2] = [x2, x1];
    if (y2 < y1) [y1, y2] = [y2, y1];
    return [x1, y1, x2, y2];
  }

  function bezierEase(progress, curve) {
    const x = clamp(progress, 0, 1);
    const [x1, y1, x2, y2] = curve;
    const sample = (t, a1, a2) => {
      const inv = 1 - t;
      return 3 * inv * inv * t * a1 + 3 * inv * t * t * a2 + t * t * t;
    };
    const derivative = (t, a1, a2) => {
      const inv = 1 - t;
      return 3 * inv * inv * a1 + 6 * inv * t * (a2 - a1) + 3 * t * t * (1 - a2);
    };

    let t = x;
    for (let i = 0; i < 6; i += 1) {
      const dx = sample(t, x1, x2) - x;
      const d = derivative(t, x1, x2);
      if (Math.abs(dx) < 1e-6 || Math.abs(d) < 1e-6) break;
      t = clamp(t - dx / d, 0, 1);
    }
    let low = 0, high = 1;
    for (let i = 0; i < 10; i += 1) {
      const sx = sample(t, x1, x2);
      if (Math.abs(sx - x) < 1e-6) break;
      if (sx < x) low = t; else high = t;
      t = (low + high) * 0.5;
    }
    return clamp(sample(t, y1, y2), 0, 1);
  }

  function buildVelocityLUT(curve, decelerating = false, steps = 180) {
    const values = new Float64Array(steps + 1);
    const area = new Float64Array(steps + 1);
    for (let i = 0; i <= steps; i += 1) {
      const u = i / steps;
      const eased = bezierEase(u, curve);
      values[i] = decelerating ? 1 - eased : eased;
      if (i > 0) area[i] = area[i - 1] + (values[i - 1] + values[i]) * 0.5 / steps;
    }
    return { steps, values, area, total: Math.max(1e-5, area[steps]) };
  }

  function velocityAreaAt(lut, progress) {
    const u = clamp(progress, 0, 1);
    const position = u * lut.steps;
    const i = Math.min(lut.steps - 1, Math.floor(position));
    const f = position - i;
    return lut.area[i] + (lut.area[i + 1] - lut.area[i]) * f;
  }

  function buildHero(point, index) {
    const article = document.createElement("article");
    const position = point.position || "center";
    const animation = point.animation || "fade";
    const align = ["left", "center", "right"].includes(point.align) ? point.align : "left";
    article.className = `svp-hero svp-align-${align}`;
    article.dataset.pointIndex = String(index);
    article.dataset.position = position;
    article.dataset.animation = animation;
    article.style.setProperty("--svp-width", `${number(point.width, 620)}px`);
    article.style.setProperty("--svp-opacity", String(clamp(number(point.opacity, 1), 0.1, 1)));
    if (point.fontFamily) article.style.setProperty("--svp-point-font", String(point.fontFamily));
    if (point.titleFontFamily) article.style.setProperty("--svp-title-font", String(point.titleFontFamily));
    if (point.textFontFamily) article.style.setProperty("--svp-text-font", String(point.textFontFamily));
    if (point.eyebrowFontFamily) article.style.setProperty("--svp-eyebrow-font", String(point.eyebrowFontFamily));
    if (Number.isFinite(Number(point.titleWeight))) article.style.setProperty("--svp-point-title-weight", String(clamp(number(point.titleWeight, 800), 300, 900)));
    if (Number.isFinite(Number(point.textWeight))) article.style.setProperty("--svp-point-text-weight", String(clamp(number(point.textWeight, 400), 300, 800)));
    if (Number.isFinite(Number(point.titleLineHeight))) article.style.setProperty("--svp-point-title-line-height", String(clamp(number(point.titleLineHeight, 0.98), 0.8, 1.5)));
    if (Number.isFinite(Number(point.textLineHeight))) article.style.setProperty("--svp-point-text-line-height", String(clamp(number(point.textLineHeight, 1.55), 1, 2.2)));
    if (point.titleTransform) article.style.setProperty("--svp-title-transform", String(point.titleTransform));
    if (point.textTransform) article.style.setProperty("--svp-text-transform", String(point.textTransform));
    article.setAttribute("aria-hidden", "true");
    if (bool(point.hideOnMobile)) article.classList.add("svp-hide-mobile");

    const parts = [];
    if (point.eyebrow || point.badge) parts.push(`<p class="svp-hero-eyebrow">${escapeHTML(point.eyebrow || point.badge)}</p>`);
    if (point.image) parts.push(`<img class="svp-hero-image" src="${escapeHTML(point.image)}" alt="${escapeHTML(point.imageAlt || "")}" loading="lazy">`);
    if (point.title) parts.push(`<h2 class="svp-hero-title">${escapeHTML(point.title)}</h2>`);
    if (point.subtitle) parts.push(`<p class="svp-hero-subtitle">${escapeHTML(point.subtitle)}</p>`);
    if (point.text) parts.push(`<p class="svp-hero-text">${escapeHTML(point.text)}</p>`);
    if (point.buttonText && point.buttonLink) parts.push(`<a class="svp-hero-button" href="${escapeHTML(point.buttonLink)}"${/^https?:/i.test(point.buttonLink) ? ' target="_blank" rel="noopener"' : ""}>${point.icon ? `${iconMarkup(point.icon)} ` : ""}${escapeHTML(point.buttonText)}</a>`);
    article.innerHTML = parts.join("");
    return article;
  }

  function init(root) {
    if (root.dataset.ready === "true") return;
    root.dataset.ready = "true";

    const video = root.querySelector(".svp-video");
    const sticky = root.querySelector(".svp-sticky");
    const poster = root.querySelector(".svp-poster");
    const loading = root.querySelector(".svp-loading");
    const percent = root.querySelector(".svp-loading-percent");
    const loadingLabel = root.querySelector(".svp-loading-label");
    const errorBox = root.querySelector(".svp-error");
    const contentLayer = root.querySelector(".svp-content-layer");
    const progressBar = root.querySelector(".svp-progress span");
    const hint = root.querySelector(".svp-scroll-hint");
    const hintLabel = root.querySelector(".svp-scroll-hint-label");
    const chaptersNav = root.querySelector(".svp-chapters");
    const debug = root.querySelector(".svp-debug-time");
    const skipButton = root.querySelector(".svp-skip");
    const restartButton = root.querySelector(".svp-restart");
    const soundButton = root.querySelector(".svp-sound");
    const toolbar = root.querySelector(".svp-toolbar");

    const config = {
      src: root.dataset.videoSrc || "",
      poster: root.dataset.poster || "",
      start: Math.max(0, number(root.dataset.startTime, 0)),
      end: Math.max(0.1, number(root.dataset.endTime, 30)),
      mediaDuration: Math.max(0, number(root.dataset.videoDuration, 0)),
      endAuto: root.dataset.endTimeAuto == null || root.dataset.endTimeAuto === "" ? true : bool(root.dataset.endTimeAuto),
      scrollHeight: Math.max(1500, number(root.dataset.scrollHeight, 8000)),
      smoothing: clamp(number(root.dataset.smoothing, 0.12), 0.01, 1),
      epsilon: clamp(number(root.dataset.timeEpsilon, 0.025), 0.005, 1),
      interactionMode: String(root.dataset.interactionMode || "cinematic").toLowerCase() === "continuous" ? "continuous" : "cinematic",
      forwardOnlyScroll: root.dataset.forwardOnlyScroll == null ? true : bool(root.dataset.forwardOnlyScroll),
      experienceProfile: String(root.dataset.experienceProfile || "cinema-smooth").toLowerCase(),
      preloadMode: String(root.dataset.preloadMode || "complete").toLowerCase(),
      restartOnReturnStart: root.dataset.restartOnReturnStart == null ? true : bool(root.dataset.restartOnReturnStart),
      restartOnReturnDelayMs: clamp(number(root.dataset.restartOnReturnDelayMs, 220), 0, 3000),
      autoStart: bool(root.dataset.autoStart),
      autoStartDelay: clamp(number(root.dataset.autoStartDelay, 1), 0, 30),
      cinematicDurationMs: clamp(number(root.dataset.cinematicDurationMs, 2600), 0, 10000),
      cinematicAccelMs: clamp(root.dataset.cinematicAccelMs ? number(root.dataset.cinematicAccelMs, 700) : number(root.dataset.cinematicRamp, 0.8) * 1000, 80, 5000),
      cinematicDecelMs: clamp(root.dataset.cinematicDecelMs ? number(root.dataset.cinematicDecelMs, 1100) : number(root.dataset.cinematicRamp, 0.8) * 1000, 80, 5000),
      cinematicAccelCurve: parseBezier(root.dataset.cinematicAccelCurve, [0.42, 0, 0.58, 1]),
      cinematicDecelCurve: parseBezier(root.dataset.cinematicDecelCurve, [0.42, 0, 0.58, 1]),
      cinematicSpeed: clamp(number(root.dataset.cinematicSpeed, 1), 0.35, 3),
      cinematicMaxRate: clamp(number(root.dataset.cinematicMaxRate, 2), 1, 4),
      timelineFps: clamp(Math.round(number(root.dataset.timelineFps, 30)), 1, 120),
      timelineSnap: root.dataset.timelineSnap == null ? true : bool(root.dataset.timelineSnap),
      wheelThreshold: clamp(number(root.dataset.wheelThreshold, 42), 8, 180),
      gestureCooldown: clamp(number(root.dataset.gestureCooldown, 180), 0, 1200),
      reverse: String(root.dataset.direction || "forward").toLowerCase() === "reverse",
      preload: root.dataset.preload || "auto",
      fit: root.dataset.fit || "cover",
      x: clamp(number(root.dataset.positionX, 50), 0, 100),
      y: clamp(number(root.dataset.positionY, 50), 0, 100),
      scaleDesktop: clamp(number(root.dataset.scaleDesktop, 1), 1, 2.5),
      mobileX: clamp(number(root.dataset.mobilePositionX, 50), 0, 100),
      mobileY: clamp(number(root.dataset.mobilePositionY, 50), 0, 100),
      scaleMobile: clamp(number(root.dataset.scaleMobile, 1.08), 1, 3),
      disableOnMobile: bool(root.dataset.disableMobile),
      mobileBreakpoint: clamp(number(root.dataset.mobileBreakpoint, 767), 320, 1200),
      mobileAutoAdapt: root.dataset.mobileAutoAdapt == null ? true : bool(root.dataset.mobileAutoAdapt),
      mobileTypographyScale: clamp(number(root.dataset.mobileTypographyScale, 0.82), 0.55, 1),
      bannerFontFamily: String(root.dataset.bannerFontFamily || "inherit"),
      bannerEyebrowSize: clamp(number(root.dataset.bannerEyebrowSize, 12), 8, 32),
      bannerTitleSize: clamp(number(root.dataset.bannerTitleSize, 56), 20, 120),
      bannerSubtitleSize: clamp(number(root.dataset.bannerSubtitleSize, 20), 12, 64),
      bannerTextSize: clamp(number(root.dataset.bannerTextSize, 16), 10, 40),
      bannerButtonSize: clamp(number(root.dataset.bannerButtonSize, 14), 10, 28),
      bannerTitleWeight: clamp(number(root.dataset.bannerTitleWeight, 800), 300, 900),
      bannerTextWeight: clamp(number(root.dataset.bannerTextWeight, 400), 300, 800),
      bannerTitleLineHeight: clamp(number(root.dataset.bannerTitleLineHeight, 0.98), 0.8, 1.5),
      bannerTextLineHeight: clamp(number(root.dataset.bannerTextLineHeight, 1.55), 1, 2.2),
      overlayColor: root.dataset.overlayColor || "#000000",
      overlayOpacity: clamp(number(root.dataset.overlayOpacity, 30), 0, 100),
      points: safeJSON(root.dataset.heroPoints, []),
      pauses: parsePausePoints(root.dataset.pausePoints)
    };

    /* loadedmetadata é a fonte definitiva. Antes dele, duração persistida e chaves
       evitam comprimir pontos de vídeos longos no fallback de 30 segundos. */
    if (config.endAuto) {
      const pointHint = Array.isArray(config.points) ? config.points.reduce((max, point) => Math.max(max, number(point?.startTime, 0), number(point?.endTime, 0)), 0) : 0;
      config.end = Math.max(config.end, config.mediaDuration, pointHint, config.start + 0.1);
    }
    if (config.end <= config.start) config.end = config.start + 1;
    const initialMobileViewport = window.innerWidth <= config.mobileBreakpoint;
    applyExperienceProfile(config, initialMobileViewport);
    config.accelLUT = buildVelocityLUT(config.cinematicAccelCurve, false);
    config.decelLUT = buildVelocityLUT(config.cinematicDecelCurve, true);
    root.style.setProperty("--svp-scroll-height", `${config.scrollHeight}px`);
    root.style.setProperty("--svp-fit", config.fit);
    root.style.setProperty("--svp-x", `${config.x}%`);
    root.style.setProperty("--svp-y", `${config.y}%`);
    root.style.setProperty("--svp-scale", config.scaleDesktop);
    root.style.setProperty("--svp-mobile-x", `${config.mobileX}%`);
    root.style.setProperty("--svp-mobile-y", `${config.mobileY}%`);
    root.style.setProperty("--svp-mobile-scale", config.scaleMobile);
    if (config.bannerFontFamily && !["inherit","preset","initial","unset","revert"].includes(String(config.bannerFontFamily).trim().toLowerCase())) {
      root.style.setProperty("--svp-banner-font", config.bannerFontFamily);
    } else {
      root.style.removeProperty("--svp-banner-font");
    }
    root.style.setProperty("--svp-title-weight", String(config.bannerTitleWeight));
    root.style.setProperty("--svp-text-weight", String(config.bannerTextWeight));
    root.style.setProperty("--svp-title-line-height", String(config.bannerTitleLineHeight));
    root.style.setProperty("--svp-text-line-height", String(config.bannerTextLineHeight));
    root.style.setProperty("--svp-mobile-typography-scale", String(config.mobileTypographyScale));
    const mobileQuery = window.matchMedia(`(max-width: ${config.mobileBreakpoint}px)`);
    const syncMobileVisibility = () => {
      const isMobile = mobileQuery.matches;
      root.classList.toggle("svp-is-mobile", isMobile);
      root.classList.toggle("svp-mobile-disabled", config.disableOnMobile && isMobile);
      if (config.experienceProfile !== "custom") {
        applyExperienceProfile(config, isMobile);
        config.accelLUT = buildVelocityLUT(config.cinematicAccelCurve, false);
        config.decelLUT = buildVelocityLUT(config.cinematicDecelCurve, true);
      }
      if (hintLabel) hintLabel.textContent = isMobile ? "Deslize para cima" : "Rolar para explorar";
    };
    syncMobileVisibility();
    if (mobileQuery.addEventListener) mobileQuery.addEventListener("change", syncMobileVisibility);
    const rgb = /^#([\da-f]{6})$/i.exec(config.overlayColor);
    const overlay = rgb ? `${parseInt(rgb[1].slice(0,2),16)},${parseInt(rgb[1].slice(2,4),16)},${parseInt(rgb[1].slice(4,6),16)}` : "0,0,0";
    root.style.setProperty("--svp-overlay", `rgba(${overlay},${config.overlayOpacity / 100})`);

    const controlFlags = {
      progress: root.dataset.showProgress,
      hint: root.dataset.showScrollHint,
      skip: root.dataset.showSkip,
      restart: root.dataset.showRestart,
      sound: root.dataset.showSound,
      chapters: root.dataset.showChapters
    };
    Object.entries(controlFlags).forEach(([name, value]) => {
      if (bool(value)) root.classList.add(`svp-show-${name}`);
    });
    if (bool(root.dataset.debugTime)) root.classList.add("svp-debug");

    /* A ordem cronológica é a fonte de verdade do runtime. O Inspector pode manter
       qualquer ordem no JSON, mas a execução entre várias chaves nunca depende dela. */
    const snapRuntimeTime = (value) => {
      const raw = Math.max(0, number(value, config.start));
      return config.timelineSnap ? Math.max(0, Math.round(raw * config.timelineFps) / config.timelineFps) : raw;
    };
    const startBoundaryTolerance = Math.max(0.001, 0.55 / Math.max(1, config.timelineFps));
    const points = (Array.isArray(config.points) ? config.points.filter((p) => p && Number.isFinite(Number(p.startTime))) : [])
      .map((point) => {
        const normalized = { ...point };
        normalized.startTime = snapRuntimeTime(point.startTime);
        const fallbackEnd = normalized.startTime + 4;
        normalized.endTime = Number.isFinite(Number(point.endTime)) ? Math.max(normalized.startTime, number(point.endTime, fallbackEnd)) : fallbackEnd;
        return normalized;
      })
      /* IN é limite da timeline, nunca banner. Presets 2.8.0 que tenham criado
         acidentalmente um banner exatamente no IN são ignorados pelo runtime. */
      .filter((point) => number(point.startTime, config.start) > config.start + startBoundaryTolerance)
      .sort((a, b) => number(a.startTime, 0) - number(b.startTime, 0) || String(a.id || "").localeCompare(String(b.id || "")));
    const heroElements = points.map((point, index) => {
      const hero = buildHero(point, index);
      contentLayer.appendChild(hero);
      return hero;
    });
    const chapterButtons = points.map((point, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "svp-chapter";
      button.title = point.title || `Capítulo ${index + 1}`;
      button.setAttribute("aria-label", button.title);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        cancelReturnRestart();
        cancelAutoStart(true);
        jumpToTimePaused(number(point.startTime, config.start), { intent:"chapter-marker" });
      });
      chaptersNav.appendChild(button);
      return button;
    });

    /* Ajuste tipográfico real ao frame. Não existe overflow:auto no banner: a fonte,
       padding, gaps, imagem e botão encolhem em conjunto até caber no viewport atual. */
    let heroFitRaf = 0;
    let heroResizeObserver = null;
    function heroBaseMetrics() {
      const w = Math.max(240, sticky?.clientWidth || window.innerWidth || 1280);
      const h = Math.max(180, sticky?.clientHeight || window.innerHeight || 720);
      const mobile = w <= config.mobileBreakpoint;
      return {
        mobile,
        pad: clamp(w * (mobile ? 0.045 : 0.024), mobile ? 12 : 18, mobile ? 24 : 38),
        gap: clamp(h * 0.018, 7, 14),
        eyebrow: clamp(w * (mobile ? 0.028 : 0.008), 9, mobile ? 13 : 14),
        title: clamp(w * (mobile ? 0.082 : 0.042), mobile ? 24 : 30, mobile ? 54 : 86),
        subtitle: clamp(w * (mobile ? 0.041 : 0.015), 13, mobile ? 20 : 23),
        text: clamp(w * (mobile ? 0.034 : 0.0125), 12.5, mobile ? 18 : 19),
        button: clamp(w * (mobile ? 0.032 : 0.011), 11, 16),
        buttonHeight: clamp(h * 0.065, 36, 48),
        imageHeight: clamp(h * 0.21, 72, 160),
        maxHeight: Math.max(120, h - (mobile ? 132 : 72))
      };
    }
    function applyHeroFit(hero, metrics, scale) {
      const px = (value, min = 1) => `${Math.max(min, value * scale).toFixed(2)}px`;
      hero.style.setProperty("--svp-card-pad", px(metrics.pad, 6));
      hero.style.setProperty("--svp-card-gap", px(metrics.gap, 4));
      hero.style.setProperty("--svp-eyebrow-size", px(metrics.eyebrow, 7));
      hero.style.setProperty("--svp-title-size", px(metrics.title, 10));
      hero.style.setProperty("--svp-subtitle-size", px(metrics.subtitle, 8));
      hero.style.setProperty("--svp-text-size", px(metrics.text, 8));
      hero.style.setProperty("--svp-button-size", px(metrics.button, 8));
      hero.style.setProperty("--svp-button-height", px(metrics.buttonHeight, 28));
      hero.style.setProperty("--svp-image-height", px(metrics.imageHeight, 42));
      hero.style.setProperty("--svp-card-max-h", `${metrics.maxHeight.toFixed(1)}px`);
      hero.dataset.fitScale = scale.toFixed(3);
    }
    function fitHero(hero) {
      if (!hero || !sticky) return;
      const base = heroBaseMetrics();
      const point = points[number(hero.dataset.pointIndex, 0)] || {};
      const mobileScale = base.mobile && config.mobileAutoAdapt ? config.mobileTypographyScale : 1;
      const pointMetric = (value, fallback) => { const parsed = number(value, 0); return parsed > 0 ? parsed : fallback; };
      const metrics = {
        ...base,
        eyebrow: clamp(pointMetric(point.eyebrowSize, config.bannerEyebrowSize) * mobileScale, 7, 48),
        title: clamp(pointMetric(point.titleSize, config.bannerTitleSize) * mobileScale, 14, 140),
        subtitle: clamp(pointMetric(point.subtitleSize, config.bannerSubtitleSize) * mobileScale, 10, 72),
        text: clamp(pointMetric(point.textSize, config.bannerTextSize) * mobileScale, 9, 48),
        button: clamp(pointMetric(point.buttonSize, config.bannerButtonSize) * mobileScale, 9, 32)
      };
      let scale = 1;
      applyHeroFit(hero, metrics, scale);
      for (let i = 0; i < 7; i += 1) {
        const ch = Math.max(1, hero.clientHeight), sh = Math.max(1, hero.scrollHeight);
        const cw = Math.max(1, hero.clientWidth), sw = Math.max(1, hero.scrollWidth);
        if (sh <= ch + 1 && sw <= cw + 1) break;
        const ratio = Math.min(ch / sh, cw / sw, 0.985);
        const next = clamp(scale * ratio * 0.965, 0.14, 1);
        if (Math.abs(next - scale) < 0.004) { scale = next; applyHeroFit(hero, metrics, scale); break; }
        scale = next;
        applyHeroFit(hero, metrics, scale);
      }
    }
    function fitHeroes() {
      heroFitRaf = 0;
      heroElements.forEach(fitHero);
    }
    function scheduleHeroFit() {
      if (heroFitRaf) return;
      heroFitRaf = requestAnimationFrame(fitHeroes);
    }
    heroElements.forEach((hero) => hero.querySelectorAll("img").forEach((img) => img.addEventListener("load", scheduleHeroFit, { once: true })));
    if ("ResizeObserver" in window && sticky) {
      heroResizeObserver = new ResizeObserver(scheduleHeroFit);
      heroResizeObserver.observe(sticky);
    } else {
      window.addEventListener("resize", scheduleHeroFit, { passive: true });
    }
    if (document.fonts?.ready) document.fonts.ready.then(scheduleHeroFit).catch(() => {});
    if (mobileQuery.addEventListener) mobileQuery.addEventListener("change", scheduleHeroFit);
    scheduleHeroFit();

    let targetTime = config.reverse ? config.end : config.start;
    let displayTime = targetTime;
    let duration = config.end;
    let metadataReady = false;
    let frameReady = false;
    let videoReady = false;
    let pendingSeek = null;
    let lastSeekAt = 0;
    let rafId = 0;
    let destroyed = false;
    let sectionVisible = true;
    let visibilityObserver = null;
    let lastDebugLabel = "";
    let lastProgressScale = -1;
    let lastHintOpacity = "";
    let cinematicAnimating = false;
    let cinematicRafId = 0;
    let cinematicFrameMode = "raf";
    let cinematicTime = null;
    let cinematicNative = false;
    let cinematicToken = 0;
    let lastPlaybackRate = 1;
    let wheelAccum = 0;
    let wheelQuietTimer = 0;
    let gestureArmed = true;
    let autoStartTimer = 0;
    let autoStartScheduled = false;
    let autoStartDone = false;
    let userInteracted = false;
    let touchStartY = null;
    let cinematicHandoffDirection = 0;
    let cinematicTravelDirection = 0;
    let cinematicIntent = "idle";
    let returnRestartTimer = 0;
    let exitBoundaryState = 0;
    let parkedAtTimelineStart = false;
    let ownsScroll = true;
    let scrollReleaseLatch = false;
    let scrollReleaseReason = "";
    let maxContinuousRaw = 0;
    const playbackEngine = isIOSDevice() ? "ios" : "default";
    let engineCleanup = null;
    root.dataset.playbackEngine = playbackEngine;
    root.classList.toggle("svp-engine-ios", playbackEngine === "ios");
    root.classList.toggle("svp-engine-default", playbackEngine === "default");
    root.dataset.scrollControl = "owned";
    root.dataset.scrollReleaseReason = "";

    function effectiveProgress(rawProgress) {
      if (!config.pauses.length) return rawProgress;
      const segment = config.end - config.start;
      const baseScroll = config.scrollHeight - window.innerHeight;
      const extra = config.pauses.reduce((sum, pause) => sum + pause.duration * 250, 0);
      const virtual = rawProgress * (baseScroll + extra);
      let consumed = 0;
      for (const pause of config.pauses) {
        const p = clamp((pause.at - config.start) / segment, 0, 1);
        const before = p * baseScroll + consumed;
        const hold = pause.duration * 250;
        if (virtual < before) return clamp((virtual - consumed) / baseScroll, 0, 1);
        if (virtual <= before + hold) return p;
        consumed += hold;
      }
      return clamp((virtual - consumed) / baseScroll, 0, 1);
    }

    function inverseEffectiveProgress(mappedProgress) {
      const target = clamp(mappedProgress, 0, 1);
      if (!config.pauses.length) return target;
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 30; i += 1) {
        const mid = (lo + hi) / 2;
        if (effectiveProgress(mid) < target) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    }

    function getScrollProgress() {
      const rect = root.getBoundingClientRect();
      const travel = Math.max(1, root.offsetHeight - window.innerHeight);
      return clamp(-rect.top / travel, 0, 1);
    }

    function rawProgressForTime(time) {
      const mapped = clamp((time - config.start) / Math.max(0.001, config.end - config.start), 0, 1);
      const directed = inverseEffectiveProgress(mapped);
      return config.reverse ? 1 - directed : directed;
    }

    function scrollToProgress(progress, behavior = "smooth") {
      const rootTop = window.scrollY + root.getBoundingClientRect().top;
      const travel = Math.max(1, root.offsetHeight - window.innerHeight);
      window.scrollTo({ top: rootTop + clamp(progress, 0, 1) * travel, behavior });
    }

    function boundaryTimeForPageDirection(direction) {
      if (direction > 0) return config.reverse ? config.start : config.end;
      return config.reverse ? config.end : config.start;
    }

    function isAtPageBoundary(direction, time = displayTime) {
      const tolerance = Math.max(0.04, 0.8 / Math.max(1, config.timelineFps));
      return Math.abs(number(time, boundaryTimeForPageDirection(direction)) - boundaryTimeForPageDirection(direction)) <= tolerance;
    }

    function resetGestureCapture() {
      if (wheelQuietTimer) { clearTimeout(wheelQuietTimer); wheelQuietTimer = 0; }
      wheelAccum = 0;
      gestureArmed = true;
    }

    function captureCurrentFrame() {
      const current = videoReady && Number.isFinite(Number(video.currentTime)) ? Number(video.currentTime) : displayTime;
      const t = clamp(number(current, displayTime), config.start, Math.min(config.end, duration || config.end));
      targetTime = displayTime = t;
      cinematicTime = null;
      pendingSeek = null;
      try { video.pause(); video.playbackRate = 1; } catch (_) {}
      updatePoints(t);
      return t;
    }

    function releaseScrollControl(reason = "external") {
      cancelReturnRestart();
      cancelAutoStart(true);
      const t = videoReady && Number.isFinite(Number(video.currentTime)) ? Number(video.currentTime) : displayTime;
      cancelCinematicAnimation();
      targetTime = displayTime = clamp(number(t, displayTime), config.start, Math.min(config.end, duration || config.end));
      cinematicTime = null;
      pendingSeek = null;
      try { video.pause(); video.playbackRate = 1; } catch (_) {}
      updatePoints(displayTime);
      ownsScroll = false;
      scrollReleaseLatch = true;
      scrollReleaseReason = String(reason || "external");
      root.dataset.scrollControl = "released";
      root.dataset.scrollReleaseReason = scrollReleaseReason;
      resetGestureCapture();
    }

    function acquireScrollControl(reason = "reentry") {
      ownsScroll = true;
      scrollReleaseLatch = false;
      scrollReleaseReason = "";
      exitBoundaryState = 0;
      root.dataset.exitState = "inside";
      root.dataset.scrollControl = "owned";
      root.dataset.scrollReleaseReason = "";
      resetGestureCapture();
    }

    function updateScrollOwnershipFromPosition() {
      const active = isSectionActive();
      if (ownsScroll) return active;
      if (scrollReleaseLatch) {
        if (!active) scrollReleaseLatch = false;
        return false;
      }
      if (active) {
        acquireScrollControl("reentry");
        return true;
      }
      return false;
    }

    function handoffPastStickyBoundary(direction) {
      if (!direction) return;
      releaseScrollControl(direction > 0 ? "terminal-out" : "terminal-before");
      const rootTop = window.scrollY + root.getBoundingClientRect().top;
      const travel = Math.max(1, root.offsetHeight - window.innerHeight);
      /* O sticky ainda é considerado ativo exatamente em 0%/100%. Avançar 8 px
         coloca a viewport inequivocamente fora da área capturada e permite que a
         inércia restante de wheel/trackpad/touch continue na página seguinte. */
      const edge = direction > 0 ? rootTop + travel + 8 : rootTop - 8;
      exitBoundaryState = direction;
      root.dataset.exitState = direction > 0 ? "after" : "before";
      resetGestureCapture();
      try { window.scrollTo({ top: Math.max(0, edge), behavior: "auto" }); } catch (_) { window.scrollTo(0, Math.max(0, edge)); }
    }

    function cancelCinematicAnimation() {
      cinematicToken += 1;
      if (engineCleanup) { try { engineCleanup(); } catch (_) {} engineCleanup = null; }
      root.classList.remove("svp-cinematic-running");
      if (cinematicRafId) {
        try {
          if (cinematicFrameMode === "video" && typeof video.cancelVideoFrameCallback === "function") video.cancelVideoFrameCallback(cinematicRafId);
          else cancelAnimationFrame(cinematicRafId);
        } catch (_) {}
      }
      cinematicRafId = 0;
      cinematicFrameMode = "raf";
      cinematicAnimating = false;
      cinematicTime = null;
      pendingSeek = null;
      cinematicHandoffDirection = 0;
      cinematicIntent = "idle";
      if (cinematicNative) {
        try { video.pause(); } catch (_) {}
      }
      cinematicNative = false;
      lastPlaybackRate = 1;
      try { video.playbackRate = 1; } catch (_) {}
    }

    function getCinematicStops() {
      const stops = [config.start];
      points.forEach((point) => {
        const at = number(point.startTime, config.start);
        if (at < config.start - 0.001 || at > config.end + 0.001) return;
        stops.push(clamp(at, config.start, config.end));
      });
      stops.push(config.end);
      return stops
        .sort((a, b) => a - b)
        .filter((value, index, list) => index === 0 || Math.abs(value - list[index - 1]) > 0.02);
    }

    function nextStopTime(direction, fromTime = displayTime) {
      const stops = getCinematicStops();
      const epsilon = 0.035;
      if (direction > 0) return stops.find((time) => time > fromTime + epsilon) ?? null;
      for (let i = stops.length - 1; i >= 0; i -= 1) {
        if (stops[i] < fromTime - epsilon) return stops[i];
      }
      return null;
    }

    function firstContentStop() {
      const stops = points
        .map((point) => number(point.startTime, config.start))
        .filter((time) => time >= config.start - 0.001 && time <= config.end + 0.001)
        .map((time) => clamp(time, config.start, config.end))
        .sort((a, b) => a - b);
      if (!stops.length) return null;
      return config.reverse ? stops[stops.length - 1] : stops[0];
    }

    function pointForTarget(targetTime) {
      return points.find((point) => Math.abs(number(point.startTime, config.start) - targetTime) <= 0.035) || null;
    }

    function transitionDurationMsForTarget(targetTime) {
      const match = pointForTarget(targetTime);
      const custom = match ? number(match.transitionMs, 0) : 0;
      return custom > 0 ? clamp(custom, 150, 20000) : config.cinematicDurationMs;
    }

    function cinematicProfile(distance, targetTime) {
      const d = Math.max(0, distance);
      const arrivalPoint = pointForTarget(targetTime);
      const pointDecelMs = arrivalPoint ? number(arrivalPoint.decelMs, 0) : 0;
      let accel = Math.max(0.08, config.cinematicAccelMs / 1000);
      let decel = Math.max(0.08, (pointDecelMs > 0 ? pointDecelMs : config.cinematicDecelMs) / 1000);
      const accelArea = config.accelLUT.total;
      const decelArea = config.decelLUT.total;
      const maxRate = Math.max(1, config.cinematicMaxRate);
      const requestedDurationMs = transitionDurationMsForTarget(targetTime);

      if (requestedDurationMs > 0) {
        const requestedTotal = Math.max(0.15, requestedDurationMs / 1000);
        const ramps = accel + decel;
        if (ramps > requestedTotal) {
          const scale = requestedTotal / ramps;
          accel *= scale;
          decel *= scale;
        }
        let cruiseTime = Math.max(0, requestedTotal - accel - decel);
        const unitDistance = Math.max(1e-5, accel * accelArea + cruiseTime + decel * decelArea);
        let peak = d / unitDistance;
        let total = requestedTotal;
        let stretched = false;

        /* Se a duração pedida exigir velocidade alta demais, manter o tempo exato
           provocaria descarte de frames. Priorizamos fluidez e alongamos somente o
           necessário, preservando as rampas de aceleração/desaceleração. */
        if (peak > maxRate) {
          peak = maxRate;
          const rampDistance = peak * (accel * accelArea + decel * decelArea);
          cruiseTime = Math.max(0, (d - rampDistance) / peak);
          total = accel + cruiseTime + decel;
          stretched = true;
        }
        return { accel, decel, cruiseTime, peak, total, requestedTotal, stretched, accelArea, decelArea };
      }

      const peakLimit = Math.min(config.cinematicSpeed, maxRate);
      const rampDistance = peakLimit * (accel * accelArea + decel * decelArea);
      if (d <= rampDistance) {
        const unitDistance = Math.max(1e-5, accel * accelArea + decel * decelArea);
        const peak = Math.min(maxRate, d / unitDistance);
        return { accel, decel, cruiseTime: 0, peak, total: accel + decel, requestedTotal: 0, stretched: false, accelArea, decelArea };
      }
      const cruiseTime = (d - rampDistance) / peakLimit;
      return { accel, decel, cruiseTime, peak: peakLimit, total: accel + cruiseTime + decel, requestedTotal: 0, stretched: false, accelArea, decelArea };
    }

    function cinematicDistanceAt(elapsed, profile) {
      const { accel, decel, cruiseTime, peak, total, accelArea } = profile;
      const t = clamp(elapsed, 0, total);
      const accelDistance = peak * accel * accelArea;
      if (t <= accel) {
        return peak * accel * velocityAreaAt(config.accelLUT, t / accel);
      }
      if (t <= accel + cruiseTime) {
        return accelDistance + peak * (t - accel);
      }
      const q = decel > 0 ? (t - accel - cruiseTime) / decel : 1;
      const decelDistance = peak * decel * velocityAreaAt(config.decelLUT, q);
      return accelDistance + peak * cruiseTime + decelDistance;
    }

    function cinematicVelocityAt(elapsed, profile) {
      const { accel, decel, cruiseTime, peak, total } = profile;
      const t = clamp(elapsed, 0, total);
      if (t <= accel) return peak * bezierEase(accel > 0 ? t / accel : 1, config.cinematicAccelCurve);
      if (t <= accel + cruiseTime) return peak;
      const q = decel > 0 ? (t - accel - cruiseTime) / decel : 1;
      return peak * (1 - bezierEase(q, config.cinematicDecelCurve));
    }

    function finishCinematic(target, token) {
      if (destroyed || token !== cinematicToken) return;
      if (engineCleanup) { try { engineCleanup(); } catch (_) {} engineCleanup = null; }
      root.classList.remove("svp-cinematic-running");
      try { video.pause(); } catch (_) {}
      try { video.playbackRate = 1; } catch (_) {}
      lastPlaybackRate = 1;
      cinematicNative = false;
      cinematicAnimating = false;
      cinematicRafId = 0;
      targetTime = displayTime = target;
      cinematicTime = target;
      pendingSeek = null;
      /* No iOS evitamos micro-seeks: o decoder do Safari pode engasgar mesmo com
         correções muito pequenas. Só reposicionamos quando o erro final é visível. */
      const finalSeekTolerance = playbackEngine === "ios" ? 0.12 : 0.006;
      if (videoReady && Math.abs(video.currentTime - target) > finalSeekTolerance) {
        try { video.currentTime = target; } catch (_) {}
      }
      scrollToProgress(rawProgressForTime(target), "auto");
      updatePoints(target);
      const handoffDirection = cinematicHandoffDirection;
      const arrivalIntent = cinematicIntent;
      const returnedToStart = cinematicTravelDirection < 0 && Math.abs(target - config.start) <= Math.max(0.04, 0.8 / Math.max(1, config.timelineFps));
      cinematicHandoffDirection = 0;
      cinematicTravelDirection = 0;
      cinematicIntent = "idle";
      const releasedAtBanner = releaseAtMarkedBanner(target);
      if (releasedAtBanner) {
        exitBoundaryState = 0;
        root.dataset.exitState = "inside";
      } else if (returnedToStart && arrivalIntent === "gesture" && config.restartOnReturnStart && !config.reverse) {
        releaseTimelineStartPark();
        exitBoundaryState = 0;
        root.dataset.exitState = "inside";
        scheduleRestartFromTimelineStart();
      } else {
        if (!isAtPageBoundary(-1, target)) releaseTimelineStartPark();
        if (handoffDirection && isAtPageBoundary(handoffDirection, target)) {
          handoffPastStickyBoundary(handoffDirection);
        } else {
          exitBoundaryState = 0;
          root.dataset.exitState = "inside";
        }
      }
      window.setTimeout(() => { if (!cinematicAnimating && token === cinematicToken) cinematicTime = null; }, 60);
    }

    function runSeekTransition(from, target, profile, direction, distance, token) {
      const startedAt = performance.now();
      cinematicNative = false;
      cinematicFrameMode = "raf";
      const tick = (now) => {
        if (destroyed || !cinematicAnimating || token !== cinematicToken) return;
        const elapsed = (now - startedAt) / 1000;
        const travelled = Math.min(distance, cinematicDistanceAt(elapsed, profile));
        const current = clamp(from + direction * travelled, config.start, config.end);
        cinematicTime = current;
        targetTime = displayTime = current;
        /* O scroll físico não acompanha cada frame. window.scrollTo() durante a
           reprodução força layout/paint e compete com o decoder. A posição da
           página é sincronizada somente na chegada à chave. */
        if (elapsed >= profile.total || travelled >= distance - 0.0005) {
          finishCinematic(target, token);
          return;
        }
        cinematicRafId = requestAnimationFrame(tick);
      };
      cinematicRafId = requestAnimationFrame(tick);
    }

    function runNativeForwardTransition(from, target, profile, distance, token) {
      let startedAt = 0;
      let lastRateAt = 0;
      let startGuardTimer = 0;
      let lastQualityAt = 0;
      let qualityTotal = 0;
      let qualityDropped = 0;
      let adaptiveRateCap = config.cinematicMaxRate;
      let smoothedRate = 1;
      cinematicNative = true;
      pendingSeek = null;

      /* Playback muito lento parece travamento porque o navegador precisa repetir
         frames do arquivo. Mantemos movimento perceptualmente contínuo e fazemos
         a parada limpa somente ao chegar à chave. */
      const nativeRateFloor = mobileQuery.matches ? 0.62 : 0.55;

      const frameTolerance = Math.max(0.004, 0.55 / Math.max(1, config.timelineFps));
      const scheduleTick = (tick) => {
        if (typeof video.requestVideoFrameCallback === "function") {
          cinematicFrameMode = "video";
          cinematicRafId = video.requestVideoFrameCallback(tick);
        } else {
          cinematicFrameMode = "raf";
          cinematicRafId = requestAnimationFrame((now) => tick(now, null));
        }
      };

      const beginPlayback = () => {
        if (startGuardTimer) { clearTimeout(startGuardTimer); startGuardTimer = 0; }
        if (destroyed || !cinematicAnimating || token !== cinematicToken) return;
        try {
          const initialVelocity = cinematicVelocityAt(0.001, profile) || nativeRateFloor;
          video.playbackRate = clamp(initialVelocity, nativeRateFloor, adaptiveRateCap);
        } catch (_) {}
        lastPlaybackRate = video.playbackRate || nativeRateFloor;
        smoothedRate = lastPlaybackRate;
        if (typeof video.getVideoPlaybackQuality === "function") {
          try {
            const q = video.getVideoPlaybackQuality();
            qualityTotal = number(q.totalVideoFrames, 0);
            qualityDropped = number(q.droppedVideoFrames, 0);
          } catch (_) {}
        }

        const tick = (now, metadata) => {
          if (destroyed || !cinematicAnimating || token !== cinematicToken) return;
          const elapsed = Math.max(0, (now - startedAt) / 1000);
          const curveElapsed = Math.min(elapsed, profile.total);
          const desiredTravel = Math.min(distance, cinematicDistanceAt(curveElapsed, profile));
          const desiredTime = Math.min(target, from + desiredTravel);
          const mediaTime = metadata && Number.isFinite(metadata.mediaTime) ? metadata.mediaTime : number(video.currentTime, desiredTime);
          const actualTime = clamp(mediaTime, from, Math.max(from, target));
          const remaining = target - actualTime;

          cinematicTime = actualTime;
          targetTime = displayTime = actualTime;

          /* O scroll físico fica estacionado durante a tomada. Atualizá-lo a cada
             callback de vídeo causava reflow e microtravadas, sobretudo no mobile. */

          /* Só declaramos chegada quando o decoder realmente apresentou o frame da
             chave (ou chegou a menos de meio frame). Isso elimina correções visíveis
             antecipadas em transições com vários pontos. */
          if (remaining <= frameTolerance || mediaTime >= target) {
            finishCinematic(target, token);
            return;
          }

          let baseRate;
          if (elapsed < profile.total) baseRate = cinematicVelocityAt(curveElapsed, profile);
          else baseRate = Math.max(nativeRateFloor, remaining / 0.18);

          /* Controle adaptativo: se o decoder começar a descartar frames, reduzimos
             gradualmente o teto da etapa. Quando estabiliza, o teto se recupera. */
          if (typeof video.getVideoPlaybackQuality === "function" && now - lastQualityAt >= 450) {
            lastQualityAt = now;
            try {
              const q = video.getVideoPlaybackQuality();
              const total = number(q.totalVideoFrames, qualityTotal);
              const dropped = number(q.droppedVideoFrames, qualityDropped);
              const totalDelta = Math.max(0, total - qualityTotal);
              const dropDelta = Math.max(0, dropped - qualityDropped);
              qualityTotal = total;
              qualityDropped = dropped;
              if (totalDelta >= 8) {
                const ratio = dropDelta / totalDelta;
                if (ratio >= 0.08) adaptiveRateCap = Math.max(1, adaptiveRateCap - 0.18);
                else if (ratio <= 0.01) adaptiveRateCap = Math.min(config.cinematicMaxRate, adaptiveRateCap + 0.05);
              }
            } catch (_) {}
          }

          const drift = desiredTime - actualTime;
          const terminalWindow = Math.max(frameTolerance * 3, nativeRateFloor * 0.11);
          const minRate = remaining <= terminalWindow ? 0.22 : nativeRateFloor;
          const desiredRate = clamp(baseRate + drift * 1.15, minRate, adaptiveRateCap);

          /* Alterar playbackRate dezenas de vezes por segundo pode produzir jitter
             no próprio pipeline de mídia. Aplicamos low-pass e atualizamos em ritmo
             mais baixo, suficiente para uma rampa visualmente contínua. */
          smoothedRate += (desiredRate - smoothedRate) * 0.42;
          const correctedRate = clamp(smoothedRate, minRate, adaptiveRateCap);
          if (now - lastRateAt >= 72 && Math.abs(correctedRate - lastPlaybackRate) >= 0.035) {
            try { video.playbackRate = correctedRate; lastPlaybackRate = correctedRate; lastRateAt = now; } catch (_) {}
          }

          const hardTimeout = profile.total + Math.max(1.2, profile.total * 0.75);
          if (elapsed >= hardTimeout) {
            finishCinematic(target, token);
            return;
          }
          scheduleTick(tick);
        };

        const playPromise = video.play();
        if (playPromise && typeof playPromise.then === "function") {
          playPromise.then(() => {
            if (destroyed || !cinematicAnimating || token !== cinematicToken) return;
            startedAt = performance.now();
            scheduleTick(tick);
          }).catch(() => {
            cinematicNative = false;
            cinematicFrameMode = "raf";
            runSeekTransition(from, target, profile, 1, distance, token);
          });
        } else {
          startedAt = performance.now();
          scheduleTick(tick);
        }
      };

      /* Nunca iniciamos play() enquanto o navegador ainda está buscando a chave
         anterior. Com muitos pontos, esse era um dos principais motivos de saltos. */
      const needsPositioning = Math.abs(number(video.currentTime, from) - from) > frameTolerance * 1.5;
      if (needsPositioning) {
        try { video.pause(); video.currentTime = from; } catch (_) {}
        const onSeeked = () => beginPlayback();
        video.addEventListener("seeked", onSeeked, { once: true });
        startGuardTimer = window.setTimeout(() => {
          try { video.removeEventListener("seeked", onSeeked); } catch (_) {}
          beginPlayback();
        }, 320);
      } else beginPlayback();
    }

    function runIOSForwardTransition(from, target, profile, distance, token) {
      cinematicNative = true;
      pendingSeek = null;
      cinematicFrameMode = "raf";
      const tolerance = Math.max(0.045, 1.6 / Math.max(24, config.timelineFps));
      const iosRate = clamp(config.cinematicSpeed || 1, 0.86, 1.05);
      let raf = 0;
      let frameCb = 0;
      let startedAt = 0;
      let buffering = false;
      let stalledAt = 0;

      const cleanup = () => {
        if (raf) cancelAnimationFrame(raf);
        if (frameCb && typeof video.cancelVideoFrameCallback === "function") {
          try { video.cancelVideoFrameCallback(frameCb); } catch (_) {}
        }
        ["waiting","stalled","seeking","seeked","playing","canplay"].forEach((type) => {
          try { video.removeEventListener(type, mediaStateHandler); } catch (_) {}
        });
        raf = 0;
        frameCb = 0;
      };
      engineCleanup = cleanup;

      function mediaStateHandler(event) {
        if (destroyed || token !== cinematicToken) return;
        if (event.type === "waiting" || event.type === "stalled" || event.type === "seeking") {
          buffering = true;
          stalledAt = performance.now();
          root.dataset.decoderState = event.type;
        } else {
          buffering = false;
          root.dataset.decoderState = "playing";
        }
      }
      ["waiting","stalled","seeking","seeked","playing","canplay"].forEach((type) => {
        video.addEventListener(type, mediaStateHandler, { passive: true });
      });

      const updateFromMedia = (mediaTime) => {
        const actual = clamp(number(mediaTime, video.currentTime), from, target);
        cinematicTime = actual;
        targetTime = displayTime = actual;
        if (target - actual <= tolerance || actual >= target) {
          finishCinematic(target, token);
          return false;
        }
        return true;
      };

      const schedule = () => {
        if (destroyed || !cinematicAnimating || token !== cinematicToken) return;
        if (typeof video.requestVideoFrameCallback === "function") {
          cinematicFrameMode = "video";
          frameCb = video.requestVideoFrameCallback((now, meta) => {
            cinematicRafId = frameCb;
            const mediaTime = meta && Number.isFinite(meta.mediaTime) ? meta.mediaTime : video.currentTime;
            if (!updateFromMedia(mediaTime)) return;
            /* Safari pode ficar em waiting sem emitir stalled. Não criamos novos seeks;
               apenas aguardamos o decoder recuperar e mantemos uma única transição. */
            if (buffering && stalledAt && now - stalledAt > 1800) root.dataset.decoderState = "recovering";
            schedule();
          });
          cinematicRafId = frameCb;
        } else {
          cinematicFrameMode = "raf";
          raf = requestAnimationFrame((now) => {
            cinematicRafId = raf;
            if (!updateFromMedia(video.currentTime)) return;
            if (buffering && stalledAt && now - stalledAt > 1800) root.dataset.decoderState = "recovering";
            schedule();
          });
          cinematicRafId = raf;
        }
      };

      const begin = () => {
        if (destroyed || !cinematicAnimating || token !== cinematicToken) return;
        try { video.playbackRate = iosRate; } catch (_) {}
        lastPlaybackRate = iosRate;
        startedAt = performance.now();
        root.dataset.decoderState = "starting";
        const promise = video.play();
        if (promise && typeof promise.then === "function") {
          promise.then(() => { root.dataset.decoderState = "playing"; schedule(); }).catch(() => {
            /* Se autoplay/play falhar, usa o fallback existente, mas não mistura os
               dois motores ao mesmo tempo. */
            cleanup();
            engineCleanup = null;
            cinematicNative = false;
            runSeekTransition(from, target, profile, 1, distance, token);
          });
        } else schedule();
      };

      /* No iOS só posicionamos o ponto inicial quando realmente necessário. Depois
         disso não há micro-seeks durante o avanço cinematográfico. */
      const startError = Math.abs(number(video.currentTime, from) - from);
      if (startError > 0.18) {
        try { video.pause(); video.currentTime = from; } catch (_) {}
        const onSeeked = () => begin();
        video.addEventListener("seeked", onSeeked, { once: true });
        const guard = window.setTimeout(() => {
          try { video.removeEventListener("seeked", onSeeked); } catch (_) {}
          begin();
        }, 420);
        const previousCleanup = engineCleanup;
        engineCleanup = () => { clearTimeout(guard); previousCleanup(); };
      } else begin();
    }

    function runPlaybackEngine(from, target, profile, direction, distance, token) {
      if (direction > 0 && videoReady) {
        if (playbackEngine === "ios") runIOSForwardTransition(from, target, profile, distance, token);
        else runNativeForwardTransition(from, target, profile, distance, token);
        return;
      }
      /* O reverso continua por seek controlado. Safari/iOS não oferece playbackRate
         negativo confiável; a fila de seek já é limitada pelo frame loop global. */
      runSeekTransition(from, target, profile, direction, distance, token);
    }

    function animateToTime(time, options = {}) {
      const target = clamp(number(time, config.start), config.start, Math.min(config.end, duration || config.end));
      const currentVideoTime = videoReady && Number.isFinite(video.currentTime) ? video.currentTime : displayTime;
      const from = clamp(Math.abs(currentVideoTime - displayTime) < 0.35 ? currentVideoTime : displayTime, config.start, Math.min(config.end, duration || config.end));
      cancelReturnRestart();
      cancelCinematicAnimation();
      cinematicHandoffDirection = Number(options.handoffDirection) || 0;
      cinematicTravelDirection = target > from ? 1 : (target < from ? -1 : 0);
      cinematicIntent = String(options.intent || "programmatic");
      if (ownsScroll) {
        exitBoundaryState = 0;
        root.dataset.exitState = "inside";
      }

      const distance = Math.abs(target - from);
      const pageStart = boundaryTimeForPageDirection(-1);
      const movingAwayFromStart = Math.abs(from - pageStart) <= Math.max(0.04, 0.8 / Math.max(1, config.timelineFps)) && Math.abs(target - pageStart) > 0.035;
      if (movingAwayFromStart) releaseTimelineStartPark();
      if (distance < 0.015) {
        targetTime = displayTime = target;
        cinematicTime = null;
        if (videoReady && Math.abs(video.currentTime - target) > 0.006) { try { video.currentTime = target; } catch (_) {} }
        scrollToProgress(rawProgressForTime(target), "auto");
        updatePoints(target);
        const handoffDirection = cinematicHandoffDirection;
        const arrivalIntent = cinematicIntent;
        const returnedToStart = cinematicTravelDirection < 0 && Math.abs(target - config.start) <= Math.max(0.04, 0.8 / Math.max(1, config.timelineFps));
        cinematicHandoffDirection = 0;
        cinematicTravelDirection = 0;
        cinematicIntent = "idle";
        if (releaseAtMarkedBanner(target)) {
          exitBoundaryState = 0;
          root.dataset.exitState = "inside";
        } else if (returnedToStart && arrivalIntent === "gesture" && config.restartOnReturnStart && !config.reverse) scheduleRestartFromTimelineStart();
        else if (handoffDirection && isAtPageBoundary(handoffDirection, target)) handoffPastStickyBoundary(handoffDirection);
        return false;
      }

      const direction = target > from ? 1 : -1;
      const profile = cinematicProfile(distance, target);
      const token = ++cinematicToken;
      cinematicAnimating = true;
      cinematicTime = from;
      updatePoints(from); /* oculta imediatamente o banner da chave de origem */

      root.classList.add("svp-cinematic-running");
      runPlaybackEngine(from, target, profile, direction, distance, token);
      return true;
    }

    function pointAtTime(time) {
      const tolerance = Math.max(0.04, 0.8 / Math.max(1, config.timelineFps));
      return points.find((point) => Math.abs(number(point.startTime, -999999) - number(time, -999999)) <= tolerance) || null;
    }

    function releaseAtMarkedBanner(time, reason = "banner-release") {
      const point = pointAtTime(time);
      if (!point || !bool(point.releaseScroll)) return false;
      releaseScrollControl(reason);
      root.dataset.releaseBanner = String(point.id || "");
      return true;
    }

    function jumpToTimePaused(time, options = {}) {
      cancelReturnRestart();
      cancelAutoStart(true);
      cancelCinematicAnimation();
      const t = clamp(number(time, config.start), config.start, Math.min(config.end, duration || config.end));
      targetTime = displayTime = t;
      cinematicTime = null;
      pendingSeek = null;
      try { video.pause(); video.playbackRate = 1; video.currentTime = t; } catch (_) {}
      scrollToProgress(rawProgressForTime(t), "auto");
      updatePoints(t);
      root.dataset.lastJumpIntent = String(options.intent || "direct");
      return true;
    }

    function scrollToTime(time, options = {}) {
      if (options && options.instant) return jumpToTimePaused(time, options);
      if (config.interactionMode === "cinematic") return animateToTime(time, options);
      const linear = clamp((time - config.start) / (config.end - config.start), 0, 1);
      scrollToProgress(config.reverse ? 1 - linear : linear);
      return true;
    }

    function isSectionActive() {
      const rect = root.getBoundingClientRect();
      return rect.top <= 2 && rect.bottom >= window.innerHeight - 2;
    }

    function cancelAutoStart(markInteraction = false) {
      if (autoStartTimer) clearTimeout(autoStartTimer);
      autoStartTimer = 0;
      autoStartScheduled = false;
      if (markInteraction) userInteracted = true;
    }

    function parkAtTimelineStart(time = displayTime) {
      const pageStart = boundaryTimeForPageDirection(-1);
      const tolerance = Math.max(0.04, 0.8 / Math.max(1, config.timelineFps));
      if (Math.abs(number(time, pageStart) - pageStart) > tolerance) return false;
      cancelAutoStart(true);
      autoStartDone = true;
      parkedAtTimelineStart = true;
      root.dataset.parkedStart = "true";
      targetTime = displayTime = pageStart;
      cinematicTime = null;
      pendingSeek = null;
      try { video.pause(); video.playbackRate = 1; } catch (_) {}
      if (videoReady && Math.abs(number(video.currentTime, pageStart) - pageStart) > 0.006) {
        try { video.currentTime = pageStart; } catch (_) {}
      }
      updatePoints(pageStart);
      return true;
    }

    function releaseTimelineStartPark() {
      if (!parkedAtTimelineStart) return;
      parkedAtTimelineStart = false;
      root.dataset.parkedStart = "false";
    }

    function cancelReturnRestart() {
      if (returnRestartTimer) clearTimeout(returnRestartTimer);
      returnRestartTimer = 0;
    }

    function scheduleRestartFromTimelineStart() {
      if (!ownsScroll || !config.restartOnReturnStart || config.reverse || destroyed) return false;
      const tolerance = Math.max(0.04, 0.8 / Math.max(1, config.timelineFps));
      if (Math.abs(displayTime - config.start) > tolerance) return false;
      const target = nextStopTime(1, config.start);
      if (target == null || Math.abs(target - config.start) <= 0.035) return false;
      cancelReturnRestart();
      parkedAtTimelineStart = false;
      root.dataset.parkedStart = "false";
      root.dataset.returnRestart = "pending";
      returnRestartTimer = window.setTimeout(() => {
        returnRestartTimer = 0;
        if (destroyed || cinematicAnimating || Math.abs(displayTime - config.start) > tolerance * 1.5) return;
        root.dataset.returnRestart = "running";
        animateToTime(target, { intent:"return-to-first" });
      }, config.restartOnReturnDelayMs);
      return true;
    }

    function maybeScheduleAutoStart() {
      if (!ownsScroll || config.interactionMode !== "cinematic" || !config.autoStart || autoStartDone || autoStartScheduled || userInteracted || parkedAtTimelineStart || !videoReady || !isSectionActive()) return;
      autoStartScheduled = true;
      autoStartTimer = window.setTimeout(() => {
        autoStartTimer = 0;
        autoStartScheduled = false;
        if (destroyed || !ownsScroll || userInteracted || !isSectionActive()) return;
        const target = firstContentStop();
        autoStartDone = true;
        const initial = config.reverse ? config.end : config.start;
        if (target == null || Math.abs(target - initial) <= 0.035) return;
        animateToTime(target, { intent:"auto-start" });
      }, config.autoStartDelay * 1000);
    }

    function timeDirectionForGesture(direction) {
      return config.reverse ? -direction : direction;
    }

    function goToStep(direction) {
      if (direction > 0) releaseTimelineStartPark();
      const target = nextStopTime(timeDirectionForGesture(direction), displayTime);
      if (target == null) {
        if (isAtPageBoundary(direction, displayTime)) handoffPastStickyBoundary(direction);
        return false;
      }
      const terminal = Math.abs(target - boundaryTimeForPageDirection(direction)) <= Math.max(0.035, 0.8 / Math.max(1, config.timelineFps));
      return animateToTime(target, { handoffDirection: terminal ? direction : 0, intent:"gesture" });
    }

    function updatePoints(time) {
      let current = -1;
      if (config.interactionMode === "cinematic") {
        /* No modo cinematográfico o banner pertence à CHAVE, não a um intervalo.
           Durante A→B todos ficam ocultos; ao pausar em B aparece somente o banner B. */
        if (!cinematicAnimating) {
          const tolerance = Math.max(0.018, 0.65 / Math.max(1, config.timelineFps));
          let bestDistance = Infinity;
          points.forEach((point, index) => {
            const distance = Math.abs(number(point.startTime, config.start) - time);
            if (distance <= tolerance && distance < bestDistance) {
              bestDistance = distance;
              current = index;
            }
          });
        }
      } else {
        /* Compatibilidade: no modo contínuo startTime/endTime seguem sendo a janela
           visual do card. */
        points.forEach((point, index) => {
          if (time >= Number(point.startTime) && time <= Number(point.endTime)) current = index;
        });
      }

      points.forEach((point, index) => {
        const active = index === current;
        const hero = heroElements[index];
        const changed = hero.classList.contains("svp-active") !== active;
        if (changed) hero.classList.toggle("svp-active", active);
        const ariaHidden = String(!active);
        if (hero.getAttribute("aria-hidden") !== ariaHidden) hero.setAttribute("aria-hidden", ariaHidden);
        if (active && changed) fitHero(hero);
      });
      const cardStandby = config.interactionMode === "cinematic" && !cinematicAnimating && current >= 0;
      root.dataset.cardStandby = cardStandby ? "true" : "false";
      root.classList.toggle("svp-card-standby", cardStandby);
      if (hint) hint.classList.toggle("svp-card-standby-hint", cardStandby);

      chapterButtons.forEach((button, index) => {
        const active = index === current;
        if (button.classList.contains("svp-current") !== active) button.classList.toggle("svp-current", active);
      });
      root.dataset.activePoint = current >= 0 ? String(points[current].id || current) : "";
      root.classList.toggle("svp-in-transition", cinematicAnimating);
    }

    function applyPointBoomerang(baseTime) {
      /*
       * v1.4 — boomerangue independente do intervalo visual do Hero.
       * - boomerangAtTime: segundo exato onde o loop começa.
       * - boomerangSpan: tamanho do trecho A→B em segundos do vídeo.
       * - boomerangDuration: janela, em segundos da linha de tempo, reservada ao loop.
       * - boomerangCycles: quantidade de idas/voltas dentro da janela.
       * O movimento continua totalmente determinístico pelo scroll: não há autoplay escondido.
       */
      const point = points.find((item) => {
        if (!bool(item.boomerang)) return false;
        const at = number(item.boomerangAtTime, number(item.startTime, config.start));
        const hold = Math.max(0.1, number(item.boomerangDuration, Math.max(1, number(item.boomerangSeconds, 1.5) * 2)));
        return baseTime >= at && baseTime <= at + hold;
      });
      if (!point) return baseTime;

      const at = clamp(number(point.boomerangAtTime, number(point.startTime, config.start)), config.start, config.end);
      const maxSpan = Math.max(0.05, config.end - at);
      const span = clamp(number(point.boomerangSpan, number(point.boomerangSeconds, 1.5)), 0.05, maxSpan);
      const hold = Math.max(0.1, number(point.boomerangDuration, Math.max(span * 2, 1)));
      const cycles = clamp(Math.round(number(point.boomerangCycles, number(point.boomerangRepeats, 2))), 1, 30);
      const local = clamp((baseTime - at) / hold, 0, 1);
      const phase = local * cycles * 2;
      const cycle = phase % 2;
      const triangle = cycle <= 1 ? cycle : 2 - cycle;
      return clamp(at + triangle * span, config.start, config.end);
    }

    function frame() {
      rafId = 0;
      if (destroyed) return;
      if (document.hidden || (!sectionVisible && !cinematicAnimating)) return;

      /* Durante uma tomada cinematográfica, ler getBoundingClientRect() em todo
         RAF força layout sem necessidade. O tempo do vídeo já é a fonte da verdade. */
      const raw = (config.interactionMode === "cinematic" && cinematicAnimating)
        ? rawProgressForTime(displayTime)
        : getScrollProgress();
      updateScrollOwnershipFromPosition();
      if (ownsScroll && exitBoundaryState && isSectionActive()) {
        exitBoundaryState = 0;
        root.dataset.exitState = "inside";
      }

      if (cinematicAnimating && cinematicNative && videoReady) {
        cinematicTime = clamp(number(video.currentTime, displayTime), config.start, Math.min(config.end, duration));
        targetTime = displayTime = cinematicTime;
      } else if (cinematicAnimating && cinematicTime != null) {
        targetTime = displayTime = cinematicTime;
      } else if (config.interactionMode === "continuous") {
        const directionalRaw = config.forwardOnlyScroll ? Math.max(maxContinuousRaw, raw) : raw;
        if (config.forwardOnlyScroll) maxContinuousRaw = directionalRaw;
        const mapped = effectiveProgress(config.reverse ? 1 - directionalRaw : directionalRaw);
        const linearTime = config.start + mapped * (config.end - config.start);
        targetTime = applyPointBoomerang(linearTime);
        displayTime += (targetTime - displayTime) * config.smoothing;
        if (Math.abs(targetTime - displayTime) < 0.001) displayTime = targetTime;
      } else {
        /* Cinematográfico: a posição física do scroll NÃO recalcula o tempo do vídeo.
           A chave atual fica travada até um gesto solicitar a próxima transição. */
        targetTime = displayTime;
      }

      if (videoReady && !cinematicNative && Math.abs(video.currentTime - displayTime) >= config.epsilon) {
        const desired = clamp(displayTime, config.start, Math.min(config.end, duration));
        const now = performance.now();
        /*
         * Limita seeks para não saturar o decoder. O valor mais recente substitui
         * qualquer seek pendente; não existe fila de frames atrasados.
         */
        const seekInterval = cinematicAnimating
          ? (config.experienceProfile === "performance" ? 52 : (config.preloadMode === "complete" ? (mobileQuery.matches ? 40 : 34) : 46))
          : 50;
        pendingSeek = desired;
        if (!video.seeking && now - lastSeekAt >= seekInterval) {
          const nextSeek = pendingSeek;
          pendingSeek = null;
          lastSeekAt = now;
          try {
            if (!cinematicAnimating && typeof video.fastSeek === "function" && Math.abs(video.currentTime - nextSeek) > 0.22) video.fastSeek(nextSeek);
            else video.currentTime = nextSeek;
          } catch (_) { pendingSeek = nextSeek; }
        }
      } else if (videoReady && Math.abs(video.currentTime - displayTime) < config.epsilon) {
        pendingSeek = null;
      }

      updatePoints(displayTime);
      const mediaProgress = clamp((displayTime - config.start) / Math.max(0.001, config.end - config.start), 0, 1);
      const visibleProgress = config.interactionMode === "cinematic" ? mediaProgress : raw;
      if (Math.abs(visibleProgress - lastProgressScale) >= 0.0015) {
        progressBar.style.transform = `scaleX(${visibleProgress})`;
        lastProgressScale = visibleProgress;
      }
      if (hint) {
        const cardStandby = root.dataset.cardStandby === "true";
        /* Em modo cinematográfico o hint pertence ao estado de espera do card.
           Ele some durante a transição e volta sempre que uma chave/card fica parado. */
        const shouldShowHint = cardStandby || visibleProgress <= 0.035;
        const hintOpacity = shouldShowHint ? (cardStandby ? ".96" : ".8") : "0";
        if (hintOpacity !== lastHintOpacity) { hint.style.opacity = hintOpacity; lastHintOpacity = hintOpacity; }
      }
      const debugLabel = `${displayTime.toFixed(2)} s`;
      if (debugLabel !== lastDebugLabel) {
        debug.textContent = debugLabel;
        lastDebugLabel = debugLabel;
      }
      maybeScheduleAutoStart();
      rafId = requestAnimationFrame(frame);
    }

    let seekableWaitStarted = 0;
    function updateReadyState() {
      if (!metadataReady || !frameReady) return;
      /* Alguns MP4/WebM expõem duration antes de seekable. Damos uma pequena
         janela para o índice chegar, mas não bloqueamos indefinidamente a prévia. */
      if (!video.seekable || video.seekable.length === 0) {
        if (!seekableWaitStarted) seekableWaitStarted = performance.now();
        if (performance.now() - seekableWaitStarted < 1800) {
          loadingLabel.textContent = "Preparando navegação por frames…";
          window.setTimeout(updateReadyState, 120);
          return;
        }
      }
      if (videoReady) return;
      videoReady = true;
      root.classList.add("svp-video-ready", "svp-loaded");
      const initial = clamp(config.reverse ? config.end : config.start, 0, duration);
      try { video.currentTime = initial; } catch (_) {}
      loadingLabel.textContent = "Experiência pronta";
      percent.textContent = "100%";
      errorBox.hidden = true;
    }

    function notifyHostMetadata() {
      if (window.parent === window) return;
      const section = root.closest("[data-section-id]");
      const sectionId = section?.dataset.sectionId || root.dataset.sectionId || "";
      const detail = { sectionId, duration, startTime: config.start, endTime: config.end, endTimeAuto: config.endAuto };
      /* postMessage funciona mesmo quando a prévia está em sandbox sem allow-same-origin. */
      try { window.parent.postMessage({ type:"parallax-metadata", detail }, "*"); } catch (_) {}
      /* Compatibilidade com hosts antigos que permitiam acesso direto ao documento pai. */
      try { window.parent.document.dispatchEvent(new window.parent.CustomEvent("svp:metadata", { detail })); } catch (_) {}
    }

    function onMetadata() {
      const detectedDuration = mediaDuration(video);
      duration = detectedDuration || Math.max(config.end, config.mediaDuration);
      config.mediaDuration = detectedDuration || config.mediaDuration;
      const minGap = Math.max(0.01, 1 / Math.max(1, config.timelineFps));
      config.start = clamp(config.start, 0, Math.max(0, duration - minGap));
      config.end = config.endAuto
        ? duration
        : clamp(config.end, Math.min(duration, config.start + minGap), duration);
      if (config.end <= config.start) config.end = Math.min(duration, config.start + minGap);
      root.dataset.videoDuration = String(duration);
      root.dataset.startTime = String(config.start);
      root.dataset.endTime = String(config.end);
      if (!cinematicAnimating) { targetTime = displayTime = config.reverse ? config.end : config.start; cinematicTime = null; }
      chapterButtons.forEach((button,index)=>{const at=number(points[index]?.startTime,-1);button.hidden=at<config.start-0.001||at>config.end+0.001});
      if (detectedDuration > 0) notifyHostMetadata();
      metadataReady = detectedDuration > 0;
      loadingLabel.textContent = "Carregando primeiro frame…";
      /* Um play/pause silencioso após gesto não é necessário na maioria dos browsers,
         mas ajuda WebKit a inicializar o pipeline de decodificação. */
      const prime = video.play();
      if (prime && typeof prime.then === "function") {
        prime.then(() => { video.pause(); }).catch(() => {});
      }
      updateReadyState();
    }

    function onFrameReady() {
      frameReady = true;
      if (!metadataReady) {
        const lateDuration = mediaDuration(video);
        if (lateDuration > 0) onMetadata();
      }
      loadingLabel.textContent = "Preparando navegação por frames…";
      updateReadyState();
    }

    function fail() {
      if (root.dataset.mediaFailed === "true") return;
      root.dataset.mediaFailed = "true";
      root.classList.add("svp-loaded");
      errorBox.hidden = false;
      const source = config.src || "(não informado)";
      const mediaError = video.error;
      const code = mediaError ? mediaError.code : 0;
      const reason = ({1:"carregamento interrompido",2:"erro de rede",3:"erro de decodificação/codec",4:"formato ou fonte não suportada"})[code] || "fonte indisponível";
      errorBox.textContent = `Vídeo indisponível (${reason}). Fonte: ${source}`;
      loadingLabel.textContent = "Usando imagem de fallback";
      console.error("[Parallax] Falha de mídia", { source, code, networkState: video.networkState, readyState: video.readyState, error: mediaError });
    }

    function updateBuffered() {
      if (!video.duration || !video.buffered.length) return;
      const buffered = video.buffered.end(video.buffered.length - 1);
      percent.textContent = `${Math.round(clamp(buffered / video.duration, 0, 1) * 100)}%`;
    }

    function flushPendingSeek() {
      /* O próximo RAF consome apenas o seek mais recente, respeitando o limite de taxa. */
      if (destroyed || pendingSeek == null || !videoReady || document.hidden || !sectionVisible) return;
      if (!rafId) rafId = requestAnimationFrame(frame);
    }

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = config.preloadMode === "metadata" ? "metadata" : "auto";
    video.poster = config.poster;
    let sourceNode = null;
    let preloadObjectUrl = "";
    let preloadController = null;

    video.addEventListener("loadedmetadata", onMetadata, { once: true });
    video.addEventListener("durationchange", () => { if (!metadataReady && mediaDuration(video) > 0) onMetadata(); });
    video.addEventListener("loadeddata", onFrameReady, { once: true });
    video.addEventListener("canplay", onFrameReady, { once: true });
    video.addEventListener("seeked", flushPendingSeek);
    video.addEventListener("progress", updateBuffered);
    video.addEventListener("error", fail, { once: true });

    function mountVideoSource(source, originalSource = source) {
      if (destroyed) return;
      sourceNode = document.createElement("source");
      sourceNode.src = source;
      const mime = mediaMime(originalSource);
      if (mime) sourceNode.type = mime;
      sourceNode.addEventListener("error", fail, { once: true });
      video.replaceChildren(sourceNode);
      video.load();
      window.setTimeout(() => {
        if (!videoReady && (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE || video.error)) fail();
      }, 8000);
    }

    async function preloadCompleteVideo(resolvedSource) {
      if (/^(?:data:|blob:)/i.test(resolvedSource)) {
        percent.textContent = "100%";
        return mountVideoSource(resolvedSource, resolvedSource);
      }
      loadingLabel.textContent = "Carregando vídeo completo…";
      percent.textContent = "0%";
      preloadController = typeof AbortController !== "undefined" ? new AbortController() : null;
      const response = await fetch(resolvedSource, { cache:"force-cache", signal:preloadController?.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const total = Math.max(0, number(response.headers.get("content-length"), 0));
      const contentType = response.headers.get("content-type") || mediaMime(resolvedSource) || "video/mp4";
      let blob;
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value?.byteLength) {
            chunks.push(value);
            received += value.byteLength;
            if (total > 0) percent.textContent = `${Math.round(clamp(received / total, 0, 1) * 100)}%`;
            else percent.textContent = `${(received / 1048576).toFixed(1)} MB`;
          }
        }
        blob = new Blob(chunks, { type:contentType });
      } else {
        blob = await response.blob();
      }
      if (destroyed) return;
      preloadObjectUrl = URL.createObjectURL(blob);
      percent.textContent = "100%";
      loadingLabel.textContent = "Vídeo carregado. Preparando frames…";
      mountVideoSource(preloadObjectUrl, resolvedSource);
    }

    if (config.src) {
      /* No modo completo a experiência só é liberada depois de o arquivo inteiro
         existir em memória/Blob. Assim o percurso não disputa rede com o decoder. */
      const resolvedSource = normalizeMediaSource(config.src);
      if (config.preloadMode === "complete") {
        preloadCompleteVideo(resolvedSource).catch((error) => {
          if (destroyed || error?.name === "AbortError") return;
          console.warn("[Parallax] Preload completo indisponível; usando streaming nativo.", error);
          loadingLabel.textContent = "Preload completo indisponível. Usando buffer inteligente…";
          percent.textContent = "…";
          mountVideoSource(resolvedSource, resolvedSource);
        });
      } else {
        mountVideoSource(resolvedSource, resolvedSource);
      }
    } else {
      fail();
    }

    function normalizedWheelDelta(event) {
      const scale = event.deltaMode === 1 ? 16 : (event.deltaMode === 2 ? window.innerHeight : 1);
      return event.deltaY * scale;
    }

    function armGestureAfterQuiet() {
      if (wheelQuietTimer) clearTimeout(wheelQuietTimer);
      wheelQuietTimer = window.setTimeout(() => {
        gestureArmed = true;
        wheelAccum = 0;
      }, config.gestureCooldown);
    }

    function onWheel(event) {
      if (!ownsScroll) { updateScrollOwnershipFromPosition(); if (!ownsScroll) return; }
      if (config.interactionMode !== "cinematic" || (config.disableOnMobile && mobileQuery.matches) || !isSectionActive()) return;
      const delta = normalizedWheelDelta(event);
      if (Math.abs(delta) < 0.01) return;
      const direction = delta > 0 ? 1 : -1;
      if (config.forwardOnlyScroll && direction < 0) {
        event.preventDefault();
        cancelAutoStart(true);
        resetGestureCapture();
        return;
      }
      const candidate = nextStopTime(timeDirectionForGesture(direction), displayTime);

      /* No início/fim não capturamos o gesto. Além disso, empurramos a viewport
         alguns pixels para fora do sticky para que trackpads com inércia não fiquem
         oscilando exatamente no limite da seção. */
      if (candidate == null && !cinematicAnimating) {
        if (isAtPageBoundary(direction, displayTime)) handoffPastStickyBoundary(direction);
        return;
      }

      event.preventDefault();
      cancelAutoStart(true);
      armGestureAfterQuiet();
      if (cinematicAnimating || !gestureArmed) return;

      wheelAccum += delta;
      if (Math.abs(wheelAccum) < config.wheelThreshold) return;
      const stepDirection = wheelAccum > 0 ? 1 : -1;
      wheelAccum = 0;
      gestureArmed = false;
      goToStep(stepDirection);
    }

    function onTouchStart(event) {
      if (!ownsScroll) { updateScrollOwnershipFromPosition(); if (!ownsScroll) return; }
      if (config.interactionMode !== "cinematic" || !isSectionActive() || !event.touches?.length) return;
      touchStartY = event.touches[0].clientY;
      cancelAutoStart(true);
    }

    function onTouchMove(event) {
      if (!ownsScroll) return;
      if (config.interactionMode !== "cinematic" || touchStartY == null || !isSectionActive() || !event.touches?.length) return;
      const delta = touchStartY - event.touches[0].clientY;
      const direction = delta >= 0 ? 1 : -1;
      if (config.forwardOnlyScroll && direction < 0) { event.preventDefault(); return; }
      if (cinematicAnimating || nextStopTime(timeDirectionForGesture(direction), displayTime) != null) event.preventDefault();
    }

    function onTouchEnd(event) {
      if (!ownsScroll || config.interactionMode !== "cinematic" || touchStartY == null || !isSectionActive()) { touchStartY = null; return; }
      const endY = event.changedTouches?.[0]?.clientY;
      if (!Number.isFinite(endY)) { touchStartY = null; return; }
      const delta = touchStartY - endY;
      touchStartY = null;
      if (Math.abs(delta) < 34 || cinematicAnimating || !gestureArmed) return;
      const direction = delta > 0 ? 1 : -1;
      if (config.forwardOnlyScroll && direction < 0) return;
      if (nextStopTime(timeDirectionForGesture(direction), displayTime) == null) {
        if (isAtPageBoundary(direction, displayTime)) handoffPastStickyBoundary(direction);
        return;
      }
      gestureArmed = false;
      armGestureAfterQuiet();
      goToStep(direction);
    }

    function onKeyDown(event) {
      if (!ownsScroll) { updateScrollOwnershipFromPosition(); if (!ownsScroll) return; }
      if (!root.matches(":hover") && !root.contains(document.activeElement) && !isSectionActive()) return;
      if (config.interactionMode === "cinematic") {
        if (["ArrowDown", "PageDown"].includes(event.key)) {
          if (nextStopTime(timeDirectionForGesture(1), displayTime) != null) { event.preventDefault(); cancelAutoStart(true); goToStep(1); }
          else if (isAtPageBoundary(1, displayTime)) handoffPastStickyBoundary(1);
          return;
        }
        if (["ArrowUp", "PageUp"].includes(event.key)) {
          if (config.forwardOnlyScroll) { event.preventDefault(); cancelAutoStart(true); return; }
          if (nextStopTime(timeDirectionForGesture(-1), displayTime) != null) { event.preventDefault(); cancelAutoStart(true); goToStep(-1); }
          else if (isAtPageBoundary(-1, displayTime)) handoffPastStickyBoundary(-1);
          return;
        }
        if (event.key === "Home") { event.preventDefault(); cancelAutoStart(true); cancelReturnRestart(); animateToTime(config.start, { handoffDirection: -1, intent:"keyboard-home" }); return; }
        if (event.key === "End") { event.preventDefault(); cancelAutoStart(true); cancelReturnRestart(); animateToTime(config.end, { intent:"keyboard-end" }); return; }
      }
      if (["ArrowDown", "PageDown"].includes(event.key)) { event.preventDefault(); scrollToProgress(getScrollProgress() + 0.08); }
      if (["ArrowUp", "PageUp"].includes(event.key)) { event.preventDefault(); if (!config.forwardOnlyScroll) scrollToProgress(getScrollProgress() - 0.08); }
      if (event.key === "Home") { event.preventDefault(); scrollToProgress(0); }
      if (event.key === "End") { event.preventDefault(); scrollToProgress(1); }
    }

    skipButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      cancelReturnRestart();
      cancelAutoStart(true);
      cancelCinematicAnimation();

      /* PULAR usa a mesma chave marcada como "libera scroll" no editor.
         O salto é instantâneo e pausado: mostra exatamente o frame/banner
         parametrizado e aplica a mesma liberação usada pela navegação normal. */
      const releasePoint = points.find((point) => bool(point.releaseScroll));
      if (releasePoint) {
        const t = number(releasePoint.startTime, config.start);
        jumpToTimePaused(t, { intent:"control-skip-release" });
        parkedAtTimelineStart = false;
        root.dataset.parkedStart = "false";
        root.dataset.returnRestart = "false";
        releaseAtMarkedBanner(t, "control-skip-release");
        return;
      }

      /* Compatibilidade: sem chave de liberação configurada, mantém o
         comportamento legado de ir ao OUT e entregar a próxima seção. */
      const t = boundaryTimeForPageDirection(1);
      cinematicIntent = "control-skip";
      targetTime = displayTime = t;
      cinematicTime = null;
      pendingSeek = null;
      parkedAtTimelineStart = false;
      root.dataset.parkedStart = "false";
      root.dataset.returnRestart = "false";
      try { video.pause(); video.playbackRate = 1; video.currentTime = t; } catch (_) {}
      updatePoints(t);
      scrollToProgress(1, "auto");
      cinematicIntent = "idle";
      handoffPastStickyBoundary(1);
    });
    restartButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      cancelReturnRestart();
      cancelAutoStart(true);
      cancelCinematicAnimation();
      const t = boundaryTimeForPageDirection(-1);
      cinematicIntent = "control-restart";
      targetTime = displayTime = t;
      cinematicTime = null;
      pendingSeek = null;
      try { video.pause(); video.playbackRate = 1; video.currentTime = t; } catch (_) {}
      scrollToProgress(0, "auto");
      updatePoints(t);
      cinematicIntent = "idle";
      /* Reiniciar é o único controle que deliberadamente relança a primeira etapa. */
      if (!config.reverse && config.restartOnReturnStart) scheduleRestartFromTimelineStart();
    });
    soundButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      video.muted = !video.muted;
      soundButton.textContent = video.muted ? "Som" : "Mudo";
      soundButton.setAttribute("aria-label", video.muted ? "Ativar som" : "Desativar som");
      if (!video.muted) { try { await video.play(); video.pause(); } catch (_) { video.muted = true; } }
    });

    if (toolbar) {
      ["pointerdown","pointerup","touchstart","touchend"].forEach((type) => {
        toolbar.addEventListener(type, (event) => event.stopPropagation(), { passive:true });
      });
    }

    function anchorTargetsThisComponent(anchor) {
      if (!anchor) return false;
      const rawHref = String(anchor.getAttribute("href") || "").trim();
      if (!rawHref || rawHref === "#") return false;
      let url;
      try { url = new URL(rawHref, document.baseURI); } catch (_) { return false; }
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return false;
      let target = null;
      try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch (_) {}
      if (!target) return false;
      const section = root.closest("[data-section-id], section[id], [id]");
      return target === root || root.contains(target) || target === section || !!section?.contains(target);
    }

    function onDocumentAnchorClick(event) {
      if (!ownsScroll || event.defaultPrevented && !isSectionActive()) return;
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor || anchorTargetsThisComponent(anchor)) return;
      if (!isSectionActive() && !cinematicAnimating) return;
      /* A liberação acontece no capture, antes do menu/roteador executar o scroll
         da âncora. Assim nenhum RAF, wheel preventDefault ou retorno automático do
         Parallax disputa a navegação solicitada pelo usuário. */
      releaseScrollControl("external-anchor");
    }

    document.addEventListener("click", onDocumentAnchorClick, true);
    window.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("keydown", onKeyDown);

    const onVisibilityChange = () => {
      if (document.hidden && cinematicAnimating) {
        const t = clamp(number(video.currentTime, displayTime), config.start, Math.min(config.end, duration || config.end));
        cancelCinematicAnimation();
        targetTime = displayTime = t;
        updatePoints(t);
        return;
      }
      if (!document.hidden && sectionVisible && !destroyed && !rafId) rafId = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    if ("IntersectionObserver" in window) {
      visibilityObserver = new IntersectionObserver((entries) => {
        sectionVisible = entries.some((entry) => entry.isIntersecting);
        if (!sectionVisible && !ownsScroll && scrollReleaseLatch) scrollReleaseLatch = false;
        if (sectionVisible) updateScrollOwnershipFromPosition();
        if (sectionVisible && !document.hidden && !destroyed && !rafId) rafId = requestAnimationFrame(frame);
      }, { rootMargin: "240px 0px" });
      visibilityObserver.observe(root);
    }

    updatePoints(displayTime);
    rafId = requestAnimationFrame(frame);
    root._svpAPI = {
      previewTime(time) {
        cancelCinematicAnimation();
        try { video.pause(); video.playbackRate = 1; } catch (_) {}
        /* Scrub do editor usa o vídeo completo para permitir escolher novos IN/OUT. */
        const fullEnd = Math.max(0, duration || config.mediaDuration || config.end);
        const t = clamp(number(time, config.start), 0, fullEnd);
        targetTime = displayTime = t;
        try { video.currentTime = t; } catch (_) {}
        updatePoints(t);
        debug.textContent = `${t.toFixed(2)} s`;
      },
      scrollToTime,
      next() { return goToStep(1); },
      previous() { return goToStep(-1); },
      getTime() { return displayTime; },
      getDuration() { return duration || config.mediaDuration || config.end; },
      getRange() { return { start: config.start, end: config.end }; }
    };
    const onHostPreviewMessage = (event) => {
      const data = event?.data;
      if (!data || data.type !== "parallax-preview-time") return;
      const section = root.closest("[data-section-id]");
      const sectionId = section?.dataset.sectionId || root.dataset.sectionId || "";
      if (data.sectionId && sectionId && String(data.sectionId) !== String(sectionId)) return;
      root._svpAPI?.previewTime?.(data.time);
    };
    window.addEventListener("message", onHostPreviewMessage);
    root._svpDestroy = () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      cancelCinematicAnimation();
      cancelAutoStart(false);
      cancelReturnRestart();
      if (wheelQuietTimer) clearTimeout(wheelQuietTimer);
      window.removeEventListener("wheel", onWheel);
      document.removeEventListener("click", onDocumentAnchorClick, true);
      window.removeEventListener("message", onHostPreviewMessage);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      visibilityObserver?.disconnect();
      heroResizeObserver?.disconnect?.();
      if (heroFitRaf) cancelAnimationFrame(heroFitRaf);
      window.removeEventListener("resize", scheduleHeroFit);
      if (mobileQuery.removeEventListener) {
        mobileQuery.removeEventListener("change", syncMobileVisibility);
        mobileQuery.removeEventListener("change", scheduleHeroFit);
      }
      try { preloadController?.abort?.(); } catch (_) {}
      video.pause();
      video.removeAttribute("src");
      if (sourceNode) sourceNode.remove();
      video.load();
      if (preloadObjectUrl) { try { URL.revokeObjectURL(preloadObjectUrl); } catch (_) {} preloadObjectUrl = ""; }
      delete root._svpAPI;
    };
  }


  function boot() { document.querySelectorAll(SELECTOR).forEach(init); }
  /* A prévia do framework é recriada como documento completo. Um MutationObserver
     global aqui era desnecessário e podia ser acionado pelo próprio HUD a cada frame. */
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
})();
