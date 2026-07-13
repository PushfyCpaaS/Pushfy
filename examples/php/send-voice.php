<?php

declare(strict_types=1);

// Place a voice call: upload an mp3 once under a name, then dial referencing
// that same name. The upload does NOT return an audio id — the audio is keyed
// by the name you choose.
//   PUSHFY_API_TOKEN=... PUSHFY_AUDIO_FILE=./welcome.mp3 php send-voice.php

require __DIR__ . '/vendor/autoload.php';

use Pushfy\Pushfy;
use Pushfy\Exception\PushfyException;

$pushfy = new Pushfy([
    'apiToken' => getenv('PUSHFY_API_TOKEN') ?: '',
]);

$audioFile = getenv('PUSHFY_AUDIO_FILE') ?: '';
// The name identifies the audio on both steps. Keep upload and call in sync.
$audioName = getenv('PUSHFY_AUDIO_NAME') ?: 'Welcome message';

try {
    // 1) Upload the audio (raw mp3 bytes) under $audioName. Do this once and reuse the name.
    if ($audioFile === '' || !is_readable($audioFile)) {
        fwrite(STDERR, "Set PUSHFY_AUDIO_FILE to a readable .mp3 path.\n");
        exit(1);
    }

    $upload = $pushfy->voice->uploadAudio([
        'name'     => $audioName,
        'filename' => basename($audioFile),
        'data'     => file_get_contents($audioFile), // raw mp3 bytes
    ]);
    echo "Uploaded audio:\n";
    echo json_encode($upload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), "\n";

    // 2) Place the call referencing the audio by the same name.
    $result = $pushfy->voice->send([
        'to'        => '5511999999999',
        'audioName' => $audioName,
        'extId'     => 'call-' . time(),
    ]);
    echo "Call accepted:\n";
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), "\n";
} catch (PushfyException $e) {
    fwrite(STDERR, sprintf(
        "Voice call failed: status=%d code=%s\n",
        $e->getStatus(),
        (string) $e->getErrorCode()
    ));
    exit(1);
}
