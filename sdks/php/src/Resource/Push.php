<?php

declare(strict_types=1);

namespace Pushfy\Resource;

use Pushfy\Pushfy;

/**
 * Push Notifications (V2 HMAC server API + public app endpoints).
 *
 * Nested groups mirror the Node SDK:
 *   $pushfy->push->devices->register([...])
 *   $pushfy->push->campaigns->create([...])
 *   $pushfy->push->segments->list([...])
 */
final class Push
{
    /** @var Pushfy */
    private $client;

    /** @var PushDevices */
    public $devices;

    /** @var PushCampaigns */
    public $campaigns;

    /** @var PushSegments */
    public $segments;

    public function __construct(Pushfy $client)
    {
        $this->client = $client;
        $this->devices = new PushDevices($client);
        $this->campaigns = new PushCampaigns($client);
        $this->segments = new PushSegments($client);
    }

    /** Send a test push (server, HMAC). */
    public function test(array $body)
    {
        return $this->client->v2Request('POST', '/v1/push/test', ['body' => $body, 'auth' => Pushfy::AUTH_PUSH]);
    }

    /** Public: subscribe a device (browser/app). Injects app_id automatically. */
    public function subscribe(array $body)
    {
        return $this->client->v2Request('POST', '/v1/push/subscribe', [
            'body' => array_merge(['app_id' => $this->client->getAppId()], $body),
            'auth' => Pushfy::AUTH_PUBLIC,
        ]);
    }

    /** Public: report a device event. Injects app_id automatically. */
    public function track(array $body)
    {
        return $this->client->v2Request('POST', '/v1/push/track', [
            'body' => array_merge(['app_id' => $this->client->getAppId()], $body),
            'auth' => Pushfy::AUTH_PUBLIC,
        ]);
    }
}
