"use strict";
(() => {
  // src/form-field-heuristics.ts
  var HONEYPOT_TEXT_PATTERNS = [
    "leave this field empty",
    "we use this field to detect spam bots",
    "if you fill this in, you will be marked as a spammer",
    "marked as a spammer",
    "do not fill",
    "anti-spam",
    "honeypot"
  ];
  var HONEYPOT_ATTR_PATTERNS = [
    "honeypot",
    "captcha2_h",
    "-hp",
    "_hp",
    "hp-"
  ];
  function normalizeText(value) {
    return (value || "").trim().toLowerCase();
  }
  function isTextEntryControl(el) {
    if (el instanceof HTMLTextAreaElement) return true;
    if (!(el instanceof HTMLInputElement)) return false;
    const inputType = normalizeText(el.type || "text");
    return ![
      "hidden",
      "checkbox",
      "radio",
      "submit",
      "button",
      "reset",
      "range",
      "color",
      "date",
      "datetime-local",
      "month",
      "time",
      "week",
      "file",
      "image"
    ].includes(inputType);
  }
  function hasVisuallyHiddenStyles(style) {
    const clip = normalizeText(style.clip);
    const clipPath = normalizeText(style.clipPath);
    return clip.includes("rect(1px, 1px, 1px, 1px)") || clip.includes("rect(0px, 0px, 0px, 0px)") || clipPath.includes("inset(50%)") || clipPath.includes("circle(0") || style.pointerEvents === "none";
  }
  function isOffscreen(rect) {
    return rect.right < -50 || rect.bottom < -50 || rect.left < -500 || rect.top < -500;
  }
  function getFieldSignals(el) {
    return [
      el.getAttribute("name"),
      el.getAttribute("id"),
      el.getAttribute("placeholder"),
      el.getAttribute("aria-label"),
      el.getAttribute("class"),
      el.getAttribute("autocomplete"),
      el.getAttribute("data-form-type"),
      el.textContent
    ].map(normalizeText).filter(Boolean);
  }
  function isLikelyHoneypotField(el) {
    const signals = getFieldSignals(el);
    if (signals.some((signal) => HONEYPOT_TEXT_PATTERNS.some((pattern) => signal.includes(pattern)))) {
      return true;
    }
    if (signals.some((signal) => HONEYPOT_ATTR_PATTERNS.some((pattern) => signal.includes(pattern)))) {
      return true;
    }
    const ariaHidden = normalizeText(el.getAttribute("aria-hidden")) === "true";
    const tabIndex = el.getAttribute("tabindex");
    if (ariaHidden && tabIndex === "-1") {
      return true;
    }
    return false;
  }
  function isElementVisibleForInteraction(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hidden) return false;
    if (normalizeText(el.getAttribute("aria-hidden")) === "true") return false;
    if (el instanceof HTMLInputElement && normalizeText(el.type) === "hidden") return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    if (hasVisuallyHiddenStyles(style)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    if (isOffscreen(rect)) return false;
    if (isTextEntryControl(el) && (rect.width < 24 || rect.height < 8)) {
      return false;
    }
    return true;
  }
  function shouldExposeElementToAI(el) {
    if (!isElementVisibleForInteraction(el)) return false;
    if (isLikelyHoneypotField(el)) return false;
    return true;
  }
  function isSafeActionTarget(el, actionType) {
    if (!(el instanceof HTMLElement)) return false;
    if (actionType === "scroll") return true;
    if (isLikelyHoneypotField(el)) return false;
    return isElementVisibleForInteraction(el);
  }

  // src/content-script.ts
  if (window.__autoCommentInjected) {
  } else {
    window.__autoCommentInjected = true;
  }
  var CAPTCHA_IMAGE_KEYWORDS = ["captcha", "seccode", "\u9A8C\u8BC1\u7801", "\u9A57\u8B49\u78BC", "\u8A8D\u8A3C", "\u8A8D\u8A3C\u30B3\u30FC\u30C9"];
  var CAPTCHA_INPUT_KEYWORDS = ["captcha", "seccode", "\u9A8C\u8BC1\u7801", "\u9A57\u8B49\u78BC", "\u8A8D\u8A3C", "\u8A8D\u8A3C\u30B3\u30FC\u30C9"];
  var COMPLEX_CAPTCHA_SELECTORS = [".g-recaptcha", '[class*="recaptcha"]', '[class*="hcaptcha"]', "[data-sitekey]"];
  var COMMENT_FIELD_KEYWORDS = ["comment", "message", "content", "review", "reply", "\u7559\u8A00", "\u8BC4\u8BBA", "\u8A55\u8AD6", "\u30B3\u30E1\u30F3\u30C8", "\u672C\u6587"];
  var IDENTITY_FIELD_KEYWORDS = ["author", "name", "email", "mail", "url", "website", "homepage", "\u6635\u79F0", "\u59D3\u540D", "\u540D\u524D"];
  function normalizeText2(value) {
    return (value || "").trim().toLowerCase();
  }
  function isElementVisible(el) {
    return isElementVisibleForInteraction(el);
  }
  function elementMatchesKeywords(el, keywords) {
    const attrs = [
      el.getAttribute("name"),
      el.getAttribute("id"),
      el.getAttribute("placeholder"),
      el.getAttribute("aria-label"),
      el.getAttribute("class"),
      el.textContent
    ];
    return attrs.some((attr) => {
      const normalized = normalizeText2(attr);
      return normalized && keywords.some((kw) => normalized.includes(kw.toLowerCase()));
    });
  }
  function isLikelyCommentForm(form) {
    const hasVisibleSubmit = Array.from(form.querySelectorAll('button, input[type="submit"], input[type="button"]')).some((el) => isElementVisible(el));
    const hasCommentField = Array.from(form.querySelectorAll('textarea, [contenteditable="true"], input[type="text"]')).some((el) => {
      if (!isElementVisible(el)) return false;
      if (el.matches('textarea, [contenteditable="true"]')) return true;
      return elementMatchesKeywords(el, COMMENT_FIELD_KEYWORDS);
    });
    const hasIdentityField = Array.from(form.querySelectorAll("input, textarea")).some((el) => isElementVisible(el) && elementMatchesKeywords(el, IDENTITY_FIELD_KEYWORDS));
    return hasVisibleSubmit && (hasCommentField || hasIdentityField);
  }
  function getRelevantCaptchaScopes(forms) {
    if (forms.length > 0) {
      return forms;
    }
    const commentContainers = ["#comments", ".comments", "#respond", ".comment-respond", ".comments-area"];
    for (const selector of commentContainers) {
      const el = document.querySelector(selector);
      if (el) return [el];
    }
    return [document];
  }
  function collectCaptchaSignals(scopes) {
    const signals = /* @__PURE__ */ new Set();
    for (const scope of scopes) {
      for (const selector of COMPLEX_CAPTCHA_SELECTORS) {
        const matches = scope.querySelectorAll(selector);
        for (const el of matches) {
          if (isElementVisible(el)) {
            signals.add(`\u590D\u6742\u9A8C\u8BC1\u7801\u5143\u7D20: ${buildSelector(el)}`);
          }
        }
      }
      const genericMatches = scope.querySelectorAll('[class*="captcha"], [id*="captcha"], [aria-label*="captcha" i]');
      for (const el of genericMatches) {
        if (isElementVisible(el)) {
          signals.add(`\u9A8C\u8BC1\u7801\u76F8\u5173\u5143\u7D20: ${buildSelector(el)}`);
        }
      }
      const iframes = scope.querySelectorAll("iframe");
      for (const iframe of iframes) {
        const src = normalizeText2(iframe.getAttribute("src"));
        if (src && (src.includes("captcha") || src.includes("recaptcha") || src.includes("hcaptcha")) && isElementVisible(iframe)) {
          signals.add(`\u9A8C\u8BC1\u7801 iframe: ${buildSelector(iframe)}`);
        }
      }
    }
    return Array.from(signals);
  }
  function buildSelector(el, depth = 0) {
    if (depth > 5 || !el || el === document.documentElement || el === document.body) {
      return el?.tagName?.toLowerCase() || "body";
    }
    if (el.id) {
      try {
        const escaped = `#${CSS.escape(el.id)}`;
        if (document.querySelector(escaped) === el) return escaped;
      } catch {
      }
    }
    const tag = el.tagName.toLowerCase();
    const name = el.getAttribute("name");
    if (name) {
      try {
        const sel = `${tag}[name="${name.replace(/"/g, '\\"')}"]`;
        if (document.querySelector(sel) === el) return sel;
      } catch {
      }
    }
    const parent = el.parentElement;
    if (parent && parent !== document.documentElement && parent !== document.body) {
      const parentSel = buildSelector(parent, depth + 1);
      return `${parentSel} > ${tag}:nth-child(${Array.from(parent.children).indexOf(el) + 1})`;
    }
    return tag;
  }
  function findLabel(el, form) {
    try {
      const id = el.getAttribute("id");
      if (id) {
        const label = form.querySelector(`label[for="${id.replace(/"/g, '\\"')}"]`);
        if (label?.textContent?.trim()) return label.textContent.trim();
      }
      const parentLabel = el.closest("label");
      if (parentLabel?.textContent?.trim()) return parentLabel.textContent.trim();
      const prev = el.previousElementSibling;
      if (prev && ["LABEL", "SPAN", "TD", "TH", "DT", "B", "STRONG"].includes(prev.tagName)) {
        if (prev.textContent?.trim()) return prev.textContent.trim();
      }
      const parentTd = el.closest("td");
      if (parentTd) {
        const prevTd = parentTd.previousElementSibling;
        if (prevTd?.textContent?.trim()) return prevTd.textContent.trim();
      }
      const parentTr = el.closest("tr");
      if (parentTr) {
        const firstCell = parentTr.querySelector("td, th");
        if (firstCell && firstCell !== el.closest("td") && firstCell.textContent?.trim()) {
          return firstCell.textContent.trim();
        }
      }
    } catch {
    }
    return "";
  }
  function detectSimpleCaptcha(scopes) {
    const imgs = scopes.flatMap((scope) => Array.from(scope.querySelectorAll("img")));
    for (const img of imgs) {
      if (!isElementVisible(img)) continue;
      const isInsideComplex = COMPLEX_CAPTCHA_SELECTORS.some((sel) => {
        try {
          return img.closest(sel) !== null;
        } catch {
          return false;
        }
      });
      if (isInsideComplex) continue;
      const attrs = [
        img.id || "",
        img.getAttribute("name") || "",
        img.className || "",
        img.src || "",
        img.alt || ""
      ];
      const isCaptchaImg = attrs.some(
        (attr) => CAPTCHA_IMAGE_KEYWORDS.some((kw) => attr.toLowerCase().includes(kw))
      );
      if (!isCaptchaImg) continue;
      let input = null;
      const form = img.closest("form");
      if (form) {
        const textInputs = form.querySelectorAll('input[type="text"]');
        for (const ti of textInputs) {
          const tiAttrs = [ti.name || "", ti.id || ""];
          const matches = tiAttrs.some(
            (a) => CAPTCHA_INPUT_KEYWORDS.some((kw) => a.toLowerCase().includes(kw))
          );
          if (matches) {
            input = ti;
            break;
          }
        }
      }
      if (!input) {
        const next = img.nextElementSibling;
        if (next && next.tagName === "INPUT" && next.type === "text" && isElementVisible(next)) {
          input = next;
        }
      }
      if (!input) {
        const prev = img.previousElementSibling;
        if (prev && prev.tagName === "INPUT" && prev.type === "text" && isElementVisible(prev)) {
          input = prev;
        }
      }
      if (!input && img.parentElement) {
        input = img.parentElement.querySelector('input[type="text"]');
      }
      if (!input || !isElementVisible(input)) continue;
      return { imgElement: img, inputSelector: buildSelector(input) };
    }
    return null;
  }
  async function extractCaptchaImageData(imgElement) {
    const src = imgElement.src || "";
    if (src.startsWith("data:image/")) {
      return src;
    }
    if (src) {
      try {
        const absoluteUrl = new URL(src, window.location.href).href;
        if (absoluteUrl.startsWith("http://") || absoluteUrl.startsWith("https://")) {
          if (imgElement.complete && imgElement.naturalWidth > 0) {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = imgElement.naturalWidth;
              canvas.height = imgElement.naturalHeight;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(imgElement, 0, 0);
                return canvas.toDataURL("image/png");
              }
            } catch (e) {
            }
          }
          return absoluteUrl;
        }
      } catch {
      }
    }
    if (!imgElement.complete || imgElement.naturalWidth === 0) {
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 3e3);
        imgElement.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        imgElement.onerror = () => {
          clearTimeout(timeout);
          resolve();
        };
      });
    }
    if (imgElement.complete && imgElement.naturalWidth > 0) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = imgElement.naturalWidth;
        canvas.height = imgElement.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(imgElement, 0, 0);
          return canvas.toDataURL("image/png");
        }
      } catch {
      }
    }
    if (src) {
      try {
        return new URL(src, window.location.href).href;
      } catch {
      }
    }
    return "";
  }
  async function capturePageSnapshot() {
    const title = document.querySelector("h1")?.textContent?.trim() || document.title.trim();
    const pageLang = document.documentElement.lang || document.querySelector('meta[http-equiv="content-language"]')?.getAttribute("content") || "";
    let bodyExcerpt = "";
    for (const sel of ["article", ".post-content", ".entry-content", "main", "body"]) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) {
        bodyExcerpt = el.textContent.trim().substring(0, 2e3);
        break;
      }
    }
    const formSnapshots = [];
    const allForms = document.querySelectorAll("form");
    const commentForms = [];
    for (const form of allForms) {
      const interactiveEls = form.querySelectorAll(
        'input, textarea, select, button, [contenteditable="true"]'
      );
      if (interactiveEls.length === 0) continue;
      if (form instanceof HTMLFormElement && isLikelyCommentForm(form)) {
        commentForms.push(form);
      }
      const elements = [];
      for (const el of interactiveEls) {
        const tag = el.tagName.toLowerCase();
        const inputType = el.getAttribute("type") || void 0;
        if (inputType === "hidden") continue;
        if (!shouldExposeElementToAI(el)) continue;
        const entry = {
          selector: buildSelector(el),
          tag,
          type: inputType,
          name: el.getAttribute("name") || void 0,
          id: el.getAttribute("id") || void 0,
          placeholder: el.getAttribute("placeholder") || void 0,
          label: findLabel(el, form),
          value: el.value || void 0
        };
        if (tag === "button" || inputType === "submit") {
          entry.text = el.textContent?.trim() || el.value || void 0;
        }
        elements.push(entry);
      }
      if (elements.length > 0) {
        formSnapshots.push({
          selector: buildSelector(form),
          elements
        });
      }
    }
    const standaloneEditable = document.querySelector(
      'div[contenteditable="true"]:not(form div[contenteditable="true"])'
    );
    if (standaloneEditable) {
      formSnapshots.push({
        selector: buildSelector(standaloneEditable),
        elements: [{
          selector: buildSelector(standaloneEditable),
          tag: "div",
          type: "contenteditable",
          label: "\u8BC4\u8BBA\u5185\u5BB9"
        }]
      });
    }
    const captchaScopes = getRelevantCaptchaScopes(commentForms);
    const captchaSignals = collectCaptchaSignals(captchaScopes);
    let hasCaptcha = captchaSignals.length > 0;
    const htmlHints = ["\u53EF\u4EE5\u4F7F\u7528\u7684 HTML \u6807\u7B7E", "You may use these HTML tags", "allowed HTML tags"];
    const pageText = document.body?.textContent || "";
    const htmlAllowed = htmlHints.some((h) => pageText.includes(h));
    const errorMessages = [];
    const errorSelectors = [
      ".error",
      ".alert",
      ".warning",
      ".notice",
      ".message",
      '[class*="error"]',
      '[class*="alert"]',
      '[class*="warning"]',
      '[role="alert"]',
      ".flash",
      ".notification"
    ];
    for (const sel of errorSelectors) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const text = el.textContent?.trim();
          if (text && text.length < 500 && text.length > 3) {
            errorMessages.push(text);
          }
        }
      } catch {
      }
    }
    let captchaInfo;
    try {
      const detected = detectSimpleCaptcha(captchaScopes);
      if (detected) {
        const imageData = await extractCaptchaImageData(detected.imgElement);
        if (imageData) {
          captchaInfo = {
            imageData,
            inputSelector: detected.inputSelector,
            type: "simple_image"
          };
          hasCaptcha = true;
          captchaSignals.push(`\u53EF\u81EA\u52A8\u8BC6\u522B\u7684\u56FE\u7247\u9A8C\u8BC1\u7801\uFF0C\u8F93\u5165\u6846: ${detected.inputSelector}`);
        }
      }
    } catch {
    }
    return {
      title,
      bodyExcerpt,
      forms: formSnapshots,
      hasCaptcha,
      captchaSignals,
      captchaInfo,
      htmlAllowed,
      errorMessages,
      pageLang
    };
  }
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function randomDelay(min, max) {
    return delay(min + Math.random() * (max - min));
  }
  async function scrollTo(el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await delay(800);
  }
  async function simulateClick(el) {
    await scrollTo(el);
    await randomDelay(300, 500);
    el.focus?.();
    const pointerOptions = { bubbles: true, cancelable: true, composed: true };
    const mouseOptions = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent("pointerdown", pointerOptions));
    el.dispatchEvent(new MouseEvent("mousedown", mouseOptions));
    await randomDelay(30, 80);
    el.dispatchEvent(new PointerEvent("pointerup", pointerOptions));
    el.dispatchEvent(new MouseEvent("mouseup", mouseOptions));
    el.click();
  }
  async function simulateTyping(el, text) {
    await scrollTo(el);
    await randomDelay(200, 400);
    el.focus();
    el.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await randomDelay(100, 250);
    el.value = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    for (const char of text) {
      el.dispatchEvent(new KeyboardEvent("keydown", {
        key: char,
        bubbles: true,
        cancelable: true
      }));
      el.value += char;
      el.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: char
      }));
      el.dispatchEvent(new KeyboardEvent("keyup", {
        key: char,
        bubbles: true,
        cancelable: true
      }));
      await randomDelay(Math.random() < 0.1 ? 120 : 30, Math.random() < 0.1 ? 300 : 90);
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await randomDelay(200, 400);
  }
  async function simulateContentEditableTyping(el, content) {
    await scrollTo(el);
    await randomDelay(200, 400);
    el.focus();
    el.innerHTML = "";
    await randomDelay(100, 200);
    el.innerHTML = content;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    await randomDelay(300, 500);
  }
  async function executeActions(actions) {
    for (const action of actions) {
      const el = document.querySelector(action.selector);
      if (!el) {
        return { success: false, error: `\u627E\u4E0D\u5230\u5143\u7D20: ${action.selector}` };
      }
      if (!isSafeActionTarget(el, action.type)) {
        return { success: false, error: `\u5143\u7D20\u4E0D\u53EF\u5B89\u5168\u64CD\u4F5C: ${action.selector}` };
      }
      switch (action.type) {
        case "scroll":
          await scrollTo(el);
          await randomDelay(300, 600);
          break;
        case "type": {
          const value = action.value || "";
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            await simulateTyping(el, value);
          } else if (el.isContentEditable) {
            await simulateContentEditableTyping(el, value);
          }
          await randomDelay(300, 600);
          break;
        }
        case "click":
          await simulateClick(el);
          break;
      }
    }
    return { success: true };
  }
  var COMMENT_AREA_SELECTORS = [
    "#comments",
    ".comments",
    "#respond",
    ".comment-list",
    "#comment-area",
    ".comment-area",
    "#disqus_thread",
    ".post-comments",
    "#reply-title",
    ".comments-area"
  ];
  async function scrollToComments() {
    const previousScrollY = window.scrollY;
    try {
      let found = false;
      let scrolledTo = "bottom";
      for (const selector of COMMENT_AREA_SELECTORS) {
        const el = document.querySelector(selector);
        if (el) {
          el.scrollIntoView({ behavior: "instant" });
          found = true;
          scrolledTo = "comments";
          break;
        }
      }
      if (!found) {
        window.scrollTo(0, document.body.scrollHeight);
      }
      await delay(500);
      return { success: true, found, scrolledTo, previousScrollY };
    } catch (error) {
      return { success: false, found: false, scrolledTo: "bottom", previousScrollY, error: error?.message || String(error) };
    }
  }
  function restoreScrollPosition(savedPosition) {
    window.scrollTo(0, savedPosition);
  }
  if (!window.__autoCommentListenerRegistered) {
    window.__autoCommentListenerRegistered = true;
    chrome.runtime.onMessage.addListener(
      (message, _sender, sendResponse) => {
        if (message.action === "snapshot-page") {
          (async () => {
            try {
              const snapshot = await capturePageSnapshot();
              sendResponse({ success: true, snapshot });
            } catch (error) {
              sendResponse({ success: false, error: `\u9875\u9762\u5FEB\u7167\u6355\u83B7\u5931\u8D25: ${error?.message || error}` });
            }
          })();
          return true;
        }
        if (message.action === "execute-actions") {
          const { actions } = message.payload;
          (async () => {
            try {
              const result = await executeActions(actions);
              sendResponse(result);
            } catch (error) {
              sendResponse({ success: false, error: "\u64CD\u4F5C\u6267\u884C\u5931\u8D25" });
            }
          })();
          return true;
        }
        if (message.action === "scroll-to-comments") {
          (async () => {
            try {
              const result = await scrollToComments();
              sendResponse(result);
            } catch (error) {
              sendResponse({ success: false, found: false, scrolledTo: "bottom", previousScrollY: 0, error: error?.message || "\u6EDA\u52A8\u5931\u8D25" });
            }
          })();
          return true;
        }
        if (message.action === "restore-scroll") {
          try {
            const { scrollY: savedScrollY } = message.payload;
            restoreScrollPosition(savedScrollY);
            sendResponse({ success: true });
          } catch (error) {
            sendResponse({ success: false, error: error?.message || "\u6062\u590D\u6EDA\u52A8\u4F4D\u7F6E\u5931\u8D25" });
          }
          return true;
        }
        return true;
      }
    );
  }
})();
