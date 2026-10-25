<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Recherche et import, sans clé API obligatoire : YouTube via InnerTube, SoundCloud via son API web,
 * Audius via son API ouverte, Spotify via la page "embed" publique (ou l'API officielle si configurée).
 */
class MusicSources
{
    private const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    private const AUDIUS_APP = 'wavify-pwa';

    private const AUDIUS_HOST = 'https://api.audius.co';

    public const SOURCES = ['youtube', 'soundcloud', 'audius'];

    public function search(string $source, string $q): array
    {
        return match ($source) {
            'youtube' => $this->searchYouTube($q),
            'soundcloud' => $this->searchSoundCloud($q),
            'audius' => $this->searchAudius($q),
        };
    }

    private function http(): PendingRequest
    {
        return Http::withHeaders(['User-Agent' => self::UA])->timeout(15);
    }

    private static function parseClock(?string $text): int
    {
        if (! $text) {
            return 0;
        }

        return array_reduce(explode(':', $text), fn ($acc, $part) => $acc * 60 + (int) $part, 0);
    }

    private static function textOf(mixed $node): string
    {
        if (! $node) {
            return '';
        }
        if (is_string($node)) {
            return $node;
        }
        if (isset($node['simpleText'])) {
            return $node['simpleText'];
        }
        if (isset($node['runs'])) {
            return implode('', array_map(fn ($r) => $r['text'] ?? '', $node['runs']));
        }

        return $node['content'] ?? '';
    }

    /** Toutes les valeurs d'une clé, à n'importe quelle profondeur. */
    private static function collect(mixed $data, string $key, array &$out = []): array
    {
        if (! is_array($data)) {
            return $out;
        }
        foreach ($data as $k => $v) {
            if ($k === $key) {
                $out[] = $v;
            } else {
                self::collect($v, $key, $out);
            }
        }

        return $out;
    }

    /* ----------------------------- YouTube ----------------------------- */

    private function mapVideoRenderers(array $data): array
    {
        $seen = [];
        $out = [];
        foreach (self::collect($data, 'videoRenderer') as $v) {
            $id = $v['videoId'] ?? null;
            if (! $id || empty($v['lengthText']) || isset($seen[$id])) {
                continue;
            }
            $seen[$id] = true;
            $out[] = [
                'source' => 'youtube',
                'sourceId' => $id,
                'title' => self::textOf($v['title'] ?? null),
                'artist' => preg_replace('/ - Topic$/', '', self::textOf($v['ownerText'] ?? $v['longBylineText'] ?? $v['shortBylineText'] ?? null)),
                'duration' => self::parseClock(self::textOf($v['lengthText'])),
                'artwork' => "https://i.ytimg.com/vi/{$id}/hqdefault.jpg",
                'url' => "https://www.youtube.com/watch?v={$id}",
            ];
        }

        return $out;
    }

    private function youtubeOfficial(string $q, string $key): array
    {
        $s = Http::timeout(15)->get('https://www.googleapis.com/youtube/v3/search', [
            'part' => 'snippet', 'type' => 'video', 'videoCategoryId' => 10, 'maxResults' => 25, 'q' => $q, 'key' => $key,
        ])->throw()->json();
        $ids = implode(',', array_filter(array_map(fn ($i) => $i['id']['videoId'] ?? null, $s['items'] ?? [])));
        if (! $ids) {
            return [];
        }
        $d = Http::timeout(15)->get('https://www.googleapis.com/youtube/v3/videos', [
            'part' => 'contentDetails,snippet', 'id' => $ids, 'key' => $key,
        ])->throw()->json();

        return array_map(function ($v) {
            preg_match('/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/', $v['contentDetails']['duration'] ?? '', $m);

            return [
                'source' => 'youtube',
                'sourceId' => $v['id'],
                'title' => $v['snippet']['title'],
                'artist' => preg_replace('/ - Topic$/', '', $v['snippet']['channelTitle']),
                'duration' => (int) ($m[1] ?? 0) * 3600 + (int) ($m[2] ?? 0) * 60 + (int) ($m[3] ?? 0),
                'artwork' => "https://i.ytimg.com/vi/{$v['id']}/hqdefault.jpg",
                'url' => "https://www.youtube.com/watch?v={$v['id']}",
            ];
        }, $d['items'] ?? []);
    }

    private function youtubeInnertube(string $q): array
    {
        $res = $this->http()
            ->withHeaders(['Cookie' => 'SOCS=CAI'])
            ->post('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', [
                'context' => ['client' => ['clientName' => 'WEB', 'clientVersion' => '2.20251020.01.00', 'hl' => 'fr', 'gl' => 'FR']],
                'query' => $q,
                'params' => 'EgIQAQ==', // filtre "vidéos uniquement"
            ]);
        if (! $res->ok()) {
            throw new RuntimeException("InnerTube {$res->status()}");
        }

        return $this->mapVideoRenderers($res->json() ?? []);
    }

    private function youtubeHtml(string $q): array
    {
        $html = $this->http()
            ->withHeaders(['Accept-Language' => 'fr-FR,fr;q=0.9', 'Cookie' => 'SOCS=CAI; CONSENT=YES+cb'])
            ->get('https://www.youtube.com/results?search_query='.rawurlencode($q).'&sp=EgIQAQ%253D%253D&hl=fr')
            ->body();
        if (! preg_match('/var ytInitialData = (\{.*?\});<\/script>/s', $html, $m)) {
            throw new RuntimeException('ytInitialData introuvable');
        }

        return $this->mapVideoRenderers(json_decode($m[1], true) ?? []);
    }

    public function searchYouTube(string $q): array
    {
        if ($key = config('services.youtube.key')) {
            try {
                return $this->youtubeOfficial($q, $key);
            } catch (\Throwable) {
                // repli sans clé
            }
        }
        try {
            $r = $this->youtubeInnertube($q);
            if ($r) {
                return $r;
            }
        } catch (\Throwable) {
            // repli HTML
        }

        return $this->youtubeHtml($q);
    }

    /* ---------------------------- SoundCloud ---------------------------- */

    private function soundcloudClientId(): string
    {
        if ($id = config('services.soundcloud.client_id')) {
            return $id;
        }

        return Cache::remember('sc:client_id', now()->addHours(6), function () {
            $html = $this->http()->get('https://soundcloud.com/')->body();
            preg_match_all('/<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/', $html, $m);
            foreach (array_reverse($m[1]) as $src) {
                $js = $this->http()->get($src)->body();
                if (preg_match('/client_id\s*[:=]\s*"([a-zA-Z0-9]{32})"/', $js, $c) || preg_match('/client_id=([a-zA-Z0-9]{32})/', $js, $c)) {
                    return $c[1];
                }
            }
            throw new RuntimeException('client_id SoundCloud introuvable');
        });
    }

    public function searchSoundCloud(string $q): array
    {
        $res = $this->http()->get('https://api-v2.soundcloud.com/search/tracks', [
            'q' => $q, 'client_id' => $this->soundcloudClientId(), 'limit' => 30,
        ]);
        if (in_array($res->status(), [401, 403])) {
            Cache::forget('sc:client_id');
        }
        if (! $res->ok()) {
            throw new RuntimeException("SoundCloud {$res->status()}");
        }

        $out = [];
        foreach ($res->json('collection') ?? [] as $t) {
            if (($t['streamable'] ?? true) === false || in_array($t['policy'] ?? null, ['BLOCK', 'SNIP'])) {
                continue;
            }
            $art = $t['artwork_url'] ?? $t['user']['avatar_url'] ?? '';
            $out[] = [
                'source' => 'soundcloud',
                'sourceId' => (string) $t['id'],
                'title' => $t['title'] ?? '',
                'artist' => ($t['publisher_metadata']['artist'] ?? null) ?: ($t['user']['username'] ?? ''),
                'duration' => (int) round(($t['full_duration'] ?? $t['duration'] ?? 0) / 1000),
                'artwork' => str_replace('-large.', '-t500x500.', (string) $art),
                'url' => $t['permalink_url'] ?? '',
            ];
        }

        return $out;
    }

    /* ------------------------------ Audius ------------------------------ */

    public function searchAudius(string $q): array
    {
        $res = $this->http()->get(self::AUDIUS_HOST.'/v1/tracks/search', ['query' => $q, 'app_name' => self::AUDIUS_APP]);
        if (! $res->ok()) {
            throw new RuntimeException("Audius {$res->status()}");
        }
        $tracks = array_filter($res->json('data') ?? [], fn ($t) => ($t['is_streamable'] ?? true) !== false);

        return array_map(fn ($t) => [
            'source' => 'audius',
            'sourceId' => $t['id'],
            'title' => $t['title'] ?? '',
            'artist' => $t['user']['name'] ?? '',
            'duration' => (int) ($t['duration'] ?? 0),
            'artwork' => ($t['artwork']['480x480'] ?? null) ?: ($t['artwork']['1000x1000'] ?? ''),
            'url' => 'https://audius.co'.($t['permalink'] ?? ''),
        ], array_slice(array_values($tracks), 0, 30));
    }

    /* ------------------------------ Spotify ----------------------------- */

    public static function spotifyEnabled(): bool
    {
        return config('services.spotify.client_id') && config('services.spotify.client_secret');
    }

    private static function parseSpotifyUrl(string $input): array
    {
        if (! preg_match('/(playlist|album)[\/:]([a-zA-Z0-9]{22})/', $input, $m)) {
            throw new RuntimeException('Lien Spotify invalide (playlist ou album attendu)');
        }

        return [$m[1], $m[2]];
    }

    /** Page "embed" publique : sans clé, mais limitée aux 100 premiers titres. */
    private function spotifyEmbed(string $kind, string $id): array
    {
        $html = $this->http()
            ->withHeaders(['Accept-Language' => 'fr-FR,fr;q=0.9'])
            ->get("https://open.spotify.com/embed/{$kind}/{$id}")
            ->body();
        if (! preg_match('/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s', $html, $m)) {
            throw new RuntimeException('Playlist introuvable ou privée');
        }
        $entity = json_decode($m[1], true)['props']['pageProps']['state']['data']['entity'] ?? null;
        if (! $entity) {
            throw new RuntimeException('Playlist introuvable ou privée');
        }

        $images = $entity['coverArt']['sources'] ?? $entity['visualIdentity']['image'] ?? [];
        $width = fn ($i) => $i['maxWidth'] ?? $i['width'] ?? 0;
        usort($images, fn ($a, $b) => $width($b) <=> $width($a));
        $tracks = array_map(fn ($t) => [
            'title' => $t['title'] ?? '',
            'artist' => str_replace("\u{00A0}", ' ', $t['subtitle'] ?? ''),
            'duration' => (int) round(($t['duration'] ?? 0) / 1000),
        ], $entity['trackList'] ?? []);

        return [
            'kind' => $kind,
            'id' => $id,
            'name' => ($entity['name'] ?? null) ?: ($entity['title'] ?? 'Playlist Spotify'),
            'owner' => $entity['subtitle'] ?? '',
            'cover' => $images[0]['url'] ?? '',
            'tracks' => $tracks,
            'via' => 'embed',
            'limited' => count($tracks) >= 100,
        ];
    }

    /* API Web officielle (Client Credentials) : pagination complète, nécessite
       SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET (gratuits sur developer.spotify.com). */
    private function spotifyToken(): string
    {
        return Cache::remember('sp:token', now()->addMinutes(50), function () {
            $r = Http::asForm()
                ->withBasicAuth(config('services.spotify.client_id'), config('services.spotify.client_secret'))
                ->post('https://accounts.spotify.com/api/token', ['grant_type' => 'client_credentials']);
            if (! $r->ok()) {
                throw new RuntimeException('Clés Spotify refusées (vérifie SPOTIFY_CLIENT_ID / SECRET)');
            }

            return $r->json('access_token');
        });
    }

    private function spotifyGet(string $url, ?string $userToken = null): array
    {
        $token = $userToken ?? $this->spotifyToken();
        for ($attempt = 0; $attempt < 4; $attempt++) {
            $r = Http::withToken($token)->timeout(15)->get($url);
            if ($r->status() === 429) {
                sleep(min(10, (int) $r->header('Retry-After') ?: 1));

                continue;
            }
            if (! $r->ok()) {
                throw new RuntimeException("API Spotify {$r->status()}", $r->status());
            }

            return $r->json();
        }
        throw new RuntimeException('API Spotify saturée, réessaie dans un instant');
    }

    private function spotifyOfficial(string $kind, string $id, ?string $userToken = null): array
    {
        $api = 'https://api.spotify.com/v1';
        $meta = $this->spotifyGet("{$api}/{$kind}s/{$id}?market=FR", $userToken);
        $tracks = [];
        $push = function ($t) use (&$tracks) {
            if (! $t || ($t['type'] ?? null) === 'episode' || empty($t['name'])) {
                return;
            }
            $tracks[] = [
                'title' => $t['name'],
                'artist' => implode(', ', array_map(fn ($a) => $a['name'], $t['artists'] ?? [])),
                'duration' => (int) round(($t['duration_ms'] ?? 0) / 1000),
            ];
        };

        if ($kind === 'album') {
            $next = "{$api}/albums/{$id}/tracks?limit=50&market=FR";
        } else {
            // L'API a renommé /tracks en /items : on accepte les deux.
            $next = "{$api}/playlists/{$id}/tracks?limit=100&market=FR";
            try {
                $this->spotifyGet("{$next}&limit=1", $userToken);
            } catch (RuntimeException $e) {
                if (! in_array($e->getCode(), [403, 404])) {
                    throw $e;
                }
                $next = "{$api}/playlists/{$id}/items?limit=100&market=FR";
            }
        }
        while ($next && count($tracks) < 10000) {
            $page = $this->spotifyGet($next, $userToken);
            foreach ($page['items'] ?? [] as $it) {
                $push($kind === 'album' ? $it : ($it['track'] ?? $it['item'] ?? null));
            }
            $next = $page['next'] ?? null;
        }

        return [
            'kind' => $kind,
            'id' => $id,
            'name' => $meta['name'] ?? '',
            'owner' => $meta['owner']['display_name'] ?? implode(', ', array_map(fn ($a) => $a['name'], $meta['artists'] ?? [])),
            'cover' => $meta['images'][0]['url'] ?? '',
            'tracks' => $tracks,
            'via' => 'api',
            'limited' => false,
        ];
    }

    /**
     * @param  string|null  $userToken  jeton OAuth de l'utilisateur (« Connecter Spotify ») : depuis février 2026,
     *                                  Spotify ne donne les titres d'une playlist qu'à son créateur ou ses collaborateurs.
     */
    public function spotifyPlaylist(string $input, ?string $userToken = null): array
    {
        [$kind, $id] = self::parseSpotifyUrl($input);
        if ($userToken || self::spotifyEnabled()) {
            try {
                return $this->spotifyOfficial($kind, $id, $userToken);
            } catch (\Throwable $e) {
                $message = $kind === 'playlist' && $e->getCode() === 403
                    ? ($userToken
                        ? "Spotify ne donne accès qu'aux playlists que tu as créées ou dont tu es collaborateur."
                        : "Spotify ne donne accès qu'aux playlists de l'utilisateur connecté : connecte ton compte Spotify.")
                    : $e->getMessage();
                // Repli : la page embed (100 titres max), avec l'erreur pour le diagnostic.
                return [...$this->spotifyEmbed($kind, $id), 'apiError' => $message];
            }
        }

        return $this->spotifyEmbed($kind, $id);
    }
}
