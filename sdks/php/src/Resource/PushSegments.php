<?php

declare(strict_types=1);

namespace Pushfy\Resource;

use Pushfy\Pushfy;

/** Push audience segments (server, HMAC). */
final class PushSegments
{
    /** @var Pushfy */
    private $client;

    public function __construct(Pushfy $client)
    {
        $this->client = $client;
    }

    public function list(array $query = [])
    {
        return $this->client->v2Request('GET', '/v1/push/segments', ['query' => $query, 'auth' => Pushfy::AUTH_PUSH]);
    }

    public function create(array $body)
    {
        return $this->client->v2Request('POST', '/v1/push/segments', ['body' => $body, 'auth' => Pushfy::AUTH_PUSH]);
    }
}
