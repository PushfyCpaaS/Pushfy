'use strict';

// Place a voice call: upload an .mp3 once, then dial referencing its audio id.
//
// Run:  PUSHFY_API_TOKEN=... node send-voice.js ./welcome.mp3

const fs = require('fs');
const { Pushfy } = require('@pushfy/pushfy');

const pushfy = new Pushfy({ apiToken: process.env.PUSHFY_API_TOKEN });

async function main() {
  const audioPath = process.argv[2] || './welcome.mp3';

  // 1. Upload the audio. `data` must be the raw mp3 bytes (a Buffer).
  const upload = await pushfy.voice.uploadAudio({
    name: 'welcome',
    data: fs.readFileSync(audioPath),
    filename: 'welcome.mp3',
  });
  console.log('Uploaded audio:', upload);

  // The upload response carries the audio id to reference on the call.
  // (Field name depends on your account; adjust if needed.)
  const audioId = upload.audio_id || upload.id || upload.user_id;

  // 2. Dial, referencing the uploaded audio.
  const result = await pushfy.voice.send({
    to: '5511999999999',
    audioId,
    extId: 'call-welcome-001',
  });
  console.log('Call queued:', result);
}

main().catch((err) => {
  console.error('Voice call failed:', err.status, err.code, err.message);
  process.exitCode = 1;
});
