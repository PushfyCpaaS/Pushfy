<?php

declare(strict_types=1);

// Place a voice call: upload an mp3 once, then dial referencing its audio id.
//   PUSHFY_API_TOKEN=... PUSHFY_AUDIO_FILE=./welcome.mp3 php send-voice.php

require __DIR__ . '/vendor/autoload.php';

use Pushfy\Pushfy;
use Pushfy\Exception\PushfyException;

$pushfy = new Pushfy([
    'apiToken' => getenv('PUSHFY_API_TOKEN') ?: '',
]);

$audioFile = getenv('PUSHFY_AUDIO_FILE') ?: '';

try {
    // 1) Upload the audio (raw mp3 bytes). Do this once and reuse the id.
    if ($audioFile === '' || !is_readable($audioFile)) {
        fwrite(STDERR, "Set PUSHFY_AUDIO_FILE to a readable .mp3 path.\n");
        exit(1);
    }

    $upload = $pushfy->voice->uploadAudio([
        'name'     => 'welcome',
        'filename' => basename($audioFile),
        'data'     => file_get_contents($audioFile), // raw mp3 bytes
    ]);
    echo "Uploaded audio:\n";
    echo json_encode($upload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), "\n";

    $audioId = $upload['id'] ?? getenv('PUSHFY_AUDIO_ID') ?: '';
    if ($audioId === '') {
        fwrite(STDERR, "No audio id available to place the call.\n");
        exit(1);
    }

    // 2) Place the call referencing the uploaded audio.
    $result = $pushfy->voice->send([
        'to'      => '5511999999999',
        'audioId' => $audioId,
        'extId'   => 'call-' . time(),
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
