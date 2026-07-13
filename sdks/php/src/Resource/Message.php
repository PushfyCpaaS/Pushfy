<?php

declare(strict_types=1);

namespace Pushfy\Resource;

/** Internal helper: shapes a message payload for the classic /webapi endpoint. */
final class Message
{
    /**
     * @param array{to: string, text?: string, extId?: string, audio?: string} $m
     * @return array<string, mixed>
     */
    public static function normalize(array $m): array
    {
        $out = [
            'destinations' => [['to' => self::digits($m['to'] ?? '')]],
            'text' => $m['text'] ?? '',
        ];
        if (isset($m['extId']) && $m['extId'] !== null) {
            $out['ext_id'] = $m['extId'];
        }
        if (isset($m['audio']) && $m['audio'] !== null) {
            $out['audio'] = $m['audio'];
        }
        return $out;
    }

    /** Strip every non-digit from a phone number. */
    public static function digits(string $phone): string
    {
        return preg_replace('/\D/', '', $phone) ?? '';
    }
}
