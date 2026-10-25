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

    /** URL googlevideo du flux audio, mise en cache jusqu'à peu avant son expiration. */
    public function streamUrl(string $id): string
    {
        $key = "ytdlp:url:{$id}";
        if ($url = Cache::get($key)) {
            return $url;
        }

        $result = $this->process(45)->run([
            config('services.ytdlp.bin'),
            '--force-ipv4', // l'URL est liée à l'IP : le relais doit sortir par la même (voir StreamController)
            '--no-playlist',
            '--no-warnings',
            '-f', self::FORMAT,
            '--get-url',
            ...self::extraArgs(),
            "https://www.youtube.com/watch?v={$id}",
        ]);
        $url = trim(strtok($result->output(), "\n") ?: '');
        if (! $result->successful() || ! str_starts_with($url, 'https://')) {
            throw new RuntimeException('yt-dlp : '.(trim($result->errorOutput()) ?: 'aucun flux audio'));
        }

        parse_str((string) parse_url($url, PHP_URL_QUERY), $q);
        $ttl = min(5 * 3600, max(60, (int) ($q['expire'] ?? 0) - time() - 600));
        Cache::put($key, $url, $ttl);

        return $url;
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
        Cache::forget("ytdlp:url:{$id}");
    }

    /** YTDLP_ARGS : options en plus (cookies, fournisseur de PO token…), séparées par des espaces. */
    private static function extraArgs(): array
    {
        $raw = trim((string) config('services.ytdlp.args'));

        return $raw === '' ? [] : str_getcsv($raw, ' ', '"', '\\');
    }
}
