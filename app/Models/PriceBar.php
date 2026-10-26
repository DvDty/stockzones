<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PriceBar extends Model
{
    public $timestamps = false;

    protected $fillable = ['symbol', 'ts', 'close'];

    protected function casts(): array
    {
        return [
            'ts' => 'integer',
            'close' => 'float',
        ];
    }
}
