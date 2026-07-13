import { sign } from './hmac';
import { webhooks } from './webhooks';
import { ApiError, errorFromResponse, ApiErrorBody } from './errors';

export * from './errors';
export * from './hmac';
export * from './webhooks';

const DEFAULT_BASE = 'https://portal.pushfy.com';
const DEFAULT_V2_PATH = '/v2/api.php';

// --------------------------------------------------------------------------
// Transport-level types (fetch is a Node 18+ / browser global)
// --------------------------------------------------------------------------

/** Minimal subset of the WHATWG Response used by the SDK. */
export interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

/** Init options passed to the injected fetch. */
export interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string | FormData;
  signal?: unknown;
}

/** A fetch-compatible function (defaults to the global `fetch`). */
export type FetchLike = (url: string, init?: FetchInit) => Promise<FetchResponse>;

/** Generic JSON value returned by the API when the shape is not modelled. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// --------------------------------------------------------------------------
// Public option / parameter / response interfaces
// --------------------------------------------------------------------------

/** Constructor options for {@link Pushfy}. */
export interface PushfyOptions {
  /** Messaging Bearer token. */
  apiToken?: string;
  /** Conversational AI HMAC key (pak_...). */
  paKey?: string;
  /** Conversational AI HMAC secret (pas_...). */
  paSecret?: string;
  /** Push server HMAC key (pushk_...). */
  pushKey?: string;
  /** Push server HMAC secret (pss_...). */
  pushSecret?: string;
  /** Public Push app id (pushapp_...). */
  appId?: string;
  /** Defaults to https://portal.pushfy.com. */
  baseUrl?: string;
  /** V2 entry path; defaults to /v2/api.php. */
  v2Path?: string;
  /** Request timeout in ms (default 30000). */
  timeout?: number;
  /** Custom fetch implementation. */
  fetch?: FetchLike;
}

/** A single message send result item. */
export interface MessageSendItem {
  id?: string | number;
  phone?: string;
  date?: string;
  ext_id?: string;
  [key: string]: unknown;
}

/** Result of a messaging send (array of per-destination items). */
export type MessageSendResult = MessageSendItem[];

/** Parameters for {@link SmsResource.send}. */
export interface SmsSendParams {
  to: string;
  text: string;
  extId?: string;
}

/** One item of a bulk SMS send. */
export interface SmsBulkItem {
  to: string;
  text: string;
  extId?: string;
}

/** Parameters for {@link RcsResource.send}. */
export interface RcsSendParams {
  to: string;
  text: string;
  title?: string;
  url?: string;
  cta?: string;
  image?: string;
  extId?: string;
}

/** Parameters for {@link VoiceResource.uploadAudio}. */
export interface VoiceUploadParams {
  name?: string;
  /** Raw mp3 bytes. */
  data: Uint8Array | ArrayBuffer | Buffer;
  filename?: string;
}

/** Parameters for {@link VoiceResource.send}. */
export interface VoiceSendParams {
  to: string;
  /** The audio's NAME — the exact `nome` you set when uploading via /audio. */
  audioName: string;
  extId?: string;
}

/** Parameters for {@link MessagesResource.status}. */
export interface MessageStatusParams {
  extId?: string;
  uid?: string;
}

/** Parameters for {@link MessagesResource.report}. */
export interface ReportParams {
  date?: string;
  start?: string;
  end?: string;
  event?: string;
  limit?: number;
  offset?: number;
  dateDlr?: string;
}

/** Parsed SMS balance. */
export interface BalanceResult {
  raw: string | null;
  balance: number | null;
}

/** Parameters for {@link ConversationsResource.open}. */
export interface ConversationOpenParams {
  userExtId?: string;
  name?: string;
  channel?: string;
}

/** Parameters for {@link ConversationsResource.message}. */
export interface ConversationMessageParams {
  content?: string;
}

/** Parameters for {@link EventsResource.send}. */
export interface EventSendParams {
  type?: string;
  userExtId?: string;
  data?: JsonValue;
}

/** Parameters for {@link TasksResource.schedule}. */
export interface TaskScheduleParams {
  conversationId?: string;
  runAt?: string;
  text?: string;
}

/** V2 authentication mode. */
type V2Auth = 'pa' | 'push' | 'public';

/** Internal shape passed to {@link Pushfy._classic}. */
interface ClassicOptions {
  json?: unknown;
  form?: FormData;
  query?: Record<string, unknown>;
}

/** Internal shape passed to {@link Pushfy._v2}. */
interface V2Options {
  body?: unknown;
  query?: Record<string, unknown>;
  auth?: V2Auth;
}

/** Internal shape passed to {@link Pushfy._http}. */
interface HttpOptions {
  method: string;
  headers: Record<string, string>;
  body?: string | FormData;
}

// --------------------------------------------------------------------------
// Client
// --------------------------------------------------------------------------

/**
 * Pushfy API client.
 *
 * @example
 * import { Pushfy } from '@pushfy/pushfy';
 * const pushfy = new Pushfy({ apiToken: 'YOUR_API_TOKEN' });
 * const res = await pushfy.sms.send({ to: '5511999999999', text: 'Hello' });
 */
export class Pushfy {
  apiToken: string | null;
  paKey: string | null;
  paSecret: string | null;
  pushKey: string | null;
  pushSecret: string | null;
  appId: string | null;
  baseUrl: string;
  v2Path: string;
  timeout: number;
  private _fetch: FetchLike;

  readonly sms: SmsResource;
  readonly rcs: RcsResource;
  readonly voice: VoiceResource;
  readonly messages: MessagesResource;
  readonly balance: BalanceResource;
  readonly push: PushResource;
  readonly conversations: ConversationsResource;
  readonly events: EventsResource;
  readonly tasks: TasksResource;

  constructor(opts: PushfyOptions = {}) {
    this.apiToken = opts.apiToken || null;
    this.paKey = opts.paKey || null;
    this.paSecret = opts.paSecret || null;
    this.pushKey = opts.pushKey || null;
    this.pushSecret = opts.pushSecret || null;
    this.appId = opts.appId || null;
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
    this.v2Path = opts.v2Path || DEFAULT_V2_PATH;
    this.timeout = opts.timeout || 30000;
    const g = typeof globalThis !== 'undefined' ? (globalThis as { fetch?: FetchLike }) : undefined;
    const globalFetch = g ? g.fetch : undefined;
    const chosen = opts.fetch || globalFetch;
    if (!chosen) throw new Error('No fetch available. Use Node 18+ or pass opts.fetch.');
    this._fetch = chosen;

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

  async _http(url: string, { method, headers, body }: HttpOptions): Promise<JsonValue> {
    // AbortController is optional (present on Node 18+); degrade gracefully if absent.
    const g = typeof globalThis !== 'undefined' ? (globalThis as { AbortController?: typeof AbortController }) : {};
    const AC = g.AbortController;
    const controller = typeof AC !== 'undefined' ? new AC() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.timeout) : null;
    let res: FetchResponse;
    try {
      res = await this._fetch(url, {
        method,
        headers,
        body,
        signal: controller ? controller.signal : undefined,
      });
    } catch (e) {
      throw new ApiError(`Network error: ${(e as Error).message}`, { status: 0 });
    } finally {
      if (timer) clearTimeout(timer);
    }
    const text = await res.text();
    let parsed: JsonValue = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as JsonValue;
      } catch {
        parsed = { raw: text };
      }
    }
    if (!res.ok) {
      const errBody: ApiErrorBody =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? ((parsed as Record<string, unknown>).error
              ? (parsed as ApiErrorBody)
              : { error: (parsed as { raw?: string }).raw || text })
          : { error: typeof text === 'string' ? text : 'error' };
      throw errorFromResponse(res.status, errBody);
    }
    return parsed;
  }

  /** Messaging (classic) request against https://portal.pushfy.com/<path>. */
  async _classic(method: string, path: string, { json, form, query }: ClassicOptions = {}): Promise<JsonValue> {
    let url = this.baseUrl + path;
    if (query) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) if (v != null) qs.set(k, String(v));
      const s = qs.toString();
      if (s) url += (path.includes('?') ? '&' : '?') + s;
    }
    const headers: Record<string, string> = {};
    if (this.apiToken) headers['Authorization'] = `Bearer ${this.apiToken}`;
    let body: string | FormData | undefined;
    if (form) {
      body = form; // FormData sets its own Content-Type/boundary
    } else if (json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    }
    return this._http(url, { method, headers, body });
  }

  /** V2 request (Push / Conversational AI) via ?r=<route>. */
  async _v2(method: string, route: string, { body, query, auth }: V2Options = {}): Promise<JsonValue> {
    const qs = new URLSearchParams();
    qs.set('r', route);
    if (query) for (const [k, v] of Object.entries(query)) if (v != null) qs.set(k, String(v));
    const url = `${this.baseUrl}${this.v2Path}?${qs.toString()}`;

    const bodyStr = body !== undefined && method !== 'GET' ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {};
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
  static get webhooks(): typeof webhooks {
    return webhooks;
  }
}

// --------------------------------------------------------------------------
// Messaging resources
// --------------------------------------------------------------------------

interface WireMessage {
  destinations: Array<{ to: string }>;
  text: string;
  ext_id?: string;
  audio?: string;
}

function toMessage(m: { to: string; text: string; extId?: string; audio?: string }): WireMessage {
  const out: WireMessage = { destinations: [{ to: String(m.to).replace(/\D/g, '') }], text: m.text };
  if (m.extId) out.ext_id = m.extId;
  if (m.audio) out.audio = m.audio;
  return out;
}

export class SmsResource {
  private _c: Pushfy;
  constructor(c: Pushfy) {
    this._c = c;
  }
  /** Send a single SMS. Returns the API result array. */
  send({ to, text, extId }: SmsSendParams): Promise<MessageSendResult> {
    return this._c._classic('POST', '/webapi', {
      json: { messages: [toMessage({ to, text, extId })] },
    }) as Promise<MessageSendResult>;
  }
  /** Send many SMS in one request. `list` = [{ to, text, extId }]. */
  sendBulk(list: SmsBulkItem[] = []): Promise<MessageSendResult> {
    return this._c._classic('POST', '/webapi', {
      json: { messages: list.map(toMessage) },
    }) as Promise<MessageSendResult>;
  }
}

export class RcsResource {
  private _c: Pushfy;
  constructor(c: Pushfy) {
    this._c = c;
  }
  /** Send an RCS rich card via the API RCS campaign. */
  send({ to, title, text, url, cta, image, extId }: RcsSendParams): Promise<MessageSendResult> {
    const msg: WireMessage & { title?: string; image?: string; url?: string; cta?: string } = {
      destinations: [{ to: String(to).replace(/\D/g, '') }],
      text,
    };
    if (title) msg.title = title;
    if (image) msg.image = image;
    if (url) msg.url = url;
    if (cta) msg.cta = cta;
    if (extId) msg.ext_id = extId;
    return this._c._classic('POST', '/apircsnativo.php', {
      json: { messages: [msg] },
    }) as Promise<MessageSendResult>;
  }
}

export class VoiceResource {
  private _c: Pushfy;
  constructor(c: Pushfy) {
    this._c = c;
  }
  /**
   * Upload a voice audio (.mp3). Returns the API result.
   * The response does NOT return an audio id — the audio is stored under the
   * `name` you send here, so keep that exact name to place calls later.
   */
  async uploadAudio({ name, data, filename = 'audio.mp3' }: VoiceUploadParams): Promise<JsonValue> {
    const g = typeof globalThis !== 'undefined'
      ? (globalThis as { FormData?: typeof FormData; Blob?: typeof Blob })
      : {};
    const FD = g.FormData;
    const B = g.Blob;
    if (!FD || !B) throw new Error('FormData/Blob unavailable. Use Node 18+.');
    const fd = new FD();
    fd.set('nome', name || filename);
    fd.set('audio', new B([data as unknown as ArrayBuffer], { type: 'audio/mpeg' }), filename);
    return this._c._classic('POST', '/audio', { form: fd });
  }
  /**
   * Place a voice call by referencing a previously uploaded audio.
   * `audioName` is the audio's NAME — the exact `nome` you set when uploading via /audio.
   */
  send({ to, audioName, extId }: VoiceSendParams): Promise<MessageSendResult> {
    return this._c._classic('POST', '/webapi', {
      json: { messages: [toMessage({ to, text: '', extId, audio: audioName })] },
    }) as Promise<MessageSendResult>;
  }
}

export class MessagesResource {
  private _c: Pushfy;
  constructor(c: Pushfy) {
    this._c = c;
  }
  /** Delivery status of one message by your ext_id (or internal uid). */
  status({ extId, uid }: MessageStatusParams = {}): Promise<JsonValue> {
    return this._c._classic('GET', '/getstatus', { query: { ext_id: extId, uid } });
  }
  /** Status of every message on a given day (YYYY-MM-DD). */
  byDate(date: string): Promise<JsonValue> {
    return this._c._classic('GET', '/getdate', { query: { date } });
  }
  /** Report by date range. { date, start, end, event, limit, offset, dateDlr }. */
  report({ date, start, end, event, limit, offset, dateDlr }: ReportParams = {}): Promise<JsonValue> {
    return this._c._classic('GET', '/reportbydate', {
      query: { date, start, end, event, limit, offset, date_dlr: dateDlr },
    });
  }
}

export class BalanceResource {
  private _c: Pushfy;
  constructor(c: Pushfy) {
    this._c = c;
  }
  /** SMS balance. Returns { raw: "1.500", balance: 1500 }. */
  async get(): Promise<BalanceResult> {
    const res = (await this._c._classic('GET', '/balance')) as { saldo?: unknown } | null;
    const raw = res && res.saldo != null ? String(res.saldo) : null;
    return { raw, balance: raw ? Number(raw.replace(/\D/g, '')) : null };
  }
}

// --------------------------------------------------------------------------
// Push Notifications
// --------------------------------------------------------------------------

/** Device sub-resource for {@link PushResource}. */
export interface PushDevices {
  list(query?: Record<string, unknown>): Promise<JsonValue>;
  register(body: unknown): Promise<JsonValue>;
  remove(id: string | number): Promise<JsonValue>;
}

/** Campaign sub-resource for {@link PushResource}. */
export interface PushCampaigns {
  list(query?: Record<string, unknown>): Promise<JsonValue>;
  create(body: unknown): Promise<JsonValue>;
  get(id: string | number): Promise<JsonValue>;
  update(id: string | number, body: unknown): Promise<JsonValue>;
  send(id: string | number): Promise<JsonValue>;
  metrics(id: string | number): Promise<JsonValue>;
}

/** Segment sub-resource for {@link PushResource}. */
export interface PushSegments {
  list(query?: Record<string, unknown>): Promise<JsonValue>;
  create(body: unknown): Promise<JsonValue>;
}

export class PushResource {
  private _c: Pushfy;
  readonly devices: PushDevices;
  readonly campaigns: PushCampaigns;
  readonly segments: PushSegments;

  constructor(c: Pushfy) {
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
  test(body: unknown): Promise<JsonValue> {
    return this._c._v2('POST', '/v1/push/test', { body, auth: 'push' });
  }
  /** Public: subscribe a device (browser/app). Injects app_id automatically. */
  subscribe(body: Record<string, unknown>): Promise<JsonValue> {
    return this._c._v2('POST', '/v1/push/subscribe', {
      body: { app_id: this._c.appId, ...body },
      auth: 'public',
    });
  }
  /** Public: report a device event. */
  track(body: Record<string, unknown>): Promise<JsonValue> {
    return this._c._v2('POST', '/v1/push/track', {
      body: { app_id: this._c.appId, ...body },
      auth: 'public',
    });
  }
}

// --------------------------------------------------------------------------
// Conversational AI (PushAgent)
// --------------------------------------------------------------------------

export class ConversationsResource {
  private _c: Pushfy;
  constructor(c: Pushfy) {
    this._c = c;
  }
  /** Open a conversation. { userExtId, name, channel }. */
  open({ userExtId, name, channel }: ConversationOpenParams = {}): Promise<JsonValue> {
    return this._c._v2('POST', '/v1/conversations', {
      body: { user_ext_id: userExtId, name, channel },
      auth: 'pa',
    });
  }
  get(id: string | number): Promise<JsonValue> {
    return this._c._v2('GET', `/v1/conversations/${id}`, { auth: 'pa' });
  }
  /** Send a user message; the bot replies asynchronously. */
  message(id: string | number, { content }: ConversationMessageParams = {}): Promise<JsonValue> {
    return this._c._v2('POST', `/v1/conversations/${id}/messages`, { body: { content }, auth: 'pa' });
  }
  handoff(id: string | number): Promise<JsonValue> {
    return this._c._v2('POST', `/v1/conversations/${id}/handoff`, { body: {}, auth: 'pa' });
  }
  close(id: string | number): Promise<JsonValue> {
    return this._c._v2('POST', `/v1/conversations/${id}/close`, { body: {}, auth: 'pa' });
  }
}

export class EventsResource {
  private _c: Pushfy;
  constructor(c: Pushfy) {
    this._c = c;
  }
  /** Send a business event. { type, userExtId, data }. */
  send({ type, userExtId, data }: EventSendParams = {}): Promise<JsonValue> {
    return this._c._v2('POST', '/v1/events', {
      body: { type, user_ext_id: userExtId, data },
      auth: 'pa',
    });
  }
}

export class TasksResource {
  private _c: Pushfy;
  constructor(c: Pushfy) {
    this._c = c;
  }
  /** Schedule a follow-up. { conversationId, runAt, text }. */
  schedule({ conversationId, runAt, text }: TaskScheduleParams = {}): Promise<JsonValue> {
    return this._c._v2('POST', '/v1/tasks', {
      body: { conversation_id: conversationId, run_at: runAt, text },
      auth: 'pa',
    });
  }
}

export { webhooks };
export default Pushfy;
