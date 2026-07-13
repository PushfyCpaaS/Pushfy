<?php

declare(strict_types=1);

namespace Pushfy\Resource;

use Pushfy\Pushfy;

/** Push device registry (server, HMAC). */
final class PushDevices
{
    /** @var Pushfy */
    private $client;

    public function __construct(Pushfy $client)
    {
        $this->client = $client;
    }

    public function list(array $query = [])
    {
        return $this->client->v2Request('GET', '/v1/push/devices', ['query' => $query, 'auth' => Pushfy::AUTH_PUSH]);
    }

    public function register(array $body)
    {
        return $this->client->v2Request('POST', '/v1/push/devices', ['body' => $body, 'auth' => Pushfy::AUTH_PUSH]);
    }

    /** @param string|int $id */
    public function remove($id)
    {
        return $this->client->v2Request('DELETE', '/v1/push/devices/' . $id, ['auth' => Pushfy::AUTH_PUSH]);
    }
}
