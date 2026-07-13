using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using Pushfy;

// A minimal HttpListener endpoint that receives Pushfy messaging (status/DLR)
// webhooks and verifies their signature before trusting the payload.
//
// Key rule: verify against the RAW request-body bytes. Re-serializing the JSON
// would change the signature and every request would look invalid.
//
//   export PUSHFY_WEBHOOK_SECRET=...
//   dotnet run
//   # POST http://localhost:8080/webhooks/pushfy  with X-Pushfy-Signature: sha256=<hex>
internal static class ReceiveWebhookExample
{
    public static async Task Main()
    {
        var secret = Environment.GetEnvironmentVariable("PUSHFY_WEBHOOK_SECRET");
        if (string.IsNullOrEmpty(secret))
        {
            Console.Error.WriteLine("Set PUSHFY_WEBHOOK_SECRET in your environment.");
            Environment.Exit(2);
        }

        var listener = new HttpListener();
        listener.Prefixes.Add("http://localhost:8080/webhooks/pushfy/");
        listener.Start();
        Console.WriteLine("Listening on http://localhost:8080/webhooks/pushfy");

        while (true)
        {
            var ctx = await listener.GetContextAsync();
            _ = HandleAsync(ctx, secret!); // handle each request; don't block the accept loop
        }
    }

    private static async Task HandleAsync(HttpListenerContext ctx, string secret)
    {
        try
        {
            var req = ctx.Request;
            if (!string.Equals(req.HttpMethod, "POST", StringComparison.OrdinalIgnoreCase))
            {
                Respond(ctx, 405, "Method Not Allowed");
                return;
            }

            // Read the exact bytes received — do not parse-then-reserialize.
            string rawBody;
            using (var reader = new StreamReader(req.InputStream, req.ContentEncoding ?? Encoding.UTF8))
            {
                rawBody = await reader.ReadToEndAsync();
            }

            var signature = req.Headers["X-Pushfy-Signature"];

            var ok = Webhooks.Messaging(rawBody, signature, secret);
            if (!ok)
            {
                Respond(ctx, 401, "Invalid signature");
                return;
            }

            // Signature is valid — safe to process the payload now.
            Console.WriteLine("Verified webhook: " + rawBody);
            Respond(ctx, 200, "OK");
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("Webhook error: " + e.Message);
            Respond(ctx, 500, "Internal Error");
        }
    }

    private static void Respond(HttpListenerContext ctx, int status, string message)
    {
        try
        {
            var buf = Encoding.UTF8.GetBytes(message);
            ctx.Response.StatusCode = status;
            ctx.Response.ContentLength64 = buf.Length;
            ctx.Response.OutputStream.Write(buf, 0, buf.Length);
            ctx.Response.OutputStream.Close();
        }
        catch
        {
            // best-effort response
        }
    }
}
