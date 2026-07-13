<?php

declare(strict_types=1);

namespace Pushfy\Resource;

use Pushfy\Pushfy;

/** Voice (text-to-call via pre-uploaded mp3 audio). */
final class Voice
{
    /** @var Pushfy */
    private $client;

    public function __construct(Pushfy $client)
    {
        $this->client = $client;
    }

    /**
     * Upload a voice audio (.mp3). Returns the API result.
     *
     * The response does NOT return an audio id — the audio is stored under the
     * `name` you send here, so keep that exact name to place calls later.
     *
     * @param array{name?: string, data: string, filename?: string} $params
     *        `data` is the raw mp3 bytes. `name` is the audio's name; retain it
     *        to reference the audio in `send`.
     * @return mixed
     */
    public function uploadAudio(array $params)
    {
        $filename = $params['filename'] ?? 'audio.mp3';
        $name = $params['name'] ?? $filename;
        $data = $params['data'] ?? '';

        return $this->client->classicRequest('POST', '/audio', [
            'multipart' => [
                ['name' => 'nome', 'contents' => $name],
                ['name' => 'audio', 'contents' => $data, 'filename' => $filename, 'contentType' => 'audio/mpeg'],
            ],
        ]);
    }

    /**
     * Place a voice call by referencing a previously uploaded audio.
     *
     * `audioName` is the audio's NAME — the exact `nome` you set when uploading via /audio.
     *
     * @param array{to: string, audioName: string, extId?: string} $params
     * @return mixed
     */
    public function send(array $params)
    {
        $msg = Message::normalize([
            'to' => $params['to'] ?? '',
            'text' => '',
            'extId' => $params['extId'] ?? null,
            'audio' => $params['audioName'] ?? null,
        ]);

        return $this->client->classicRequest('POST', '/webapi', [
            'json' => ['messages' => [$msg]],
        ]);
    }
}
