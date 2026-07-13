'use strict';

const { sign } = require('./hmac');
const webhooks = require('./webhooks');
const { ApiError, errorFromResponse } = require('./errors');

const DEFAULT_BASE = 'https://portal.pushfy.com';
const DEFAULT_V2_PATH = '/v2/api.php';

/**
 * Pushfy API client.
 *
 * @example
 * const { Pushfy } = require('@pushfy/pushfy');
 * const pushfy = new Pushfy({ apiToken: 'YOUR_API_TOKEN' });
 * const res = await pushfy.sms.send({ to: '5511999999999', text: 'Hello' });
 */
class Pushfy {
  /**
   * @param {object} opts
   * @param {string} [opts.apiToken]   Messaging Bearer token.
   * @param {string} [opts.paKey]      Conversational AI HMAC key (pak_...).
   * @param {string} [opts.paSecret]   Conversational AI HMAC secret (pas_...).
   * @param {string} [opts.pushKey]    Push server HMAC key (pushk_...).
   * @param {string} [opts.pushSecret] Push server HMAC secret (pss_...).
   * @param {string} [opts.appId]      Public Push app id (pushapp_...).
   * @param {string} [opts.baseUrl]    Defaults to https://portal.pushfy.com.
   * @param {number} [opts.timeout]    Request timeout in ms (default 30000).
   * @param {Function} [opts.fetch]    Custom fetch implementation.
   */
  constructor(opts = {}) {
    this.apiToken = opts.apiToken || null;
    this.paKey = opts.paKey || null;
    this.paSecret = opts.paSecret || null;
    this.pushKey = opts.pushKey || null;
    this.pushSecret = opts.pushSecret || null;
    this.appId = opts.appId || null;
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
    this.v2Path = opts.v2Path || DEFAULT_V2_PATH;
    this.timeout = opts.timeout || 30000;
    this._fetch = opts.fetch || globalThis.fetch;
    if (!this._fetch) throw new Error('No fetch available. Use Node 18+ or pass opts.fetch.');

    this.sms = new SmsResource(this);
    this.rcs = new RcsResource(this);
    this.voice = new VoiceResource(this);
    this.messages = new MessagesResource(this);
    this.balance = new BalanceResource(this);
    this.push = new PushResource(this);
    this.conversations = new ConversationsResource(this);
    this.events = new EventsResource(this);
    this.tasks = new TasksResource(this);
  }

  // ---- low-level transport -------------------------------------------------

  async _http(url, { method, headers, body }) {
    // AbortController is optional (present on Node 18+); degrade gracefully if absent.
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.timeout) : null;
    let res;
    try {
      res = await this._fetch(url, { method, headers, body, signal: controller ? controller.signal : undefined });
    } catch (e) {
      throw new ApiError(`Network error: ${e.message}`, { status: 0 });
    } finally {
      if (timer) clearTimeout(timer);
    }
    const text = await res.text();
    let parsed = null;
    if (text) { try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; } }
    if (!res.ok) {
      const errBody = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed.error ? parsed : { error: parsed.raw || text })
        : { error: typeof text === 'string' ? text : 'error' };
      throw errorFromResponse(res.status, errBody);
    }
    return parsed;
  }

  /** Messaging (classic) request against https://portal.pushfy.com/<path>. */
  async _classic(method, path, { json, form, query } = {}) {
    let url = this.baseUrl + path;
    if (query) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) if (v != null) qs.set(k, v);
      const s = qs.toString();
      if (s) url += (path.includes('?') ? '&' : '?') + s;
    }
    const headers = {};
    if (this.apiToken) headers['Authorization'] = `Bearer ${this.apiToken}`;
    let body;
    if (form) {
      body = form; // FormData sets its own Content-Type/boundary
    } else if (json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    }
    return this._http(url, { method, headers, body });
  }

  /** V2 request (Push / Conversational AI) via ?r=<route>. */
  async _v2(method, route, { body, query, auth } = {}) {
    const qs = new URLSearchParams();
    qs.set('r', route);
    if (query) for (const [k, v] of Object.entries(query)) if (v != null) qs.set(k, v);
    const url = `${this.baseUrl}${this.v2Path}?${qs.toString()}`;

    const bodyStr = body !== undefined && method !== 'GET' ? JSON.stringify(body) : '';
    const headers = {};
    if (bodyStr) headers['Content-Type'] = 'application/json';

    if (auth === 'pa') {
      if (!this.paKey || !this.paSecret) throw new Error('paKey/paSecret required for Conversational AI');
      const { timestamp, signature } = sign({ method, path: route, body: bodyStr, secret: this.paSecret });
      headers['X-PA-Key'] = this.paKey;
      headers['X-PA-Timestamp'] = timestamp;
      headers['X-PA-Signature'] = signature;
    } else if (auth === 'push') {
      if (!this.pushKey || !this.pushSecret) throw new Error('pushKey/pushSecret required for Push server API');
      const { timestamp, signature } = sign({ method, path: route, body: bodyStr, secret: this.pushSecret });
      headers['X-PUSH-Key'] = this.pushKey;
      headers['X-PUSH-Timestamp'] = timestamp;
      headers['X-PUSH-Signature'] = signature;
    }
    return this._http(url, { method, headers, body: bodyStr || undefined });
  }

  /** Webhook signature helpers (static: no credentials needed). */
  static get webhooks() { return webhooks; }
}

// --------------------------------------------------------------------------
// Messaging resources
// --------------------------------------------------------------------------

function toMessage(m) {
  const out = { destinations: [{ to: String(m.to).replace(/\D/g, '') }], text: m.text };
  if (m.extId) out.ext_id = m.extId;
  if (m.audio) out.audio = m.audio;
  return out;
}

class SmsResource {
  constructor(c) { this._c = c; }
  /** Send a single SMS. Returns the API result array. */
  send({ to, text, extId } = {}) {
    return this._c._classic('POST', '/webapi', { json: { messages: [toMessage({ to, text, extId })] } });
  }
  /** Send many SMS in one request. `list` = [{ to, text, extId }]. */
  sendBulk(list = []) {
    return this._c._classic('POST', '/webapi', { json: { messages: list.map(toMessage) } });
  }
}

class RcsResource {
  constructor(c) { this._c = c; }
  /** Send an RCS rich card via the API RCS campaign. */
  send({ to, title, text, url, cta, image, extId } = {}) {
    const msg = { destinations: [{ to: String(to).replace(/\D/g, '') }], text };
    if (title) msg.title = title;
    if (image) msg.image = image;
    if (url) msg.url = url;
    if (cta) msg.cta = cta;
    if (extId) msg.ext_id = extId;
    return this._c._classic('POST', '/apircsnativo.php', { json: { messages: [msg] } });
  }
}

class VoiceResource {
  constructor(c) { this._c = c; }
  /**
   * Upload a voice audio (.mp3). Returns the API result.
   * The response does NOT return an audio id — the audio is stored under the
   * `name` you send here, so keep that exact name to place calls later.
   * @param {object} p
   * @param {string} p.name      The audio's name; retain it to reference the audio in `send`.
   * @param {Buffer} p.data      Raw mp3 bytes.
   * @param {string} [p.filename='audio.mp3']
   */
  async uploadAudio({ name, data, filename = 'audio.mp3' } = {}) {
    const fd = new FormData();
    fd.set('nome', name || filename);
    fd.set('audio', new Blob([data], { type: 'audio/mpeg' }), filename);
    return this._c._classic('POST', '/audio', { form: fd });
  }
  /**
   * Place a voice call by referencing a previously uploaded audio.
   * @param {object} p
   * @param {string} p.to
   * @param {string} p.audioName  the audio's NAME — the exact `nome` you set when uploading via /audio.
   * @param {string} [p.extId]
   */
  send({ to, audioName, extId } = {}) {
    return this._c._classic('POST', '/webapi', {
      json: { messages: [toMessage({ to, text: '', extId, audio: audioName })] },
    });
  }
}

class MessagesResource {
  constructor(c) { this._c = c; }
  /** Delivery status of one message by your ext_id (or internal uid). */
  status({ extId, uid } = {}) {
    return this._c._classic('GET', '/getstatus', { query: { ext_id: extId, uid } });
  }
  /** Status of every message on a given day (YYYY-MM-DD). */
  byDate(date) {
    return this._c._classic('GET', '/getdate', { query: { date } });
  }
  /** Report by date range. { start, end, event, limit, offset, dateDlr }. */
  report({ date, start, end, event, limit, offset, dateDlr } = {}) {
    return this._c._classic('GET', '/reportbydate', {
      query: { date, start, end, event, limit, offset, date_dlr: dateDlr },
    });
  }
}

class BalanceResource {
  constructor(c) { this._c = c; }
  /** SMS balance. Returns { raw: "1.500", balance: 1500 }. */
  async get() {
    const res = await this._c._classic('GET', '/balance');
    const raw = res && res.saldo != null ? String(res.saldo) : null;
    return { raw, balance: raw ? Number(raw.replace(/\D/g, '')) : null };
  }
}

// --------------------------------------------------------------------------
// Push Notifications
// --------------------------------------------------------------------------

class PushResource {
  constructor(c) {
    this._c = c;
    this.devices = {
      list: (query) => c._v2('GET', '/v1/push/devices', { query, auth: 'push' }),
      register: (body) => c._v2('POST', '/v1/push/devices', { body, auth: 'push' }),
      remove: (id) => c._v2('DELETE', `/v1/push/devices/${id}`, { auth: 'push' }),
    };
    this.campaigns = {
      list: (query) => c._v2('GET', '/v1/push/campaigns', { query, auth: 'push' }),
      create: (body) => c._v2('POST', '/v1/push/campaigns', { body, auth: 'push' }),
      get: (id) => c._v2('GET', `/v1/push/campaigns/${id}`, { auth: 'push' }),
      update: (id, body) => c._v2('PATCH', `/v1/push/campaigns/${id}`, { body, auth: 'push' }),
      send: (id) => c._v2('POST', `/v1/push/campaigns/${id}/send`, { body: {}, auth: 'push' }),
      metrics: (id) => c._v2('GET', `/v1/push/campaigns/${id}/metrics`, { auth: 'push' }),
    };
    this.segments = {
      list: (query) => c._v2('GET', '/v1/push/segments', { query, auth: 'push' }),
      create: (body) => c._v2('POST', '/v1/push/segments', { body, auth: 'push' }),
    };
  }
  /** Send a test push. */
  test(body) { return this._c._v2('POST', '/v1/push/test', { body, auth: 'push' }); }
  /** Public: subscribe a device (browser/app). Injects app_id automatically. */
  subscribe(body) {
    return this._c._v2('POST', '/v1/push/subscribe', { body: { app_id: this._c.appId, ...body }, auth: 'public' });
  }
  /** Public: report a device event. */
  track(body) {
    return this._c._v2('POST', '/v1/push/track', { body: { app_id: this._c.appId, ...body }, auth: 'public' });
  }
}

// --------------------------------------------------------------------------
// Conversational AI (PushAgent)
// --------------------------------------------------------------------------

class ConversationsResource {
  constructor(c) { this._c = c; }
  /** Open a conversation. { userExtId, name, channel }. */
  open({ userExtId, name, channel } = {}) {
    return this._c._v2('POST', '/v1/conversations', {
      body: { user_ext_id: userExtId, name, channel }, auth: 'pa',
    });
  }
  get(id) { return this._c._v2('GET', `/v1/conversations/${id}`, { auth: 'pa' }); }
  /** Send a user message; the bot replies asynchronously. */
  message(id, { content } = {}) {
    return this._c._v2('POST', `/v1/conversations/${id}/messages`, { body: { content }, auth: 'pa' });
  }
  handoff(id) { return this._c._v2('POST', `/v1/conversations/${id}/handoff`, { body: {}, auth: 'pa' }); }
  close(id) { return this._c._v2('POST', `/v1/conversations/${id}/close`, { body: {}, auth: 'pa' }); }
}

class EventsResource {
  constructor(c) { this._c = c; }
  /** Send a business event. { type, userExtId, data }. */
  send({ type, userExtId, data } = {}) {
    return this._c._v2('POST', '/v1/events', { body: { type, user_ext_id: userExtId, data }, auth: 'pa' });
  }
}

class TasksResource {
  constructor(c) { this._c = c; }
  /** Schedule a follow-up. { conversationId, runAt, text }. */
  schedule({ conversationId, runAt, text } = {}) {
    return this._c._v2('POST', '/v1/tasks', {
      body: { conversation_id: conversationId, run_at: runAt, text }, auth: 'pa',
    });
  }
}

module.exports = { Pushfy, webhooks, ...require('./errors') };
