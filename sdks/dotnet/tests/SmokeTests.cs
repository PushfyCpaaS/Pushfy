using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Pushfy;

// Offline smoke test — validates request shaping, HMAC signing and webhook
// verification without hitting the network. Run: dotnet run --project tests
internal static class SmokeTests
{
    private static int _passed;

    private static void Ok(string name) { Console.WriteLine("  [ok] " + name); _passed++; }

    private static void Assert(bool cond, string msg)
    {
        if (!cond) throw new Exception("ASSERT FAILED: " + msg);
    }

    // Captures the last request and returns a canned response.
    private sealed class MockHandler : HttpMessageHandler
    {
        private readonly int _status;
        private readonly string _body;

        public HttpMethod? Method;
        public string? Url;
        public string? RequestBody;
        public HttpRequestHeaders Headers = null!;

        public MockHandler(string body, int status = 200) { _body = body; _status = status; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Method = request.Method;
            Url = request.RequestUri!.AbsoluteUri;
            Headers = request.Headers;
            RequestBody = request.Content != null ? await request.Content.ReadAsStringAsync() : null;
            return new HttpResponseMessage((HttpStatusCode)_status)
            {
                Content = new StringContent(_body, Encoding.UTF8, "application/json"),
            };
        }
    }

    public static async Task Main()
    {
        try
        {
            // 1. HMAC signing matches the documented recipe exactly.
            {
                long ts = 1752345600;
                var body = "{\"user_ext_id\":\"user-42\"}";
                var secret = "pas_test";
                var sig = Hmac.Sign("post", "/v1/conversations", body, secret, ts);
                using var sha = SHA256.Create();
                var bh = Hmac.ToHex(sha.ComputeHash(Encoding.UTF8.GetBytes(body)));
                var baseStr = $"{ts}\nPOST\n/v1/conversations\n{bh}";
                using var h = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
                var expected = Hmac.ToHex(h.ComputeHash(Encoding.UTF8.GetBytes(baseStr)));
                Assert(sig.Signature == expected, "HMAC signature mismatch");
                Assert(sig.Timestamp == ts.ToString(), "timestamp mismatch");
                Ok("HMAC signature matches canonical base string");
            }

            // 2. SendSmsAsync hits /webapi with Bearer auth and the right body.
            {
                var mock = new MockHandler("[{\"id\":\"x\",\"phone\":\"5511999999999\",\"date\":\"2026-07-12 10:00:00\",\"ext_id\":\"x\"}]");
                var pushfy = new PushfyClient(new PushfyClientOptions { ApiToken = "YOUR_API_TOKEN", HttpClient = new HttpClient(mock) });
                var res = await pushfy.SendSmsAsync("+55 (11) 99999-9999", "Hi", "x");
                Assert(mock.Url!.EndsWith("/webapi"), "URL is /webapi");
                Assert(mock.Method == HttpMethod.Post, "method POST");
                Assert(mock.Headers.Authorization!.ToString() == "Bearer YOUR_API_TOKEN", "Bearer header");
                using var sent = JsonDocument.Parse(mock.RequestBody!);
                var to = sent.RootElement.GetProperty("messages")[0].GetProperty("destinations")[0].GetProperty("to").GetString();
                Assert(to == "5511999999999", "phone digits normalized");
                Assert(sent.RootElement.GetProperty("messages")[0].GetProperty("text").GetString() == "Hi", "text");
                Assert(res[0].GetProperty("ext_id").GetString() == "x", "response array parsed");
                Ok("SendSmsAsync shapes /webapi request and parses the array response");
            }

            // 3. GetBalanceAsync parses the formatted string.
            {
                var mock = new MockHandler("{\"saldo\":\"1.500\"}");
                var pushfy = new PushfyClient(new PushfyClientOptions { ApiToken = "t", HttpClient = new HttpClient(mock) });
                var b = await pushfy.GetBalanceAsync();
                Assert(b.Raw == "1.500", "raw preserved");
                Assert(b.Balance == 1500, "balance 1500");
                Ok("GetBalanceAsync parses {\"saldo\":\"1.500\"} -> 1500");
            }

            // 4. OpenConversationAsync signs with X-PA-* headers and routes via ?r=.
            {
                var mock = new MockHandler("{\"ok\":true,\"conversation_id\":1,\"status\":\"bot\"}");
                var pushfy = new PushfyClient(new PushfyClientOptions { PaKey = "pak_x", PaSecret = "pas_x", HttpClient = new HttpClient(mock) });
                await pushfy.OpenConversationAsync("user-42", "Ana");
                var decoded = Uri.UnescapeDataString(new Uri(mock.Url!).Query);
                Assert(decoded.Contains("r=/v1/conversations"), "route sent via ?r=");
                Assert(HeaderEquals(mock.Headers, "X-PA-Key", "pak_x"), "X-PA-Key value");
                Assert(HasHeader(mock.Headers, "X-PA-Signature") && HasHeader(mock.Headers, "X-PA-Timestamp"), "signature + timestamp set");
                Ok("OpenConversationAsync signs request with X-PA-* headers");
            }

            // 5. Push server call uses X-PUSH-* headers.
            {
                var mock = new MockHandler("{\"ok\":true}");
                var pushfy = new PushfyClient(new PushfyClientOptions { PushKey = "pushk_x", PushSecret = "pss_x", HttpClient = new HttpClient(mock) });
                await pushfy.Push.Campaigns.SendAsync(88);
                var decoded = Uri.UnescapeDataString(new Uri(mock.Url!).Query);
                Assert(decoded.Contains("r=/v1/push/campaigns/88/send"), "push route");
                Assert(HeaderEquals(mock.Headers, "X-PUSH-Key", "pushk_x"), "X-PUSH-Key value");
                Ok("Push.Campaigns.SendAsync signs with X-PUSH-* headers");
            }

            // 6. Webhook verification: raw vs prefixed schemes.
            {
                var secret = "WEBHOOK_SECRET";
                var payload = "{\"eid\":\"evt_1\",\"event\":\"handoff.requested\"}";
                using var h = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
                var hex = Hmac.ToHex(h.ComputeHash(Encoding.UTF8.GetBytes(payload)));
                Assert(Webhooks.Conversations(payload, hex, secret), "raw scheme valid");
                Assert(Webhooks.Push(payload, "sha256=" + hex, secret), "prefixed scheme valid");
                Assert(!Webhooks.Push(payload, hex, secret), "push requires sha256= prefix");
                Assert(!Webhooks.Conversations(payload, "deadbeef", secret), "bad signature rejected");
                Ok("webhook verify handles raw (X-PA) and prefixed (X-Push/X-Pushfy) schemes");
            }

            // 7. errors: 401 -> AuthenticationException.
            {
                var mock = new MockHandler("{\"ok\":false,\"error\":\"unauthorized\"}", 401);
                var pushfy = new PushfyClient(new PushfyClientOptions { ApiToken = "bad", HttpClient = new HttpClient(mock) });
                Exception? caught = null;
                try { await pushfy.SendSmsAsync("5511999999999", "x"); }
                catch (Exception e) { caught = e; }
                Assert(caught is AuthenticationException, "AuthenticationException thrown");
                Assert(((PushfyException)caught!).Status == 401, "status 401");
                Assert(((PushfyException)caught!).Code == "unauthorized", "code parsed");
                Ok("401 response throws AuthenticationException");
            }

            Console.WriteLine($"\n{_passed} checks passed.");
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("\nSMOKE TEST FAILED: " + e.Message);
            Environment.Exit(1);
        }
    }

    private static bool HasHeader(HttpRequestHeaders headers, string name)
        => headers.TryGetValues(name, out _);

    private static bool HeaderEquals(HttpRequestHeaders headers, string name, string value)
    {
        if (!headers.TryGetValues(name, out var vals)) return false;
        foreach (var v in vals) if (v == value) return true;
        return false;
    }
}
