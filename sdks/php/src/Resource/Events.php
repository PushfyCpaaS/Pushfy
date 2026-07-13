<?php

declare(strict_types=1);

namespace Pushfy\Resource;

use Pushfy\Pushfy;

/** Business events for Conversational AI (V2 HMAC, X-PA-*). */
final class Events
{
    /** @var Pushfy */
    private $client;

    public function __construct(Pushfy $client)
    {
        $this->client = $client;
    }

    /**
     * Send a business event.
     *
     * @param array{type: string, userExtId: string, data?: array} $params
     * @return mixed
     */
    public function send(array $params)
    {
        return $this->client->v2Request('POST', '/v1/events', [
            'body' => [
                'type' => $params['type'] ?? null,
                'user_ext_id' => $params['userExtId'] ?? null,
                'data' => $params['data'] ?? null,
            ],
            'auth' => Pushfy::AUTH_PA,
        ]);
    }
}
