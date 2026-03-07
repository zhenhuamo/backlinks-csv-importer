"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/papaparse/papaparse.min.js
  var require_papaparse_min = __commonJS({
    "node_modules/papaparse/papaparse.min.js"(exports, module) {
      ((e, t) => {
        "function" == typeof define && define.amd ? define([], t) : "object" == typeof module && "undefined" != typeof exports ? module.exports = t() : e.Papa = t();
      })(exports, function r() {
        var n = "undefined" != typeof self ? self : "undefined" != typeof window ? window : void 0 !== n ? n : {};
        var d, s = !n.document && !!n.postMessage, a = n.IS_PAPA_WORKER || false, o = {}, h = 0, v = {};
        function u(e) {
          this._handle = null, this._finished = false, this._completed = false, this._halted = false, this._input = null, this._baseIndex = 0, this._partialLine = "", this._rowCount = 0, this._start = 0, this._nextChunk = null, this.isFirstChunk = true, this._completeResults = { data: [], errors: [], meta: {} }, function(e2) {
            var t = b(e2);
            t.chunkSize = parseInt(t.chunkSize), e2.step || e2.chunk || (t.chunkSize = null);
            this._handle = new i(t), (this._handle.streamer = this)._config = t;
          }.call(this, e), this.parseChunk = function(t, e2) {
            var i2 = parseInt(this._config.skipFirstNLines) || 0;
            if (this.isFirstChunk && 0 < i2) {
              let e3 = this._config.newline;
              e3 || (r2 = this._config.quoteChar || '"', e3 = this._handle.guessLineEndings(t, r2)), t = [...t.split(e3).slice(i2)].join(e3);
            }
            this.isFirstChunk && U(this._config.beforeFirstChunk) && void 0 !== (r2 = this._config.beforeFirstChunk(t)) && (t = r2), this.isFirstChunk = false, this._halted = false;
            var i2 = this._partialLine + t, r2 = (this._partialLine = "", this._handle.parse(i2, this._baseIndex, !this._finished));
            if (!this._handle.paused() && !this._handle.aborted()) {
              t = r2.meta.cursor, i2 = (this._finished || (this._partialLine = i2.substring(t - this._baseIndex), this._baseIndex = t), r2 && r2.data && (this._rowCount += r2.data.length), this._finished || this._config.preview && this._rowCount >= this._config.preview);
              if (a) n.postMessage({ results: r2, workerId: v.WORKER_ID, finished: i2 });
              else if (U(this._config.chunk) && !e2) {
                if (this._config.chunk(r2, this._handle), this._handle.paused() || this._handle.aborted()) return void (this._halted = true);
                this._completeResults = r2 = void 0;
              }
              return this._config.step || this._config.chunk || (this._completeResults.data = this._completeResults.data.concat(r2.data), this._completeResults.errors = this._completeResults.errors.concat(r2.errors), this._completeResults.meta = r2.meta), this._completed || !i2 || !U(this._config.complete) || r2 && r2.meta.aborted || (this._config.complete(this._completeResults, this._input), this._completed = true), i2 || r2 && r2.meta.paused || this._nextChunk(), r2;
            }
            this._halted = true;
          }, this._sendError = function(e2) {
            U(this._config.error) ? this._config.error(e2) : a && this._config.error && n.postMessage({ workerId: v.WORKER_ID, error: e2, finished: false });
          };
        }
        function f(e) {
          var r2;
          (e = e || {}).chunkSize || (e.chunkSize = v.RemoteChunkSize), u.call(this, e), this._nextChunk = s ? function() {
            this._readChunk(), this._chunkLoaded();
          } : function() {
            this._readChunk();
          }, this.stream = function(e2) {
            this._input = e2, this._nextChunk();
          }, this._readChunk = function() {
            if (this._finished) this._chunkLoaded();
            else {
              if (r2 = new XMLHttpRequest(), this._config.withCredentials && (r2.withCredentials = this._config.withCredentials), s || (r2.onload = y(this._chunkLoaded, this), r2.onerror = y(this._chunkError, this)), r2.open(this._config.downloadRequestBody ? "POST" : "GET", this._input, !s), this._config.downloadRequestHeaders) {
                var e2, t = this._config.downloadRequestHeaders;
                for (e2 in t) r2.setRequestHeader(e2, t[e2]);
              }
              var i2;
              this._config.chunkSize && (i2 = this._start + this._config.chunkSize - 1, r2.setRequestHeader("Range", "bytes=" + this._start + "-" + i2));
              try {
                r2.send(this._config.downloadRequestBody);
              } catch (e3) {
                this._chunkError(e3.message);
              }
              s && 0 === r2.status && this._chunkError();
            }
          }, this._chunkLoaded = function() {
            4 === r2.readyState && (r2.status < 200 || 400 <= r2.status ? this._chunkError() : (this._start += this._config.chunkSize || r2.responseText.length, this._finished = !this._config.chunkSize || this._start >= ((e2) => null !== (e2 = e2.getResponseHeader("Content-Range")) ? parseInt(e2.substring(e2.lastIndexOf("/") + 1)) : -1)(r2), this.parseChunk(r2.responseText)));
          }, this._chunkError = function(e2) {
            e2 = r2.statusText || e2;
            this._sendError(new Error(e2));
          };
        }
        function l(e) {
          (e = e || {}).chunkSize || (e.chunkSize = v.LocalChunkSize), u.call(this, e);
          var i2, r2, n2 = "undefined" != typeof FileReader;
          this.stream = function(e2) {
            this._input = e2, r2 = e2.slice || e2.webkitSlice || e2.mozSlice, n2 ? ((i2 = new FileReader()).onload = y(this._chunkLoaded, this), i2.onerror = y(this._chunkError, this)) : i2 = new FileReaderSync(), this._nextChunk();
          }, this._nextChunk = function() {
            this._finished || this._config.preview && !(this._rowCount < this._config.preview) || this._readChunk();
          }, this._readChunk = function() {
            var e2 = this._input, t = (this._config.chunkSize && (t = Math.min(this._start + this._config.chunkSize, this._input.size), e2 = r2.call(e2, this._start, t)), i2.readAsText(e2, this._config.encoding));
            n2 || this._chunkLoaded({ target: { result: t } });
          }, this._chunkLoaded = function(e2) {
            this._start += this._config.chunkSize, this._finished = !this._config.chunkSize || this._start >= this._input.size, this.parseChunk(e2.target.result);
          }, this._chunkError = function() {
            this._sendError(i2.error);
          };
        }
        function c(e) {
          var i2;
          u.call(this, e = e || {}), this.stream = function(e2) {
            return i2 = e2, this._nextChunk();
          }, this._nextChunk = function() {
            var e2, t;
            if (!this._finished) return e2 = this._config.chunkSize, i2 = e2 ? (t = i2.substring(0, e2), i2.substring(e2)) : (t = i2, ""), this._finished = !i2, this.parseChunk(t);
          };
        }
        function p(e) {
          u.call(this, e = e || {});
          var t = [], i2 = true, r2 = false;
          this.pause = function() {
            u.prototype.pause.apply(this, arguments), this._input.pause();
          }, this.resume = function() {
            u.prototype.resume.apply(this, arguments), this._input.resume();
          }, this.stream = function(e2) {
            this._input = e2, this._input.on("data", this._streamData), this._input.on("end", this._streamEnd), this._input.on("error", this._streamError);
          }, this._checkIsFinished = function() {
            r2 && 1 === t.length && (this._finished = true);
          }, this._nextChunk = function() {
            this._checkIsFinished(), t.length ? this.parseChunk(t.shift()) : i2 = true;
          }, this._streamData = y(function(e2) {
            try {
              t.push("string" == typeof e2 ? e2 : e2.toString(this._config.encoding)), i2 && (i2 = false, this._checkIsFinished(), this.parseChunk(t.shift()));
            } catch (e3) {
              this._streamError(e3);
            }
          }, this), this._streamError = y(function(e2) {
            this._streamCleanUp(), this._sendError(e2);
          }, this), this._streamEnd = y(function() {
            this._streamCleanUp(), r2 = true, this._streamData("");
          }, this), this._streamCleanUp = y(function() {
            this._input.removeListener("data", this._streamData), this._input.removeListener("end", this._streamEnd), this._input.removeListener("error", this._streamError);
          }, this);
        }
        function i(m2) {
          var n2, s2, a2, t, o2 = Math.pow(2, 53), h2 = -o2, u2 = /^\s*-?(\d+\.?|\.\d+|\d+\.\d+)([eE][-+]?\d+)?\s*$/, d2 = /^((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)))$/, i2 = this, r2 = 0, f2 = 0, l2 = false, e = false, c2 = [], p2 = { data: [], errors: [], meta: {} };
          function y2(e2) {
            return "greedy" === m2.skipEmptyLines ? "" === e2.join("").trim() : 1 === e2.length && 0 === e2[0].length;
          }
          function g2() {
            if (p2 && a2 && (k("Delimiter", "UndetectableDelimiter", "Unable to auto-detect delimiting character; defaulted to '" + v.DefaultDelimiter + "'"), a2 = false), m2.skipEmptyLines && (p2.data = p2.data.filter(function(e3) {
              return !y2(e3);
            })), _2()) {
              let t3 = function(e3, t4) {
                U(m2.transformHeader) && (e3 = m2.transformHeader(e3, t4)), c2.push(e3);
              };
              var t2 = t3;
              if (p2) if (Array.isArray(p2.data[0])) {
                for (var e2 = 0; _2() && e2 < p2.data.length; e2++) p2.data[e2].forEach(t3);
                p2.data.splice(0, 1);
              } else p2.data.forEach(t3);
            }
            function i3(e3, t3) {
              for (var i4 = m2.header ? {} : [], r4 = 0; r4 < e3.length; r4++) {
                var n3 = r4, s3 = e3[r4], s3 = ((e4, t4) => ((e5) => (m2.dynamicTypingFunction && void 0 === m2.dynamicTyping[e5] && (m2.dynamicTyping[e5] = m2.dynamicTypingFunction(e5)), true === (m2.dynamicTyping[e5] || m2.dynamicTyping)))(e4) ? "true" === t4 || "TRUE" === t4 || "false" !== t4 && "FALSE" !== t4 && (((e5) => {
                  if (u2.test(e5)) {
                    e5 = parseFloat(e5);
                    if (h2 < e5 && e5 < o2) return 1;
                  }
                })(t4) ? parseFloat(t4) : d2.test(t4) ? new Date(t4) : "" === t4 ? null : t4) : t4)(n3 = m2.header ? r4 >= c2.length ? "__parsed_extra" : c2[r4] : n3, s3 = m2.transform ? m2.transform(s3, n3) : s3);
                "__parsed_extra" === n3 ? (i4[n3] = i4[n3] || [], i4[n3].push(s3)) : i4[n3] = s3;
              }
              return m2.header && (r4 > c2.length ? k("FieldMismatch", "TooManyFields", "Too many fields: expected " + c2.length + " fields but parsed " + r4, f2 + t3) : r4 < c2.length && k("FieldMismatch", "TooFewFields", "Too few fields: expected " + c2.length + " fields but parsed " + r4, f2 + t3)), i4;
            }
            var r3;
            p2 && (m2.header || m2.dynamicTyping || m2.transform) && (r3 = 1, !p2.data.length || Array.isArray(p2.data[0]) ? (p2.data = p2.data.map(i3), r3 = p2.data.length) : p2.data = i3(p2.data, 0), m2.header && p2.meta && (p2.meta.fields = c2), f2 += r3);
          }
          function _2() {
            return m2.header && 0 === c2.length;
          }
          function k(e2, t2, i3, r3) {
            e2 = { type: e2, code: t2, message: i3 };
            void 0 !== r3 && (e2.row = r3), p2.errors.push(e2);
          }
          U(m2.step) && (t = m2.step, m2.step = function(e2) {
            p2 = e2, _2() ? g2() : (g2(), 0 !== p2.data.length && (r2 += e2.data.length, m2.preview && r2 > m2.preview ? s2.abort() : (p2.data = p2.data[0], t(p2, i2))));
          }), this.parse = function(e2, t2, i3) {
            var r3 = m2.quoteChar || '"', r3 = (m2.newline || (m2.newline = this.guessLineEndings(e2, r3)), a2 = false, m2.delimiter ? U(m2.delimiter) && (m2.delimiter = m2.delimiter(e2), p2.meta.delimiter = m2.delimiter) : ((r3 = ((e3, t3, i4, r4, n3) => {
              var s3, a3, o3, h3;
              n3 = n3 || [",", "	", "|", ";", v.RECORD_SEP, v.UNIT_SEP];
              for (var u3 = 0; u3 < n3.length; u3++) {
                for (var d3, f3 = n3[u3], l3 = 0, c3 = 0, p3 = 0, g3 = (o3 = void 0, new E({ comments: r4, delimiter: f3, newline: t3, preview: 10 }).parse(e3)), _3 = 0; _3 < g3.data.length; _3++) i4 && y2(g3.data[_3]) ? p3++ : (d3 = g3.data[_3].length, c3 += d3, void 0 === o3 ? o3 = d3 : 0 < d3 && (l3 += Math.abs(d3 - o3), o3 = d3));
                0 < g3.data.length && (c3 /= g3.data.length - p3), (void 0 === a3 || l3 <= a3) && (void 0 === h3 || h3 < c3) && 1.99 < c3 && (a3 = l3, s3 = f3, h3 = c3);
              }
              return { successful: !!(m2.delimiter = s3), bestDelimiter: s3 };
            })(e2, m2.newline, m2.skipEmptyLines, m2.comments, m2.delimitersToGuess)).successful ? m2.delimiter = r3.bestDelimiter : (a2 = true, m2.delimiter = v.DefaultDelimiter), p2.meta.delimiter = m2.delimiter), b(m2));
            return m2.preview && m2.header && r3.preview++, n2 = e2, s2 = new E(r3), p2 = s2.parse(n2, t2, i3), g2(), l2 ? { meta: { paused: true } } : p2 || { meta: { paused: false } };
          }, this.paused = function() {
            return l2;
          }, this.pause = function() {
            l2 = true, s2.abort(), n2 = U(m2.chunk) ? "" : n2.substring(s2.getCharIndex());
          }, this.resume = function() {
            i2.streamer._halted ? (l2 = false, i2.streamer.parseChunk(n2, true)) : setTimeout(i2.resume, 3);
          }, this.aborted = function() {
            return e;
          }, this.abort = function() {
            e = true, s2.abort(), p2.meta.aborted = true, U(m2.complete) && m2.complete(p2), n2 = "";
          }, this.guessLineEndings = function(e2, t2) {
            e2 = e2.substring(0, 1048576);
            var t2 = new RegExp(P(t2) + "([^]*?)" + P(t2), "gm"), i3 = (e2 = e2.replace(t2, "")).split("\r"), t2 = e2.split("\n"), e2 = 1 < t2.length && t2[0].length < i3[0].length;
            if (1 === i3.length || e2) return "\n";
            for (var r3 = 0, n3 = 0; n3 < i3.length; n3++) "\n" === i3[n3][0] && r3++;
            return r3 >= i3.length / 2 ? "\r\n" : "\r";
          };
        }
        function P(e) {
          return e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }
        function E(C) {
          var S = (C = C || {}).delimiter, O = C.newline, x = C.comments, I = C.step, A = C.preview, T = C.fastMode, D = null, L = false, F = null == C.quoteChar ? '"' : C.quoteChar, j = F;
          if (void 0 !== C.escapeChar && (j = C.escapeChar), ("string" != typeof S || -1 < v.BAD_DELIMITERS.indexOf(S)) && (S = ","), x === S) throw new Error("Comment character same as delimiter");
          true === x ? x = "#" : ("string" != typeof x || -1 < v.BAD_DELIMITERS.indexOf(x)) && (x = false), "\n" !== O && "\r" !== O && "\r\n" !== O && (O = "\n");
          var z = 0, M = false;
          this.parse = function(i2, t, r2) {
            if ("string" != typeof i2) throw new Error("Input must be a string");
            var n2 = i2.length, e = S.length, s2 = O.length, a2 = x.length, o2 = U(I), h2 = [], u2 = [], d2 = [], f2 = z = 0;
            if (!i2) return w();
            if (T || false !== T && -1 === i2.indexOf(F)) {
              for (var l2 = i2.split(O), c2 = 0; c2 < l2.length; c2++) {
                if (d2 = l2[c2], z += d2.length, c2 !== l2.length - 1) z += O.length;
                else if (r2) return w();
                if (!x || d2.substring(0, a2) !== x) {
                  if (o2) {
                    if (h2 = [], k(d2.split(S)), R(), M) return w();
                  } else k(d2.split(S));
                  if (A && A <= c2) return h2 = h2.slice(0, A), w(true);
                }
              }
              return w();
            }
            for (var p2 = i2.indexOf(S, z), g2 = i2.indexOf(O, z), _2 = new RegExp(P(j) + P(F), "g"), m2 = i2.indexOf(F, z); ; ) if (i2[z] === F) for (m2 = z, z++; ; ) {
              if (-1 === (m2 = i2.indexOf(F, m2 + 1))) return r2 || u2.push({ type: "Quotes", code: "MissingQuotes", message: "Quoted field unterminated", row: h2.length, index: z }), E2();
              if (m2 === n2 - 1) return E2(i2.substring(z, m2).replace(_2, F));
              if (F === j && i2[m2 + 1] === j) m2++;
              else if (F === j || 0 === m2 || i2[m2 - 1] !== j) {
                -1 !== p2 && p2 < m2 + 1 && (p2 = i2.indexOf(S, m2 + 1));
                var y2 = v2(-1 === (g2 = -1 !== g2 && g2 < m2 + 1 ? i2.indexOf(O, m2 + 1) : g2) ? p2 : Math.min(p2, g2));
                if (i2.substr(m2 + 1 + y2, e) === S) {
                  d2.push(i2.substring(z, m2).replace(_2, F)), i2[z = m2 + 1 + y2 + e] !== F && (m2 = i2.indexOf(F, z)), p2 = i2.indexOf(S, z), g2 = i2.indexOf(O, z);
                  break;
                }
                y2 = v2(g2);
                if (i2.substring(m2 + 1 + y2, m2 + 1 + y2 + s2) === O) {
                  if (d2.push(i2.substring(z, m2).replace(_2, F)), b2(m2 + 1 + y2 + s2), p2 = i2.indexOf(S, z), m2 = i2.indexOf(F, z), o2 && (R(), M)) return w();
                  if (A && h2.length >= A) return w(true);
                  break;
                }
                u2.push({ type: "Quotes", code: "InvalidQuotes", message: "Trailing quote on quoted field is malformed", row: h2.length, index: z }), m2++;
              }
            }
            else if (x && 0 === d2.length && i2.substring(z, z + a2) === x) {
              if (-1 === g2) return w();
              z = g2 + s2, g2 = i2.indexOf(O, z), p2 = i2.indexOf(S, z);
            } else if (-1 !== p2 && (p2 < g2 || -1 === g2)) d2.push(i2.substring(z, p2)), z = p2 + e, p2 = i2.indexOf(S, z);
            else {
              if (-1 === g2) break;
              if (d2.push(i2.substring(z, g2)), b2(g2 + s2), o2 && (R(), M)) return w();
              if (A && h2.length >= A) return w(true);
            }
            return E2();
            function k(e2) {
              h2.push(e2), f2 = z;
            }
            function v2(e2) {
              var t2 = 0;
              return t2 = -1 !== e2 && (e2 = i2.substring(m2 + 1, e2)) && "" === e2.trim() ? e2.length : t2;
            }
            function E2(e2) {
              return r2 || (void 0 === e2 && (e2 = i2.substring(z)), d2.push(e2), z = n2, k(d2), o2 && R()), w();
            }
            function b2(e2) {
              z = e2, k(d2), d2 = [], g2 = i2.indexOf(O, z);
            }
            function w(e2) {
              if (C.header && !t && h2.length && !L) {
                var s3 = h2[0], a3 = /* @__PURE__ */ Object.create(null), o3 = new Set(s3);
                let n3 = false;
                for (let r3 = 0; r3 < s3.length; r3++) {
                  let i3 = s3[r3];
                  if (a3[i3 = U(C.transformHeader) ? C.transformHeader(i3, r3) : i3]) {
                    let e3, t2 = a3[i3];
                    for (; e3 = i3 + "_" + t2, t2++, o3.has(e3); ) ;
                    o3.add(e3), s3[r3] = e3, a3[i3]++, n3 = true, (D = null === D ? {} : D)[e3] = i3;
                  } else a3[i3] = 1, s3[r3] = i3;
                  o3.add(i3);
                }
                n3 && console.warn("Duplicate headers found and renamed."), L = true;
              }
              return { data: h2, errors: u2, meta: { delimiter: S, linebreak: O, aborted: M, truncated: !!e2, cursor: f2 + (t || 0), renamedHeaders: D } };
            }
            function R() {
              I(w()), h2 = [], u2 = [];
            }
          }, this.abort = function() {
            M = true;
          }, this.getCharIndex = function() {
            return z;
          };
        }
        function g(e) {
          var t = e.data, i2 = o[t.workerId], r2 = false;
          if (t.error) i2.userError(t.error, t.file);
          else if (t.results && t.results.data) {
            var n2 = { abort: function() {
              r2 = true, _(t.workerId, { data: [], errors: [], meta: { aborted: true } });
            }, pause: m, resume: m };
            if (U(i2.userStep)) {
              for (var s2 = 0; s2 < t.results.data.length && (i2.userStep({ data: t.results.data[s2], errors: t.results.errors, meta: t.results.meta }, n2), !r2); s2++) ;
              delete t.results;
            } else U(i2.userChunk) && (i2.userChunk(t.results, n2, t.file), delete t.results);
          }
          t.finished && !r2 && _(t.workerId, t.results);
        }
        function _(e, t) {
          var i2 = o[e];
          U(i2.userComplete) && i2.userComplete(t), i2.terminate(), delete o[e];
        }
        function m() {
          throw new Error("Not implemented.");
        }
        function b(e) {
          if ("object" != typeof e || null === e) return e;
          var t, i2 = Array.isArray(e) ? [] : {};
          for (t in e) i2[t] = b(e[t]);
          return i2;
        }
        function y(e, t) {
          return function() {
            e.apply(t, arguments);
          };
        }
        function U(e) {
          return "function" == typeof e;
        }
        return v.parse = function(e, t) {
          var i2 = (t = t || {}).dynamicTyping || false;
          U(i2) && (t.dynamicTypingFunction = i2, i2 = {});
          if (t.dynamicTyping = i2, t.transform = !!U(t.transform) && t.transform, !t.worker || !v.WORKERS_SUPPORTED) return i2 = null, v.NODE_STREAM_INPUT, "string" == typeof e ? (e = ((e2) => 65279 !== e2.charCodeAt(0) ? e2 : e2.slice(1))(e), i2 = new (t.download ? f : c)(t)) : true === e.readable && U(e.read) && U(e.on) ? i2 = new p(t) : (n.File && e instanceof File || e instanceof Object) && (i2 = new l(t)), i2.stream(e);
          (i2 = (() => {
            var e2;
            return !!v.WORKERS_SUPPORTED && (e2 = (() => {
              var e3 = n.URL || n.webkitURL || null, t2 = r.toString();
              return v.BLOB_URL || (v.BLOB_URL = e3.createObjectURL(new Blob(["var global = (function() { if (typeof self !== 'undefined') { return self; } if (typeof window !== 'undefined') { return window; } if (typeof global !== 'undefined') { return global; } return {}; })(); global.IS_PAPA_WORKER=true; ", "(", t2, ")();"], { type: "text/javascript" })));
            })(), (e2 = new n.Worker(e2)).onmessage = g, e2.id = h++, o[e2.id] = e2);
          })()).userStep = t.step, i2.userChunk = t.chunk, i2.userComplete = t.complete, i2.userError = t.error, t.step = U(t.step), t.chunk = U(t.chunk), t.complete = U(t.complete), t.error = U(t.error), delete t.worker, i2.postMessage({ input: e, config: t, workerId: i2.id });
        }, v.unparse = function(e, t) {
          var n2 = false, _2 = true, m2 = ",", y2 = "\r\n", s2 = '"', a2 = s2 + s2, i2 = false, r2 = null, o2 = false, h2 = ((() => {
            if ("object" == typeof t) {
              if ("string" != typeof t.delimiter || v.BAD_DELIMITERS.filter(function(e2) {
                return -1 !== t.delimiter.indexOf(e2);
              }).length || (m2 = t.delimiter), "boolean" != typeof t.quotes && "function" != typeof t.quotes && !Array.isArray(t.quotes) || (n2 = t.quotes), "boolean" != typeof t.skipEmptyLines && "string" != typeof t.skipEmptyLines || (i2 = t.skipEmptyLines), "string" == typeof t.newline && (y2 = t.newline), "string" == typeof t.quoteChar && (s2 = t.quoteChar), "boolean" == typeof t.header && (_2 = t.header), Array.isArray(t.columns)) {
                if (0 === t.columns.length) throw new Error("Option columns is empty");
                r2 = t.columns;
              }
              void 0 !== t.escapeChar && (a2 = t.escapeChar + s2), t.escapeFormulae instanceof RegExp ? o2 = t.escapeFormulae : "boolean" == typeof t.escapeFormulae && t.escapeFormulae && (o2 = /^[=+\-@\t\r].*$/);
            }
          })(), new RegExp(P(s2), "g"));
          "string" == typeof e && (e = JSON.parse(e));
          if (Array.isArray(e)) {
            if (!e.length || Array.isArray(e[0])) return u2(null, e, i2);
            if ("object" == typeof e[0]) return u2(r2 || Object.keys(e[0]), e, i2);
          } else if ("object" == typeof e) return "string" == typeof e.data && (e.data = JSON.parse(e.data)), Array.isArray(e.data) && (e.fields || (e.fields = e.meta && e.meta.fields || r2), e.fields || (e.fields = Array.isArray(e.data[0]) ? e.fields : "object" == typeof e.data[0] ? Object.keys(e.data[0]) : []), Array.isArray(e.data[0]) || "object" == typeof e.data[0] || (e.data = [e.data])), u2(e.fields || [], e.data || [], i2);
          throw new Error("Unable to serialize unrecognized input");
          function u2(e2, t2, i3) {
            var r3 = "", n3 = ("string" == typeof e2 && (e2 = JSON.parse(e2)), "string" == typeof t2 && (t2 = JSON.parse(t2)), Array.isArray(e2) && 0 < e2.length), s3 = !Array.isArray(t2[0]);
            if (n3 && _2) {
              for (var a3 = 0; a3 < e2.length; a3++) 0 < a3 && (r3 += m2), r3 += k(e2[a3], a3);
              0 < t2.length && (r3 += y2);
            }
            for (var o3 = 0; o3 < t2.length; o3++) {
              var h3 = (n3 ? e2 : t2[o3]).length, u3 = false, d2 = n3 ? 0 === Object.keys(t2[o3]).length : 0 === t2[o3].length;
              if (i3 && !n3 && (u3 = "greedy" === i3 ? "" === t2[o3].join("").trim() : 1 === t2[o3].length && 0 === t2[o3][0].length), "greedy" === i3 && n3) {
                for (var f2 = [], l2 = 0; l2 < h3; l2++) {
                  var c2 = s3 ? e2[l2] : l2;
                  f2.push(t2[o3][c2]);
                }
                u3 = "" === f2.join("").trim();
              }
              if (!u3) {
                for (var p2 = 0; p2 < h3; p2++) {
                  0 < p2 && !d2 && (r3 += m2);
                  var g2 = n3 && s3 ? e2[p2] : p2;
                  r3 += k(t2[o3][g2], p2);
                }
                o3 < t2.length - 1 && (!i3 || 0 < h3 && !d2) && (r3 += y2);
              }
            }
            return r3;
          }
          function k(e2, t2) {
            var i3, r3;
            return null == e2 ? "" : e2.constructor === Date ? JSON.stringify(e2).slice(1, 25) : (r3 = false, o2 && "string" == typeof e2 && o2.test(e2) && (e2 = "'" + e2, r3 = true), i3 = e2.toString().replace(h2, a2), (r3 = r3 || true === n2 || "function" == typeof n2 && n2(e2, t2) || Array.isArray(n2) && n2[t2] || ((e3, t3) => {
              for (var i4 = 0; i4 < t3.length; i4++) if (-1 < e3.indexOf(t3[i4])) return true;
              return false;
            })(i3, v.BAD_DELIMITERS) || -1 < i3.indexOf(m2) || " " === i3.charAt(0) || " " === i3.charAt(i3.length - 1)) ? s2 + i3 + s2 : i3);
          }
        }, v.RECORD_SEP = String.fromCharCode(30), v.UNIT_SEP = String.fromCharCode(31), v.BYTE_ORDER_MARK = "\uFEFF", v.BAD_DELIMITERS = ["\r", "\n", '"', v.BYTE_ORDER_MARK], v.WORKERS_SUPPORTED = !s && !!n.Worker, v.NODE_STREAM_INPUT = 1, v.LocalChunkSize = 10485760, v.RemoteChunkSize = 5242880, v.DefaultDelimiter = ",", v.Parser = E, v.ParserHandle = i, v.NetworkStreamer = f, v.FileStreamer = l, v.StringStreamer = c, v.ReadableStreamStreamer = p, n.jQuery && ((d = n.jQuery).fn.parse = function(o2) {
          var i2 = o2.config || {}, h2 = [];
          return this.each(function(e2) {
            if (!("INPUT" === d(this).prop("tagName").toUpperCase() && "file" === d(this).attr("type").toLowerCase() && n.FileReader) || !this.files || 0 === this.files.length) return true;
            for (var t = 0; t < this.files.length; t++) h2.push({ file: this.files[t], inputElem: this, instanceConfig: d.extend({}, i2) });
          }), e(), this;
          function e() {
            if (0 === h2.length) U(o2.complete) && o2.complete();
            else {
              var e2, t, i3, r2, n2 = h2[0];
              if (U(o2.before)) {
                var s2 = o2.before(n2.file, n2.inputElem);
                if ("object" == typeof s2) {
                  if ("abort" === s2.action) return e2 = "AbortError", t = n2.file, i3 = n2.inputElem, r2 = s2.reason, void (U(o2.error) && o2.error({ name: e2 }, t, i3, r2));
                  if ("skip" === s2.action) return void u2();
                  "object" == typeof s2.config && (n2.instanceConfig = d.extend(n2.instanceConfig, s2.config));
                } else if ("skip" === s2) return void u2();
              }
              var a2 = n2.instanceConfig.complete;
              n2.instanceConfig.complete = function(e3) {
                U(a2) && a2(e3, n2.file, n2.inputElem), u2();
              }, v.parse(n2.file, n2.instanceConfig);
            }
          }
          function u2() {
            h2.splice(0, 1), e();
          }
        }), a && (n.onmessage = function(e) {
          e = e.data;
          void 0 === v.WORKER_ID && e && (v.WORKER_ID = e.workerId);
          "string" == typeof e.input ? n.postMessage({ workerId: v.WORKER_ID, results: v.parse(e.input, e.config), finished: true }) : (n.File && e.input instanceof File || e.input instanceof Object) && (e = v.parse(e.input, e.config)) && n.postMessage({ workerId: v.WORKER_ID, results: e, finished: true });
        }), (f.prototype = Object.create(u.prototype)).constructor = f, (l.prototype = Object.create(u.prototype)).constructor = l, (c.prototype = Object.create(c.prototype)).constructor = c, (p.prototype = Object.create(u.prototype)).constructor = p, v;
      });
    }
  });

  // src/deduplicator.ts
  function normalizeUrl(url) {
    if (!url || url.trim() === "") return "";
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = "https://" + normalized;
    }
    normalized = normalized.replace(/^http:\/\//i, "https://");
    try {
      const parsed = new URL(normalized);
      parsed.hash = "";
      const params = Array.from(parsed.searchParams.entries());
      params.sort((a, b) => a[0].localeCompare(b[0]));
      parsed.search = "";
      if (params.length > 0) {
        const sp = new URLSearchParams();
        for (const [key, value] of params) {
          sp.append(key, value);
        }
        parsed.search = sp.toString();
      }
      normalized = parsed.toString();
    } catch {
    }
    normalized = normalized.replace(/\/+$/, "");
    return normalized;
  }
  function deduplicate(records) {
    const map = /* @__PURE__ */ new Map();
    for (const record of records) {
      const key = normalizeUrl(record.sourcePageInfo.url);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, record);
      } else {
        if (record.lastSeenDate > existing.lastSeenDate) {
          map.set(key, record);
        }
      }
    }
    const deduplicated = Array.from(map.values());
    return {
      records: deduplicated,
      removedCount: records.length - deduplicated.length
    };
  }
  var init_deduplicator = __esm({
    "src/deduplicator.ts"() {
      "use strict";
    }
  });

  // src/storage.ts
  async function saveRecords(records) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(records) });
    } catch {
      throw new StorageError("\u6570\u636E\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u6D4F\u89C8\u5668\u5B58\u50A8\u7A7A\u95F4");
    }
  }
  async function loadRecords() {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      const data = result[STORAGE_KEY];
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error("\u6570\u636E\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u5BFC\u5165", error);
      return [];
    }
  }
  async function clearRecords() {
    try {
      await chrome.storage.local.remove(STORAGE_KEY);
      await clearCommentStatuses();
    } catch {
      throw new StorageError("\u6570\u636E\u6E05\u9664\u5931\u8D25");
    }
  }
  async function mergeAndSave(newRecords) {
    const existing = await loadRecords();
    const combined = [...existing, ...newRecords];
    const result = deduplicate(combined);
    await saveRecords(result.records);
    return result;
  }
  async function saveCommentStatuses(statuses) {
    try {
      await chrome.storage.local.set({ [COMMENT_STATUS_KEY]: JSON.stringify(statuses) });
    } catch {
      throw new StorageError("\u8BC4\u8BBA\u72B6\u6001\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u6D4F\u89C8\u5668\u5B58\u50A8\u7A7A\u95F4");
    }
  }
  async function loadCommentStatuses() {
    try {
      const result = await chrome.storage.local.get([COMMENT_STATUS_KEY]);
      const data = result[COMMENT_STATUS_KEY];
      if (!data) return {};
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  async function clearCommentStatuses() {
    try {
      await chrome.storage.local.remove(COMMENT_STATUS_KEY);
    } catch {
      throw new StorageError("\u8BC4\u8BBA\u72B6\u6001\u6E05\u9664\u5931\u8D25");
    }
  }
  var STORAGE_KEY, COMMENT_STATUS_KEY, StorageError;
  var init_storage = __esm({
    "src/storage.ts"() {
      "use strict";
      init_deduplicator();
      STORAGE_KEY = "backlinks";
      COMMENT_STATUS_KEY = "commentStatuses";
      StorageError = class extends Error {
        constructor(message) {
          super(message);
          this.name = "StorageError";
        }
      };
    }
  });

  // src/link-template-storage.ts
  var link_template_storage_exports = {};
  __export(link_template_storage_exports, {
    generateId: () => generateId,
    loadTemplates: () => loadTemplates,
    saveTemplates: () => saveTemplates
  });
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  async function saveTemplates(templates2) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY2]: JSON.stringify(templates2) });
    } catch {
      throw new StorageError("\u6A21\u677F\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u6D4F\u89C8\u5668\u5B58\u50A8\u7A7A\u95F4");
    }
  }
  async function loadTemplates() {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEY2]);
      const data = result[STORAGE_KEY2];
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error("\u6A21\u677F\u52A0\u8F7D\u5931\u8D25", error);
      return [];
    }
  }
  var STORAGE_KEY2;
  var init_link_template_storage = __esm({
    "src/link-template-storage.ts"() {
      "use strict";
      init_storage();
      STORAGE_KEY2 = "linkTemplates";
    }
  });

  // src/csv-parser.ts
  var import_papaparse = __toESM(require_papaparse_min());
  var PAGE_TYPES = /* @__PURE__ */ new Set(["\u535A\u5BA2", "CMS", "\u7559\u8A00\u677F"]);
  var LANGUAGE_CODES = /* @__PURE__ */ new Set(["EN", "FR", "ZH", "KO", "RU", "JA", "DE", "ES", "IT", "PT"]);
  var MOBILE_FRIENDLY = "\u79FB\u52A8\u53CB\u597D";
  var LINK_TYPES = /* @__PURE__ */ new Set(["\u6587\u672C", "\u56FE\u7247"]);
  function parseCSV(csvContent) {
    const parsed = import_papaparse.default.parse(csvContent, {
      header: false,
      skipEmptyLines: true
    });
    const rows = parsed.data;
    if (rows.length === 0) {
      return { records: [], failedRows: 0, totalRows: 0 };
    }
    const dataRows = rows.slice(1);
    const totalRows = dataRows.length;
    const records = [];
    let failedRows = 0;
    for (const row of dataRows) {
      try {
        if (row.length !== 7) {
          failedRows++;
          continue;
        }
        const pageAS = parseInt(row[0].trim(), 10);
        if (isNaN(pageAS)) {
          failedRows++;
          continue;
        }
        const externalLinks = parseInt(row[2].trim(), 10);
        if (isNaN(externalLinks)) {
          failedRows++;
          continue;
        }
        const sourcePageInfo = parseSourcePageInfo(row[1].trim());
        const anchorInfo = parseAnchorInfo(row[4].trim());
        const firstSeenDate = parseDate(row[5].trim());
        const lastSeenDate = parseDate(row[6].trim());
        records.push({
          pageAS,
          sourcePageInfo,
          externalLinks,
          anchorInfo,
          firstSeenDate,
          lastSeenDate
        });
      } catch {
        failedRows++;
      }
    }
    return { records, failedRows, totalRows };
  }
  function parseSourcePageInfo(field) {
    const parts = field.split(" | ").map((p) => p.trim());
    const url = parts[0];
    if (!url) {
      throw new Error("Source page URL is required");
    }
    const result = { url };
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part === MOBILE_FRIENDLY) {
        result.mobileFriendly = true;
      } else if (PAGE_TYPES.has(part)) {
        result.pageType = part;
      } else if (LANGUAGE_CODES.has(part)) {
        result.language = part;
      }
    }
    return result;
  }
  function parseAnchorInfo(field) {
    const parts = field.split(" | ").map((p) => p.trim());
    const targetUrl = parts[0];
    if (!targetUrl) {
      throw new Error("Target URL is required");
    }
    const result = { targetUrl, attributes: [] };
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (LINK_TYPES.has(part)) {
        result.linkType = part;
      } else if (part) {
        result.attributes.push(part);
      }
    }
    return result;
  }
  function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function parseDate(dateStr) {
    const trimmed = dateStr.trim();
    const absoluteMatch = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
    if (absoluteMatch) {
      const year = parseInt(absoluteMatch[1], 10);
      const month = parseInt(absoluteMatch[2], 10);
      const day = parseInt(absoluteMatch[3], 10);
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    const relativeMatch = trimmed.match(/^(\d+)\s*天前$/);
    if (relativeMatch) {
      const daysAgo = parseInt(relativeMatch[1], 10);
      const date = /* @__PURE__ */ new Date();
      date.setDate(date.getDate() - daysAgo);
      return formatDate(date);
    }
    const hoursMatch = trimmed.match(/^(\d+)\s*小时前$/);
    if (hoursMatch) {
      const date = /* @__PURE__ */ new Date();
      date.setHours(date.getHours() - parseInt(hoursMatch[1], 10));
      return formatDate(date);
    }
    const minutesMatch = trimmed.match(/^(\d+)\s*分钟前$/);
    if (minutesMatch) {
      return formatDate(/* @__PURE__ */ new Date());
    }
    if (trimmed === "\u6628\u5929") {
      const date = /* @__PURE__ */ new Date();
      date.setDate(date.getDate() - 1);
      return formatDate(date);
    }
    throw new Error(`Unrecognized date format: "${trimmed}"`);
  }

  // src/sidepanel.ts
  init_storage();

  // src/types.ts
  var COMMENT_STATUS_LABELS = {
    commentable: "\u2705 \u53EF\u8BC4\u8BBA",
    login_required: "\u274C \u9700\u767B\u5F55",
    uncertain: "\u26A0\uFE0F \u4E0D\u786E\u5B9A",
    filtered_out: "\u{1F6AB} \u5DF2\u8FC7\u6EE4"
  };

  // src/static-rule-engine.ts
  var EXCLUDE_PATTERNS = [
    "/profile",
    "/user/",
    "/member/",
    "/login",
    "/register",
    "/signin",
    "/signup",
    "/gallery",
    "/archive",
    "/category",
    "/tag/"
  ];
  function shouldFilter(url) {
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      return EXCLUDE_PATTERNS.some((pattern) => pathname.includes(pattern));
    } catch {
      return false;
    }
  }
  function applyStaticFilter(records) {
    const filtered = [];
    const pending = [];
    for (const record of records) {
      if (shouldFilter(record.sourcePageInfo.url)) {
        filtered.push(record);
      } else {
        pending.push(record);
      }
    }
    return { filtered, pending };
  }

  // src/page-analyzer.ts
  var COMMENT_FORM_SELECTORS = [
    "form textarea",
    // textarea + form 组合
    "#commentform",
    // WordPress 评论表单
    "#disqus_thread"
    // Disqus 评论系统
  ];
  var AUTHOR_INPUT_PATTERNS = ["author", "email", "url", "website"];
  var LOGIN_BARRIER_TEXTS = [
    "log in to comment",
    "sign in to comment",
    "\u767B\u5F55\u540E\u8BC4\u8BBA",
    "\u8BF7\u5148\u767B\u5F55"
  ];
  var LOGIN_REDIRECT_PATTERNS = ["/login", "/signin", "/auth"];
  function analyzeHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const hasCommentForm = detectCommentForm(doc);
    const hasLoginBarrier = detectLoginBarrier(doc);
    return { hasCommentForm, hasLoginBarrier };
  }
  function detectCommentForm(doc) {
    for (const selector of COMMENT_FORM_SELECTORS) {
      if (doc.querySelector(selector)) {
        return true;
      }
    }
    const inputs = doc.querySelectorAll("input");
    for (const input of inputs) {
      const name = (input.getAttribute("name") || "").toLowerCase();
      const id = (input.getAttribute("id") || "").toLowerCase();
      for (const pattern of AUTHOR_INPUT_PATTERNS) {
        if (name.includes(pattern) || id.includes(pattern)) {
          return true;
        }
      }
    }
    return false;
  }
  function detectLoginBarrier(doc) {
    const textContent = (doc.body?.textContent || "").toLowerCase();
    return LOGIN_BARRIER_TEXTS.some((text) => textContent.includes(text.toLowerCase()));
  }
  async function fetchAndAnalyze(url, signal) {
    try {
      const response = await fetch(url, { redirect: "manual", signal });
      if (response.status >= 300 && response.status < 400) {
        const location = (response.headers.get("Location") || "").toLowerCase();
        const redirectedToLogin = LOGIN_REDIRECT_PATTERNS.some((pattern) => location.includes(pattern));
        return {
          url,
          hasCommentForm: false,
          hasLoginBarrier: false,
          fetchError: false,
          redirectedToLogin
        };
      }
      if (response.status >= 400) {
        return {
          url,
          hasCommentForm: false,
          hasLoginBarrier: false,
          fetchError: true,
          redirectedToLogin: false
        };
      }
      const html = await response.text();
      const { hasCommentForm, hasLoginBarrier } = analyzeHtml(html);
      return {
        url,
        hasCommentForm,
        hasLoginBarrier,
        fetchError: false,
        redirectedToLogin: false
      };
    } catch {
      return {
        url,
        hasCommentForm: false,
        hasLoginBarrier: false,
        fetchError: true,
        redirectedToLogin: false
      };
    }
  }

  // src/status-resolver.ts
  function resolveStatus(result) {
    if (result.redirectedToLogin || result.hasLoginBarrier) {
      return "login_required";
    }
    if (result.hasCommentForm) {
      return "commentable";
    }
    return "uncertain";
  }

  // src/rate-limiter.ts
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function withTimeout(task, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      task().then(
        (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }
  async function executeWithRateLimit(tasks, options, onProgress) {
    const { maxConcurrent, delayMs, timeoutMs } = options;
    const total = tasks.length;
    if (total === 0) {
      return [];
    }
    const results = new Array(total);
    const errors = new Array(total);
    let completed = 0;
    let activeCount = 0;
    const waitQueue = [];
    async function acquire() {
      if (activeCount < maxConcurrent) {
        activeCount++;
        return;
      }
      return new Promise((resolve) => {
        waitQueue.push(resolve);
      });
    }
    async function release() {
      if (delayMs > 0) {
        await delay(delayMs);
      }
      if (waitQueue.length > 0) {
        const next = waitQueue.shift();
        next();
      } else {
        activeCount--;
      }
    }
    const taskPromises = tasks.map(async (task, index) => {
      await acquire();
      try {
        const result = await withTimeout(task, timeoutMs);
        results[index] = result;
      } catch (error) {
        errors[index] = error instanceof Error ? error : new Error(String(error));
      } finally {
        completed++;
        if (onProgress) {
          onProgress(completed, total);
        }
        await release();
      }
    });
    await Promise.all(taskPromises);
    for (let i = 0; i < total; i++) {
      if (errors[i]) {
        throw errors[i];
      }
    }
    return results;
  }

  // src/link-template.ts
  init_link_template_storage();
  var templates = [];
  var selectedId = null;
  var editingId = null;
  function $(id) {
    return document.getElementById(id);
  }
  async function initTemplateManager() {
    $("template-toggle-btn").addEventListener("click", async () => {
      const section = $("template-section");
      const btn = $("template-toggle-btn");
      if (section.hidden) {
        section.hidden = false;
        btn.classList.add("active");
        templates = await loadTemplates();
        refreshSelect();
      } else {
        section.hidden = true;
        btn.classList.remove("active");
        hideForm();
      }
    });
    $("template-select").addEventListener("change", () => {
      const select = $("template-select");
      selectedId = select.value || null;
      renderDetail();
      hideForm();
    });
    $("template-add-btn").addEventListener("click", () => showForm());
    $("template-edit-current-btn").addEventListener("click", () => {
      const tpl = templates.find((t) => t.id === selectedId);
      if (tpl) showForm(tpl);
    });
    $("template-delete-current-btn").addEventListener("click", () => handleDelete());
    $("template-save-btn").addEventListener("click", () => handleSave());
    $("template-cancel-btn").addEventListener("click", () => hideForm());
  }
  function refreshSelect() {
    const select = $("template-select");
    const currentValue = selectedId;
    select.innerHTML = '<option value="">-- \u9009\u62E9\u6A21\u677F --</option>';
    for (const tpl of templates) {
      const opt = document.createElement("option");
      opt.value = tpl.id;
      opt.textContent = tpl.name;
      select.appendChild(opt);
    }
    if (currentValue && templates.some((t) => t.id === currentValue)) {
      select.value = currentValue;
      selectedId = currentValue;
    } else if (templates.length > 0) {
      select.value = templates[0].id;
      selectedId = templates[0].id;
    } else {
      selectedId = null;
    }
    renderDetail();
    $("template-empty").hidden = templates.length > 0;
  }
  function renderDetail() {
    const detailEl = $("template-detail");
    const editBtn = $("template-edit-current-btn");
    const deleteBtn = $("template-delete-current-btn");
    detailEl.innerHTML = "";
    const tpl = templates.find((t) => t.id === selectedId);
    if (!tpl) {
      detailEl.hidden = true;
      editBtn.hidden = true;
      deleteBtn.hidden = true;
      return;
    }
    detailEl.hidden = false;
    editBtn.hidden = false;
    deleteBtn.hidden = false;
    const fields = [
      { label: "\u540D\u79F0:", value: tpl.name },
      { label: "\u7F51\u5740:", value: tpl.url },
      { label: "\u5173\u952E\u8BCD:", value: tpl.keyword }
    ];
    for (const field of fields) {
      const row = document.createElement("div");
      row.className = "template-field";
      const labelSpan = document.createElement("span");
      labelSpan.className = "template-field-label";
      labelSpan.textContent = field.label;
      row.appendChild(labelSpan);
      const valueSpan = document.createElement("span");
      valueSpan.className = "template-field-value";
      valueSpan.textContent = field.value;
      valueSpan.title = field.value;
      row.appendChild(valueSpan);
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "template-copy-btn";
      copyBtn.textContent = "\u{1F4CB}";
      copyBtn.addEventListener("click", () => copyToClipboard(field.value, copyBtn));
      row.appendChild(copyBtn);
      detailEl.appendChild(row);
    }
  }
  function showForm(template) {
    const form = $("template-form");
    const nameInput = $("template-name");
    const urlInput = $("template-url");
    const keywordInput = $("template-keyword");
    if (template) {
      editingId = template.id;
      nameInput.value = template.name;
      urlInput.value = template.url;
      keywordInput.value = template.keyword;
    } else {
      editingId = null;
      nameInput.value = "";
      urlInput.value = "";
      keywordInput.value = "";
    }
    form.hidden = false;
    nameInput.focus();
  }
  function hideForm() {
    $("template-name").value = "";
    $("template-url").value = "";
    $("template-keyword").value = "";
    editingId = null;
    $("template-form").hidden = true;
  }
  async function handleSave() {
    const name = $("template-name").value.trim();
    const url = $("template-url").value.trim();
    const keyword = $("template-keyword").value.trim();
    if (!name) {
      alert("\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
      return;
    }
    if (editingId) {
      const idx = templates.findIndex((t) => t.id === editingId);
      if (idx !== -1) {
        templates[idx] = { ...templates[idx], name, url, keyword };
        selectedId = editingId;
      }
    } else {
      const newId = generateId();
      templates.push({ id: newId, name, url, keyword });
      selectedId = newId;
    }
    await saveTemplates(templates);
    hideForm();
    refreshSelect();
  }
  async function handleDelete() {
    if (!selectedId) return;
    if (!confirm("\u786E\u5B9A\u8981\u5220\u9664\u8BE5\u6A21\u677F\u5417\uFF1F")) return;
    templates = templates.filter((t) => t.id !== selectedId);
    selectedId = null;
    await saveTemplates(templates);
    refreshSelect();
  }
  async function copyToClipboard(text, buttonEl) {
    try {
      await navigator.clipboard.writeText(text);
      buttonEl.textContent = "\u2705";
      setTimeout(() => {
        buttonEl.textContent = "\u{1F4CB}";
      }, 1e3);
    } catch (error) {
      console.error("\u590D\u5236\u5931\u8D25", error);
    }
  }

  // src/auto-comment.ts
  function updateStatus(text, type) {
    const el = document.getElementById("auto-comment-status");
    if (!el) return;
    el.textContent = text;
    el.classList.remove("status-info", "status-success", "status-warning", "status-error");
    el.classList.add(`status-${type}`);
    el.hidden = false;
  }
  function isCommentVisibleOnPage(bodyExcerpt, comment) {
    if (!comment || comment.trim().length === 0) return false;
    if (!bodyExcerpt) return false;
    return bodyExcerpt.toLowerCase().includes(comment.toLowerCase());
  }
  async function getSelectedTemplate() {
    const select = document.getElementById("template-select");
    if (!select || !select.value) return null;
    const { loadTemplates: loadTemplates2 } = await Promise.resolve().then(() => (init_link_template_storage(), link_template_storage_exports));
    const templates2 = await loadTemplates2();
    return templates2.find((t) => t.id === select.value) || null;
  }
  async function loadApiKey() {
    const result = await chrome.storage.local.get(["dashscopeApiKey"]);
    return result.dashscopeApiKey || null;
  }
  async function runAutoComment() {
    const btn = document.getElementById("auto-comment-btn");
    try {
      const template = await getSelectedTemplate();
      if (!template) {
        updateStatus("\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u5916\u94FE\u6A21\u677F", "error");
        return;
      }
      const apiKey = await loadApiKey();
      if (!apiKey) {
        updateStatus("\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E API Key", "error");
        return;
      }
      btn.disabled = true;
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (!tabId) {
        updateStatus("\u65E0\u6CD5\u83B7\u53D6\u5F53\u524D\u6807\u7B7E\u9875", "error");
        return;
      }
      updateStatus("\u6B63\u5728\u5206\u6790\u9875\u9762\u7ED3\u6784...", "info");
      let snapshotResp;
      try {
        snapshotResp = await chrome.runtime.sendMessage({
          action: "snapshot-page",
          payload: { tabId }
        });
      } catch (e) {
        updateStatus(`\u9875\u9762\u901A\u4FE1\u5931\u8D25: ${e?.message || e}`, "error");
        return;
      }
      if (!snapshotResp) {
        updateStatus("\u672A\u6536\u5230\u9875\u9762\u54CD\u5E94\uFF0C\u8BF7\u5237\u65B0\u6269\u5C55\u540E\u91CD\u8BD5\uFF08chrome://extensions \u70B9\u51FB\u5237\u65B0\uFF09", "error");
        return;
      }
      if (!snapshotResp.success) {
        updateStatus(snapshotResp.error || "\u9875\u9762\u5206\u6790\u5931\u8D25\uFF08\u672A\u77E5\u539F\u56E0\uFF09", "error");
        return;
      }
      const { snapshot } = snapshotResp;
      if (!snapshot.forms || snapshot.forms.length === 0) {
        updateStatus("\u672A\u5728\u9875\u9762\u4E2D\u68C0\u6D4B\u5230\u8BC4\u8BBA\u8868\u5355", "error");
        return;
      }
      updateStatus("AI \u6B63\u5728\u7406\u89E3\u9875\u9762\u5E76\u751F\u6210\u8BC4\u8BBA...", "info");
      const analyzeResp = await chrome.runtime.sendMessage({
        action: "ai-analyze",
        payload: { snapshot, template, apiKey }
      });
      if (!analyzeResp?.success) {
        updateStatus(analyzeResp?.error || "AI \u5206\u6790\u5931\u8D25", "error");
        return;
      }
      const { actions, hasCaptcha } = analyzeResp;
      if (!actions || actions.length === 0) {
        updateStatus("AI \u672A\u80FD\u89C4\u5212\u64CD\u4F5C\u6307\u4EE4\uFF0C\u8BF7\u91CD\u8BD5", "error");
        return;
      }
      updateStatus("\u6B63\u5728\u6A21\u62DF\u4EBA\u7C7B\u64CD\u4F5C\uFF08\u8BF7\u52FF\u5207\u6362\u6807\u7B7E\u9875\uFF09...", "info");
      const execResp = await chrome.runtime.sendMessage({
        action: "execute-actions",
        payload: { tabId, actions }
      });
      if (!execResp?.success) {
        updateStatus(execResp?.error || "\u64CD\u4F5C\u6267\u884C\u5931\u8D25", "error");
        return;
      }
      let finalSuccess = false;
      let finalCaptcha = hasCaptcha;
      let retryCount = 0;
      const MAX_RETRIES = 3;
      let lastComment = analyzeResp.comment || "";
      for (let round = 0; round < 5; round++) {
        updateStatus("\u7B49\u5F85\u9875\u9762\u54CD\u5E94...", "info");
        await new Promise((r) => setTimeout(r, 3e3));
        let verifySnapshot;
        try {
          const snapResp = await chrome.runtime.sendMessage({
            action: "snapshot-page",
            payload: { tabId }
          });
          if (!snapResp?.success) break;
          verifySnapshot = snapResp.snapshot;
        } catch {
          break;
        }
        updateStatus("\u6B63\u5728\u9A8C\u8BC1\u63D0\u4EA4\u7ED3\u679C...", "info");
        const verifyResp = await chrome.runtime.sendMessage({
          action: "post-submit-analyze",
          payload: { snapshot: verifySnapshot, apiKey, commentContent: lastComment }
        });
        if (!verifyResp?.success) break;
        if (verifyResp.status === "success") {
          finalSuccess = true;
          break;
        }
        if (verifyResp.status === "confirmation_page" && verifyResp.actions?.length > 0) {
          updateStatus("\u68C0\u6D4B\u5230\u786E\u8BA4\u9875\u9762\uFF0C\u6B63\u5728\u70B9\u51FB\u63D0\u4EA4...", "info");
          const confirmResp = await chrome.runtime.sendMessage({
            action: "execute-actions",
            payload: { tabId, actions: verifyResp.actions }
          });
          if (!confirmResp?.success) {
            updateStatus("\u786E\u8BA4\u63D0\u4EA4\u5931\u8D25", "error");
            return;
          }
          continue;
        }
        if (verifyResp.status === "unknown") {
          if (lastComment && verifySnapshot?.bodyExcerpt && isCommentVisibleOnPage(verifySnapshot.bodyExcerpt, lastComment)) {
            finalSuccess = true;
            break;
          }
          break;
        }
        if (verifyResp.status === "error") {
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            const errMsg = verifyResp.message || "\u672A\u77E5\u9519\u8BEF";
            updateStatus(`\u63D0\u4EA4\u5931\u8D25\uFF08${errMsg}\uFF09\uFF0C\u6B63\u5728\u81EA\u52A8\u4FEE\u6B63\u5E76\u91CD\u8BD5\uFF08${retryCount}/${MAX_RETRIES}\uFF09...`, "info");
            const retrySnapResp = await chrome.runtime.sendMessage({
              action: "snapshot-page",
              payload: { tabId }
            });
            if (!retrySnapResp?.success) {
              updateStatus("\u63D0\u4EA4\u5931\u8D25: " + errMsg, "error");
              return;
            }
            const retryAnalyze = await chrome.runtime.sendMessage({
              action: "ai-retry-comment",
              payload: {
                snapshot: retrySnapResp.snapshot,
                template,
                apiKey,
                errorMessage: errMsg,
                failedComment: lastComment,
                attemptNumber: retryCount
              }
            });
            if (!retryAnalyze?.success || !retryAnalyze.actions?.length) {
              updateStatus("\u63D0\u4EA4\u5931\u8D25: " + errMsg, "error");
              return;
            }
            lastComment = retryAnalyze.comment || lastComment;
            updateStatus(`\u6B63\u5728\u91CD\u65B0\u586B\u5199\u5E76\u63D0\u4EA4\uFF08\u7B2C ${retryCount} \u6B21\u91CD\u8BD5\uFF09...`, "info");
            const retryExec = await chrome.runtime.sendMessage({
              action: "execute-actions",
              payload: { tabId, actions: retryAnalyze.actions }
            });
            if (!retryExec?.success) {
              updateStatus("\u91CD\u8BD5\u6267\u884C\u5931\u8D25", "error");
              return;
            }
            continue;
          }
          updateStatus("\u591A\u6B21\u91CD\u8BD5\u540E\u4ECD\u5931\u8D25: " + (verifyResp.message || "\u9875\u9762\u62A5\u9519"), "error");
          return;
        }
        break;
      }
      if (finalCaptcha) {
        updateStatus("\u68C0\u6D4B\u5230\u9A8C\u8BC1\u7801\uFF0C\u5DF2\u586B\u5199\u8868\u5355\uFF0C\u8BF7\u624B\u52A8\u5B8C\u6210\u9A8C\u8BC1\u7801\u5E76\u63D0\u4EA4", "warning");
      } else if (finalSuccess) {
        updateStatus("\u8BC4\u8BBA\u5DF2\u6210\u529F\u53D1\u5E03 \u2713", "success");
      } else {
        updateStatus("\u64CD\u4F5C\u5DF2\u5B8C\u6210\uFF0C\u8BF7\u68C0\u67E5\u9875\u9762\u786E\u8BA4\u8BC4\u8BBA\u662F\u5426\u53D1\u5E03\u6210\u529F", "warning");
      }
    } catch (error) {
      updateStatus(`\u51FA\u9519: ${error?.message || error}`, "error");
    } finally {
      btn.disabled = false;
    }
  }
  function initAutoComment() {
    const btn = document.getElementById("auto-comment-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        runAutoComment();
      });
    }
  }

  // src/sidepanel.ts
  var currentRecords = [];
  var currentSortColumn = "pageAS";
  var currentSortOrder = "desc";
  var currentCommentStatuses = {};
  var currentFilterStatus = "all";
  function $2(id) {
    return document.getElementById(id);
  }
  function getColumnValue(record, column) {
    switch (column) {
      case "pageAS":
        return record.pageAS;
      case "sourceUrl":
        return record.sourcePageInfo.url;
      case "linkType":
        return record.anchorInfo.linkType ?? "";
      case "firstSeenDate":
        return record.firstSeenDate;
      case "lastSeenDate":
        return record.lastSeenDate;
    }
  }
  function compareValues(a, b, order) {
    let result;
    if (typeof a === "number" && typeof b === "number") {
      result = a - b;
    } else {
      result = String(a).localeCompare(String(b));
    }
    return order === "asc" ? result : -result;
  }
  function sortRecords(records, column, order) {
    const col = column;
    return [...records].sort(
      (a, b) => compareValues(getColumnValue(a, col), getColumnValue(b, col), order)
    );
  }
  function renderTable(records, sortColumn, sortOrder) {
    const tbody = document.querySelector("#data-table tbody");
    tbody.innerHTML = "";
    const sorted = sortRecords(records, sortColumn, sortOrder);
    for (const record of sorted) {
      const tr = document.createElement("tr");
      const cells = [
        String(record.pageAS),
        record.sourcePageInfo.url,
        formatLinkType(record),
        record.firstSeenDate,
        record.lastSeenDate
      ];
      for (const text of cells) {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    const headers = document.querySelectorAll("#data-table thead th[data-column]");
    for (const th of headers) {
      const col = th.dataset.column;
      if (col === sortColumn) {
        th.dataset.sort = sortOrder;
      } else {
        delete th.dataset.sort;
      }
    }
  }
  function renderTableWithStatus() {
    const tbody = document.querySelector("#data-table tbody");
    tbody.innerHTML = "";
    const sorted = sortRecords(currentRecords, currentSortColumn, currentSortOrder);
    const filtered = currentFilterStatus === "all" ? sorted : sorted.filter((record) => currentCommentStatuses[record.sourcePageInfo.url] === currentFilterStatus);
    for (const record of filtered) {
      const tr = document.createElement("tr");
      const asTd = document.createElement("td");
      asTd.textContent = String(record.pageAS);
      tr.appendChild(asTd);
      const urlTd = document.createElement("td");
      urlTd.className = "url-cell";
      urlTd.title = record.sourcePageInfo.url;
      const urlSpan = document.createElement("span");
      urlSpan.className = "url-text";
      urlSpan.textContent = record.sourcePageInfo.url;
      urlTd.appendChild(urlSpan);
      const openIcon = document.createElement("span");
      openIcon.className = "open-icon";
      openIcon.textContent = "\u2197";
      openIcon.title = "\u5728\u65B0\u6807\u7B7E\u9875\u6253\u5F00";
      openIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        window.open(record.sourcePageInfo.url, "_blank");
      });
      urlTd.appendChild(openIcon);
      const copyIcon = document.createElement("span");
      copyIcon.className = "copy-icon";
      copyIcon.textContent = "\u{1F4CB}";
      urlTd.appendChild(copyIcon);
      urlTd.addEventListener("click", () => {
        navigator.clipboard.writeText(record.sourcePageInfo.url).then(() => {
          copyIcon.textContent = "\u2705";
          setTimeout(() => {
            copyIcon.textContent = "\u{1F4CB}";
          }, 1e3);
        });
      });
      tr.appendChild(urlTd);
      for (const text of [formatLinkType(record), record.firstSeenDate, record.lastSeenDate]) {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      }
      const statusTd = document.createElement("td");
      const status = currentCommentStatuses[record.sourcePageInfo.url];
      if (status) {
        const span = document.createElement("span");
        span.className = "status-badge";
        span.dataset.status = status;
        span.dataset.url = record.sourcePageInfo.url;
        span.textContent = COMMENT_STATUS_LABELS[status];
        if (status !== "filtered_out") {
          span.addEventListener("click", handleStatusChange);
        }
        statusTd.appendChild(span);
      }
      tr.appendChild(statusTd);
      tbody.appendChild(tr);
    }
    const headers = document.querySelectorAll("#data-table thead th[data-column]");
    for (const th of headers) {
      const col = th.dataset.column;
      if (col === currentSortColumn) {
        th.dataset.sort = currentSortOrder;
      } else {
        delete th.dataset.sort;
      }
    }
  }
  function renderStatusFilter() {
    const buttons = document.querySelectorAll("#status-filter-section .status-filter button");
    for (const btn of buttons) {
      btn.addEventListener("click", () => {
        const filterValue = btn.dataset.filter;
        currentFilterStatus = filterValue;
        for (const b of buttons) {
          b.classList.remove("active");
        }
        btn.classList.add("active");
        renderTableWithStatus();
      });
    }
  }
  function handleStatusChange(event) {
    const badge = event.currentTarget;
    const url = badge.dataset.url;
    if (!url) return;
    removeStatusDropdown();
    const dropdown = document.createElement("div");
    dropdown.className = "status-dropdown";
    const options = [
      { status: "commentable", label: "\u2705 \u53EF\u8BC4\u8BBA" },
      { status: "login_required", label: "\u274C \u9700\u767B\u5F55" },
      { status: "uncertain", label: "\u26A0\uFE0F \u4E0D\u786E\u5B9A" }
    ];
    for (const opt of options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = opt.label;
      btn.addEventListener("click", async () => {
        currentCommentStatuses[url] = opt.status;
        await saveCommentStatuses(currentCommentStatuses);
        removeStatusDropdown();
        renderTableWithStatus();
        updateCleanseSummary();
      });
      dropdown.appendChild(btn);
    }
    const rect = badge.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;
    document.body.appendChild(dropdown);
    setTimeout(() => {
      document.addEventListener("click", closeDropdownOnOutsideClick);
    }, 0);
  }
  function removeStatusDropdown() {
    const existing = document.querySelector(".status-dropdown");
    if (existing) existing.remove();
    document.removeEventListener("click", closeDropdownOnOutsideClick);
  }
  function closeDropdownOnOutsideClick(event) {
    const dropdown = document.querySelector(".status-dropdown");
    if (dropdown && !dropdown.contains(event.target)) {
      removeStatusDropdown();
    }
  }
  function updateCleanseSummary() {
    const stats = { commentable: 0, loginRequired: 0, uncertain: 0, filteredOut: 0 };
    for (const status of Object.values(currentCommentStatuses)) {
      switch (status) {
        case "commentable":
          stats.commentable++;
          break;
        case "login_required":
          stats.loginRequired++;
          break;
        case "uncertain":
          stats.uncertain++;
          break;
        case "filtered_out":
          stats.filteredOut++;
          break;
      }
    }
    $2("stat-commentable").textContent = String(stats.commentable);
    $2("stat-login-required").textContent = String(stats.loginRequired);
    $2("stat-uncertain").textContent = String(stats.uncertain);
    $2("stat-filtered-out").textContent = String(stats.filteredOut);
  }
  function formatLinkType(record) {
    const parts = [];
    if (record.anchorInfo.linkType) {
      parts.push(record.anchorInfo.linkType);
    }
    parts.push(...record.anchorInfo.attributes);
    return parts.join(" | ");
  }
  function renderSummary(result) {
    const section = $2("summary-section");
    $2("stat-total").textContent = String(result.totalRows);
    $2("stat-success").textContent = String(result.successCount);
    $2("stat-duplicates").textContent = String(result.duplicateCount);
    $2("stat-failed").textContent = String(result.failedCount);
    section.hidden = false;
  }
  async function handleImport(file) {
    const loading = $2("loading-indicator");
    loading.hidden = false;
    try {
      const content = await readFileAsText(file);
      const parseResult = parseCSV(content);
      if (parseResult.records.length === 0 && parseResult.failedRows === parseResult.totalRows && parseResult.totalRows > 0) {
        alert("\u8BF7\u9009\u62E9\u6709\u6548\u7684 CSV \u6587\u4EF6");
        loading.hidden = true;
        return;
      }
      const deduplicationResult = await mergeAndSave(parseResult.records);
      const importResult = {
        totalRows: parseResult.totalRows,
        successCount: parseResult.records.length,
        duplicateCount: deduplicationResult.removedCount,
        failedCount: parseResult.failedRows
      };
      currentRecords = deduplicationResult.records;
      renderSummary(importResult);
      renderTableWithStatus();
      $2("cleanse-btn").hidden = currentRecords.length === 0;
    } catch (error) {
      alert("\u8BF7\u9009\u62E9\u6709\u6548\u7684 CSV \u6587\u4EF6");
    } finally {
      loading.hidden = true;
    }
  }
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25"));
      reader.readAsText(file);
    });
  }
  async function handleCleanse() {
    const cleanseBtn = $2("cleanse-btn");
    const progressSection = $2("cleanse-progress");
    const progressBar = $2("cleanse-progress-bar");
    const progressText = $2("cleanse-progress-text");
    cleanseBtn.disabled = true;
    progressSection.hidden = false;
    try {
      const { filtered, pending } = applyStaticFilter(currentRecords);
      const total = filtered.length + pending.length;
      const statuses = {};
      for (const record of filtered) {
        statuses[record.sourcePageInfo.url] = "filtered_out";
      }
      const baseCompleted = filtered.length;
      const progressPercent = total > 0 ? baseCompleted / total * 100 : 0;
      progressBar.style.width = `${progressPercent}%`;
      progressText.textContent = `\u5DF2\u68C0\u67E5 ${baseCompleted} / ${total}`;
      const tasks = pending.map((record) => {
        return async () => {
          try {
            const analysisResult = await fetchAndAnalyze(record.sourcePageInfo.url);
            return { url: record.sourcePageInfo.url, status: resolveStatus(analysisResult) };
          } catch {
            return { url: record.sourcePageInfo.url, status: "uncertain" };
          }
        };
      });
      const onProgress = (completed, _total) => {
        const totalCompleted = baseCompleted + completed;
        const pct = total > 0 ? totalCompleted / total * 100 : 100;
        progressBar.style.width = `${pct}%`;
        progressText.textContent = `\u5DF2\u68C0\u67E5 ${totalCompleted} / ${total}`;
      };
      const results = await executeWithRateLimit(tasks, {
        maxConcurrent: 3,
        delayMs: 500,
        timeoutMs: 1e4
      }, onProgress);
      for (const result of results) {
        statuses[result.url] = result.status;
      }
      await saveCommentStatuses(statuses);
      currentCommentStatuses = statuses;
      updateCleanseSummary();
      $2("cleanse-summary-section").hidden = false;
      $2("status-filter-section").hidden = false;
      renderTableWithStatus();
    } catch (error) {
      console.error("\u6E05\u6D17\u8FC7\u7A0B\u51FA\u9519:", error);
    } finally {
      cleanseBtn.disabled = false;
      progressSection.hidden = true;
    }
  }
  async function handleClear() {
    const confirmed = confirm("\u786E\u5B9A\u8981\u6E05\u9664\u6240\u6709\u5DF2\u5BFC\u5165\u7684\u5916\u94FE\u6570\u636E\u5417\uFF1F");
    if (!confirmed) return;
    await clearRecords();
    currentRecords = [];
    removeStatusDropdown();
    renderTableWithStatus();
    $2("summary-section").hidden = true;
    $2("cleanse-btn").hidden = true;
    $2("cleanse-summary-section").hidden = true;
    $2("status-filter-section").hidden = true;
    currentCommentStatuses = {};
    currentFilterStatus = "all";
  }
  function toggleApiKeySection() {
    const section = $2("api-key-section");
    section.hidden = !section.hidden;
  }
  async function handleSaveApiKey() {
    const input = $2("api-key-input");
    const msgEl = $2("api-key-message");
    const value = input.value.trim();
    if (!value) {
      msgEl.textContent = "API Key \u4E0D\u80FD\u4E3A\u7A7A";
      msgEl.style.color = "#dc2626";
      msgEl.hidden = false;
      return;
    }
    await chrome.storage.local.set({ dashscopeApiKey: value });
    msgEl.textContent = "\u4FDD\u5B58\u6210\u529F";
    msgEl.style.color = "#065f46";
    msgEl.hidden = false;
    setTimeout(() => {
      msgEl.hidden = true;
    }, 2e3);
  }
  async function loadSavedApiKey() {
    const result = await chrome.storage.local.get(["dashscopeApiKey"]);
    if (result.dashscopeApiKey) {
      $2("api-key-input").value = result.dashscopeApiKey;
    }
  }
  function handleColumnSort(column) {
    if (column === currentSortColumn) {
      currentSortOrder = currentSortOrder === "asc" ? "desc" : "asc";
    } else {
      currentSortColumn = column;
      currentSortOrder = "desc";
    }
    renderTableWithStatus();
  }
  async function init() {
    $2("cleanse-btn").hidden = true;
    currentRecords = await loadRecords();
    currentCommentStatuses = await loadCommentStatuses();
    renderTableWithStatus();
    $2("cleanse-btn").hidden = currentRecords.length === 0;
    renderStatusFilter();
    if (Object.keys(currentCommentStatuses).length > 0) {
      $2("status-filter-section").hidden = false;
      $2("cleanse-summary-section").hidden = false;
      updateCleanseSummary();
    }
    const importBtn = $2("import-btn");
    const fileInput = $2("file-input");
    importBtn.addEventListener("click", () => {
      fileInput.value = "";
      fileInput.click();
    });
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (file) {
        handleImport(file);
      }
    });
    $2("clear-btn").addEventListener("click", () => {
      handleClear();
    });
    $2("cleanse-btn").addEventListener("click", () => {
      handleCleanse();
    });
    const headers = document.querySelectorAll("#data-table thead th[data-column]");
    for (const th of headers) {
      th.addEventListener("click", () => {
        const column = th.dataset.column;
        if (column) {
          handleColumnSort(column);
        }
      });
    }
    await initTemplateManager();
    $2("settings-btn").addEventListener("click", toggleApiKeySection);
    $2("api-key-save-btn").addEventListener("click", () => {
      handleSaveApiKey();
    });
    await loadSavedApiKey();
    initAutoComment();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
/*! Bundled license information:

papaparse/papaparse.min.js:
  (* @license
  Papa Parse
  v5.5.3
  https://github.com/mholt/PapaParse
  License: MIT
  *)
*/
