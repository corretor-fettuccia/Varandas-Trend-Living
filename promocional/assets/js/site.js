(function(){
  // 5.9.1 — bloqueio global de zoom para preservar composição e hit-areas no mobile.
  // Single-touch continua livre para scroll, sliders e Parallax; somente gestos de zoom são interceptados.
  function isMobilePointer(){
    try{return matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints>0}catch(_error){return navigator.maxTouchPoints>0}
  }
  ['gesturestart','gesturechange','gestureend'].forEach(function(type){
    document.addEventListener(type,function(event){if(isMobilePointer())event.preventDefault()},{passive:false});
  });
  document.addEventListener('touchmove',function(event){
    if(isMobilePointer() && event.touches && event.touches.length>1)event.preventDefault();
  },{passive:false});
  document.addEventListener('dblclick',function(event){
    if(isMobilePointer())event.preventDefault();
  },{passive:false});
  const CTA_SELECTOR = [
    '[data-design-role="cta"]',
    '.button-primary','.btn-primary','.opp-cta','.svp-hero-button','.formsenderCSS_button','.spp-cta','.pit-glass-cta','.pp-flip-cta','.btn-flip','.btn-flipFake',
    '.fsp-result a[data-fsp-cta]',
    'a[class*="__cta"]','button[class*="__cta"]','a[class*="-cta"]','button[class*="-cta"]','a[class*="_cta"]','button[class*="_cta"]',
    'a[class*="call-to-action"]','button[class*="call-to-action"]'
  ].join(',');
  function buttonEffect(){return cssVar(document.documentElement,'--action-button-effect','depth')||'depth'}
  function buttonClickEffect(){return cssVar(document.documentElement,'--action-button-click-effect','press')||'press'}
  function decorateCTA(el){
    if(!(el instanceof Element))return;
    el.classList.add('imobify-design-cta');
    el.dataset.imobifyEffect=buttonEffect();
  }
  function parseColor(value){
    const raw=String(value||'').trim();
    let m=raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if(m){let hex=m[1];if(hex.length===3)hex=hex.split('').map(c=>c+c).join('');return {r:parseInt(hex.slice(0,2),16),g:parseInt(hex.slice(2,4),16),b:parseInt(hex.slice(4,6),16)}}
    m=raw.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if(m)return {r:+m[1],g:+m[2],b:+m[3]};
    return null;
  }
  function hex(rgb){const h=v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');return '#'+h(rgb.r)+h(rgb.g)+h(rgb.b)}
  function lum(value){const rgb=parseColor(value);if(!rgb)return null;const c=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return c(rgb.r)*.2126+c(rgb.g)*.7152+c(rgb.b)*.0722}
  function ratio(a,b){const x=lum(a),y=lum(b);if(x==null||y==null)return 1;return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
  function mix(a,b,t){const x=parseColor(a),y=parseColor(b);if(!x||!y)return a;t=Math.max(0,Math.min(1,Number(t)||0));return hex({r:x.r+(y.r-x.r)*t,g:x.g+(y.g-x.g)*t,b:x.b+(y.b-x.b)*t})}
  function safest(background){return ratio('#ffffff',background)>=ratio('#000000',background)?'#ffffff':'#000000'}
  function ensureContrast(preferred,background,minimum){
    minimum=Number(minimum)||4.5;
    if(!parseColor(preferred)||!parseColor(background)||ratio(preferred,background)>=minimum)return preferred;
    const target=safest(background);
    for(let step=1;step<=20;step++){const candidate=mix(preferred,target,step/20);if(ratio(candidate,background)>=minimum)return candidate}
    return target;
  }
  function cssVar(el,name,fallback=''){return (getComputedStyle(el).getPropertyValue(name)||fallback).trim()}
  function contrastEnabled(){return cssVar(document.documentElement,'--contrast-enabled','1')!=='0'}
  function contrastMinimum(){return Number(cssVar(document.documentElement,'--contrast-min','4.5'))||4.5}
  function setSafe(el,name,preferred,background){if(!el||!contrastEnabled())return;el.style.setProperty(name,ensureContrast(preferred,background,contrastMinimum()))}
  function applyDesignSemantics(root){
    const scope=root&&root.querySelectorAll?root:document;
    const pluginRoots=[];
    if(scope instanceof Element){
      const owner=scope.closest('[data-plugin]');
      if(owner)pluginRoots.push(owner);
    }
    if(scope.querySelectorAll)scope.querySelectorAll('[data-plugin]').forEach(el=>pluginRoots.push(el));
    [...new Set(pluginRoots)].forEach(function(plugin){
      plugin.querySelectorAll('h1,h2,h3,h4,h5,h6,[data-design-role=\"title\"]').forEach(function(el){
        el.classList.add('imobify-design-title');
      });
      plugin.querySelectorAll('.hero-copy,.svp-hero-subtitle,[class$=\"__subtitle\"],[class$=\"-subtitle\"],[class$=\"_subtitle\"],[class$=\"__subheading\"],[class$=\"-subheading\"],[class$=\"_subheading\"],[data-design-role=\"subtitle\"]').forEach(function(el){
        el.classList.add('imobify-design-subtitle');
      });
      plugin.querySelectorAll('h1,h2').forEach(function(heading){
        const next=heading.nextElementSibling;
        if(next&&next.matches('p:not(.eyebrow):not(.legal)'))next.classList.add('imobify-design-subtitle');
      });
      plugin.querySelectorAll(CTA_SELECTOR).forEach(decorateCTA);
      plugin.querySelectorAll('.bbp[data-project-profile=\"true\"] .bbp__cta').forEach(decorateCTA);
    });
  }

  function applyContrastGuards(root){
    if(!contrastEnabled())return;
    const scope=root&&root.querySelectorAll?root:document;
    const include=(selector)=>{const out=[];if(scope instanceof Element&&scope.matches(selector))out.push(scope);scope.querySelectorAll(selector).forEach(el=>out.push(el));return out};

    include('.pit-section').forEach(el=>{
      const accent=cssVar(el,'--pit-accent',cssVar(document.documentElement,'--primary','#16a34a'));
      const surface=cssVar(document.documentElement,'--surface','#ffffff');
      setSafe(el,'--pit-accent-on-surface',accent,surface);
      setSafe(el,'--pit-accent-contrast',safest(accent),accent);
    });

    include('.iwfp-widget').forEach(el=>{
      const bg=cssVar(el,'--iwfp-bg','#25d366');
      setSafe(el,'--iwfp-icon-safe',cssVar(el,'--iwfp-icon','#ffffff'),bg);
      setSafe(el,'--iwfp-text-safe',cssVar(el,'--iwfp-text','#ffffff'),bg);
    });

    include('.imobify-menu-pro').forEach(el=>{
      const text=cssVar(el,'--imp-text','#ffffff'),accent=cssVar(el,'--imp-accent','#d4af37');
      const bg=cssVar(el,'--imp-bg','#0a1628'),scroll=cssVar(el,'--imp-bg-scroll',bg),mobile=cssVar(el,'--imp-mobile-bg',bg);
      setSafe(el,'--imp-text-safe',text,bg);setSafe(el,'--imp-text-scroll-safe',text,scroll);setSafe(el,'--imp-text-mobile-safe',text,mobile);
      setSafe(el,'--imp-accent-safe',accent,bg);setSafe(el,'--imp-accent-scroll-safe',accent,scroll);setSafe(el,'--imp-accent-mobile-safe',accent,mobile);
      setSafe(el,'--imp-accent-contrast',safest(accent),accent);
    });
  }

  function clearButtonMotion(el){if(!el)return;el.style.removeProperty('--imobify-button-x');el.style.removeProperty('--imobify-button-y')}
  document.addEventListener('pointermove',function(event){
    const el=event.target.closest?.('.imobify-design-cta');
    if(!el||buttonEffect()!=='magnetic'||matchMedia('(prefers-reduced-motion: reduce)').matches||!matchMedia('(pointer:fine)').matches)return;
    const rect=el.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const x=((event.clientX-rect.left)/rect.width-.5)*10;
    const y=((event.clientY-rect.top)/rect.height-.5)*8;
    el.style.setProperty('--imobify-button-x',x.toFixed(2)+'px');
    el.style.setProperty('--imobify-button-y',y.toFixed(2)+'px');
  },{passive:true});
  document.addEventListener('pointerout',function(event){
    const el=event.target.closest?.('.imobify-design-cta');
    if(el&&!el.contains(event.relatedTarget))clearButtonMotion(el);
  },{passive:true});
  document.addEventListener('click',function(event){
    const el=event.target.closest?.('.imobify-design-cta');
    if(!el||el.matches('[disabled],[aria-disabled="true"]'))return;
    const mode=buttonClickEffect();
    if(mode==='ripple'){
      const rect=el.getBoundingClientRect();
      const ripple=document.createElement('span');
      ripple.className='imobify-button-ripple';
      const restorePosition=getComputedStyle(el).position==='static';
      if(restorePosition)el.style.position='relative';
      el.classList.add('imobify-ripple-active');
      const cx=Number.isFinite(event.clientX)&&event.clientX!==0?event.clientX-rect.left:rect.width/2;
      const cy=Number.isFinite(event.clientY)&&event.clientY!==0?event.clientY-rect.top:rect.height/2;
      ripple.style.left=cx+'px'; ripple.style.top=cy+'px';
      el.appendChild(ripple);setTimeout(()=>{ripple.remove();el.classList.remove('imobify-ripple-active');if(restorePosition)el.style.removeProperty('position')},650);
    }else if(mode==='bounce'||mode==='flash'){
      const cls=mode==='bounce'?'imobify-button-click-bounce':'imobify-button-click-flash';
      el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);setTimeout(()=>el.classList.remove(cls),430);
    }
  });

  document.addEventListener('click',function(event){
    if(event.__imobifyFloatingHandled)return;
    const link=event.target.closest?.('[href^="#"]');
    if(!link)return;
    const href=String(link.getAttribute('href')||'').trim();
    if(!href||href==='#')return;
    const floating=window.ImobifyFloating?.get?.(href);
    if(floating){
      event.preventDefault();
      window.ImobifyFloating.open(href,link);
      return;
    }
    let target=null;
    try{target=document.querySelector(href)}catch(_error){return}
    if(target){event.preventDefault();target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  });
  window.Imobify={
    track:function(name,data){
      window.dataLayer=window.dataLayer||[];
      window.dataLayer.push({event:name,...(data||{})});
    },
    contrastRatio:ratio,
    ensureContrast:ensureContrast,
    applyContrastGuards:applyContrastGuards,
    applyDesignSemantics:applyDesignSemantics,
    registerCTA:function(el){decorateCTA(el);return el},
    refreshDesign:function(root){applyDesignSemantics(root||document);applyContrastGuards(root||document)}
  };
  const scan=()=>{applyDesignSemantics(document);applyContrastGuards(document)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);else scan();
  new MutationObserver(function(mutations){
    mutations.forEach(function(mutation){mutation.addedNodes.forEach(function(node){if(node instanceof Element){applyDesignSemantics(node);applyContrastGuards(node)}})});
  }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-design-role']});
})();


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


(function(){})();


(function(){})();


(function () {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  var SAMPLE_ASSET = {
    p1:'plugins/smart-plant-v1.4.2/assets/images/plant-1.png', p1full:'plugins/smart-plant-v1.4.2/assets/images/plant-1-full.png',
    p2:'plugins/smart-plant-v1.4.2/assets/images/plant-2.png', p3:'plugins/smart-plant-v1.4.2/assets/images/plant-3.png', pos1:'plugins/smart-plant-v1.4.2/assets/images/position-1.png'
  };
  function resolveSampleAsset(raw) {
    var key = String(raw || '').trim();
    var prefix = ['assets','images'].join('/') + '/';
    if (key === prefix + 'plant-1.png') return SAMPLE_ASSET.p1;
    if (key === prefix + 'plant-1-full.png') return SAMPLE_ASSET.p1full;
    if (key === prefix + 'plant-2.png') return SAMPLE_ASSET.p2;
    if (key === prefix + 'plant-3.png') return SAMPLE_ASSET.p3;
    if (key === prefix + 'smart-plant-position-1.png' || key === prefix + 'position-1.png') return SAMPLE_ASSET.pos1;
    return key;
  }
  function safeImage(value) {
    var raw = resolveSampleAsset(value);
    if (!raw) return '';
    if (/^data:image\//i.test(raw) || /^(?:https?:)?\/\//i.test(raw) || /^(?:\/|\.\/|\.\.\/)(?!\/)/.test(raw) || /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.~%+@()-]+)+/.test(raw)) return raw;
    return '';
  }
  function normalizePlant(item, index) {
    item = item && typeof item === 'object' ? item : {};
    return {
      id:String(item.id || ('planta-' + (index + 1))),
      code:String(item.code || item.identifier || ''),
      title:String(item.title || ('Planta ' + (index + 1))),
      description:String(item.description || ''),
      area:String(item.area || ''),
      composition:String(item.composition || ''),
      bathrooms:String(item.bathrooms || ''),
      features:Array.isArray(item.features) ? item.features.join('|') : String(item.features || ''),
      image:String(item.image || ''),
      fullImage:String(item.fullImage || item.image || ''),
      positionImage:String(item.positionImage || ''),
      position:String(item.position || '')
    };
  }
  function readPlants(root) {
    try {
      var list = JSON.parse(root.dataset.plants || '[]');
      if (Array.isArray(list)) return list.map(normalizePlant);
    } catch (_) {}
    return [];
  }
  function badges(plant) {
    return [plant.area, plant.composition, plant.bathrooms].concat(String(plant.features || '').split('|').map(function (v) { return v.trim(); })).filter(Boolean);
  }
  function cardMarkup(plant, index, buttonText) {
    var image = safeImage(plant.image || plant.fullImage);
    return '<article class="smart-plant__card" data-smart-plant-card="' + esc(plant.id) + '">' +
      '<div class="smart-plant__card-media">' + (image ? '<img src="' + esc(image) + '" alt="' + esc(plant.title) + '"' + (index ? ' loading="lazy"' : '') + ' decoding="async">' : '') + '</div>' +
      '<div class="smart-plant__card-body"><h3>' + esc(plant.title) + '</h3>' +
      (plant.description ? '<p>' + esc(plant.description) + '</p>' : '') +
      '<div class="smart-plant__badges">' + badges(plant).map(function (item) { return '<span class="smart-plant__badge">' + esc(item) + '</span>'; }).join('') + '</div>' +
      '<button class="smart-plant__card-button" type="button" data-smart-plant-open="' + esc(plant.id) + '"><span>' + esc(buttonText || 'Ver planta completa') + '</span></button>' +
      '</div></article>';
  }
  function fillTemplate(template, root, plant) {
    return String(template || '')
      .replace(/\{empreendimento\}/gi, root.dataset.empreendimento || '')
      .replace(/\{planta\}/gi, plant.title || '')
      .replace(/\{metragem\}/gi, plant.area || '');
  }
  function init(wrapper) {
    if (wrapper.dataset.smartPlantReady === 'true') return;
    wrapper.dataset.smartPlantReady = 'true';
    var root = wrapper.querySelector('.smart-plant') || wrapper;
    var plants = readPlants(root);
    var grid = root.querySelector('[data-smart-plant-grid]');
    var modal = root.querySelector('[data-smart-plant-modal]');
    var active = null;
    var lockedScrollY = 0;
    var viewportHandler = null;
    var modalPortal = null;
    var lastTrigger = null;
    var closing = false;
    var magnifierCleanup = null;
    if (grid) grid.innerHTML = plants.map(function (plant, index) { return cardMarkup(plant, index, root.dataset.cardButtonText); }).join('');

    // O modal público é portado para o <body> para não herdar transform,
    // overflow, contain ou contexto de posicionamento da section Smart Plant.
    // Isso é essencial no Safari/iPhone, onde um ancestral transformado pode
    // transformar position:fixed em posicionamento relativo ao bloco ancestral.
    function ensureModalPortal() {
      if (!modal || modalPortal) return modalPortal;
      modalPortal = document.createElement('div');
      modalPortal.className = 'smart-plant-modal-portal';
      modalPortal.setAttribute('data-plugin', 'smart-plant');
      modalPortal.setAttribute('data-smart-plant-portal', '');
      document.body.appendChild(modalPortal);
      modalPortal.appendChild(modal);
      return modalPortal;
    }
    function syncPortalTheme() {
      if (!modalPortal) return;
      var cs = window.getComputedStyle(root);
      ['--sp-accent','--sp-modal','--sp-text','--sp-muted','--heading','--body-color','--heading-color'].forEach(function (name) {
        var value = cs.getPropertyValue(name);
        if (value) modalPortal.style.setProperty(name, value.trim());
      });
      modalPortal.style.fontFamily = cs.fontFamily || '';
    }
    function syncVisualViewportBox() {
      if (!modal) return;
      var vv = window.visualViewport;
      var left = vv ? vv.offsetLeft : 0;
      var top = vv ? vv.offsetTop : 0;
      var width = vv ? vv.width : window.innerWidth;
      var height = vv ? vv.height : window.innerHeight;
      modal.style.left = Math.round(left) + 'px';
      modal.style.top = Math.round(top) + 'px';
      modal.style.width = Math.round(width) + 'px';
      modal.style.height = Math.round(height) + 'px';
      modal.style.right = 'auto';
      modal.style.bottom = 'auto';
    }

    function unlockPage() {
      document.documentElement.classList.remove('smart-plant-modal-open');
      document.body.classList.remove('smart-plant-body-locked');
      document.body.style.top = '';
      document.body.style.width = '';
      if (window.visualViewport && viewportHandler) {
        window.visualViewport.removeEventListener('resize', viewportHandler);
        window.visualViewport.removeEventListener('scroll', viewportHandler);
      }
      window.removeEventListener('resize', viewportHandler);
      window.removeEventListener('orientationchange', viewportHandler);
      viewportHandler = null;
      // Safari iOS restaura o scroll com mais consistência após liberar o body.
      window.requestAnimationFrame(function () {
        window.scrollTo(0, lockedScrollY || 0);
      });
    }
    function fitModalToViewport() {
      if (!modal || !modal.classList.contains('is-open')) return;
      syncVisualViewportBox();
      var dialog = modal.querySelector('.smart-plant__dialog');
      if (!dialog) return;
      dialog.style.setProperty('--sp-modal-scale', '1');
      var vv = window.visualViewport;
      var vw = vv ? vv.width : window.innerWidth;
      var vh = vv ? vv.height : window.innerHeight;
      var padX = vw <= 640 ? 16 : 36;
      var padY = vw <= 640 ? 16 : 36;
      var naturalW = dialog.offsetWidth || 1;
      var naturalH = dialog.offsetHeight || 1;
      var scale = Math.min(1, (vw - padX) / naturalW, (vh - padY) / naturalH);
      if (!Number.isFinite(scale) || scale <= 0) scale = 1;
      // Sem barra interna: em telas realmente pequenas o conteúdo reduz como bloco.
      dialog.style.setProperty('--sp-modal-scale', String(Math.max(.32, scale)));
    }
    function lockPage() {
      lockedScrollY = window.scrollY || window.pageYOffset || 0;
      document.documentElement.classList.add('smart-plant-modal-open');
      document.body.classList.add('smart-plant-body-locked');
      document.body.style.top = (-lockedScrollY) + 'px';
      document.body.style.width = '100%';
      viewportHandler = function () {
        window.requestAnimationFrame(function () {
          syncVisualViewportBox();
          fitModalToViewport();
        });
      };
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', viewportHandler, { passive:true });
        window.visualViewport.addEventListener('scroll', viewportHandler, { passive:true });
      }
      window.addEventListener('resize', viewportHandler, { passive:true });
      window.addEventListener('orientationchange', viewportHandler, { passive:true });
    }
    function setupMagnifier(image) {
      if (magnifierCleanup) { try { magnifierCleanup(); } catch (_) {} magnifierCleanup = null; }
      if (!modal || !image) return;
      var stage = modal.querySelector('[data-smart-plant-magnifier-stage]');
      var lens = modal.querySelector('[data-smart-plant-magnifier]');
      var settingsToggle = modal.querySelector('[data-smart-plant-magnifier-settings-toggle]');
      var settingsPanel = modal.querySelector('[data-smart-plant-magnifier-settings]');
      var zoomButtons = Array.prototype.slice.call(modal.querySelectorAll('[data-smart-plant-zoom]'));
      if (!stage || !lens) return;

      function boolData(name, fallback) {
        var value = String(root.dataset[name] == null ? '' : root.dataset[name]).trim().toLowerCase();
        if (!value) return fallback;
        return !['false','0','no','off'].includes(value);
      }
      var touchToggle = boolData('magnifierTouchToggle', true);
      var clickPosition = boolData('magnifierClickPosition', true);
      var dragPosition = boolData('magnifierDragPosition', true);
      var followMouse = boolData('magnifierFollowMouse', false);
      var zoom = String(root.dataset.magnifierZoom || '3') === '2' ? 2 : 3;
      var dragging = false;
      var pointerId = null;
      var dragMoved = false;
      var downX = 0, downY = 0;
      var suppressLensClick = false;
      var touchStart = null;
      var lastTouchToggleAt = 0;

      lens.dataset.dragEnabled = dragPosition ? 'true' : 'false';

      function sourceUrl() { return safeImage(image.currentSrc || image.src || ''); }
      function updateZoomUi() {
        lens.setAttribute('aria-label', 'Lupa ' + zoom + ' vezes');
        zoomButtons.forEach(function (button) {
          button.classList.toggle('is-active', Number(button.dataset.smartPlantZoom) === zoom);
        });
      }
      function place(clientX, clientY) {
        var rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        var y = Math.max(0, Math.min(rect.height, clientY - rect.top));
        lens.style.left = x + 'px'; lens.style.top = y + 'px';
        lens.style.backgroundImage = 'url("' + sourceUrl().replace(/"/g,'\\"') + '")';
        lens.style.backgroundSize = (rect.width * zoom) + 'px ' + (rect.height * zoom) + 'px';
        lens.style.backgroundPosition = ((75 - x * zoom)) + 'px ' + ((75 - y * zoom)) + 'px';
      }
      function refreshAtCurrentPosition() {
        var rect = stage.getBoundingClientRect();
        var left = parseFloat(lens.style.left), top = parseFloat(lens.style.top);
        if (!Number.isFinite(left)) left = rect.width / 2;
        if (!Number.isFinite(top)) top = rect.height / 2;
        place(rect.left + left, rect.top + top);
      }
      function center() { var r = stage.getBoundingClientRect(); place(r.left + r.width/2, r.top + r.height/2); }
      function setVisible(visible) { lens.classList.toggle('is-hidden', !visible); }
      function toggleVisible() { setVisible(lens.classList.contains('is-hidden')); }
      function setSettingsOpen(open) {
        if (!settingsPanel) return;
        settingsPanel.classList.toggle('is-open', !!open);
        settingsPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (settingsToggle) settingsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      function toggleSettings() { setSettingsOpen(!(settingsPanel && settingsPanel.classList.contains('is-open'))); }
      function chooseZoom(event) {
        var button = event.currentTarget;
        zoom = Number(button.dataset.smartPlantZoom) === 2 ? 2 : 3;
        updateZoomUi();
        refreshAtCurrentPosition();
        event.preventDefault(); event.stopPropagation();
      }
      function down(event) {
        if (!dragPosition) return;
        dragging = true; pointerId = event.pointerId; dragMoved = false; downX = event.clientX; downY = event.clientY;
        lens.classList.add('is-dragging');
        try { lens.setPointerCapture(pointerId); } catch (_) {}
        place(event.clientX,event.clientY); event.preventDefault(); event.stopPropagation();
      }
      function move(event) {
        if (!dragging || (pointerId != null && event.pointerId !== pointerId)) return;
        if (Math.abs(event.clientX-downX) > 3 || Math.abs(event.clientY-downY) > 3) dragMoved = true;
        place(event.clientX,event.clientY); event.preventDefault(); event.stopPropagation();
      }
      function up(event) {
        if (!dragging || (pointerId != null && event.pointerId !== pointerId)) return;
        suppressLensClick = true;
        if (!dragMoved) toggleSettings();
        dragging=false; lens.classList.remove('is-dragging');
        try { lens.releasePointerCapture(pointerId); } catch (_) {} pointerId=null;
        event.preventDefault(); event.stopPropagation();
        setTimeout(function () { suppressLensClick = false; }, 0);
      }
      function lensClick(event) {
        if (suppressLensClick) return;
        toggleSettings();
        event.preventDefault(); event.stopPropagation();
      }
      function stageClick(event) {
        if (!clickPosition || (Date.now() - lastTouchToggleAt) < 500) return;
        if (event.target.closest('[data-smart-plant-magnifier], [data-smart-plant-magnifier-settings], [data-smart-plant-magnifier-settings-toggle]')) return;
        if (event.pointerType === 'touch') return;
        setVisible(true); place(event.clientX,event.clientY);
      }
      function stagePointerMove(event) {
        if (!followMouse || dragging || event.pointerType !== 'mouse') return;
        if (event.target.closest('[data-smart-plant-magnifier-settings], [data-smart-plant-magnifier-settings-toggle]')) return;
        setVisible(true); place(event.clientX,event.clientY);
      }
      function stagePointerDown(event) {
        if (!touchToggle || event.pointerType !== 'touch') return;
        if (event.target.closest('[data-smart-plant-magnifier], [data-smart-plant-magnifier-settings], [data-smart-plant-magnifier-settings-toggle]')) return;
        touchStart = { id:event.pointerId, x:event.clientX, y:event.clientY };
      }
      function stagePointerUp(event) {
        if (!touchToggle || event.pointerType !== 'touch' || !touchStart || touchStart.id !== event.pointerId) return;
        if (event.target.closest('[data-smart-plant-magnifier], [data-smart-plant-magnifier-settings], [data-smart-plant-magnifier-settings-toggle]')) { touchStart=null; return; }
        var moved = Math.abs(event.clientX-touchStart.x) > 8 || Math.abs(event.clientY-touchStart.y) > 8;
        touchStart = null;
        if (moved) return;
        lastTouchToggleAt = Date.now();
        if (lens.classList.contains('is-hidden')) { setVisible(true); place(event.clientX,event.clientY); }
        else toggleVisible();
        event.preventDefault();
      }
      function toggleSettingsButton(event) { toggleSettings(); event.preventDefault(); event.stopPropagation(); }

      lens.addEventListener('pointerdown', down); lens.addEventListener('pointermove', move); lens.addEventListener('pointerup', up); lens.addEventListener('pointercancel', up); lens.addEventListener('click', lensClick);
      stage.addEventListener('click', stageClick); stage.addEventListener('pointermove', stagePointerMove); stage.addEventListener('pointerdown', stagePointerDown); stage.addEventListener('pointerup', stagePointerUp); stage.addEventListener('pointercancel', function(){ touchStart=null; });
      if (settingsToggle) settingsToggle.addEventListener('click', toggleSettingsButton);
      zoomButtons.forEach(function (button) { button.addEventListener('click', chooseZoom); });
      lens.classList.add('is-ready'); setVisible(true); updateZoomUi(); center(); setSettingsOpen(false);

      magnifierCleanup = function () {
        lens.removeEventListener('pointerdown',down); lens.removeEventListener('pointermove',move); lens.removeEventListener('pointerup',up); lens.removeEventListener('pointercancel',up); lens.removeEventListener('click',lensClick);
        stage.removeEventListener('click',stageClick); stage.removeEventListener('pointermove',stagePointerMove); stage.removeEventListener('pointerdown',stagePointerDown); stage.removeEventListener('pointerup',stagePointerUp);
        if (settingsToggle) settingsToggle.removeEventListener('click',toggleSettingsButton);
        zoomButtons.forEach(function (button) { button.removeEventListener('click',chooseZoom); });
        lens.classList.remove('is-ready','is-dragging','is-hidden'); setSettingsOpen(false);
      };
    }

    function closeModal() {
      if (!modal || closing || !modal.classList.contains('is-open')) return;
      closing = true;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden','true');
      if (magnifierCleanup) { try { magnifierCleanup(); } catch (_) {} magnifierCleanup = null; }
      unlockPage();
      active = null;
      var restore = lastTrigger;
      lastTrigger = null;
      window.setTimeout(function () {
        closing = false;
        if (restore && restore.isConnected && restore.focus) {
          try { restore.focus({ preventScroll:true }); } catch (_) { restore.focus(); }
        }
      }, 30);
    }
    function openModal(id, trigger) {
      active = plants.find(function (item) { return String(item.id) === String(id); }) || null;
      if (!active || !modal) return;
      ensureModalPortal();
      syncPortalTheme();
      syncVisualViewportBox();
      lastTrigger = trigger || document.activeElement || null;
      closing = false;
      var image = modal.querySelector('[data-smart-plant-modal-image]');
      var title = modal.querySelector('[data-smart-plant-modal-title]');
      var badgeWrap = modal.querySelector('[data-smart-plant-modal-badges]');
      var positionImage = modal.querySelector('[data-smart-plant-position-image]');
      var position = modal.querySelector('[data-smart-plant-position]');
      var positionBlock = modal.querySelector('[data-smart-plant-position-block]');
      var action = modal.querySelector('[data-smart-plant-action]');
      var full = safeImage(active.fullImage || active.image);
      if (image) { image.src = full; image.alt = active.title || 'Planta'; }
      if (title) title.textContent = active.title;
      if (badgeWrap) badgeWrap.innerHTML = badges(active).map(function (item) { return '<span class="smart-plant__badge">' + esc(item) + '</span>'; }).join('');
      if (positionImage) {
        var posSrc = safeImage(active.positionImage);
        positionImage.src = posSrc;
        positionImage.style.display = posSrc ? 'block' : 'none';
      }
      if (position) position.textContent = active.position || '';
      if (positionBlock) positionBlock.style.display = (active.position || active.positionImage) ? '' : 'none';
      if (action) action.textContent = root.dataset.actionMode === 'form' ? (root.dataset.actionLabelForm || 'Gostei desta planta. Quero mais informações') : (root.dataset.actionLabelWhats || 'Gostei desta! Quero mais informações');
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden','false');
      lockPage();
      window.requestAnimationFrame(function () {
        fitModalToViewport();
        window.requestAnimationFrame(fitModalToViewport);
      });
      if (image) {
        image.onload = function () { fitModalToViewport(); setupMagnifier(image); };
        if (image.complete) setupMagnifier(image);
      }
      setTimeout(function () {
        fitModalToViewport();
        var closeButton = modal.querySelector('[data-smart-plant-close].smart-plant__close');
        if (closeButton && closeButton.focus) closeButton.focus({ preventScroll:true });
      }, 40);
    }
    function sendAction() {
      if (!active) return;
      var mode = root.dataset.actionMode === 'form' ? 'form' : 'whatsapp';
      if (mode === 'whatsapp') {
        var number = String(root.dataset.whatsNumber || '').replace(/\D+/g,'');
        var message = fillTemplate(root.dataset.whatsMessage, root, active);
        var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(message);
        window.open(url, '_blank', 'noopener');
        return;
      }
      var detail = {
        source:'smart-plant',
        empreendimento:root.dataset.empreendimento || '',
        plantId:active.id,
        plantCode:active.code || '',
        plantTitle:active.title,
        area:active.area,
        message:fillTemplate(root.dataset.formContextMessage, root, active),
        targetAnchor:String(root.dataset.formAnchor || '').replace(/^#/,'')
      };

      // Integração nativa com o Form Sender v4.
      // O Smart Plant grava o contexto diretamente no formulário que efetivamente
      // será submetido pelo Form Sender v4. Assim a planta escolhida chega no e-mail
      // mesmo quando o campo visual de mensagem estiver oculto.
      function locateFormSenderV4() {
        var scope = detail.targetAnchor ? document.getElementById(detail.targetAnchor) : null;
        var mount = null;
        if (scope) {
          if (scope.matches && scope.matches('.formsenderV4_mount')) mount = scope;
          if (!mount && scope.querySelector) mount = scope.querySelector('.formsenderV4_mount');
          if (!mount && scope.matches && scope.matches('[data-plugin="form-sender-v4"]')) mount = scope.querySelector('.formsenderV4_mount');
        }
        if (!mount) mount = document.querySelector('[data-plugin="form-sender-v4"] .formsenderV4_mount');
        if (!mount) mount = document.querySelector('.formsenderV4_mount');
        return mount;
      }

      function writeFormSenderV4Context(mount) {
        if (!mount) return false;
        var form = mount.querySelector('form');
        if (!form) return false;

        function setHidden(name, value) {
          var field = form.querySelector('[name="' + name + '"]');
          if (!field) {
            field = document.createElement('input');
            field.type = 'hidden';
            field.name = name;
            form.appendChild(field);
          }
          field.value = String(value || '');
        }

        setHidden('origem', 'Smart Plant');
        setHidden('smartPlantId', detail.plantId);
        setHidden('smartPlantCode', detail.plantCode);
        setHidden('smartPlant', detail.plantTitle);
        setHidden('smartPlantArea', detail.area);

        var msg = form.querySelector('[name="msg"]');
        if (!msg) {
          msg = document.createElement('input');
          msg.type = 'hidden';
          msg.name = 'msg';
          form.appendChild(msg);
        }

        var current = String(msg.value || '').trim();
        var previous = String(form.dataset.smartPlantMessage || '');
        if (previous && current.indexOf(previous) >= 0) current = current.replace(previous, '').trim();

        var lines = [
          detail.plantTitle ? 'Planta: ' + detail.plantTitle : '',
          detail.area ? 'Metragem: ' + detail.area : '',
          detail.plantCode ? 'Identificador: ' + detail.plantCode : ''
        ].filter(Boolean);
        if (detail.message) lines.push('', detail.message);
        var block = lines.join('\n').trim();

        form.dataset.smartPlantMessage = block;
        msg.value = [current, block].filter(Boolean).join('\n\n');
        mount.dataset.smartPlantSelected = detail.plantId || detail.plantTitle || 'true';
        return true;
      }

      var formSenderMount = locateFormSenderV4();
      var applied = writeFormSenderV4Context(formSenderMount);

      // Mantém o evento oficial para o adapter do Form Sender v4 e futuras integrações.
      // Só o dispara quando não foi possível aplicar diretamente, evitando duplicidade.
      if (!applied) {
        window.dispatchEvent(new CustomEvent('imobify:smart-plant-form', { detail:detail }));
      }

      closeModal();
      var target = formSenderMount || (detail.targetAnchor ? document.getElementById(detail.targetAnchor) : document.querySelector('[data-plugin="form-sender-v4"]'));
      if (target) {
        target.scrollIntoView({ behavior:'smooth', block:'center' });
        setTimeout(function () {
          var focusTarget = target.querySelector ? target.querySelector('input,textarea,button') : null;
          if (focusTarget && focusTarget.focus) focusTarget.focus({preventScroll:true});
        }, 500);
      } else {
        console.warn('[Smart Plant] Form Sender v4 não encontrado. Configure a âncora do Form Sender ou adicione uma seção form-sender-v4 à página.');
      }
    }
    root.addEventListener('click', function (event) {
      var open = event.target.closest('[data-smart-plant-open]');
      if (open) { openModal(open.dataset.smartPlantOpen, open); return; }
    });
    if (modal) {
      // Listener próprio porque o modal é movido para um portal fora da section.
      // Click é intencional: evita o duplo disparo touchend + click no Safari iOS.
      modal.addEventListener('click', function (event) {
        var closeControl = event.target.closest('[data-smart-plant-close]');
        if (closeControl) {
          event.preventDefault();
          event.stopPropagation();
          closeModal();
          return;
        }
        var actionControl = event.target.closest('[data-smart-plant-action]');
        if (actionControl) {
          event.preventDefault();
          sendAction();
        }
      });
    }
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && modal && modal.classList.contains('is-open')) closeModal(); });
  }
  function boot() { document.querySelectorAll('[data-plugin="smart-plant"]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();


(function () {
  'use strict';

  var SHOWCASE_PROFILES = {
    signature: { title:'#1f2a2e', heading:'#17242a', accent:'#6f8f62', icon:'#ffffff', surface:'#18232d', border:'#7f9c73' },
    ivory: { title:'#332e28', heading:'#211f1b', accent:'#8b6f47', icon:'#fbf7ef', surface:'#6d5a40', border:'#b79c72' },
    mineral: { title:'#28323a', heading:'#1a232b', accent:'#6f8796', icon:'#f7fafc', surface:'#314553', border:'#8ba1ae' },
    forest: { title:'#233029', heading:'#15231b', accent:'#6f8b64', icon:'#f6f7f2', surface:'#254332', border:'#8ca684' },
    monochrome: { title:'#181b1e', heading:'#0e1113', accent:'#6e7478', icon:'#ffffff', surface:'#15191c', border:'#555e63' }
  };

  var MODAL_PROFILES = {
    obsidian: { background:'#111619', accent:'#bfa06a', border:'#6e5e45', iconSurface:'#252a2d' },
    ivory: { background:'#f3efe7', accent:'#8a6c43', border:'#bca783', iconSurface:'#e1d6c3' },
    forest: { background:'#142019', accent:'#9eb68d', border:'#526a4d', iconSurface:'#24352b' },
    midnight: { background:'#111a28', accent:'#8faec7', border:'#465f75', iconSurface:'#1e2c3f' },
    mineral: { background:'#2c3033', accent:'#c0b49b', border:'#69645b', iconSurface:'#3b4145' }
  };

  // Valores sentinela do manifesto. Enquanto o usuário não alterar uma cor,
  // o perfil visual pode fornecer a paleta-base. Depois que a cor é alterada
  // no Inspetor, ela passa a ter prioridade sobre o perfil naquele atributo.
  var DEFAULT_SHOWCASE_COLORS = {
    title:'#1d2730', icon:'#ffffff', surface:'#18232d', border:'#6f8f62'
  };
  var DEFAULT_MODAL_COLORS = {
    background:'#0f171d', accent:'#83a873', border:'#83a873', iconSurface:'#18232d'
  };

  function setVar(node, name, value) {
    if (node && value) node.style.setProperty(name, value);
  }

  function inlineVar(component, name) {
    return component && component.style ? String(component.style.getPropertyValue(name) || '').trim() : '';
  }

  function sameColor(a, b) {
    var ca = parseColor(a), cb = parseColor(b);
    return Boolean(ca && cb && ca[0] === cb[0] && ca[1] === cb[1] && ca[2] === cb[2]);
  }

  function applyProfileColor(component, name, paletteValue, defaultValue) {
    var authored = inlineVar(component, name);
    // Sem valor próprio, ou ainda com o default original do componente: usa o perfil.
    // Se o usuário escolheu outra cor no Inspetor, ela é preservada.
    if (!authored || sameColor(authored, defaultValue)) setVar(component, name, paletteValue);
  }

  function applyShowcaseProfile(component) {
    var profile = String(component.dataset.showcaseProfile || 'custom').toLowerCase();
    var palette = SHOWCASE_PROFILES[profile];
    if (!palette) return;
    applyProfileColor(component, '--bmp-title-color', palette.title, DEFAULT_SHOWCASE_COLORS.title);
    setVar(component, '--bmp-showcase-heading', palette.heading);
    setVar(component, '--bmp-showcase-accent', palette.accent);
    applyProfileColor(component, '--bmp-icon-color', palette.icon, DEFAULT_SHOWCASE_COLORS.icon);
    applyProfileColor(component, '--bmp-icon-surface', palette.surface, DEFAULT_SHOWCASE_COLORS.surface);
    applyProfileColor(component, '--bmp-icon-border', palette.border, DEFAULT_SHOWCASE_COLORS.border);
  }

  function applyModalProfile(component) {
    var profile = String(component.dataset.modalProfile || 'custom').toLowerCase();
    var palette = MODAL_PROFILES[profile];
    if (!palette) return;
    applyProfileColor(component, '--bmp-modal-bg', palette.background, DEFAULT_MODAL_COLORS.background);
    applyProfileColor(component, '--bmp-modal-accent', palette.accent, DEFAULT_MODAL_COLORS.accent);
    applyProfileColor(component, '--bmp-modal-border', palette.border, DEFAULT_MODAL_COLORS.border);
    applyProfileColor(component, '--bmp-modal-icon-surface', palette.iconSurface, DEFAULT_MODAL_COLORS.iconSurface);
  }

  function parseColor(value) {
    var text = String(value || '').trim().toLowerCase();
    var match;
    if ((match = text.match(/^#([0-9a-f]{3})$/i))) {
      return match[1].split('').map(function (c) { return parseInt(c + c, 16); });
    }
    if ((match = text.match(/^#([0-9a-f]{6})$/i))) {
      return [parseInt(match[1].slice(0,2),16), parseInt(match[1].slice(2,4),16), parseInt(match[1].slice(4,6),16)];
    }
    if ((match = text.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i))) {
      return [Number(match[1]), Number(match[2]), Number(match[3])].map(function (v) { return Math.max(0, Math.min(255, v)); });
    }
    return null;
  }

  function linear(channel) {
    var c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function luminance(rgb) {
    return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
  }

  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function mix(foreground, background, weight) {
    return [0,1,2].map(function (i) { return Math.round(foreground[i] * weight + background[i] * (1 - weight)); });
  }

  function rgbCss(rgb) { return 'rgb(' + rgb[0] + ' ' + rgb[1] + ' ' + rgb[2] + ')'; }

  function bestForeground(background) {
    var light = [250, 251, 252];
    var dark = [18, 23, 27];
    return contrast(light, background) >= contrast(dark, background) ? light : dark;
  }

  function secondaryForeground(foreground, background, target) {
    var weight = 0.72;
    var candidate = mix(foreground, background, weight);
    while (weight < 1 && contrast(candidate, background) < target) {
      weight = Math.min(1, weight + 0.04);
      candidate = mix(foreground, background, weight);
    }
    return candidate;
  }

  function readVar(component, name, fallback) {
    var value = getComputedStyle(component).getPropertyValue(name).trim();
    return value || fallback;
  }

  function applyAutoContrast(component) {
    if (String(component.dataset.modalContrast || 'auto').toLowerCase() !== 'auto') return;
    // A decisão parte da cor EFETIVA do modal, já considerando perfil + ajuste manual.
    var background = parseColor(readVar(component, '--bmp-modal-bg', '#111619'));
    if (!background) return;

    var foreground = bestForeground(background);
    var secondary = secondaryForeground(foreground, background, 4.7);
    var tone = luminance(background) < 0.38 ? 'dark' : 'light';
    component.dataset.modalTone = tone;
    setVar(component, '--bmp-modal-title', rgbCss(foreground));
    setVar(component, '--bmp-modal-text', rgbCss(secondary));
    setVar(component, '--bmp-modal-close-fg', rgbCss(foreground));

    var iconBackground = parseColor(readVar(component, '--bmp-modal-icon-surface', '#252a2d')) || background;
    setVar(component, '--bmp-modal-icon', rgbCss(bestForeground(iconBackground)));
  }

  function applyColorProfiles(component) {
    applyShowcaseProfile(component);
    applyModalProfile(component);
    applyAutoContrast(component);
  }

  function dialogFromTrigger(root, trigger) {
    var id = trigger && trigger.getAttribute('aria-controls');
    if (!id) return null;
    try { return root.querySelector('#' + CSS.escape(id)); }
    catch (_) { return document.getElementById(id); }
  }

  function openDialog(dialog, trigger) {
    if (!dialog) return;
    dialog.__bmpTrigger = trigger || null;
    try {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } catch (_) { dialog.setAttribute('open', ''); }
    var close = dialog.querySelector('[data-benefit-close]');
    if (close) window.setTimeout(function () { try { close.focus({ preventScroll:true }); } catch (_) { close.focus(); } }, 0);
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    var trigger = dialog.__bmpTrigger;
    try {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    } catch (_) { dialog.removeAttribute('open'); }
    if (trigger && typeof trigger.focus === 'function') window.setTimeout(function () { try { trigger.focus({ preventScroll:true }); } catch (_) { trigger.focus(); } }, 0);
  }

  function init(root) {
    if (!root || root.dataset.ready === '1') return;
    root.dataset.ready = '1';
    var component = root.querySelector('.benefits-modal-pro');
    if (!component) return;

    applyColorProfiles(component);

    root.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-benefit-open]');
      if (trigger && root.contains(trigger)) {
        event.preventDefault();
        openDialog(dialogFromTrigger(root, trigger), trigger);
        return;
      }
      var close = event.target.closest('[data-benefit-close]');
      if (close && root.contains(close)) {
        event.preventDefault();
        closeDialog(close.closest('dialog'));
      }
    });

    root.querySelectorAll('.bmp-dialog').forEach(function (dialog) {
      dialog.addEventListener('click', function (event) {
        if (event.target !== dialog) return;
        if (String(component.dataset.closeBackdrop).toLowerCase() !== 'true') return;
        closeDialog(dialog);
      });
      dialog.addEventListener('cancel', function (event) {
        event.preventDefault();
        closeDialog(dialog);
      });
      dialog.addEventListener('close', function () {
        var trigger = dialog.__bmpTrigger;
        dialog.__bmpTrigger = null;
        if (trigger && typeof trigger.focus === 'function' && document.activeElement !== trigger) {
          try { trigger.focus({ preventScroll:true }); } catch (_) {}
        }
      });
    });
  }

  function boot() { document.querySelectorAll('[data-plugin="beneficios-modal"]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


(function(){document.querySelectorAll('[data-plugin="gallery"] img').forEach(image=>image.addEventListener('error',()=>image.closest('figure').classList.add('image-missing')));})();


(function(){
  function init(){
    document.querySelectorAll('[data-plugin="gallery-big-four"]:not([data-ready])').forEach(function(root){
      root.dataset.ready='true';
      var items=root.querySelectorAll('.pp-big-four-item');
      items.forEach(function(item,index){
        item.setAttribute('role','button');
        item.setAttribute('aria-label',item.querySelector('strong')?.textContent||('Imagem '+(index+1)));
        function activate(){items.forEach(function(other){if(other!==item)other.classList.remove('is-active')});item.classList.toggle('is-active');}
        item.addEventListener('click',activate);
        item.addEventListener('keydown',function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}});
      });
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();


(function(){
  document.querySelectorAll('[data-plugin="button-single"] .ibs-button').forEach(function(button){
    if(button.getAttribute('target')==='_blank') button.setAttribute('rel','noopener noreferrer');
    if(!button.textContent.trim()) button.setAttribute('aria-disabled','true');
  });
})();


(function(){
  "use strict";
  // 1.2.1: composição balanceada é resolvida por CSS; não há ajuste iterativo de tracking.
})();


(function(){})();


(function(){
  'use strict';

  function decodeHtml(value){
    return String(value || '').replace(/&amp;/gi, '&').trim();
  }

  function extractIframeSrc(value){
    var text = decodeHtml(value);
    var match = text.match(/<iframe[\s\S]*?\bsrc\s*=\s*["']([^"']+)["']/i);
    return match && match[1] ? decodeHtml(match[1]) : text;
  }

  function safeUrl(value){
    var text = extractIframeSrc(value);
    if (!/^https?:\/\//i.test(text)) return '';
    try { return new URL(text); } catch (e) { return ''; }
  }

  function embedFromUrl(value, address){
    var parsed = safeUrl(value);
    var fallback = String(address || '').trim();

    if (parsed) {
      var host = parsed.hostname.toLowerCase();
      var isGoogle = host === 'google.com' || host.endsWith('.google.com') || host === 'maps.google.com' || host === 'maps.app.goo.gl';

      if (isGoogle) {
        if (/\/maps\/embed/i.test(parsed.pathname) || parsed.searchParams.get('output') === 'embed') {
          return parsed.href;
        }

        var q = parsed.searchParams.get('q') || parsed.searchParams.get('query') || parsed.searchParams.get('ll');
        if (q) {
          return 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed';
        }

        var coords = parsed.href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
        if (coords) {
          return 'https://www.google.com/maps?q=' + encodeURIComponent(coords[1] + ',' + coords[2]) + '&output=embed';
        }
      }
    }

    if (fallback) {
      return 'https://www.google.com/maps?q=' + encodeURIComponent(fallback) + '&output=embed';
    }

    return '';
  }

  function renderMap(section){
    if (!section) return;

    var map = section.querySelector('.location-map');
    if (!map) return;

    var link = map.querySelector('a');
    var addressNode = section.querySelector('.location-layout .address');
    var address = addressNode ? addressNode.textContent.trim() : '';
    var source = link ? (link.getAttribute('href') || '') : '';
    var src = embedFromUrl(source, address);
    if (!src) return;

    var frame = map.querySelector('iframe.location-map-frame');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.className = 'location-map-frame';
      frame.setAttribute('title', 'Localização no Google Maps');
      frame.setAttribute('loading', 'lazy');
      frame.setAttribute('allowfullscreen', '');
      frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      map.insertBefore(frame, map.firstChild);
    }

    if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
    if (window.__IMOBIFY_EDITOR__) frame.style.pointerEvents = 'none';
    map.classList.add('has-google-map');
  }

  function enhancePlaces(section){
    section.querySelectorAll('.location-places li').forEach(function(item){
      if (item.querySelector('strong')) return;
      var raw = (item.textContent || '').trim();
      var separator = raw.indexOf('|');
      if (separator < 0) return;
      var time = raw.slice(0, separator).trim();
      var place = raw.slice(separator + 1).trim();
      item.textContent = '';
      var strong = document.createElement('strong');
      var span = document.createElement('span');
      strong.textContent = time;
      span.textContent = place;
      item.append(strong, span);
    });
  }

  function boot(scope){
    var root = scope && scope.querySelectorAll ? scope : document;
    root.querySelectorAll('.location-section').forEach(function(section){
      enhancePlaces(section);
      renderMap(section);
    });
  }

  function start(){
    boot(document);
    if (!document.documentElement) return;
    new MutationObserver(function(mutations){
      var needsRender = mutations.some(function(mutation){ return mutation.addedNodes && mutation.addedNodes.length; });
      if (needsRender) boot(document);
    }).observe(document.documentElement, {childList:true, subtree:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();


(function(){document.querySelectorAll('[data-plugin="faq"] details').forEach(item=>item.addEventListener('toggle',()=>{if(item.open)window.Imobify&&Imobify.track('faq_open',{question:item.querySelector('summary').textContent.replace('+','').trim()});}));})();


/**
 * ================================================================
 * notify-send.js v1.2.0 - Sistema de Notificações e Alertas
 * ================================================================
 */

(function() {
    'use strict';
    
    // ============================================================
    // CONFIGURAÇÕES
    // ============================================================
    
    const CONFIG = {
        notificationDuration: 5000,
        alertDefaultAvatar: 'fa-info-circle',
        alertTypes: {
            success: { icon: 'fa-check-circle', color: '#27ae60', title: 'Sucesso' },
            error: { icon: 'fa-times-circle', color: '#e74c3c', title: 'Erro' },
            warning: { icon: 'fa-exclamation-triangle', color: '#f39c12', title: 'Atenção' },
            info: { icon: 'fa-info-circle', color: '#3498db', title: 'Informação' },
            question: { icon: 'fa-question-circle', color: '#9b59b6', title: 'Pergunta' }
        },
        defaultMessages: {
            success: { title: 'Sucesso!', message: 'Operação realizada com sucesso.' },
            error: { title: 'Erro!', message: 'Ocorreu um erro. Tente novamente.' },
            warning: { title: 'Atenção!', message: 'Verifique as informações antes de continuar.' },
            info: { title: 'Informação', message: 'Aguarde enquanto processamos sua solicitação.' }
        },
        icons: {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        },
        defaultAvatar: 'fa-bell'
    };
    
    // ============================================================
    // CRIAÇÃO DOS CONTAINERS
    // ============================================================
    
    function createContainers() {
        // Container de Notificações
        if (!document.getElementById('ns-notification-container')) {
            const container = document.createElement('div');
            container.id = 'ns-notification-container';
            container.className = 'ns-notification-container';
            document.body.appendChild(container);
        }
        
        // Modal Overlay
        if (!document.getElementById('ns-modal-overlay')) {
            const modalOverlay = document.createElement('div');
            modalOverlay.id = 'ns-modal-overlay';
            modalOverlay.className = 'ns-modal-overlay';
            modalOverlay.innerHTML = `
                <div class="ns-modal">
                    <div class="ns-modal-avatar-container" style="text-align: center; margin-bottom: 15px; display: none;">
                        <div class="ns-modal-avatar" style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; overflow: hidden;">
                            <i class="fas fa-info-circle" style="font-size: 48px; color: white;"></i>
                        </div>
                    </div>
                    <div class="ns-modal-icon" style="text-align: center; font-size: 50px; margin-bottom: 20px;">
                        <i class="fas fa-info-circle"></i>
                    </div>
                    <h2 class="ns-modal-title">Título</h2>
                    <p class="ns-modal-message">Mensagem</p>
                    <div class="ns-modal-buttons">
                        <button class="ns-modal-button confirm" style="background: #3498db; padding: 12px 28px; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; color: white;">OK</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modalOverlay);
        }
        
        // Toast
        if (!document.getElementById('ns-toast')) {
            const toast = document.createElement('div');
            toast.id = 'ns-toast';
            toast.className = 'ns-toast';
            document.body.appendChild(toast);
        }
    }
    
    // ============================================================
    // FUNÇÃO PRINCIPAL: ALERT COM AVATAR
    // ============================================================
    
    window.notify_Send_alert = function(message, type = 'info', title = '', avatar = '') {
        return new Promise((resolve) => {
            const modalOverlay = document.getElementById('ns-modal-overlay');
            if (!modalOverlay) {
                console.error('notify_Send: Modal overlay não encontrado');
                resolve();
                return;
            }
            
            const modal = modalOverlay.querySelector('.ns-modal');
            const modalTitle = modal.querySelector('.ns-modal-title');
            const modalMessage = modal.querySelector('.ns-modal-message');
            const confirmBtn = modal.querySelector('.ns-modal-button.confirm');
            const modalIcon = modal.querySelector('.ns-modal-icon');
            const modalIconI = modal.querySelector('.ns-modal-icon i');
            const avatarContainer = modal.querySelector('.ns-modal-avatar-container');
            const avatarDiv = modal.querySelector('.ns-modal-avatar');
            
            // Configurar tipo
            const typeConfig = CONFIG.alertTypes[type] || CONFIG.alertTypes.info;
            const finalTitle = title || typeConfig.title;
            
            // Atualizar conteúdo
            modalTitle.textContent = finalTitle;
            modalMessage.textContent = message || 'Mensagem';
            confirmBtn.textContent = 'OK';
            confirmBtn.style.background = typeConfig.color;
            
            // Configurar avatar
            if (avatar) {
                // Mostrar container de avatar, esconder ícone padrão
                avatarContainer.style.display = 'block';
                modalIcon.style.display = 'none';
                
                // Configurar avatar
                if (avatar.match(/^(https?:\/\/|data:image|\/)/i) || avatar.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
                    // É URL de imagem
                    avatarDiv.innerHTML = `<img src="${avatar}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
                } else if (avatar.startsWith('fa-')) {
                    // É ícone Font Awesome
                    avatarDiv.innerHTML = `<i class="fas ${avatar}" style="font-size: 48px; color: white;"></i>`;
                } else {
                    // Fallback
                    avatarDiv.innerHTML = `<i class="fas ${CONFIG.alertDefaultAvatar}" style="font-size: 48px; color: white;"></i>`;
                }
            } else {
                // Sem avatar, mostrar ícone padrão do tipo
                avatarContainer.style.display = 'none';
                modalIcon.style.display = 'block';
                if (modalIconI) {
                    modalIconI.className = `fas ${typeConfig.icon}`;
                    modalIconI.style.color = typeConfig.color;
                }
            }
            
            // Função para fechar
            function closeModal() {
                modalOverlay.classList.remove('show');
                resolve();
            }
            
            // Remover listener antigo e adicionar novo
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            
            newConfirmBtn.addEventListener('click', closeModal);
            
            // Fechar ao clicar fora
            modalOverlay.onclick = function(e) {
                if (e.target === modalOverlay) {
                    closeModal();
                }
            };
            
            // Mostrar modal
            modalOverlay.classList.add('show');
        });
    };
    
    // ============================================================
    // SOBRESCREVER ALERT NATIVO
    // ============================================================
    
    let alertOverridden = false;
    let originalAlert = null;
    
    window.notify_Send_override_alert = function(enable = true, defaultAvatar = '') {
        if (enable && !alertOverridden) {
            // Salvar referência do alert original
            originalAlert = window.alert;
            
            // Substituir
            window.alert = function(message) {
                window.notify_Send_alert(message, 'info', 'Aviso', defaultAvatar);
            };
            alertOverridden = true;
            console.log('✅ Alert nativo substituído pelo notify_Send_alert');
        } else if (!enable && alertOverridden) {
            // Restaurar alert original
            window.alert = originalAlert;
            alertOverridden = false;
            console.log('✅ Alert nativo restaurado');
        }
    };
    
    // ============================================================
    // FUNÇÕES DE NOTIFICAÇÃO
    // ============================================================
    
    function getAvatarHTML(avatar) {
        if (!avatar) {
            return `<div class="ns-notification-avatar"><i class="fas ${CONFIG.defaultAvatar}"></i></div>`;
        }
        
        if (avatar.match(/^(https?:\/\/|data:image|\/)/i) || avatar.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
            return `<div class="ns-notification-avatar"><img src="${avatar}" alt="Avatar" onerror="this.parentElement.innerHTML='<i class=\'fas fa-user-circle\'></i>'"></div>`;
        }
        
        if (avatar.startsWith('fa-')) {
            return `<div class="ns-notification-avatar"><i class="fas ${avatar}"></i></div>`;
        }
        
        return `<div class="ns-notification-avatar"><i class="fas fa-user-circle"></i></div>`;
    }
    
    function closeNotification(notificationElement) {
        if (!notificationElement || !notificationElement.parentElement) return;
        notificationElement.classList.remove('show');
        notificationElement.classList.add('hide');
        setTimeout(() => {
            if (notificationElement.parentElement) {
                notificationElement.parentElement.removeChild(notificationElement);
            }
        }, 400);
    }
    
    window.notify_Send_notification = function(type, message = '', title = '', avatar = '') {
        const validTypes = ['success', 'error', 'warning', 'info'];
        if (!validTypes.includes(type)) {
            console.warn(`notify_Send: Tipo inválido "${type}". Usando "info".`);
            type = 'info';
        }
        
        const finalTitle = title || CONFIG.defaultMessages[type].title;
        const finalMessage = message || CONFIG.defaultMessages[type].message;
        
        const notification = document.createElement('div');
        notification.className = `ns-notification ${type}`;
        
        const avatarHTML = getAvatarHTML(avatar);
        const iconHTML = !avatar ? `<i class="fas ${CONFIG.icons[type]} ns-notification-icon"></i>` : '';
        
        notification.innerHTML = `
            ${avatarHTML}
            ${iconHTML}
            <div class="ns-notification-content">
                <div class="ns-notification-title">${escapeHtml(finalTitle)}</div>
                <div class="ns-notification-message">${escapeHtml(finalMessage)}</div>
            </div>
            <button class="ns-notification-close" onclick="notify_Send_close_notification(this.parentElement)">
                <i class="fas fa-times"></i>
            </button>
            <div class="ns-notification-progress"></div>
        `;
        
        const container = document.getElementById('ns-notification-container');
        if (container) {
            container.appendChild(notification);
        } else {
            console.error('notify_Send: Container de notificações não encontrado');
            return;
        }
        
        setTimeout(() => {
            notification.classList.add('show');
            const progressBar = notification.querySelector('.ns-notification-progress');
            if (progressBar) {
                setTimeout(() => {
                    progressBar.style.transform = 'scaleX(0)';
                }, 50);
            }
        }, 10);
        
        const timeoutId = setTimeout(() => {
            if (notification.parentElement) {
                closeNotification(notification);
            }
        }, CONFIG.notificationDuration);
        
        notification.dataset.timeoutId = timeoutId;
    };
    
    window.notify_Send_close_notification = function(notificationElement) {
        if (notificationElement && notificationElement.dataset.timeoutId) {
            clearTimeout(parseInt(notificationElement.dataset.timeoutId));
        }
        closeNotification(notificationElement);
    };
    
    window.notify_Send_close_all = function() {
        const container = document.getElementById('ns-notification-container');
        if (container) {
            const notifications = container.querySelectorAll('.ns-notification');
            notifications.forEach(notification => {
                closeNotification(notification);
            });
        }
    };
    
    window.notify_Send_toast = function(message, duration = 3000) {
        const toast = document.getElementById('ns-toast');
        if (!toast) {
            console.error('notify_Send: Toast element não encontrado');
            return;
        }
        toast.textContent = message || 'Notificação';
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    };
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Inicialização
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createContainers);
    } else {
        createContainers();
    }
    
    console.log('🎉 notify-send.js carregado com sucesso!');
    console.log('📌 Funções disponíveis:');
    console.log('   - notify_Send_alert()');
    console.log('   - notify_Send_notification()');
    console.log('   - notify_Send_modal()');
    console.log('   - notify_Send_toast()');
    console.log('   - notify_Send_override_alert()');
    
})();

/**
 * formsenderJS.Plugin - Formulário de contato com validação e integração com notify-send
 * 
 * Uso:
 * new formsenderJS.Plugin('#meu-formulario', {
 *   produto: 'The Garden - New Edition',
 *   endpoint: 'https://script.google.com/macros/s/.../exec',
 *   textoBotao: 'Enviar Mensagem'
 * });
 */
(function() {
    'use strict';

    window.formsenderJS = window.formsenderJS || {};

    class FormPlugin {
        constructor(selector, options = {}) {
            // Container
            this.container = document.querySelector(selector);
            if (!this.container) {
                console.error(`[formsenderJS] Elemento "${selector}" não encontrado.`);
                throw new Error(`Elemento "${selector}" não encontrado.`);
            }

            // Opções padrão
            const defaults = {
                produto: 'The Garden - New Edition',
                endpoint: '',                    // obrigatório
                textoBotao: 'Enviar Mensagem',
                mostrarMensagem: true,
                mostrarCheckboxes: false,
                mostrarDataNasc: false,
                notificacao: null,               // função personalizada (tipo, mensagem, titulo)
                onSuccess: null,
                onError: null
            };
            this.opts = { ...defaults, ...options };

            if (!this.opts.endpoint) {
                throw new Error('[formsenderJS] A opção "endpoint" é obrigatória.');
            }

            // Gera ID único
            this.uid = 'fs-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);

            // Constrói o HTML
            this.buildForm();

            // Inicializa eventos
            this.initEvents();

            console.log('[formsenderJS] Plugin inicializado com sucesso!');
        }

        // ---------- Monta o formulário (com prefixo CSS) ----------
        buildForm() {
            const uid = this.uid;
            const opts = this.opts;
            const css = 'formsenderCSS_';

            const hiddenFields = `
                <input type="hidden" name="produto" value="${opts.produto.replace(/"/g, '&quot;')}">
                <input type="hidden" name="dataHora" id="dataHora_${uid}">
            `;

            const nascimentoHtml = opts.mostrarDataNasc ? `
                <div class="${css}field">
                    <label for="nascimento_${uid}" class="${css}label">Data de Nascimento</label>
                    <input type="date" id="nascimento_${uid}" name="nascimento" class="${css}input">
                </div>
            ` : `
                <input type="date" name="nascimento" style="display:none;">
            `;

            const checkboxesHtml = opts.mostrarCheckboxes ? `
                <div class="${css}field">
                    <label class="${css}label">Informações Adicionais</label>
                    <div class="${css}checkbox-group">
                        <label class="${css}checkbox">
                            <input type="checkbox" name="anosCtps" value="X"> 3 Anos de carteira assinada?
                        </label>
                        <label class="${css}checkbox">
                            <input type="checkbox" name="fatorsocial" value="X"> Possui cônjuge ou dependente(a)
                        </label>
                        <label class="${css}checkbox">
                            <input type="checkbox" name="imovelnome" value="X"> Possui imóvel no nome?
                        </label>
                    </div>
                </div>
            ` : '';

            const mensagemHtml = opts.mostrarMensagem ? `
                <div class="${css}field">
                    <label for="msg_${uid}" class="${css}label">Mensagem</label>
                    <textarea id="msg_${uid}" name="msg" rows="4" class="${css}input ${css}textarea"></textarea>
                </div>
            ` : '';

            const formHtml = `
                <form id="form_${uid}" class="${css}form" novalidate>
                    ${hiddenFields}
                    <div class="${css}field">
                        <label for="nome_${uid}" class="${css}label">Nome Completo *</label>
                        <input type="text" id="nome_${uid}" name="nome" required class="${css}input">
                    </div>
                    <div class="${css}row">
                        <div class="${css}col">
                            <label for="email_${uid}" class="${css}label">E-mail *</label>
                            <input type="email" id="email_${uid}" name="email" required class="${css}input">
                        </div>
                        <div class="${css}col">
                            <label for="telefone_${uid}" class="${css}label">Telefone *</label>
                            <input type="tel" id="telefone_${uid}" name="telefone" required class="${css}input">
                        </div>
                    </div>
                    ${nascimentoHtml}
                    ${checkboxesHtml}
                    ${mensagemHtml}
                    <button type="submit" id="submit_${uid}" class="${css}button">${opts.textoBotao}</button>
                    <div id="resposta_${uid}" class="${css}resposta"></div>
                </form>
            `;

            this.container.innerHTML = formHtml;

            // Referências
            this.form = document.getElementById(`form_${uid}`);
            this.submitBtn = document.getElementById(`submit_${uid}`);
            this.resposta = document.getElementById(`resposta_${uid}`);
            this.dataHoraInput = document.getElementById(`dataHora_${uid}`);
        }

        // ---------- Eventos ----------
        initEvents() {
            // Máscara de telefone
            const telInput = this.form.querySelector('input[name="telefone"]');
            if (telInput) {
                telInput.addEventListener('input', (e) => {
                    let value = e.target.value.replace(/\D/g, '');
                    if (value.length > 11) value = value.substring(0, 11);
                    if (value.length > 0) {
                        value = value.replace(/^(\d{0,2})(\d{0,5})(\d{0,4}).*/, '($1) $2-$3');
                    }
                    e.target.value = value;
                });
            }

            // Validação de data
            const dateInput = this.form.querySelector('input[type="date"]');
            if (dateInput && this.opts.mostrarDataNasc) {
                dateInput.addEventListener('change', (e) => {
                    const selected = new Date(e.target.value);
                    const today = new Date();
                    if (selected > today) {
                        this.mostrarNotificacao('error', 'Data de nascimento não pode ser no futuro', 'Erro!');
                        e.target.value = '';
                    }
                });
            }

            // Envio
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // ---------- VALIDAÇÃO MANUAL DOS CAMPOS OBRIGATÓRIOS ----------
        validarCampos() {
            // Define quais campos são obrigatórios conforme as opções
            const obrigatorios = ['nome', 'email', 'telefone'];
            
            // Se quiser tornar a data obrigatória, descomente a linha abaixo:
            // if (this.opts.mostrarDataNasc) obrigatorios.push('nascimento');

            let valido = true;
            const css = 'formsenderCSS_';

            for (const campo of obrigatorios) {
                const input = this.form.querySelector(`[name="${campo}"]`);
                if (input) {
                    // Remove espaços e verifica se está vazio
                    if (!input.value.trim()) {
                        input.classList.add(`${css}input_error`);
                        valido = false;
                    } else {
                        input.classList.remove(`${css}input_error`);
                    }
                }
            }
            return valido;
        }

        // ---------- Envio com validação ----------
        handleSubmit(e) {
            e.preventDefault();

            // 1. VALIDA OS CAMPOS
            if (!this.validarCampos()) {
                this.mostrarNotificacao('error', 'Preencha todos os campos obrigatórios.', 'Atenção!');
                return; // Não envia
            }

            // 2. DESABILITA BOTÃO
            this.submitBtn.disabled = true;
            const originalText = this.submitBtn.textContent;
            this.submitBtn.textContent = 'Enviando...';

            // 3. PREENCHE DATA/HORA
            if (this.dataHoraInput) {
                this.dataHoraInput.value = new Date().toLocaleString('pt-BR');
            }

            const formData = new FormData(this.form);

            // 4. ENVIA
            fetch(this.opts.endpoint, {
                method: 'POST',
                body: formData,
            })
                .then(response => response.text())
                .then(msg => {
                    this.resposta.innerText = msg;
                    this.resposta.className = 'formsenderCSS_resposta formsenderCSS_success';
                    this.mostrarNotificacao('success', 'Mensagem enviada com sucesso!', 'Sucesso!');
                    this.form.reset();
                    if (this.opts.onSuccess) this.opts.onSuccess(msg);
                })
                .catch(err => {
                    this.resposta.innerText = 'Erro ao enviar dados. Por favor, tente novamente.';
                    this.resposta.className = 'formsenderCSS_resposta formsenderCSS_error';
                    this.mostrarNotificacao('error', 'Erro no envio. Tente novamente.', 'Erro!');
                    console.error(err);
                    if (this.opts.onError) this.opts.onError(err);
                })
                .finally(() => {
                    this.submitBtn.disabled = false;
                    this.submitBtn.textContent = originalText;
                    setTimeout(() => {
                        this.resposta.innerText = '';
                        this.resposta.className = 'formsenderCSS_resposta';
                    }, 3000);
                });
        }

        // ---------- Sistema de notificação (integrado ao notify-send) ----------
        mostrarNotificacao(tipo, mensagem, titulo) {
            // 1. Se o usuário forneceu uma função personalizada, usa ela
            if (typeof this.opts.notificacao === 'function') {
                this.opts.notificacao(tipo, mensagem, titulo);
                return;
            }

            // 2. Se o notify-send estiver disponível, usa-o
            if (typeof window.notify_Send_notification === 'function') {
                const avatar = (tipo === 'success')
                    ? 'https://randomuser.me/api/portraits/men/32.jpg'
                    : 'fas fa-exclamation-triangle';
                window.notify_Send_notification(tipo, mensagem, titulo, avatar);
                return;
            }

            // 3. Fallback para showfeedview_notification
            if (typeof window.showfeedview_notification === 'function') {
                window.showfeedview_notification(tipo, mensagem, titulo);
                return;
            }

            // 4. Último recurso: alert simples
            alert(`${titulo}: ${mensagem}`);
        }
    }

    // Exporta a classe no namespace
    window.formsenderJS.Plugin = FormPlugin;

    //console.log(' formsenderJS.Plugin carregado com sucesso!');
    //console.log(' Uso: new formsenderJS.Plugin("#seletor", { ... });');
})();

(function () {
  'use strict';

  function enabled(value) {
    return value === 'true' || value === '1' || value === 'on';
  }



  function quickQuestion(mount, index) {
    var prefix = 'quickQ' + index;
    var key = prefix.charAt(0).toLowerCase() + prefix.slice(1);
    function ds(suffix) { return mount.dataset[key + suffix] || ''; }
    var type = ds('Type') || 'single';
    var options = ds('Options').split('|').map(function (item) { return item.trim(); }).filter(Boolean);
    if (type === 'yesno') options = ['Sim', 'Não'];
    if (type === 'truefalse') options = ['Verdadeiro', 'Falso'];
    return {
      enabled: enabled(ds('Enabled')),
      label: ds('Label') || ('Pergunta ' + index),
      type: type,
      options: options,
      required: true
    };
  }

  function applyPossibilitySummary(mount, explicitSummary) {
    var summary = String(explicitSummary || '');
    if (!summary) { try { summary = sessionStorage.getItem('imobify:possibility-path-summary') || ''; } catch (_) {} }
    if (!summary) return;
    var form = mount && mount.querySelector('form');
    if (!form) return;
    var msg = form.querySelector('textarea[name="msg"]');
    if (msg && !msg.value.trim()) msg.value = summary;
    var hidden = form.querySelector('input[name="diagnosticoPossibilidade"]');
    if (!hidden) { hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = 'diagnosticoPossibilidade'; form.appendChild(hidden); }
    hidden.value = summary;
  }


  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function openQuickComplement(instance, config) {
    return new Promise(function (resolve) {
      var questions = (config.questions || []).filter(function (q) { return q && q.enabled !== false && q.label; });
      if (!questions.length) { resolve([]); return; }
      var old = document.getElementById('quick_' + instance.uid); if (old) old.remove();
      function choices(q) {
        if (q.type === 'yesno') return ['Sim','Não'];
        if (q.type === 'truefalse') return ['Verdadeiro','Falso'];
        return Array.isArray(q.options) ? q.options : [];
      }
      var overlay = document.createElement('div');
      overlay.id = 'quick_' + instance.uid;
      overlay.className = 'formsenderCSS_quick-overlay';
      overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true');
      overlay.innerHTML = '<div class="formsenderCSS_quick-card">' +
        '<div class="formsenderCSS_quick-head"><span class="formsenderCSS_quick-kicker">Só mais um detalhe</span>' +
        '<h3>' + escapeHtml(config.title || 'Antes de finalizar, só me confirma rapidinho…') + '</h3>' +
        (config.copy ? '<p>' + escapeHtml(config.copy) + '</p>' : '') + '</div>' +
        (questions.length > 1 ? '<div class="formsenderCSS_quick-progress" aria-live="polite"><span data-quick-current>1</span> de ' + questions.length + '</div>' : '') +
        '<div class="formsenderCSS_quick-questions">' + questions.map(function (q, i) {
          return '<fieldset class="formsenderCSS_quick-question' + (i === 0 ? ' is-active' : '') + '" data-quick-question="' + i + '">' +
            '<legend>' + escapeHtml(q.label) + ' *</legend>' +
            '<div class="formsenderCSS_quick-options">' + choices(q).map(function (option) {
              return '<button type="button" class="formsenderCSS_quick-option" data-value="' + escapeHtml(option) + '">' + escapeHtml(option) + '</button>';
            }).join('') + '</div><small>Selecione uma opção para continuar.</small></fieldset>';
        }).join('') + '</div>' +
        '<div class="formsenderCSS_quick-actions">' +
        '<button type="button" class="formsenderCSS_quick-confirm">' + escapeHtml(config.confirmText || 'Concluir envio') + '</button></div></div>';
      document.body.appendChild(overlay);
      document.documentElement.classList.add('formsender-quick-open');
      requestAnimationFrame(function () { overlay.classList.add('is-open'); });
      var selected = new Map();
      var activeIndex = 0;
      var isMobile = false;
      try { isMobile = window.matchMedia ? window.matchMedia('(max-width: 640px)').matches : window.innerWidth <= 640; } catch (_) {}
      var progressCurrent = overlay.querySelector('[data-quick-current]');
      var questionsWrap = overlay.querySelector('.formsenderCSS_quick-questions');
      var confirmButton = overlay.querySelector('.formsenderCSS_quick-confirm');
      var quickCard = overlay.querySelector('.formsenderCSS_quick-card');
      var fitRaf = 0;
      var viewportResizeTarget = window.visualViewport || null;

      function fitMobileCard() {
        if (!isMobile || !quickCard) return;
        if (fitRaf) cancelAnimationFrame(fitRaf);
        fitRaf = requestAnimationFrame(function () {
          fitRaf = 0;
          var vw = viewportResizeTarget ? viewportResizeTarget.width : window.innerWidth;
          var vh = viewportResizeTarget ? viewportResizeTarget.height : window.innerHeight;
          var naturalWidth = Math.max(1, quickCard.offsetWidth);
          var naturalHeight = Math.max(1, quickCard.scrollHeight);
          overlay.style.setProperty('--formsender-vv-width', Math.round(vw) + 'px');
          overlay.style.setProperty('--formsender-vv-height', Math.round(vh) + 'px');
          var availableWidth = Math.max(1, vw - 24);
          var availableHeight = Math.max(1, vh - 24);
          var scale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
          if (!isFinite(scale) || scale <= 0) scale = 1;
          quickCard.style.setProperty('--formsender-mobile-scale', String(Math.max(.55, scale)));
        });
      }

      function currentNode(index) { return overlay.querySelector('[data-quick-question="' + index + '"]'); }
      function currentAnswer(index) {
        var raw = selected.get(index);
        return Array.isArray(raw) ? raw.join(', ') : (raw || '');
      }
      function updateMobileHeight() {
        if (!isMobile || !questionsWrap) return;
        /* A pergunta ativa permanece no fluxo normal. Não fixamos a altura do wrapper:
           isso evita que opções maiores que a etapa anterior vazem para fora do card. */
        questionsWrap.style.removeProperty('height');
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { fitMobileCard(); });
        });
      }
      function updateActionLabel() {
        if (!confirmButton) return;
        if (!isMobile) {
          confirmButton.hidden = false;
          confirmButton.textContent = config.confirmText || 'Concluir envio';
          overlay.classList.add('has-mobile-action');
          return;
        }
        var q = questions[activeIndex];
        var needsAction = q && (q.type || 'single') === 'multiple';
        confirmButton.hidden = !needsAction;
        overlay.classList.toggle('has-mobile-action', !!needsAction);
        if (needsAction) confirmButton.textContent = activeIndex < questions.length - 1 ? 'Concluir seleção' : (config.confirmText || 'Concluir envio');
      }
      function showStep(nextIndex, immediate) {
        if (!isMobile) return;
        nextIndex = Math.max(0, Math.min(questions.length - 1, nextIndex));
        var oldNode = currentNode(activeIndex);
        var newNode = currentNode(nextIndex);
        if (!newNode || nextIndex === activeIndex) { updateMobileHeight(); updateActionLabel(); return; }
        function activate() {
          if (oldNode) oldNode.classList.remove('is-active','is-leaving');
          activeIndex = nextIndex;
          newNode.classList.add('is-active');
          if (progressCurrent) progressCurrent.textContent = String(activeIndex + 1);
          updateActionLabel();
          updateMobileHeight();
          requestAnimationFrame(function () { newNode.classList.add('is-entered'); });
          setTimeout(function () { newNode.classList.remove('is-entered'); }, 220);
        }
        if (immediate || !oldNode) activate();
        else {
          oldNode.classList.add('is-leaving');
          setTimeout(activate, 140);
        }
      }
      function validateIndex(index) {
        var q = questions[index];
        var answer = currentAnswer(index);
        var node = currentNode(index);
        if (q && !answer) { if (node) node.classList.add('has-error'); return false; }
        if (node) node.classList.remove('has-error');
        return true;
      }
      function collectAnswers() {
        var valid = true;
        var answers = questions.map(function (q, index) {
          var answer = currentAnswer(index);
          if (!answer) { valid = false; var node = currentNode(index); if (node) node.classList.add('has-error'); }
          return { label:q.label, answer:answer };
        });
        return { valid:valid, answers:answers };
      }
      function cleanup() {
        document.documentElement.classList.remove('formsender-quick-open');
        if (fitRaf) cancelAnimationFrame(fitRaf);
        window.removeEventListener('resize', fitMobileCard);
        window.removeEventListener('orientationchange', fitMobileCard);
        if (viewportResizeTarget && viewportResizeTarget.removeEventListener) viewportResizeTarget.removeEventListener('resize', fitMobileCard);
        document.removeEventListener('keydown', blockEscape, true);
        overlay.classList.add('is-closing');
        setTimeout(function () { overlay.remove(); }, 180);
      }
      function finish(answers) {
        cleanup();
        resolve({ cancelled:false, answers:answers || [] });
      }

      overlay.querySelectorAll('.formsenderCSS_quick-option').forEach(function (button) {
        button.addEventListener('click', function () {
          var fieldset = button.closest('[data-quick-question]');
          var index = Number(fieldset.dataset.quickQuestion); var q = questions[index]; var value = button.dataset.value || '';
          if ((q.type || 'single') === 'multiple') {
            var values = selected.get(index) || [];
            var next = values.indexOf(value) >= 0 ? values.filter(function (v) { return v !== value; }) : values.concat([value]);
            selected.set(index, next); button.classList.toggle('is-selected', next.indexOf(value) >= 0);
          } else {
            selected.set(index, value);
            fieldset.querySelectorAll('.formsenderCSS_quick-option').forEach(function (el) { el.classList.toggle('is-selected', el === button); });
          }
          fieldset.classList.remove('has-error');
          if (isMobile && (q.type || 'single') !== 'multiple' && index === activeIndex) {
            if (index < questions.length - 1) {
              setTimeout(function () { showStep(index + 1, false); }, 110);
            } else {
              setTimeout(function () {
                var result = collectAnswers();
                if (result.valid) finish(result.answers);
              }, 110);
            }
          }
        });
      });

      confirmButton.addEventListener('click', function () {
        if (isMobile) {
          var currentQuestion = questions[activeIndex];
          if (!currentQuestion || (currentQuestion.type || 'single') !== 'multiple') return;
          if (!validateIndex(activeIndex)) return;
          if (activeIndex < questions.length - 1) {
            showStep(activeIndex + 1, false);
            return;
          }
        }
        var result = collectAnswers();
        if (result.valid) finish(result.answers);
        else if (isMobile) {
          var firstInvalid = questions.findIndex(function (q, index) { return !currentAnswer(index); });
          if (firstInvalid >= 0) showStep(firstInvalid, true);
        }
      });
      overlay.addEventListener('click', function (event) {
        if (event.target === overlay) {
          event.preventDefault();
          event.stopPropagation();
        }
      });
      function blockEscape(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }
      document.addEventListener('keydown', blockEscape, true);

      if (isMobile) {
        overlay.classList.add('is-mobile-steps');
        updateActionLabel();
        updateMobileHeight();
        window.addEventListener('resize', fitMobileCard, { passive:true });
        window.addEventListener('orientationchange', fitMobileCard, { passive:true });
        if (viewportResizeTarget && viewportResizeTarget.addEventListener) viewportResizeTarget.addEventListener('resize', fitMobileCard, { passive:true });
        setTimeout(fitMobileCard, 40);
      }
    });
  }

  function appendQuickAnswers(instance, answers) {
    var answered = (answers || []).filter(function (item) { return item && String(item.answer || '').trim(); });
    if (!answered.length) return;
    var block = answered.map(function (item) { return item.label + '\n' + item.answer + ';'; }).join('\n\n');
    var form = instance.form; if (!form) return;
    var msg = form.querySelector('[name="msg"]');
    if (!msg) { msg = document.createElement('input'); msg.type = 'hidden'; msg.name = 'msg'; form.appendChild(msg); }
    var original = String(msg.value || '').trim();
    msg.value = [original, 'Informações complementares:', block].filter(Boolean).join('\n\n');
    var hidden = form.querySelector('[name="complementacaoRapida"]');
    if (!hidden) { hidden = document.createElement('input'); hidden.type='hidden'; hidden.name='complementacaoRapida'; form.appendChild(hidden); }
    hidden.value = block;
    answered.forEach(function (item, index) {
      var input = form.querySelector('[name="qualificacao_' + (index+1) + '"]');
      if (!input) { input=document.createElement('input'); input.type='hidden'; input.name='qualificacao_' + (index+1); form.appendChild(input); }
      input.value = item.label + '\n' + item.answer + ';';
    });
  }

  function installQuickComplement(instance, config) {
    if (!instance || !config || !config.enabled || !(config.questions || []).length) return;
    var original = instance.handleSubmit.bind(instance);
    var opening = false;
    instance.handleSubmit = function (event) {
      if (opening) { event && event.preventDefault && event.preventDefault(); return; }
      event && event.preventDefault && event.preventDefault();
      if (!instance.validarCampos()) { instance.mostrarNotificacao('error','Preencha todos os campos obrigatórios.','Atenção!'); return; }
      opening = true;
      openQuickComplement(instance, config).then(function (result) {
        if (result && result.cancelled) { opening = false; return; }
        var answers = result && Array.isArray(result.answers) ? result.answers : (Array.isArray(result) ? result : []);
        appendQuickAnswers(instance, answers);
        opening = false;
        original({ preventDefault:function () {} });
      }).catch(function () { opening = false; });
    };
  }

  function configureAutocomplete(instance, shouldEnable) {
    if (!instance || !instance.form) return;
    var fields = [
      { name:'nome', token:'name', extra:{ autocapitalize:'words' } },
      { name:'email', token:'email', extra:{ inputmode:'email', autocapitalize:'none', spellcheck:'false' } },
      { name:'telefone', token:'tel', extra:{ inputmode:'tel' } }
    ];
    fields.forEach(function (item) {
      var input = instance.form.querySelector('[name="' + item.name + '"]');
      if (!input) return;
      input.setAttribute('autocomplete', shouldEnable ? item.token : 'off');
      Object.keys(item.extra || {}).forEach(function (key) { input.setAttribute(key, item.extra[key]); });
    });
    instance.form.setAttribute('autocomplete', shouldEnable ? 'on' : 'off');
  }

  function initialize() {
    document.querySelectorAll('[data-plugin="form-sender-v4"] .formsenderV4_mount:not([data-initialized])').forEach(function (mount, index) {
      mount.dataset.initialized = 'true';
      mount.id = mount.id || 'formsender-v4-' + Date.now() + '-' + index + '-' + Math.random().toString(36).slice(2, 7);

      if (!window.formsenderJS || typeof window.formsenderJS.Plugin !== 'function') {
        mount.innerHTML = '<p>Não foi possível inicializar o Form.v4.</p>';
        return;
      }

      var endpoint = (mount.dataset.endpoint || '').trim();
      if (!endpoint) {
        mount.innerHTML = '<p>Configure o endpoint do Form.v4 no editor.</p>';
        return;
      }

      if (window.__IMOBIFY_EDITOR__) {
        mount.addEventListener('submit', function (event) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }, true);
      }

      try {
        var quickConfig = {
          enabled: enabled(mount.dataset.quickComplement),
          title: mount.dataset.quickTitle || 'Antes de finalizar, só me confirma rapidinho…',
          copy: mount.dataset.quickCopy || '',
          confirmText: mount.dataset.quickConfirmText || 'Concluir envio',
          questions: [quickQuestion(mount, 1), quickQuestion(mount, 2), quickQuestion(mount, 3), quickQuestion(mount, 4)].filter(function (q) { return q.enabled; })
        };
        var instance = new window.formsenderJS.Plugin('#' + mount.id, {
          produto: mount.dataset.product || 'The Garden - New Edition',
          endpoint: endpoint,
          textoBotao: mount.dataset.buttonText || 'Enviar Mensagem',
          mostrarMensagem: enabled(mount.dataset.showMessage),
          mostrarCheckboxes: enabled(mount.dataset.showCheckboxes),
          mostrarDataNasc: enabled(mount.dataset.showBirthdate),
          notificacao: function (type, message, title) {
            if (type === 'success') return;
            if (typeof window.notify_Send_notification === 'function') {
              window.notify_Send_notification(type, message, title, 'fas fa-exclamation-triangle');
            } else {
              window.alert(title + ': ' + message);
            }
          },
          onSuccess: function () {
            if (typeof window.notify_Send_notification === 'function') {
              window.notify_Send_notification(
                'success',
                mount.dataset.successMessage || 'Nosso consultor entrará em contato!',
                mount.dataset.successTitle || 'Fique atento',
                mount.dataset.successAvatar || ''
              );
            }
          },
          onError: function (error) {
            console.warn('[Form.v4]', error);
          }
        });
        mount.formsenderV4 = instance;
        configureAutocomplete(instance, enabled(mount.dataset.fieldAutocomplete));
        installQuickComplement(instance, quickConfig);
        applyPossibilitySummary(mount);
      } catch (error) {
        console.error('[Form.v4]', error);
        mount.innerHTML = '<p>Erro ao carregar o formulário: ' + String(error.message || error) + '</p>';
      }
    });
  }

  window.addEventListener('imobify:possibility-path-complete', function (event) { document.querySelectorAll('[data-plugin="form-sender-v4"] .formsenderV4_mount').forEach(function (mount) { applyPossibilitySummary(mount, event.detail && event.detail.summary); }); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();


(function () {
  "use strict";

  const POSITION_MAP = {
    "Inferior direita": "bottom-right",
    "Inferior esquerda": "bottom-left",
    "Superior direita": "top-right",
    "Superior esquerda": "top-left"
  };

  function asBoolean(value) {
    return String(value).toLowerCase() === "true" || value === "1";
  }

  function sanitizePhone(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function safeEncodedMessage(message, mode) {
    const text = String(message || "").trim();
    if (!text) return "";

    if (mode === "Mensagem já codificada") {
      try {
        return encodeURIComponent(decodeURIComponent(text));
      } catch (_) {
        return text;
      }
    }

    return encodeURIComponent(text);
  }

  function moveToViewportRoot(widget) {
    if (!(widget instanceof HTMLElement)) return;

    /*
     * Um elemento position:fixed pode deixar de usar a viewport quando algum
     * ancestral possui transform, filter, perspective, contain ou animações de
     * reveal. O Imobify envolve as seções em elementos desse tipo.
     *
     * Por isso o widget é movido para document.body. Assim ele fica visível
     * desde o carregamento e não depende da posição da seção na página.
     */
    if (widget.parentElement !== document.body) {
      widget.dataset.iwfpOriginalParent = "section";
      document.body.appendChild(widget);
    }
  }

  function configureWidget(widget) {
    if (!(widget instanceof HTMLElement)) return;

    moveToViewportRoot(widget);

    const button = widget.querySelector(".iwfp-button");
    if (!(button instanceof HTMLAnchorElement)) return;

    const phone = sanitizePhone(widget.dataset.phone);
    const encodedMessage = safeEncodedMessage(
      widget.dataset.message,
      widget.dataset.urlEncoding
    );

    const url = phone
      ? `https://wa.me/${phone}${encodedMessage ? `?text=${encodedMessage}` : ""}`
      : "#";

    widget.dataset.corner = POSITION_MAP[widget.dataset.position] || "bottom-right";
    widget.dataset.label = String(asBoolean(widget.dataset.showLabel));
    widget.dataset.pulse = String(asBoolean(widget.dataset.pulse));
    widget.dataset.bubble = String(asBoolean(widget.dataset.showHoverBubble));
    widget.dataset.hoverPhoto = String(Boolean(String(widget.dataset.hoverImage || "").trim()));

    widget.style.setProperty(
      "--iwfp-offset-x",
      `${Math.max(0, Number(widget.dataset.offsetX) || 0)}px`
    );
    widget.style.setProperty(
      "--iwfp-offset-y",
      `${Math.max(0, Number(widget.dataset.offsetY) || 0)}px`
    );
    widget.style.setProperty(
      "--iwfp-size",
      `${Math.max(44, Number(widget.dataset.buttonSize) || 58)}px`
    );

    button.href = url;

    if (asBoolean(widget.dataset.openNewTab)) {
      button.target = "_blank";
      button.rel = "noopener noreferrer";
    } else {
      button.removeAttribute("target");
      button.removeAttribute("rel");
    }

    button.setAttribute("aria-disabled", phone ? "false" : "true");

    if (!button.dataset.iwfpClickBound) {
      button.addEventListener("click", function (event) {
        if (!sanitizePhone(widget.dataset.phone)) {
          event.preventDefault();
        }
      });
      button.dataset.iwfpClickBound = "true";
    }

    widget.dataset.iwfpReady = "true";
  }

  function initializeAll(root) {
    const scope = root instanceof Element || root instanceof Document ? root : document;

    if (scope instanceof Element && scope.matches(".iwfp-widget")) {
      configureWidget(scope);
    }

    scope.querySelectorAll(".iwfp-widget").forEach(configureWidget);
  }

  function start() {
    initializeAll(document);

    const observer = new MutationObserver(function (mutations) {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          const target = mutation.target;
          if (target instanceof HTMLElement && target.matches(".iwfp-widget")) {
            configureWidget(target);
          }
          continue;
        }

        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          initializeAll(node);
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-phone",
        "data-message",
        "data-url-encoding",
        "data-position",
        "data-offset-x",
        "data-offset-y",
        "data-button-size",
        "data-show-label",
        "data-pulse",
        "data-show-hover-bubble",
        "data-hover-image",
        "data-open-new-tab"
      ]
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();


(function () {
  "use strict";

  const PLUGIN_ID = "anti-ia-copy-policy";
  const POLICY_NODE_ID = "imobify-anti-ai-policy";
  const JSONLD_ID = "imobify-anti-ai-rights-jsonld";
  const META_ATTR = "data-imobify-anti-ai";

  function toBoolean(value) {
    return String(value).toLowerCase() === "true";
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function setMeta(name, content) {
    let meta = document.head.querySelector(`meta[name="${name}"][${META_ATTR}]`);

    if (!content) {
      if (meta) meta.remove();
      return;
    }

    if (!meta) {
      meta = document.createElement("meta");
      meta.name = name;
      meta.setAttribute(META_ATTR, "true");
      document.head.appendChild(meta);
    }

    meta.content = content;
  }

  function removeGeneratedMetadata() {
    document.head
      .querySelectorAll(`[${META_ATTR}]`)
      .forEach((element) => element.remove());

    document.getElementById(JSONLD_ID)?.remove();
    document.getElementById(POLICY_NODE_ID)?.remove();
  }

  function buildPolicy(config) {
    const restrictions = [];

    if (config.blockReproduction) {
      restrictions.push("cópia, reprodução, redistribuição, adaptação e criação de obras derivadas");
    }

    if (config.blockTraining) {
      restrictions.push("treinamento, ajuste, avaliação, mineração ou alimentação de sistemas de inteligência artificial");
    }

    if (config.blockSummarization) {
      restrictions.push("resumo automatizado ou reformulação substancial por sistemas de inteligência artificial");
    }

    const restrictionText = restrictions.length
      ? `Não autorizado para ${restrictions.join("; ")} sem autorização expressa do titular.`
      : "Uso sujeito aos direitos autorais e às condições declaradas pelo titular.";

    return [
      config.directive,
      restrictionText,
      config.owner ? `Titular: ${config.owner}.` : "",
      config.siteName ? `Obra/site: ${config.siteName}.` : "",
      config.copyrightYear ? `Ano: ${config.copyrightYear}.` : "",
      config.licenseUrl ? `Termos de uso: ${config.licenseUrl}.` : "",
      config.contactUrl ? `Contato para licenciamento: ${config.contactUrl}.` : ""
    ].filter(Boolean).join(" ");
  }

  function injectPolicy(config) {
    removeGeneratedMetadata();

    const policy = buildPolicy(config);
    const copyrightNotice = [
      config.copyrightYear ? `© ${config.copyrightYear}` : "©",
      config.owner || config.siteName || "Todos os direitos reservados"
    ].join(" ");

    const policyNode = document.createElement("aside");
    policyNode.id = POLICY_NODE_ID;
    policyNode.className = "aicp-machine-policy";
    policyNode.setAttribute("aria-hidden", "true");
    policyNode.setAttribute("data-ai-usage-policy", config.blockTraining ? "no-training" : "restricted");
    policyNode.setAttribute("data-content-license", config.licenseUrl || "all-rights-reserved");
    policyNode.textContent = policy;
    document.body.appendChild(policyNode);

    setMeta("copyright", copyrightNotice);
    setMeta("rights", policy);
    setMeta("ai-usage-policy", config.blockTraining ? "no-training" : "restricted-use");
    setMeta("content-license", config.licenseUrl || "all-rights-reserved");

    if (config.addNoAiMeta) {
      setMeta("robots", "noai, noimageai");
      setMeta("googlebot", "noai, noimageai");
    }

    if (config.addJsonLd) {
      const data = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "name": config.siteName || document.title || "Conteúdo protegido",
        "copyrightNotice": copyrightNotice,
        "copyrightYear": config.copyrightYear || undefined,
        "copyrightHolder": config.owner
          ? { "@type": "Person", "name": config.owner }
          : undefined,
        "license": config.licenseUrl || undefined,
        "usageInfo": config.licenseUrl || config.contactUrl || undefined,
        "description": policy
      };

      Object.keys(data).forEach((key) => {
        if (data[key] === undefined || data[key] === "") delete data[key];
      });

      const script = document.createElement("script");
      script.id = JSONLD_ID;
      script.type = "application/ld+json";
      script.setAttribute(META_ATTR, "true");
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    }
  }

  function readConfig(root) {
    const source = root.querySelector(".aicp-config");
    if (!source) return null;

    return {
      owner: clean(source.dataset.owner),
      siteName: clean(source.dataset.siteName),
      copyrightYear: clean(source.dataset.year),
      contactUrl: clean(source.dataset.contactUrl),
      licenseUrl: clean(source.dataset.licenseUrl),
      blockTraining: toBoolean(source.dataset.blockTraining),
      blockReproduction: toBoolean(source.dataset.blockReproduction),
      blockSummarization: toBoolean(source.dataset.blockSummarization),
      addNoAiMeta: toBoolean(source.dataset.addNoaiMeta),
      addJsonLd: toBoolean(source.dataset.addJsonld),
      directive: clean(source.querySelector(".aicp-directive-source")?.textContent)
    };
  }

  function initialize() {
    const instances = Array.from(document.querySelectorAll(`[data-plugin="${PLUGIN_ID}"]`));
    if (!instances.length) return;

    /* A última instância configurada prevalece para evitar metadados duplicados. */
    const config = readConfig(instances[instances.length - 1]);
    if (config) injectPolicy(config);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();


(function () {
  'use strict';

  var GOOGLE_FONTS = new Set(['Inter','Montserrat','Poppins','Manrope','Josefin Sans','Raleway','Roboto','Lato','Oswald','Playfair Display']);

  function bool(value) { return value === true || value === 'true' || value === '1'; }
  function cssFont(value) { return String(value || '').replace(/[;{}]/g, '').trim(); }

  function loadFont(name) {
    if (!GOOGLE_FONTS.has(name)) return;
    var id = 'imobify-menu-font-' + name.toLowerCase().replace(/\s+/g, '-');
    if (document.getElementById(id)) return;
    var link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + ':wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
  }

  function parseItems(text) {
    return String(text || '').split(/\r?\n/).map(function (line) {
      var clean = line.trim();
      if (!clean) return null;
      var splitAt = clean.indexOf('|');
      if (splitAt < 0) return { label: clean, href: '#' };
      return { label: clean.slice(0, splitAt).trim(), href: clean.slice(splitAt + 1).trim() || '#' };
    }).filter(Boolean);
  }

  function setFont(nav) {
    var node = nav.querySelector('.imobify-menu-pro__font');
    var selected = node ? node.dataset.font : 'Perfil do projeto';
    var custom = node ? cssFont(node.dataset.customFont) : '';
    var family;
    if (selected === 'Perfil do projeto') family = 'var(--body)';
    else if (selected === 'Sistema') family = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    else if (selected === 'Personalizada' && custom) family = custom;
    else {
      loadFont(selected);
      family = '"' + selected + '", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    }
    nav.style.setProperty('--imp-font', family);
  }

  function buildLinks(nav) {
    var source = nav.querySelector('.imobify-menu-pro__source');
    var list = nav.querySelector('.imobify-menu-pro__links');
    if (!list) return;
    list.textContent = '';
    parseItems(source ? source.value || source.textContent : '').forEach(function (item) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.textContent = item.label;
      a.href = item.href;
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function updateMobileRule(nav) {
    var bp = Math.max(320, Math.min(1600, Number(nav.dataset.mobileBreakpoint) || 768));
    var id = 'imobify-menu-pro-breakpoint';
    var style = document.getElementById(id);
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = '@media (max-width:' + bp + 'px){.imobify-menu-pro__toggle{display:block!important}.imobify-menu-pro__panel{position:fixed}.imobify-menu-pro__links{flex-direction:column;align-items:stretch}}';
  }

  function init(nav) {
    if (!nav || nav.dataset.ready === 'true') return;
    nav.dataset.ready = 'true';

    var section = nav.closest('[data-section-id]');
    var instanceId = section ? section.getAttribute('data-section-id') : ('menu-' + Math.random().toString(36).slice(2));
    nav.dataset.instanceId = instanceId;

    document.querySelectorAll('.imobify-menu-pro[data-instance-id="' + CSS.escape(instanceId) + '"]').forEach(function (old) {
      if (old !== nav) old.remove();
    });

    buildLinks(nav);
    setFont(nav);
    updateMobileRule(nav);

    if (nav.parentElement !== document.body) document.body.appendChild(nav);
    if (section) {
      section.style.minHeight = '0';
      section.style.height = '0';
      section.style.padding = '0';
      section.style.margin = '0';
      section.style.overflow = 'visible';
    }

    var toggle = nav.querySelector('.imobify-menu-pro__toggle');
    var links = nav.querySelector('.imobify-menu-pro__links');
    var lastY = window.scrollY;
    var ticking = false;

    function close() {
      nav.classList.remove('is-open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
      document.documentElement.classList.remove('imobify-menu-open');
    }

    function onScroll() {
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      var threshold = Number(nav.dataset.scrollThreshold) || 0;
      var active = y > threshold;
      nav.classList.toggle('is-scrolled', active);
      if (nav.dataset.scrollEffect === 'ocultar ao descer' && active) {
        nav.classList.toggle('is-hidden-scroll', y > lastY && y - lastY > 2 && !nav.classList.contains('is-open'));
      } else nav.classList.remove('is-hidden-scroll');
      lastY = y;
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();

    if (toggle) toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    if (links) links.addEventListener('click', function (event) {
      var anchor = event.target.closest('a');
      if (!anchor) return;
      var href = anchor.getAttribute('href') || '';
      if (bool(nav.dataset.closeOnClick)) close();
      if (!bool(nav.dataset.smoothScroll) || href.charAt(0) !== '#' || href === '#') return;
      var target;
      try { target = document.querySelector(href); } catch (_) { target = null; }
      if (!target) return;
      event.preventDefault();
      var menuHeight = nav.getBoundingClientRect().height;
      var offset = nav.dataset.position === 'topo' ? menuHeight + 8 : 8;
      var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });

    document.addEventListener('click', function (event) {
      if (nav.classList.contains('is-open') && !nav.contains(event.target)) close();
    });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape') close(); });
  }

  function scan(root) {
    (root || document).querySelectorAll('.imobify-menu-pro:not([data-ready="true"])').forEach(init);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { scan(document); });
  else scan(document);

  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (!(node instanceof Element)) return;
        if (node.matches('.imobify-menu-pro')) init(node);
        scan(node);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();


(function(){
  'use strict';
  function installFallback(image){
    if(image.dataset.footerIconFallback==='true')return;
    image.dataset.footerIconFallback='true';
    image.addEventListener('error',()=>{
      const fallback=document.createElement('i');
      fallback.className='fa-solid fa-link';
      fallback.setAttribute('aria-hidden','true');
      image.replaceWith(fallback);
    },{once:true});
  }
  function init(scope=document){
    scope.querySelectorAll('[data-plugin="footer"] .footer-social-icon img').forEach(installFallback);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init(),{once:true});
  else init();
})();


(function(){if(!('IntersectionObserver'in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;document.documentElement.classList.add('reveal-ready');const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.08});document.querySelectorAll('.section-shell:not([data-plugin="parallax"]):not([data-plugin="scrollytelling-video-pro"])').forEach(section=>observer.observe(section));})();


(function(){const triggers=document.querySelectorAll('[data-lightbox-src]');if(!triggers.length)return;const box=document.createElement('div');box.className='imobify-lightbox';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.innerHTML='<button aria-label="Fechar">×</button><img alt="Imagem ampliada">';document.body.append(box);const close=()=>{box.classList.remove('is-open');document.body.classList.remove('no-scroll');};triggers.forEach(trigger=>trigger.addEventListener('click',()=>{box.querySelector('img').src=trigger.dataset.lightboxSrc;box.classList.add('is-open');document.body.classList.add('no-scroll');box.querySelector('button').focus();}));box.addEventListener('click',event=>{if(event.target===box||event.target.tagName==='BUTTON')close();});addEventListener('keydown',event=>{if(event.key==='Escape')close();});})();


(function () {
  "use strict";

  const ROOT_CLASS = "imobify-content-protection";
  const READY_ATTRIBUTE = "data-content-protection-ready";

  function isEditableElement(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    return Boolean(
      element.closest(
        'input, textarea, select, [contenteditable="true"], [data-allow-copy]'
      )
    );
  }

  function blockEvent(event) {
    if (isEditableElement(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function blockKeyboardShortcuts(event) {
    const key = String(event.key || "").toLowerCase();
    const ctrlOrCommand = event.ctrlKey || event.metaKey;

    if (isEditableElement(event.target)) {
      return;
    }

    const blockedShortcut =
      event.key === "F12" ||
      (ctrlOrCommand && key === "c") ||
      (ctrlOrCommand && key === "x") ||
      (ctrlOrCommand && key === "u") ||
      (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key)) ||
      (event.metaKey && event.altKey && ["i", "j", "c"].includes(key));

    if (!blockedShortcut) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function initialize() {
    const html = document.documentElement;

    if (html.hasAttribute(READY_ATTRIBUTE)) {
      return;
    }

    html.setAttribute(READY_ATTRIBUTE, "true");
    html.classList.add(ROOT_CLASS);

    document.addEventListener("contextmenu", blockEvent, true);
    document.addEventListener("selectstart", blockEvent, true);
    document.addEventListener("copy", blockEvent, true);
    document.addEventListener("cut", blockEvent, true);
    document.addEventListener("keydown", blockKeyboardShortcuts, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, {
      once: true
    });
  } else {
    initialize();
  }
})();
