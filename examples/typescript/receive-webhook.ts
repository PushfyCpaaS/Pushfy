/**
 * receive-webhook.ts — Express server that verifies Pushfy webhook signatures.
 *
 * Covers all three webhook families:
 *   - messaging     (delivery/DLR)  header: X-Pushfy-Signature   scheme: sha256=<hex>
 *   - push          (push events)   header: X-Push-Signature     scheme: sha256=<hex>
 *   - conversations (PushAgent)     header: X-PA-Signature       scheme: <hex> (raw)
 *
 * IMPORTANT: always verify against the RAW request body. Re-serializing JSON
 * changes the bytes and therefore breaks the signature — so we use
 * `express.raw` and keep the Buffer untouched.
 *
 * Run:  WEBHOOK_SECRET=... PUSH_WEBHOOK_SECRET=... PA_WEBHOOK_SECRET=... npx ts-node receive-webhook.ts
 */
import express, { Request, Response } from 'express';
import { Pushfy } from '@pushfy/pushfy';

const messagingSecret = process.env.WEBHOOK_SECRET;
const pushSecret = process.env.PUSH_WEBHOOK_SECRET;
const paSecret = process.env.PA_WEBHOOK_SECRET;
if (!messagingSecret) throw new Error('Set WEBHOOK_SECRET in the environment.');

const app = express();

// Keep the RAW body for every route so signatures stay verifiable.
app.use(express.raw({ type: '*/*' }));

/** Parse the raw Buffer into an object only AFTER the signature is verified. */
function parseBody(raw: Buffer): unknown {
  const text = raw.toString('utf8');
  return text ? JSON.parse(text) : {};
}

// --- Messaging: delivery status / DLR ---------------------------------------
app.post('/webhooks/pushfy/messaging', (req: Request, res: Response) => {
  const ok = Pushfy.webhooks.messaging({
    payload: req.body as Buffer,
    signature: req.header('X-Pushfy-Signature'),
    secret: messagingSecret,
  });
  if (!ok) return res.sendStatus(401);

  const event = parseBody(req.body as Buffer);
  console.log('Messaging event:', event);

  // Respond fast; do any heavy work asynchronously.
  return res.sendStatus(200);
});

// --- Push notification events -----------------------------------------------
app.post('/webhooks/pushfy/push', (req: Request, res: Response) => {
  if (!pushSecret) return res.sendStatus(503);
  const ok = Pushfy.webhooks.push({
    payload: req.body as Buffer,
    signature: req.header('X-Push-Signature'),
    secret: pushSecret,
  });
  if (!ok) return res.sendStatus(401);

  console.log('Push event:', parseBody(req.body as Buffer));
  return res.sendStatus(200);
});

// --- Conversational AI (PushAgent) events -----------------------------------
app.post('/webhooks/pushfy/conversations', (req: Request, res: Response) => {
  if (!paSecret) return res.sendStatus(503);
  const ok = Pushfy.webhooks.conversations({
    payload: req.body as Buffer,
    signature: req.header('X-PA-Signature'),
    secret: paSecret,
  });
  if (!ok) return res.sendStatus(401);

  console.log('Conversation event:', parseBody(req.body as Buffer));
  return res.sendStatus(200);
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Webhook listener on http://localhost:${port}`));
