<?php

use Illuminate\Support\Facades\Route;

// En production, Nginx sert le front (dist/) : Laravel ne répond que sur /api.
Route::get('/', fn () => response()->json(['name' => 'Wavify API']));
