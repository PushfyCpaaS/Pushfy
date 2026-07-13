<?php

declare(strict_types=1);

namespace Pushfy\Resource;

use Pushfy\Pushfy;

/** SMS balance. */
final class Balance
{
    /** @var Pushfy */
    private $client;

    public function __construct(Pushfy $client)
    {
        $this->client = $client;
    }

    /**
     * SMS balance.
     *
     * The API returns a locale-formatted string like {"saldo":"1.500"}. This
     * strips the grouping separators to an integer credit count.
     *
     * @return array{raw: string|null, balance: int|null}
     */
    public function get(): array
    {
        $res = $this->client->classicRequest('GET', '/balance');
        $raw = (is_array($res) && isset($res['saldo']) && $res['saldo'] !== null)
            ? (string) $res['saldo']
            : null;

        return [
            'raw' => $raw,
            'balance' => $raw !== null ? (int) preg_replace('/\D/', '', $raw) : null,
        ];
    }
}
