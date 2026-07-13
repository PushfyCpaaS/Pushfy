using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Pushfy
{
    /// <summary>Push Notifications resource — server API (HMAC) plus public device endpoints.</summary>
    public sealed class PushResource
    {
        private readonly PushfyClient _c;

        public DevicesApi Devices { get; }
        public CampaignsApi Campaigns { get; }
        public SegmentsApi Segments { get; }

        internal PushResource(PushfyClient c)
        {
            _c = c;
            Devices = new DevicesApi(c);
            Campaigns = new CampaignsApi(c);
            Segments = new SegmentsApi(c);
        }

        /// <summary>Send a test push.</summary>
        public Task<JsonElement> TestAsync(object body, CancellationToken ct = default)
            => _c.V2Async(HttpMethod.Post, "/v1/push/test", body: body, auth: AuthMode.Push, ct: ct);

        /// <summary>Public: subscribe a device (browser/app). Injects app_id automatically.</summary>
        public Task<JsonElement> SubscribeAsync(IDictionary<string, object?>? body = null, CancellationToken ct = default)
            => _c.V2Async(HttpMethod.Post, "/v1/push/subscribe", body: WithAppId(body), auth: AuthMode.Public, ct: ct);

        /// <summary>Public: report a device event. Injects app_id automatically.</summary>
        public Task<JsonElement> TrackAsync(IDictionary<string, object?>? body = null, CancellationToken ct = default)
            => _c.V2Async(HttpMethod.Post, "/v1/push/track", body: WithAppId(body), auth: AuthMode.Public, ct: ct);

        private Dictionary<string, object?> WithAppId(IDictionary<string, object?>? body)
        {
            var d = new Dictionary<string, object?> { ["app_id"] = _c.AppId };
            if (body != null) foreach (var kv in body) d[kv.Key] = kv.Value;
            return d;
        }

        public sealed class DevicesApi
        {
            private readonly PushfyClient _c;
            internal DevicesApi(PushfyClient c) { _c = c; }

            public Task<JsonElement> ListAsync(IDictionary<string, string?>? query = null, CancellationToken ct = default)
                => _c.V2Async(HttpMethod.Get, "/v1/push/devices", query: query, auth: AuthMode.Push, ct: ct);

            public Task<JsonElement> RegisterAsync(object body, CancellationToken ct = default)
                => _c.V2Async(HttpMethod.Post, "/v1/push/devices", body: body, auth: AuthMode.Push, ct: ct);

            public Task<JsonElement> RemoveAsync(object id, CancellationToken ct = default)
                => _c.V2Async(HttpMethod.Delete, $"/v1/push/devices/{id}", auth: AuthMode.Push, ct: ct);
        }

        public sealed class CampaignsApi
        {
            private readonly PushfyClient _c;
            internal CampaignsApi(PushfyClient c) { _c = c; }

            public Task<JsonElement> ListAsync(IDictionary<string, string?>? query = null, CancellationToken ct = default)
                => _c.V2Async(HttpMethod.Get, "/v1/push/campaigns", query: query, auth: AuthMode.Push, ct: ct);

            public Task<JsonElement> CreateAsync(object body, CancellationToken ct = default)
                => _c.V2Async(HttpMethod.Post, "/v1/push/campaigns", body: body, auth: AuthMode.Push, ct: ct);

            public Task<JsonElement> GetAsync(object id, CancellationToken ct = default)
                => _c.V2Async(HttpMethod.Get, $"/v1/push/campaigns/{id}", auth: AuthMode.Push, ct: ct);

            public Task<JsonElement> UpdateAsync(object id, object body, CancellationToken ct = default)
                => _c.V2Async(HttpMethod.Patch, $"/v1/push/campaigns/{id}", body: body, auth: AuthMode.Push, ct: ct);

            public Task<JsonElement> SendAsync(object id, CancellationToken ct = default)
                => _c.V2Async(HttpMethod.Post, $"/v1/push/campaigns/{id}/send", body: new { }, auth: AuthMode.Push, ct: ct);

            public Task<JsonElement> MetricsAsync(object id, CancellationToken ct = default)
                => _c.V2Async(HttpMethod.Get, $"/v1/push/campaigns/{id}/metrics", auth: AuthMode.Push, ct: ct);
        }

        public sealed class SegmentsApi
        {
            private readonly PushfyClient _c;
            internal SegmentsApi(PushfyClient c) { _c = c; }

            public Task<JsonElement> ListAsync(IDictionary<string, string?>? query = null, CancellationToken ct = default)
                => _c.V2Async(HttpMethod.Get, "/v1/push/segments", query: query, auth: AuthMode.Push, ct: ct);

            public Task<JsonElement> CreateAsync(object body, CancellationToken ct = default)
                => _c.V2Async(HttpMethod.Post, "/v1/push/segments", body: body, auth: AuthMode.Push, ct: ct);
        }
    }
}
