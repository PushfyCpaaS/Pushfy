/**
 * send-voice.ts — Upload an .mp3 and place a voice call referencing it.
 *
 * Run:  PUSHFY_API_TOKEN=... npx ts-node send-voice.ts ./welcome.mp3
 */
import { readFileSync } from 'fs';
import { Pushfy, JsonValue, MessageSendResult } from '@pushfy/pushfy';

/** Extract the uploaded audio id from the loosely-typed upload response. */
function readAudioId(value: JsonValue): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, JsonValue>;
    const id = obj.id ?? obj.audio_id ?? obj.audioId;
    if (typeof id === 'string' || typeof id === 'number') return String(id);
  }
  throw new Error(`Could not find audio id in upload response: ${JSON.stringify(value)}`);
}

async function main(): Promise<void> {
  const apiToken = process.env.PUSHFY_API_TOKEN;
  if (!apiToken) throw new Error('Set PUSHFY_API_TOKEN in the environment.');

  const audioPath = process.argv[2] ?? './welcome.mp3';
  const pushfy = new Pushfy({ apiToken });

  // 1. Upload the audio bytes (mp3).
  const uploaded = await pushfy.voice.uploadAudio({
    name: 'welcome',
    data: readFileSync(audioPath),
    filename: 'welcome.mp3',
  });
  const audioId = readAudioId(uploaded);
  console.log('Uploaded audio id:', audioId);

  // 2. Place the call.
  const result: MessageSendResult = await pushfy.voice.send({
    to: '5511999999999',
    audioId,
    extId: 'voice-call-001',
  });

  console.log('Voice call accepted:', JSON.stringify(result, null, 2));
}

main().catch((err: unknown) => {
  console.error('Failed to place voice call:', err instanceof Error ? err.message : err);
  process.exit(1);
});
