<?php

namespace App\Support;

/** Nettoie les titres envoyés par le front (type Track de src/types.ts). */
class Tracks
{
    public const SOURCES = ['youtube', 'soundcloud', 'audius'];

    public const MAX = 10000;

    public static function clean(mixed $tracks, int $max = self::MAX): array
    {
        if (! is_array($tracks)) {
            return [];
        }
        $out = [];
        foreach (array_slice(array_values($tracks), 0, $max) as $t) {
            if (! is_array($t) || ! in_array($t['source'] ?? null, self::SOURCES, true) || ! isset($t['sourceId'])) {
                continue;
            }
            $sourceId = mb_substr((string) $t['sourceId'], 0, 128);
            $out[] = [
                'id' => "{$t['source']}:{$sourceId}",
                'source' => $t['source'],
                'sourceId' => $sourceId,
                'title' => mb_substr((string) ($t['title'] ?? ''), 0, 300),
                'artist' => mb_substr((string) ($t['artist'] ?? ''), 0, 300),
                'duration' => max(0, (int) ($t['duration'] ?? 0)),
                'artwork' => mb_substr((string) ($t['artwork'] ?? ''), 0, 1000),
                'url' => mb_substr((string) ($t['url'] ?? ''), 0, 1000),
            ];
        }

        return $out;
    }
}
