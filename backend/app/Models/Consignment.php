<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Consignment extends Model
{
    use HasFactory;

    // Tường minh tên bảng dưới cơ sở dữ liệu MySQL
    protected $table = 'consignments';

    // Cấu hình mảng bảo mật cho phép nạp dữ liệu hàng loạt (Mass Assignment) phòng hờ khi cần
    protected $fillable = [
        'name',
        'phone',
        'type',
        'project',
        'apartment_code',
        'price',
        'notes',
        'status'
    ];
}
