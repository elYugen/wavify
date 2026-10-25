<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Wavify : toutes facultatives (voir .env.example).
    'spotify' => [
        'client_id' => env('SPOTIFY_CLIENT_ID'),
        'client_secret' => env('SPOTIFY_CLIENT_SECRET'),
        // Par défaut APP_URL/api/spotify/callback.
        'redirect' => env('SPOTIFY_REDIRECT_URI'),
    ],

    'youtube' => [
        'key' => env('YOUTUBE_API_KEY'),
    ],

    // Lecture YouTube en audio (écran éteint) via yt-dlp, désactivée d'elle-même s'il est absent.
    'ytdlp' => [
        'enabled' => env('YTDLP_ENABLED', true),
        'bin' => env('YTDLP_BIN', 'yt-dlp'),
        'args' => env('YTDLP_ARGS', ''),
    ],

    'soundcloud' => [
        'client_id' => env('SOUNDCLOUD_CLIENT_ID'),
    ],

];
