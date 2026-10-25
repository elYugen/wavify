<?php

// Messages des règles utilisées par l'API (les autres retombent sur l'anglais).
return [
    'required' => 'Le champ :attribute est obligatoire.',
    'email' => 'L\'adresse e-mail n\'est pas valide.',
    'unique' => 'Un compte existe déjà avec cette adresse :attribute.',
    'string' => 'Le champ :attribute doit être un texte.',
    'array' => 'Le champ :attribute doit être une liste.',
    'integer' => 'Le champ :attribute doit être un entier.',
    'present' => 'Le champ :attribute est obligatoire.',
    'in' => 'La valeur de :attribute est invalide.',
    'max' => [
        'string' => 'Le champ :attribute ne doit pas dépasser :max caractères.',
        'array' => 'Le champ :attribute ne doit pas contenir plus de :max éléments.',
    ],
    'min' => [
        'string' => 'Le champ :attribute doit contenir au moins :min caractères.',
        'numeric' => 'Le champ :attribute doit être au moins :min.',
    ],
    'password' => [
        'min' => 'Le mot de passe doit contenir au moins :min caractères.',
    ],
    'attributes' => [
        'name' => 'nom',
        'email' => 'e-mail',
        'password' => 'mot de passe',
        'tracks' => 'titres',
        'q' => 'recherche',
    ],
];
