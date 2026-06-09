<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    // 1. Bổ sung 'landing_data' vào fillable để mở khóa Mass Assignment
    protected $fillable = [
        'title',
        'slug',
        'address',
        'image',
        'status',
        'legal',
        'lat',
        'lng',
        'landing_data'
    ];

    public $timestamps = false;

    // 2. Tự động hóa việc đóng/mở gói JSON của Landing Page nguyên khối
    protected $casts = [
        'landing_data' => 'array',
    ];

    /**
     * 🛡️ CHỐT CHẶN CUỐI CÙNG CHO TRƯỜNG LEGAL (PHÁP LÝ ENUM)
     * Tự động dọn dẹp và ép về mặc định hợp lệ trước khi ghi vào Database
     */
    public function setLegalAttribute($value)
    {
        $allowedLegal = ['hdmb', 'so_hong', 'booking'];

        // Nếu dữ liệu truyền vào là rác ("test1", "thử nghiệm", trống...) thì tự ép về 'hdmb'
        if (!in_array($value, $allowedLegal)) {
            $this->attributes['legal'] = 'hdmb';
        } else {
            $this->attributes['legal'] = $value;
        }
    }

    /**
     * 🛡️ CHỐT CHẶN CUỐI CÙNG CHO TRƯỜNG STATUS (TÌNH TRẠNG ENUM)
     */
    public function setStatusAttribute($value)
    {
        $allowedStatus = ['dang_xay_dung', 'da_ban_giao', 'dang_mo_ban', 'sap_mo_ban'];

        if (!in_array($value, $allowedStatus)) {
            $this->attributes['status'] = 'dang_xay_dung';
        } else {
            $this->attributes['status'] = $value;
        }
    }

    /**
     * Mối quan hệ một nhiều tới bảng căn hộ tháp phân khu
     */
    public function apartments()
    {
        return $this->hasMany(Apartment::class, 'project_id', 'id');
    }
}
