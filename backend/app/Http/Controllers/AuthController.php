<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'string', Password::min(8)],
        ]);

        $user = User::create($data);

        return response()->json($this->session($user, $request), 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'E-mail ou mot de passe incorrect.']);
        }

        return response()->json($this->session($user, $request));
    }

    public function me(Request $request)
    {
        return response()->json(['user' => $this->profile($request->user())]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    private function session(User $user, Request $request): array
    {
        $device = mb_substr((string) $request->userAgent(), 0, 120) ?: 'wavify';

        return [
            'token' => $user->createToken($device)->plainTextToken,
            'user' => $this->profile($user),
        ];
    }

    private function profile(User $user): array
    {
        return $user->toAccount();
    }
}
