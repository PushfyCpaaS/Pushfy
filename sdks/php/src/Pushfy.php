<?php

declare(strict_types=1);

namespace Pushfy;

use Pushfy\Exception\ApiException;
use Pushfy\Exception\PushfyException;
use Pushfy\Resource\Balance;
use Pushfy\Resource\Conversations;
use Pushfy\Resource\Events;
use Pushfy\Resource\Messages;
use Pushfy\Resource\Push;
use Pushfy\Resource\Rcs;
use Pushfy\Resource\Sms;
use Pushfy\Resource\Tasks;
use Pushfy\Resource\Voice;

/**
 * Pushfy API client.
 *
 * @example
 *   use Pushfy\Pushfy;
 *   $pushfy = new Pushfy(['apiToken' => 'YOUR_API_TOKEN']);
 *   $res = $pushfy->sms->send(['to' => '5511999999999', 'text' => 'Hello']);
 */
final class Pushfy
{
    public const DEFAULT_BASE = 'https://portal.pushfy.com';
    public const DEFAULT_V2_PATH = '/v2/api.php';

    public const AUTH_PA = 'pa';
    public const AUTH_PUSH = 'push';
    public const AUTH_PUBLIC = 'public';

    /** @var string|null */
    private $apiToken;
    /** @var string|null */
    private $paKey;
    /** @var string|null */
    private $paSecret;
    /** @var string|null */
    private $pushKey;
    /** @var string|null */
    private $pushSecret;
    /** @var string|null */
    private $appId;
    /** @var string */
    private $baseUrl;
    /** @var string */
    private $v2Path;
    /** @var int Request timeout in seconds. */
    private $timeout;
    /** @var callable|null Optional transport override (url, method, headers[], body) => ['status'=>int,'body'=>string]. */
    private $transport;

    /** @var Sms */
    public $sms;
    /** @var Rcs */
    public $rcs;
    /** @var Voice */
    public $voice;
    /** @var Messages */
    public $messages;
    /** @var Balance */
    public $balance;
    /** @var Push */
    public $push;
    /** @var Conversations */
    public $conversations;
    /** @var Events */
    public $events;
    /** @var Tasks */
    public $tasks;

    /**
     * @param array{
     *   apiToken?: string,
     *   paKey?: string, paSecret?: string,
     *   pushKey?: string, pushSecret?: string,
     *   appId?: string,
     *   baseUrl?: string, v2Path?: string,
     *   timeout?: int|float,
     *   transport?: callable
     * } $opts
     */
    public function __construct(array $opts = [])
    {
        $this->apiToken = $opts['apiToken'] ?? null;
        $this->paKey = $opts['paKey'] ?? null;
        $this->paSecret = $opts['paSecret'] ?? null;
        $this->pushKey = $opts['pushKey'] ?? null;
        $this->pushSecret = $opts['pushSecret'] ?? null;
        $this->appId = $opts['appId'] ?? null;
        $this->baseUrl = rtrim($opts['baseUrl'] ?? self::DEFAULT_BASE, '/');
        $this->v2Path = $opts['v2Path'] ?? self::DEFAULT_V2_PATH;
        // Node uses milliseconds (default 30000); PHP cURL works in seconds.
        $ms = $opts['timeout'] ?? 30000;
        $this->timeout = (int) max(1, (int) round($ms / 1000));
        $this->transport = $opts['transport'] ?? null;

        $this->sms = new Sms($this);
        $this->rcs = new Rcs($this);
        $this->voice = new Voice($this);
        $this->messages = new Messages($this);
        $this->balance = new Balance($this);
        $this->push = new Push($this);
        $this->conversations = new Conversations($this);
        $this->events = new Events($this);
        $this->tasks = new Tasks($this);
    }

    public function getAppId(): ?string
    {
        return $this->appId;
    }

    /** Webhook signature helpers (no credentials needed). */
    public static function webhooks(): string
    {
        return Webhooks::class;
    }

    // ---- low-level transport -------------------------------------------------

    /**
     * @param string $method
     * @param string $url
     * @param array<string,string> $headers
     * @param string|null $body
     * @return mixed  Parsed response (array), or null for empty responses.
     * @throws PushfyException
     */
    private function http(string $method, string $url, array $headers, ?string $body)
    {
        if ($this->transport !== null) {
            $res = ($this->transport)($url, $method, $headers, $body);
            $status = (int) ($res['status'] ?? 200);
            $text = (string) ($res['body'] ?? '');
        } else {
            [$status, $text] = $this->curl($method, $url, $headers, $body);
        }

        $parsed = null;
        if ($text !== '') {
            $decoded = json_decode($text, true);
            $parsed = (json_last_error() === JSON_ERROR_NONE) ? $decoded : ['raw' => $text];
        }

        if ($status < 200 || $status >= 300) {
            $errBody = $parsed;
            if (is_array($parsed) && !isset($parsed['error']) && isset($parsed['raw'])) {
                $errBody = ['error' => $parsed['raw']];
            } elseif (!is_array($parsed)) {
                $errBody = ['error' => $text !== '' ? $text : 'error'];
            }
            throw PushfyException::fromResponse($status, $errBody);
        }

        return $parsed;
    }

    /**
     * @param array<string,string> $headers
     * @return array{0:int,1:string}
     * @throws ApiException on network/timeout failure.
     */
    private function curl(string $method, string $url, array $headers, ?string $body): array
    {
        $ch = curl_init();
        $headerLines = [];
        foreach ($headers as $k => $v) {
            $headerLines[] = $k . ': ' . $v;
        }

        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headerLines,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CONNECTTIMEOUT => $this->timeout,
        ]);
        if ($body !== null && $body !== '' && strtoupper($method) !== 'GET') {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }

        $text = curl_exec($ch);
        if ($text === false) {
            $err = curl_error($ch);
            curl_close($ch);
            throw new ApiException('Network error: ' . $err, 0);
        }
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return [$status, (string) $text];
    }

    /**
     * Messaging (classic) request against https://portal.pushfy.com/<path>.
     *
     * @param array{json?: mixed, multipart?: array, query?: array} $opts
     * @return mixed
     * @throws PushfyException
     */
    public function classicRequest(string $method, string $path, array $opts = [])
    {
        $url = $this->baseUrl . $path;
        if (!empty($opts['query'])) {
            $q = [];
            foreach ($opts['query'] as $k => $v) {
                if ($v !== null) {
                    $q[$k] = $v;
                }
            }
            if ($q) {
                $url .= (strpos($path, '?') !== false ? '&' : '?') . http_build_query($q);
            }
        }

        $headers = [];
        if ($this->apiToken !== null) {
            $headers['Authorization'] = 'Bearer ' . $this->apiToken;
        }

        $body = null;
        if (isset($opts['multipart'])) {
            [$body, $contentType] = $this->buildMultipart($opts['multipart']);
            $headers['Content-Type'] = $contentType;
        } elseif (array_key_exists('json', $opts)) {
            $headers['Content-Type'] = 'application/json';
            $body = self::encodeJson($opts['json']);
        }

        return $this->http($method, $url, $headers, $body);
    }

    /**
     * V2 request (Push / Conversational AI) via ?r=<route>.
     *
     * @param array{body?: mixed, query?: array, auth?: string} $opts
     * @return mixed
     * @throws PushfyException
     */
    public function v2Request(string $method, string $route, array $opts = [])
    {
        $params = ['r' => $route];
        if (!empty($opts['query'])) {
            foreach ($opts['query'] as $k => $v) {
                if ($v !== null) {
                    $params[$k] = $v;
                }
            }
        }
        $url = $this->baseUrl . $this->v2Path . '?' . http_build_query($params);

        $bodyStr = '';
        if (array_key_exists('body', $opts) && strtoupper($method) !== 'GET') {
            $body = $opts['body'];
            if (is_array($body)) {
                $body = array_filter($body, static function ($v) {
                    return $v !== null;
                });
            }
            $bodyStr = self::encodeJson($body);
        }

        $headers = [];
        if ($bodyStr !== '') {
            $headers['Content-Type'] = 'application/json';
        }

        $auth = $opts['auth'] ?? null;
        if ($auth === self::AUTH_PA) {
            if ($this->paKey === null || $this->paSecret === null) {
                throw new \InvalidArgumentException('paKey/paSecret required for Conversational AI');
            }
            $sig = Hmac::sign($method, $route, $bodyStr, $this->paSecret);
            $headers['X-PA-Key'] = $this->paKey;
            $headers['X-PA-Timestamp'] = $sig['timestamp'];
            $headers['X-PA-Signature'] = $sig['signature'];
        } elseif ($auth === self::AUTH_PUSH) {
            if ($this->pushKey === null || $this->pushSecret === null) {
                throw new \InvalidArgumentException('pushKey/pushSecret required for Push server API');
            }
            $sig = Hmac::sign($method, $route, $bodyStr, $this->pushSecret);
            $headers['X-PUSH-Key'] = $this->pushKey;
            $headers['X-PUSH-Timestamp'] = $sig['timestamp'];
            $headers['X-PUSH-Signature'] = $sig['signature'];
        }

        return $this->http($method, $url, $headers, $bodyStr !== '' ? $bodyStr : null);
    }

    /**
     * JSON-encode a body, mirroring JS: an empty object stays "{}" (not "[]").
     *
     * @param mixed $value
     */
    private static function encodeJson($value): string
    {
        if ($value === [] || $value === null) {
            return $value === null ? 'null' : '{}';
        }
        $json = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return $json === false ? '{}' : $json;
    }

    /**
     * Builds a multipart/form-data body.
     *
     * @param array<int, array{name: string, contents: string, filename?: string, contentType?: string}> $parts
     * @return array{0:string,1:string}  [body, contentType]
     */
    private function buildMultipart(array $parts): array
    {
        $boundary = '----PushfyBoundary' . bin2hex(random_bytes(16));
        $eol = "\r\n";
        $out = '';
        foreach ($parts as $p) {
            $out .= '--' . $boundary . $eol;
            if (isset($p['filename'])) {
                $out .= 'Content-Disposition: form-data; name="' . $p['name'] . '"; filename="' . $p['filename'] . '"' . $eol;
                $out .= 'Content-Type: ' . ($p['contentType'] ?? 'application/octet-stream') . $eol;
            } else {
                $out .= 'Content-Disposition: form-data; name="' . $p['name'] . '"' . $eol;
            }
            $out .= $eol . $p['contents'] . $eol;
        }
        $out .= '--' . $boundary . '--' . $eol;

        return [$out, 'multipart/form-data; boundary=' . $boundary];
    }
}
