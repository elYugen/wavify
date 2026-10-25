<?php

namespace Tests\Feature;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;
use Tests\TestCase;

class YouTubeStreamTest extends TestCase
{
    private const ID = 'dQw4w9WgXcQ';

    private const URL = 'https://rr1---sn-test.googlevideo.com/videoplayback?expire=9999999999&ip=1.2.3.4';

    private const INFO = '{"url": "'.self::URL.'", "http_headers": {"User-Agent": "TvClient/1.0", "Accept": "text/html"}}';

    private string $file;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.ytdlp.enabled' => true, 'services.ytdlp.bin' => 'yt-dlp']);
        // Fichier audio de 5 Mo : 3 tranches de 2 Mo côté googlevideo.
        $this->file = str_repeat('0123456789', 500_000);
    }

    /** Simule googlevideo : répond aux plages comme le vrai serveur. */
    private function fakeGoogleVideo(): void
    {
        Http::fake(function (Request $r) {
            preg_match('/bytes=(\d+)-(\d+)/', $r->header('Range')[0] ?? '', $m);
            $total = strlen($this->file);
            if ((int) $m[1] >= $total) {
                return Http::response('', 416, ['Content-Range' => "bytes */{$total}"]);
            }
            $end = min((int) $m[2], $total - 1);

            return Http::response(substr($this->file, (int) $m[1], $end - $m[1] + 1), 206, [
                'Content-Type' => 'audio/mp4',
                'Content-Range' => "bytes {$m[1]}-{$end}/{$total}",
            ]);
        });
    }

    public function test_status_reflects_ytdlp_availability(): void
    {
        Process::fake(['*' => Process::result(output: '2026.10.21')]);
        $this->getJson('/api/stream/status')->assertOk()->assertJson(['youtube' => true]);

        cache()->flush();
        Process::fake(['*' => Process::result(exitCode: 127, errorOutput: 'not found')]);
        $this->getJson('/api/stream/status')->assertJson(['youtube' => false]);
    }

    public function test_streams_whole_file_in_chunks(): void
    {
        Process::fake(['*' => Process::result(output: self::INFO."\n")]);
        $this->fakeGoogleVideo();

        $res = $this->get('/api/stream/youtube/'.self::ID);
        $res->assertOk()->assertHeader('Content-Type', 'audio/mp4')->assertHeader('Content-Length', strlen($this->file));
        $this->assertSame($this->file, $res->streamedContent());
        Http::assertSentCount(3);
        // User-Agent du client YouTube transmis, en-têtes de navigation retirés.
        Http::assertSent(fn ($r) => $r->header('User-Agent') === ['TvClient/1.0'] && ! $r->hasHeader('Accept', 'text/html'));
    }

    public function test_honours_range_requests(): void
    {
        Process::fake(['*' => Process::result(output: self::INFO)]);
        $this->fakeGoogleVideo();

        $res = $this->withHeader('Range', 'bytes=3000000-')->get('/api/stream/youtube/'.self::ID);
        $res->assertStatus(206)->assertHeader('Content-Range', 'bytes 3000000-4999999/5000000');
        $this->assertSame(substr($this->file, 3000000), $res->streamedContent());

        $this->withHeader('Range', 'bytes=9000000-')->get('/api/stream/youtube/'.self::ID)->assertStatus(416);
    }

    public function test_ytdlp_is_retried_once_after_a_failure(): void
    {
        Process::fake(['*' => Process::sequence()
            ->push(Process::result(output: '2026.10.21'))
            ->push(Process::result(exitCode: 1, errorOutput: 'ERROR: HTTP Error 503'))
            ->push(Process::result(output: self::INFO))]);
        $this->fakeGoogleVideo();

        $this->withHeader('Range', 'bytes=0-1')->get('/api/stream/youtube/'.self::ID)->assertStatus(206);
        Process::assertRanTimes(fn ($p) => in_array('--print', $p->command), 2);
    }

    public function test_ytdlp_failure_returns_502_and_bad_ids_404(): void
    {
        Process::fake(['*' => Process::result(output: '2026.10.21')]);
        $this->getJson('/api/stream/status');
        Process::fake(['*' => Process::result(exitCode: 1, errorOutput: 'ERROR: Video unavailable')]);

        $this->getJson('/api/stream/youtube/'.self::ID)->assertStatus(502);
        $this->get('/api/stream/youtube/bad')->assertNotFound();
    }
}
