<?php

declare(strict_types=1);

namespace Pushfy\Resource;

use Pushfy\Pushfy;

/** SMS sending. */
final class Sms
{
    /** @var Pushfy */
    private $client;

    public function __construct(Pushfy $client)
    {
        $this->client = $client;
    }

    /**
     * Send a single SMS.
     *
     * @param array{to: string, text: string, extId?: string} $params
     * @return mixed The API result array [{ id, phone, date, ext_id }].
     */
    public function send(array $params)
    {
        return $this->client->classicRequest('POST', '/webapi', [
            'json' => ['messages' => [Message::normalize($params)]],
        ]);
    }

    /**
     * Send many SMS in one request.
     *
     * @param array<int, array{to: string, text: string, extId?: string}> $list
     * @return mixed
     */
    public function sendBulk(array $list)
    {
        $messages = array_map([Message::class, 'normalize'], $list);
        return $this->client->classicRequest('POST', '/webapi', [
            'json' => ['messages' => $messages],
        ]);
    }
}
