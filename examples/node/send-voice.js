'use strict';

// Place a voice call: upload an .mp3 once under a name, then dial referencing
// that same name. The upload does NOT return an audio id — the audio is keyed
// by the name you choose here.
//
// Run:  PUSHFY_API_TOKEN=... node send-voice.js ./welcome.mp3

const fs = require('fs');
const { Pushfy } = require('@pushfy/pushfy');

const pushfy = new Pushfy({ apiToken: process.env.PUSHFY_API_TOKEN });

// The name identifies the audio on both steps. Keep upload and call in sync.
const AUDIO_NAME = process.env.PUSHFY_AUDIO_NAME || 'Welcome message';

async function main() {
  const audioPath = process.argv[2] || './welcome.mp3';

  // 1. Upload the audio under AUDIO_NAME. `data` must be the raw mp3 bytes.
  const upload = await pushfy.voice.uploadAudio({
    name: AUDIO_NAME,
    data: fs.readFileSync(audioPath),
    filename: 'welcome.mp3',
  });
  console.log('Uploaded audio:', upload);

  // 2. Dial, referencing the audio by the same name.
  const result = await pushfy.voice.send({
    to: '5511999999999',
    audioName: AUDIO_NAME,
    extId: 'call-welcome-001',
  });
  console.log('Call queued:', result);
}

main().catch((err) => {
  console.error('Voice call failed:', err.status, err.code, err.message);
  process.exitCode = 1;
});
