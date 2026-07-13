<?php

declare(strict_types=1);

namespace Pushfy\Resource;

use Pushfy\Pushfy;

/** Push campaigns (server, HMAC). */
final class PushCampaigns
{
    /** @var Pushfy */
    private $client;

    public function __construct(Pushfy $client)
    {
        $this->client = $client;
    }

    public function list(array $query = [])
    {
        return $this->client->v2Request('GET', '/v1/push/campaigns', ['query' => $query, 'auth' => Pushfy::AUTH_PUSH]);
    }

    public function create(array $body)
    {
        return $this->client->v2Request('POST', '/v1/push/campaigns', ['body' => $body, 'auth' => Pushfy::AUTH_PUSH]);
    }

    /** @param string|int $id */
    public function get($id)
    {
        return $this->client->v2Request('GET', '/v1/push/campaigns/' . $id, ['auth' => Pushfy::AUTH_PUSH]);
    }

    /** @param string|int $id */
    public function update($id, array $body)
    {
        return $this->client->v2Request('PATCH', '/v1/push/campaigns/' . $id, ['body' => $body, 'auth' => Pushfy::AUTH_PUSH]);
    }

    /** @param string|int $id */
    public function send($id)
    {
        return $this->client->v2Request('POST', '/v1/push/campaigns/' . $id . '/send', ['body' => [], 'auth' => Pushfy::AUTH_PUSH]);
    }

    /** @param string|int $id */
    public function metrics($id)
    {
        return $this->client->v2Request('GET', '/v1/push/campaigns/' . $id . '/metrics', ['auth' => Pushfy::AUTH_PUSH]);
    }
}
