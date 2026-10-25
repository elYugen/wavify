<?php

namespace App\Services;

use Illuminate\Process\PendingProcess;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * Flux audio YouTube via yt-dlp, pour lire YouTube comme un simple fichier audio (lecture écran éteint).
 * Les URL googlevideo sont liées à l'IP qui les a demandées : c'est ce serveur qui doit relayer le flux.
 */
class YouTubeAudio
{
    // AAC (m4a) d'abord : lu partout, y compris sur iPhone.
    private const FORMAT = 'bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio';

    public function enabled(): bool
    {
        if (! config('services.ytdlp.enabled')) {
            return false;
        }

        $ok = Cache::get('ytdlp:ok');
        if ($ok === null) {
            $r = $this->process(15)->run([config('services.ytdlp.bin'), '--version']);
            $ok = $r->successful();
            if (! $ok) {
                logger()->warning('yt-dlp indisponible : '.trim($r->errorOutput() ?: $r->output()));
            }
            // Un échec est revérifié plus vite (installation en cours, mise à jour…).
            Cache::put('ytdlp:ok', $ok, $ok ? now()->addMinutes(10) : now()->addMinute());
        }

        return $ok;
    }

    /**
     * Flux audio : URL googlevideo et en-têtes HTTP à envoyer avec (certains clients YouTube, TV par exemple,
     * exigent leur propre User-Agent). Mis en cache jusqu'à peu avant l'expiration de l'URL.
     *
     * @return array{url: string, headers: array<string, string>}
     */
    public function stream(string $id): array
    {
        $key = "ytdlp:stream:{$id}";
        if ($stream = Cache::get($key)) {
            return $stream;
        }

        // Un seul yt-dlp à la fois : il réécrit cookies.txt, et le navigateur envoie souvent plusieurs
        // requêtes pour le même titre (plages, préchargement du suivant). Les autres attendent son résultat.
        return Cache::lock('ytdlp:run', 120)->block(60, function () use ($id, $key) {
            if ($stream = Cache::get($key)) {
                return $stream;
            }
            try {
                return $this->resolve($id, $key);
            } catch (RuntimeException $e) {
                logger()->warning("yt-dlp {$id}, nouvel essai : ".$e->getMessage());

                return $this->resolve($id, $key);
            }
        });
    }

    private function resolve(string $id, string $key): array
    {
        $result = $this->process(45)->run([
            config('services.ytdlp.bin'),
            '--force-ipv4', // l'URL est liée à l'IP : le relais doit sortir par la même (voir StreamController)
            '--no-playlist',
            '--no-warnings',
            '-f', self::FORMAT,
            '--print', '%(.{url,http_headers})j',
            ...self::extraArgs(),
            "https://www.youtube.com/watch?v={$id}",
        ]);
        $info = json_decode(trim(strtok($result->output(), "\n") ?: ''), true);
        $url = $info['url'] ?? '';
        if (! $result->successful() || ! str_starts_with($url, 'https://')) {
            throw new RuntimeException('yt-dlp : '.(trim($result->errorOutput()) ?: 'aucun flux audio'));
        }

        // Les en-têtes de navigation (Accept: text/html…) n'ont pas de sens pour un flux audio.
        $headers = array_diff_key($info['http_headers'] ?? [], array_flip(['Accept', 'Sec-Fetch-Mode']));
        $stream = ['url' => $url, 'headers' => $headers];

        parse_str((string) parse_url($url, PHP_URL_QUERY), $q);
        $ttl = min(5 * 3600, max(60, (int) ($q['expire'] ?? 0) - time() - 600));
        Cache::put($key, $stream, $ttl);

        return $stream;
    }

    /**
     * PHP-FPM vide l'environnement (clear_env) : on donne à yt-dlp de quoi trouver python, un dossier
     * temporaire (exécutables autonomes) et un cache, sinon il échoue sans message clair.
     */
    private function process(int $timeout): PendingProcess
    {
        $tmp = sys_get_temp_dir();

        return Process::timeout($timeout)->env([
            ...array_filter([
                'PATH' => '/usr/local/bin:/usr/bin:/bin',
                'TMPDIR' => $tmp,
                'TEMP' => $tmp,
                'TMP' => $tmp,
                'HOME' => storage_path('app'),
            ], fn ($k) => getenv($k) === false, ARRAY_FILTER_USE_KEY),
            ...getenv(),
            'XDG_CACHE_HOME' => storage_path('framework/cache/yt-dlp'),
        ]);
    }

    public function forget(string $id): void
    {
        Cache::forget("ytdlp:stream:{$id}");
    }

    /** YTDLP_ARGS : options en plus (cookies, fournisseur de PO token…), séparées par des espaces. */
    private static function extraArgs(): array
    {
        $raw = trim((string) config('services.ytdlp.args'));

        return $raw === '' ? [] : str_getcsv($raw, ' ', '"', '\\');
    }
}
