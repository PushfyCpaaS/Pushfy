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
     * @param array{name?: string, data: string, filename?: string} $params
     *        `data` is the raw mp3 bytes.
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
     * Place a voice call by referencing a previously uploaded audio id.
     *
     * @param array{to: string, audioId: string, extId?: string} $params
     * @return mixed
     */
    public function send(array $params)
    {
        $msg = Message::normalize([
            'to' => $params['to'] ?? '',
            'text' => '',
            'extId' => $params['extId'] ?? null,
            'audio' => $params['audioId'] ?? null,
        ]);

        return $this->client->classicRequest('POST', '/webapi', [
            'json' => ['messages' => [$msg]],
        ]);
    }
}
