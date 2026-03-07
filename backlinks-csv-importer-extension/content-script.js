"use strict";
(() => {
  // src/content-script.ts
  if (window.__autoCommentInjected) {
  } else {
    window.__autoCommentInjected = true;
  }
  var CAPTCHA_IMAGE_KEYWORDS = ["captcha", "verify", "verification", "seccode", "\u9A8C\u8BC1\u7801", "\u8A8D\u8A3C", "vcode"];
  var CAPTCHA_INPUT_KEYWORDS = ["captcha", "verify", "verification", "seccode", "\u9A8C\u8BC1\u7801", "\u8A8D\u8A3C", "vcode"];
  var COMPLEX_CAPTCHA_SELECTORS = [".g-recaptcha", '[class*="recaptcha"]', '[class*="hcaptcha"]', "[data-sitekey]"];
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
  function detectSimpleCaptcha() {
    const imgs = document.querySelectorAll("img");
    for (const img of imgs) {
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
        if (next && next.tagName === "INPUT" && next.type === "text") {
          input = next;
        }
      }
      if (!input) {
        const prev = img.previousElementSibling;
        if (prev && prev.tagName === "INPUT" && prev.type === "text") {
          input = prev;
        }
      }
      if (!input && img.parentElement) {
        input = img.parentElement.querySelector('input[type="text"]');
      }
      if (!input) continue;
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
    for (const form of allForms) {
      const interactiveEls = form.querySelectorAll(
        'input, textarea, select, button, [contenteditable="true"]'
      );
      if (interactiveEls.length === 0) continue;
      const elements = [];
      for (const el of interactiveEls) {
        const tag = el.tagName.toLowerCase();
        const inputType = el.getAttribute("type") || void 0;
        if (inputType === "hidden") continue;
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
    let hasCaptcha = false;
    const captchaSelectors = ['[class*="captcha"]', '[class*="recaptcha"]', ".g-recaptcha"];
    for (const sel of captchaSelectors) {
      if (document.querySelector(sel)) {
        hasCaptcha = true;
        break;
      }
    }
    if (!hasCaptcha) {
      for (const iframe of document.querySelectorAll("iframe")) {
        const src = (iframe.getAttribute("src") || "").toLowerCase();
        if (src.includes("captcha") || src.includes("recaptcha")) {
          hasCaptcha = true;
          break;
        }
      }
    }
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
      const detected = detectSimpleCaptcha();
      if (detected) {
        const imageData = await extractCaptchaImageData(detected.imgElement);
        if (imageData) {
          captchaInfo = {
            imageData,
            inputSelector: detected.inputSelector,
            type: "simple_image"
          };
        }
      }
    } catch {
    }
    return { title, bodyExcerpt, forms: formSnapshots, hasCaptcha, captchaInfo, htmlAllowed, errorMessages, pageLang };
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
        console.warn(`[auto-comment] \u627E\u4E0D\u5230\u5143\u7D20: ${action.selector}`);
        continue;
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
          await scrollTo(el);
          await randomDelay(300, 500);
          el.click();
          break;
      }
    }
    return { success: true };
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
        return true;
      }
    );
  }
})();
