<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DailyClose extends Model
{
    public $timestamps = false;

    protected $fillable = ['symbol', 'date', 'close'];

    protected function casts(): array
    {
        return [
            'close' => 'float',
        ];
    }
}
