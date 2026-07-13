<?php

declare(strict_types=1);

namespace Pushfy\Resource;

use Pushfy\Pushfy;

/** Conversational AI (PushAgent) — V2 HMAC with X-PA-* headers. */
final class Conversations
{
    /** @var Pushfy */
    private $client;

    public function __construct(Pushfy $client)
    {
        $this->client = $client;
    }

    /**
     * Open a conversation.
     *
     * @param array{userExtId: string, name?: string, channel?: string} $params
     * @return mixed
     */
    public function open(array $params)
    {
        return $this->client->v2Request('POST', '/v1/conversations', [
            'body' => [
                'user_ext_id' => $params['userExtId'] ?? null,
                'name' => $params['name'] ?? null,
                'channel' => $params['channel'] ?? null,
            ],
            'auth' => Pushfy::AUTH_PA,
        ]);
    }

    /** @param string|int $id */
    public function get($id)
    {
        return $this->client->v2Request('GET', '/v1/conversations/' . $id, ['auth' => Pushfy::AUTH_PA]);
    }

    /**
     * Send a user message; the bot replies asynchronously.
     *
     * @param string|int $id
     * @param array{content: string} $params
     * @return mixed
     */
    public function message($id, array $params)
    {
        return $this->client->v2Request('POST', '/v1/conversations/' . $id . '/messages', [
            'body' => ['content' => $params['content'] ?? null],
            'auth' => Pushfy::AUTH_PA,
        ]);
    }

    /** @param string|int $id */
    public function handoff($id)
    {
        return $this->client->v2Request('POST', '/v1/conversations/' . $id . '/handoff', ['body' => [], 'auth' => Pushfy::AUTH_PA]);
    }

    /** @param string|int $id */
    public function close($id)
    {
        return $this->client->v2Request('POST', '/v1/conversations/' . $id . '/close', ['body' => [], 'auth' => Pushfy::AUTH_PA]);
    }
}
