<?php

declare(strict_types=1);

namespace Pushfy\Resource;

use Pushfy\Pushfy;

/** Delivery status and reporting for classic messaging. */
final class Messages
{
    /** @var Pushfy */
    private $client;

    public function __construct(Pushfy $client)
    {
        $this->client = $client;
    }

    /**
     * Delivery status of one message by your ext_id (or internal uid).
     *
     * @param array{extId?: string, uid?: string} $params
     * @return mixed
     */
    public function status(array $params)
    {
        return $this->client->classicRequest('GET', '/getstatus', [
            'query' => [
                'ext_id' => $params['extId'] ?? null,
                'uid' => $params['uid'] ?? null,
            ],
        ]);
    }

    /**
     * Status of every message on a given day (YYYY-MM-DD).
     *
     * @param string $date
     * @return mixed
     */
    public function byDate(string $date)
    {
        return $this->client->classicRequest('GET', '/getdate', [
            'query' => ['date' => $date],
        ]);
    }

    /**
     * Report by date / date range.
     *
     * @param array{date?: string, start?: string, end?: string, event?: string, limit?: int, offset?: int, dateDlr?: string} $params
     * @return mixed
     */
    public function report(array $params = [])
    {
        return $this->client->classicRequest('GET', '/reportbydate', [
            'query' => [
                'date' => $params['date'] ?? null,
                'start' => $params['start'] ?? null,
                'end' => $params['end'] ?? null,
                'event' => $params['event'] ?? null,
                'limit' => $params['limit'] ?? null,
                'offset' => $params['offset'] ?? null,
                'date_dlr' => $params['dateDlr'] ?? null,
            ],
        ]);
    }
}
