/**
 * send-voice.ts — Upload an .mp3 under a name and place a voice call referencing it.
 *
 * The upload response does NOT contain an audio id: the audio is identified by
 * the name you choose. Use that same name when placing the call.
 *
 * Run:  PUSHFY_API_TOKEN=... npx ts-node send-voice.ts ./welcome.mp3
 */
import { readFileSync } from 'fs';
import { Pushfy, MessageSendResult } from '@pushfy/pushfy';

async function main(): Promise<void> {
  const apiToken = process.env.PUSHFY_API_TOKEN;
  if (!apiToken) throw new Error('Set PUSHFY_API_TOKEN in the environment.');

  // The name identifies the audio on both steps. Keep upload and call in sync.
  const audioName = process.env.PUSHFY_AUDIO_NAME ?? 'Welcome message';
  const audioPath = process.argv[2] ?? './welcome.mp3';
  const pushfy = new Pushfy({ apiToken });

  // 1. Upload the audio bytes (mp3) under `audioName`.
  await pushfy.voice.uploadAudio({
    name: audioName,
    data: readFileSync(audioPath),
    filename: 'welcome.mp3',
  });
  console.log('Uploaded audio:', audioName);

  // 2. Place the call, referencing the audio by the same name.
  const result: MessageSendResult = await pushfy.voice.send({
    to: '5511999999999',
    audioName,
    extId: 'voice-call-001',
  });

  console.log('Voice call accepted:', JSON.stringify(result, null, 2));
}

main().catch((err: unknown) => {
  console.error('Failed to place voice call:', err instanceof Error ? err.message : err);
  process.exit(1);
});
