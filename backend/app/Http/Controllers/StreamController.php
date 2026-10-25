<?php

namespace App\Http\Controllers;

use App\Services\YouTubeAudio;
use Illuminate\Http\Client\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class StreamController extends Controller
{
    private const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    // googlevideo bride les longues requêtes : on lui demande le fichier par tranches (comme yt-dlp).
    private const CHUNK = 2 * 1024 * 1024;

    public function __construct(private YouTubeAudio $youtube) {}

    public function status()
    {
        return response()->json(['youtube' => $this->youtube->enabled()]);
    }

    /** Relaie le flux audio d'une vidéo YouTube, avec la gestion des plages (Range) pour l'avance rapide et iOS. */
    public function youtube(Request $request, string $id)
    {
        abort_unless(preg_match('/^[A-Za-z0-9_-]{11}$/', $id) && $this->youtube->enabled(), 404);
        set_time_limit(0);

        // Plage demandée par le navigateur (« bytes=début-[fin] ») ; les autres formes : fichier entier.
        $ranged = preg_match('/^bytes=(\d+)-(\d*)$/', (string) $request->header('Range'), $m) === 1;
        $start = $ranged ? (int) $m[1] : 0;
        $end = $ranged && $m[2] !== '' ? (int) $m[2] : null;

        try {
            [$url, $first] = $this->firstChunk($id, $start, $end);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['error' => 'Flux YouTube indisponible'], 502);
        }

        if (! preg_match('#/(\d+)$#', (string) $first->header('Content-Range'), $t)) {
            return response()->json(['error' => "Flux YouTube refusé ({$first->status()})"], 502);
        }
        $total = (int) $t[1];
        if ($first->status() === 416 || $start >= $total) {
            return response('', 416, ['Content-Range' => "bytes */{$total}"]);
        }
        $end = min($end ?? $total - 1, $total - 1);

        $headers = [
            'Content-Type' => $first->header('Content-Type') ?: 'audio/mp4',
            'Content-Length' => $end - $start + 1,
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'private, max-age=3600',
        ];
        if ($ranged) {
            $headers['Content-Range'] = "bytes {$start}-{$end}/{$total}";
        }

        return response()->stream(function () use ($url, $first, $start, $end) {
            $pos = $start;
            $chunk = $first;
            while (true) {
                $body = $chunk->toPsrResponse()->getBody();
                while (! $body->eof() && ! connection_aborted()) {
                    $data = $body->read(64 * 1024);
                    $pos += strlen($data);
                    echo $data;
                    flush();
                }
                if ($pos > $end || connection_aborted()) {
                    return;
                }
                $chunk = $this->fetch($url, $pos, min($pos + self::CHUNK - 1, $end));
                if ($chunk->status() !== 206) {
                    return;
                }
            }
        }, $ranged ? 206 : 200, $headers);
    }

    /** Première tranche ; une URL expirée ou refusée (403/410) est redemandée à yt-dlp une fois. */
    private function firstChunk(string $id, int $start, ?int $end): array
    {
        $to = min($start + self::CHUNK - 1, $end ?? PHP_INT_MAX);
        for ($attempt = 0; ; $attempt++) {
            $url = $this->youtube->streamUrl($id);
            $res = $this->fetch($url, $start, $to);
            if (! in_array($res->status(), [403, 410]) || $attempt > 0) {
                return [$url, $res];
            }
            $this->youtube->forget($id);
        }
    }

    private function fetch(string $url, int $from, int $to): Response
    {
        return Http::withHeaders(['User-Agent' => self::UA, 'Range' => "bytes={$from}-{$to}"])
            // Même IP que yt-dlp (--force-ipv4), sinon googlevideo refuse l'URL.
            ->withOptions(['stream' => true, 'force_ip_resolve' => 'v4'])
            ->connectTimeout(10)
            ->timeout(60)
            ->get($url);
    }
}
