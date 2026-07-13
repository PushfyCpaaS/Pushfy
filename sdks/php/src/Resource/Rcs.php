<?php

declare(strict_types=1);

namespace Pushfy\Resource;

use Pushfy\Pushfy;

/** RCS rich messaging. */
final class Rcs
{
    /** @var Pushfy */
    private $client;

    public function __construct(Pushfy $client)
    {
        $this->client = $client;
    }

    /**
     * Send an RCS rich card via the API RCS campaign.
     *
     * @param array{to: string, text: string, title?: string, url?: string, cta?: string, image?: string, extId?: string} $params
     * @return mixed
     */
    public function send(array $params)
    {
        $msg = [
            'destinations' => [['to' => Message::digits($params['to'] ?? '')]],
            'text' => $params['text'] ?? '',
        ];
        foreach (['title' => 'title', 'image' => 'image', 'url' => 'url', 'cta' => 'cta'] as $in => $out) {
            if (isset($params[$in]) && $params[$in] !== null) {
                $msg[$out] = $params[$in];
            }
        }
        if (isset($params['extId']) && $params['extId'] !== null) {
            $msg['ext_id'] = $params['extId'];
        }

        return $this->client->classicRequest('POST', '/apircsnativo.php', [
            'json' => ['messages' => [$msg]],
        ]);
    }
}
