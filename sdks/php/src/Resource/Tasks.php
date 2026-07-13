<?php

declare(strict_types=1);

namespace Pushfy\Resource;

use Pushfy\Pushfy;

/** Scheduled follow-up tasks for Conversational AI (V2 HMAC, X-PA-*). */
final class Tasks
{
    /** @var Pushfy */
    private $client;

    public function __construct(Pushfy $client)
    {
        $this->client = $client;
    }

    /**
     * Schedule a follow-up.
     *
     * @param array{conversationId: string|int, runAt: string, text: string} $params
     * @return mixed
     */
    public function schedule(array $params)
    {
        return $this->client->v2Request('POST', '/v1/tasks', [
            'body' => [
                'conversation_id' => $params['conversationId'] ?? null,
                'run_at' => $params['runAt'] ?? null,
                'text' => $params['text'] ?? null,
            ],
            'auth' => Pushfy::AUTH_PA,
        ]);
    }
}
