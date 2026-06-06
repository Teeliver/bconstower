<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Apartment;
use App\Models\ActivityLog; // 🔥 ĐỒNG BỘ: Gọi Model nhật ký hệ thống xử lý ghi vết trực tiếp
use App\Models\Project;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\JsonResponse;

class ApartmentController extends Controller
{
    /**
     * Hàm phụ trợ phân rã chuỗi Token bảo mật lấy ID người dùng
     */
    private function getUserIdFromToken(Request $request)
    {
        try {
            $authorizationHeader = $request->header('Authorization');
            if (!$authorizationHeader || !str_starts_with($authorizationHeader, 'Bearer ')) {
                return null;
            }

            $token = str_replace('Bearer ', '', $authorizationHeader);
            $token = trim(str_replace(['"', "'"], '', $token));

            if (Schema::hasTable('personal_access_tokens')) {
                $tokenInstance = DB::table('personal_access_tokens')
                    ->where('token', hash('sha256', $token))
                    ->first();
                if ($tokenInstance) {
                    return $tokenInstance->tokenable_id;
                }
            }

            if (Schema::hasTable('users') && Schema::hasColumn('users', 'remember_token')) {
                $user = DB::table('users')->where('remember_token', $token)->first();
                if ($user) return $user->id;
            }

            if (Schema::hasTable('users')) {
                $firstAdmin = DB::table('users')->first();
                return $firstAdmin ? $firstAdmin->id : null;
            }

            return null;
        } catch (\Exception $e) {
            \Log::error('Lỗi phân rã chuỗi Token bảo mật: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * 1. DANH SÁCH CĂN HỘ
     */
    public function index()
    {
        try {
            $query = Apartment::leftJoin('projects', 'apartments.project_id', '=', 'projects.id')
                ->select('apartments.*', 'projects.title as project_name');

            if (Schema::hasTable('users')) {
                $foreignKey = Schema::hasColumn('apartments', 'user_id') ? 'user_id' : (Schema::hasColumn('apartments', 'created_by') ? 'created_by' : null);

                if ($foreignKey) {
                    $query->leftJoin('users', "apartments.{$foreignKey}", '=', 'users.id');

                    if (Schema::hasColumn('users', 'name')) {
                        $query->addSelect('users.name as creator_name');
                    } elseif (Schema::hasColumn('users', 'username')) {
                        $query->addSelect('users.username as creator_name');
                    } elseif (Schema::hasColumn('users', 'fullname')) {
                        $query->addSelect('users.fullname as creator_name');
                    } else {
                        $query->addSelect(DB::raw('NULL as creator_name'));
                    }
                } else {
                    $query->addSelect(DB::raw('NULL as creator_name'));
                }
            } else {
                $query->addSelect(DB::raw('NULL as creator_name'));
            }

            $apartments = $query->orderBy('apartments.created_at', 'desc')->get();
            return response()->json($apartments, 200);

        } catch (\Exception $e) {
            try {
                \Log::error('Kích hoạt lớp phòng thủ Index Căn hộ: ' . $e->getMessage());
                $apartments = Apartment::leftJoin('projects', 'apartments.project_id', '=', 'projects.id')
                    ->select('apartments.*', 'projects.title as project_name')
                    ->orderBy('apartments.created_at', 'desc')
                    ->get();

                foreach ($apartments as $item) {
                    $item->creator_name = 'Hệ thống';
                }
                return response()->json($apartments, 200);
            } catch (\Exception $ex) {
                return response()->json(['success' => false, 'message' => 'Lỗi kết nối nghiêm trọng: ' . $ex->getMessage()], 500);
            }
        }
    }

    /**
     * 2. ĐĂNG TIN CĂN HỘ MỚI
     */
    public function store(Request $request)
    {
        // 🛡️ BẢO MẬT: Tối ưu Validator để quét và xác thực TỪNG FILE trong mảng ảnh gửi lên
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'project_id' => 'required',
            'images' => 'nullable|array', // Xác thực đầu vào gửi lên phải là một mảng
            'images.*' => 'image|mimes:jpeg,png,jpg,webp|max:5120', // Giới hạn kích thước mỗi ảnh tối đa 5MB
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        // 📸 XỬ LÝ UPLOAD NHIỀU ẢNH (MULTI-UPLOAD) KHI TẠO MỚI
        $imagesData = [];
        if ($request->hasFile('images')) {
            $path = public_path('upload/apartments');
            if (!file_exists($path)) { mkdir($path, 0755, true); }

            $baseSlug = Str::slug($request->name);
            foreach ($request->file('images') as $file) {
                // Tạo tên file độc nhất bằng slug căn hộ + timestamp + chuỗi ngẫu nhiên uniqid()
                $filename = $baseSlug . '-' . time() . '-' . uniqid() . '.' . $file->getClientOriginalExtension();
                $file->move($path, $filename);

                // Gom đường dẫn tương đối vào mảng PHP
                $imagesData[] = '/upload/apartments/' . $filename;
            }
        }

        // Khởi tạo đối tượng căn hộ mới
        $apartment = new Apartment();
        $apartment->name = $request->name;
        $apartment->slug = $request->slug ?? Str::slug($request->name);
        $apartment->project_id = $request->project_id ?? $request->projectId;
        $apartment->price = $request->price;
        $apartment->area = $request->area;

        if (Schema::hasColumn('apartments', 'floor')) $apartment->floor = $request->floor;
        if (Schema::hasColumn('apartments', 'block')) $apartment->block = $request->block;
        if (Schema::hasColumn('apartments', 'description')) $apartment->description = $request->description;
        if (Schema::hasColumn('apartments', 'furniture')) $apartment->furniture = $request->furniture;

        if (Schema::hasColumn('apartments', 'bedrooms')) {
            $apartment->bedrooms = $request->bedrooms ?? $request->rooms;
        } elseif (Schema::hasColumn('apartments', 'rooms')) {
            $apartment->rooms = $request->bedrooms ?? $request->rooms;
        }
        if (Schema::hasColumn('apartments', 'bathrooms')) $apartment->bathrooms = $request->bathrooms;

        if (Schema::hasColumn('apartments', 'direction_main')) {
            $apartment->direction_main = $request->direction_main ?? $request->directionMain;
        } elseif (Schema::hasColumn('apartments', 'directionMain')) {
            $apartment->directionMain = $request->direction_main ?? $request->directionMain;
        }

        if (Schema::hasColumn('apartments', 'direction_balcony')) {
            $apartment->direction_balcony = $request->direction_balcony ?? $request->directionBalcony;
        } elseif (Schema::hasColumn('apartments', 'directionBalcony')) {
            $apartment->directionBalcony = $request->direction_balcony ?? $request->directionBalcony;
        }

        $apartment->status = $request->status ?? 'trong';

        if (Schema::hasColumn('apartments', 'approval_status')) {
            $apartment->approval_status = $request->approval_status ?? $request->approvalStatus ?? 'pending';
        }

        $authUser = $request->user();
        if ($authUser) {
            if (Schema::hasColumn('apartments', 'user_id')) {
                $apartment->user_id = $authUser->id;
            } elseif (Schema::hasColumn('apartments', 'created_by')) {
                $apartment->created_by = $authUser->id;
            }
        }

        // 🌟 CHUYỂN ĐỔI CHUỖI: Nếu có ảnh thì đóng gói mảng thành chuỗi JSON, ngược lại để null
        $apartment->image = !empty($imagesData) ? json_encode($imagesData) : null;
        $apartment->save();

        $creatorName = $authUser->fullname ?? $authUser->name ?? 'Hệ thống';
        ActivityLog::write(
            'Thêm mới ➕',
            // 'Giỏ hàng căn hộ',
            "Đã đăng tin căn hộ mới [{$apartment->name}] lên sàn giao dịch."
        );

        return response()->json(['success' => true, 'message' => 'Đăng tin căn hộ mới thành công!', 'data' => $apartment], 201);
    }

    /**
     * 3. CẬP NHẬT CĂN HỘ & PHÊ DUYỆT BÀI (ĐÃ TỐI ƯU GHI LOG DUYỆT CĂN HỘ)
     */
    public function update(Request $request, $id)
    {
        $apartment = Apartment::findOrFail($id);

        // 🔥 GIẢI PHÁP NÂNG CAO: Đọc trước và giữ lại cả 2 trạng thái cũ để đối chiếu nghiệp vụ log
        $oldStatus = $apartment->status;
        $oldApprovalStatus = Schema::hasColumn('apartments', 'approval_status') ? $apartment->approval_status : null;

        // 🛡️ BẢO MẬT: Nâng cấp Validator để quét và kiểm tra TỪNG FILE trong mảng ảnh gửi lên
        $validator = Validator::make($request->all(), [
            'name' => 'nullable|string|max:255',
            'images' => 'nullable|array', // Xác thực đầu vào phải là một mảng ảnh
            'images.*' => 'image|mimes:jpeg,png,jpg,webp|max:5120', // Giới hạn kích thước từng file tối đa 5MB
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        // 📸 XỬ LÝ UPLOAD NHIỀU ẢNH (MULTI-UPLOAD) & LƯU CHUỖI JSON
        if ($request->hasFile('images')) {
            $path = public_path('upload/apartments');
            if (!file_exists($path)) { mkdir($path, 0755, true); }

            // 1. DỌN DẸP DÀN ẢNH CŨ: Giải mã chuỗi JSON cũ trong database để tìm và xóa file vật lý trên hosting
            if ($apartment->image) {
                $oldImages = json_decode($apartment->image, true);
                if (is_array($oldImages)) {
                    foreach ($oldImages as $oldImg) {
                        $oldFilePath = public_path(ltrim($oldImg, '/'));
                        if (file_exists($oldFilePath)) {
                            @unlink($oldFilePath); // Xóa file tĩnh cũ tránh rác hosting
                        }
                    }
                } else {
                    // Dự phòng trường hợp dữ liệu cũ trong DB là 1 chuỗi ảnh đơn lẻ (chưa qua đóng gói JSON)
                    $oldFilePath = public_path(ltrim($apartment->image, '/'));
                    if (file_exists($oldFilePath)) {
                        @unlink($oldFilePath);
                    }
                }
            }

            // 2. TIẾN HÀNH UPLOAD DÀN ẢNH MỚI
            $imagesData = [];
            $baseSlug = Str::slug($request->name ?? $apartment->name);

            foreach ($request->file('images') as $file) {
                // Tạo tên file độc nhất bằng slug căn hộ + timestamp + chuỗi ngẫu nhiên uniqid()
                $filename = $baseSlug . '-' . time() . '-' . uniqid() . '.' . $file->getClientOriginalExtension();
                $file->move($path, $filename);

                // Gom đường dẫn tương đối vào mảng
                $imagesData[] = '/upload/apartments/' . $filename;
            }

            // 🌟 CHUYỂN ĐỔI CHUỖI: Đóng gói mảng đường dẫn thành chuỗi JSON String ném vào DB
            $apartment->image = json_encode($imagesData);
        }

        if ($request->has('name')) {
            $apartment->name = $request->name;
            $apartment->slug = Str::slug($request->name);
            $apartment->project_id = $request->project_id ?? $request->projectId;
            $apartment->price = $request->price;
            $apartment->area = $request->area;

            if (Schema::hasColumn('apartments', 'floor')) $apartment->floor = $request->floor;
            if (Schema::hasColumn('apartments', 'block')) $apartment->block = $request->block;
            if (Schema::hasColumn('apartments', 'description')) $apartment->description = $request->description;
            if (Schema::hasColumn('apartments', 'furniture')) $apartment->furniture = $request->furniture;

            if (Schema::hasColumn('apartments', 'bedrooms')) $apartment->bedrooms = $request->bedrooms ?? $request->rooms;
            if (Schema::hasColumn('apartments', 'bathrooms')) $apartment->bathrooms = $request->bathrooms;

            if (Schema::hasColumn('apartments', 'direction_main')) $apartment->direction_main = $request->direction_main ?? $request->directionMain;
            if (Schema::hasColumn('apartments', 'direction_balcony')) $apartment->direction_balcony = $request->direction_balcony ?? $request->directionBalcony;
        }

        // Đánh dấu cờ kiểm tra xem Client gửi dữ liệu thao tác duyệt bài hay không
        $isApprovalAction = false;

        if ($request->has('approval_status') || $request->has('approvalStatus')) {
            if (Schema::hasColumn('apartments', 'approval_status')) {
                $apartment->approval_status = $request->approval_status ?? $request->approvalStatus;
                $isApprovalAction = true;
            }
        }

        if ($request->has('status')) {
            $statusValue = $request->status;
            if (in_array($statusValue, ['approved', 'pending', 'rejected'])) {
                if (Schema::hasColumn('apartments', 'approval_status')) {
                    $apartment->approval_status = $statusValue;
                    $isApprovalAction = true;
                }
            } else {
                $apartment->status = $statusValue;
            }
        }

        $apartment->save();

        // Xác định danh tính nhân sự thực hiện hành động
        $authUser = $request->user();
        $staffName = $authUser->fullname ?? $authUser->name ?? 'Quản trị viên';

        // 🧠 HỆ THỐNG ĐIỀU HƯỚNG GHI NHẬT KÝ ĐA TẦNG THÔNG MINH (CHỐNG LẶP LOG):

        // TRƯỜNG HỢP 1: Ghi nhận lịch sử DUYỆT CĂN HỘ
        if ($isApprovalAction && $oldApprovalStatus !== $apartment->approval_status) {
            $actionTitle = 'Thay đổi trạng thái';
            $statusDescription = $apartment->approval_status;

            if ($apartment->approval_status === 'approved') {
                $actionTitle = 'Phê duyệt ✅';
                $statusDescription = 'Đã phê duyệt hiển thị tin công khai';
            } elseif ($apartment->approval_status === 'rejected') {
                $actionTitle = 'Từ chối duyệt ❌';
                $statusDescription = 'Từ chối phê duyệt (Yêu cầu chỉnh sửa)';
            } elseif ($apartment->approval_status === 'pending') {
                $actionTitle = 'Hạ bài chờ duyệt 🟡';
                $statusDescription = 'Chuyển về trạng thái chờ kiểm duyệt';
            }

            ActivityLog::write(
                $actionTitle,
                // 'Giỏ hàng căn hộ',
                "Đã duyệt căn hộ [{$apartment->name}] || Trạng thái: {$statusDescription}."
            );
        }
        // TRƯỜNG HỢP 2: Ghi nhận CHIẾN THẦN CHỐT DEAL khi căn hộ đổi trạng thái thành 'da_ban'
        elseif ($apartment->status === 'da_ban' && $oldStatus !== 'da_ban') {
            ActivityLog::write(
                'Chốt deal 👑',
                // 'Giỏ hàng căn hộ',
                "Chúc mừng chiến thần [{$staffName}] đã chốt căn hộ [{$apartment->name}]!"
            );
        }
        // TRƯỜNG HỢP 3: Chỉnh sửa các thông số kỹ thuật thông thường
        else {
            ActivityLog::write(
                'Chỉnh sửa 📝',
                // 'Giỏ hàng căn hộ',
                "Đã cập nhật thông tin của căn hộ [{$apartment->name}]."
            );
        }

        return response()->json(['success' => true, 'message' => 'Cập nhật dữ liệu căn hộ thành công!', 'data' => $apartment], 200);
    }

    /**
     * 4. CHI TIẾT CĂN HỘ
     */
    public function show($id)
    {
        try {
            $query = Apartment::where('apartments.id', $id);

            if (Schema::hasTable('projects')) {
                $query->leftJoin('projects', 'apartments.project_id', '=', 'projects.id')
                    ->addSelect('apartments.*', 'projects.title as project_name');
            } else {
                $query->select('apartments.*');
            }

            if (Schema::hasTable('users')) {
                $foreignKey = Schema::hasColumn('apartments', 'user_id') ? 'user_id' : (Schema::hasColumn('apartments', 'created_by') ? 'created_by' : null);

                if ($foreignKey) {
                    $query->leftJoin('users', "apartments.{$foreignKey}", '=', 'users.id');

                    if (Schema::hasColumn('users', 'name')) {
                        $query->addSelect('users.name as creator_name');
                    } elseif (Schema::hasColumn('users', 'username')) {
                        $query->addSelect('users.username as creator_name');
                    } elseif (Schema::hasColumn('users', 'fullname')) {
                        $query->addSelect('users.fullname as creator_name');
                    }
                }
            }

            $apartment = $query->first();

            if (!$apartment) {
                return response()->json(['success' => false, 'message' => 'Không tìm thấy thông tin căn hộ yêu cầu.'], 404);
            }

            return response()->json($apartment, 200);

        } catch (\Exception $e) {
            try {
                \Log::error('Kích hoạt lớp phòng thủ Show Căn hộ: ' . $e->getMessage());
                $apartment = Apartment::find($id);
                if ($apartment) {
                    $apartment->project_name = 'N/A';
                    $apartment->creator_name = 'Hệ thống';
                    return response()->json($apartment, 200);
                }
                return response()->json(['success' => false, 'message' => 'Không tìm thấy căn hộ.'], 404);
            } catch (\Exception $ex) {
                return response()->json(['success' => false, 'message' => 'Lỗi kết nối dữ liệu nghiêm trọng: ' . $ex->getMessage()], 500);
            }
        }
    }

    /**
     * 5. XÓA CĂN HỘ
     */
    public function destroy(Request $request, $id)
    {
        $apartment = Apartment::findOrFail($id);
        $apartmentName = $apartment->name;

        if ($apartment->image && file_exists(public_path($apartment->image))) {
            @unlink(public_path($apartment->image));
        }

        $apartment->delete();

        $authUser = $request->user();
        $staffName = $authUser->fullname ?? $authUser->name ?? 'Hệ thống';
        ActivityLog::write(
            'Xóa bỏ ❌',
            // 'Giỏ hàng căn hộ',
            "Đã xoá căn hộ [{$apartmentName}] khỏi hệ thống."
        );

        return response()->json(['success' => true, 'message' => 'Đã xóa căn hộ thành công khỏi sàn!'], 200);
    }

    /**
     * LẤY NGUỒN HÀNG SANG NHƯỢNG HOT CHO TRANG CHỦ PUBLIC (QUÉT THEO PROJECT)
     */
    public function getHotTransfers(): JsonResponse
    {
        try {
            // Lớp phòng thủ: Thử query bốc hàng ra
            $apartments = Apartment::with('project')
                ->orderBy('id', 'desc')
                ->get();

            // 🟢 ĐÚNG: Luôn trả về success và mảng apartments (kể cả mảng rỗng)
            return response()->json([
                'success' => true,
                'apartments' => $apartments
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi hệ thống',
                'apartments' => []
            ], 500);
        }
    }

    /**
     * =========================================================================
     * 🔥 HÀM TÁCH RIÊNG: LẤY DANH SÁCH NỒI HÀNG MỚI NHẤT (GIỐNG getHotTransfer)
     * URL target: GET /api/apartments/new-posts
     * =========================================================================
     */
    public function getNewPostList()
    {
        try {
            // Eager load quan hệ project để tối ưu hiệu năng quét DB
            $apartments = Apartment::with('project')
                ->where('price', '>', 0)
                ->orderBy('created_at', 'desc')
                ->take(30)
                ->get();

            // Duyệt mảng và format dữ liệu đầu ra
            $formattedApartments = $apartments->map(function ($apt) {

                // 🧠 LOGIC INLINE BẢO VỆ: Tự phân tích Slug dự án tại chỗ, không gọi hàm ngoài
                $projectSlug = 'bcons';

                if ($apt->relationLoaded('project') && $apt->project && !empty($apt->project->slug)) {
                    $projectSlug = $apt->project->slug;
                } elseif (isset($apt->project) && is_object($apt->project) && !empty($apt->project->slug)) {
                    $projectSlug = $apt->project->slug;
                } elseif (!empty($apt->project_slug)) {
                    $projectSlug = $apt->project_slug;
                } elseif (!empty($apt->projectSlug)) {
                    $projectSlug = $apt->projectSlug;
                } elseif (!empty($apt->project_id)) {
                    // Nếu hụt hết thì quét nhanh DB tìm slug theo ID dự án cha
                    $project = \App\Models\Project::find($apt->project_id);
                    if ($project && !empty($project->slug)) {
                        $projectSlug = $project->slug;
                    }
                }

                return [
                    'id'           => $apt->id,
                    'name'         => $apt->name,
                    'slug'         => $apt->slug,
                    'image'        => $apt->image,
                    'price'        => $apt->price,
                    'area'         => $apt->area,
                    'bedrooms'     => $apt->bedrooms,
                    'bathrooms'    => $apt->bathrooms,
                    'address'      => $apt->address,
                    'created_at'   => $apt->created_at,
                    'createdAt'    => $apt->created_at,
                    'project_slug' => $projectSlug,
                    'projectSlug'  => $projectSlug,
                    'project'      => $apt->project ? [
                        'id'       => $apt->project->id,
                        'title'    => $apt->project->title,
                        'slug'     => $apt->project->slug,
                        'address'  => $apt->project->address ?? $apt->project->location,
                    ] : null
                ];
            });

            return response()->json($formattedApartments, 200);

        } catch (\Exception $e) {
            Log::error('Lỗi nghiêm trọng function getNewPostList: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Lỗi kết nối danh sách tin mới.'], 500);
        }
    }


    // Lấy danh sách căn hộ theo Dự Án
    public function getApartmentsByProject(Request $request)
    {
        try {
            // 1. Đọc và làm sạch tham số Slug dự án truyền từ Frontend lên
            $slug = trim($request->query('slug'));
            if (empty($slug)) {
                return response()->json(['success' => false, 'message' => 'Thiếu tham số slug dự án.'], 400);
            }

            // 2. Truy vết thông tin chi tiết của dự án cha theo Slug
            $project = Project::where('slug', $slug)->first();
            if (!$project) {
                return response()->json([
                    'project_info' => null,
                    'projectInfo' => null,
                    'apartments' => [],
                    'data' => []
                ], 200); // Trả về cấu trúc rỗng an toàn thay vì sập luồng hệ thống
            }

            // 3. Khởi tạo luồng Query lấy danh sách căn hộ thuộc dự án này
            $query = Apartment::leftJoin('projects', 'apartments.project_id', '=', 'projects.id')
                ->where('apartments.project_id', $project->id)
                ->select(
                    'apartments.*',
                    'projects.title as project_name',
                    'projects.slug as project_slug',
                    'projects.address as project_address',
                    'projects.location as project_location'
                );

            // 🛡️ BẢO TOÀN LỚP PHÒNG THỦ QUÉT USER ĐĂNG TIN GIỐNG HÀM INDEX CỦA TRUNG TÍN
            if (Schema::hasTable('users')) {
                $foreignKey = Schema::hasColumn('apartments', 'user_id') ? 'user_id' : (Schema::hasColumn('apartments', 'created_by') ? 'created_by' : null);

                if ($foreignKey) {
                    $query->leftJoin('users', "apartments.{$foreignKey}", '=', 'users.id');

                    if (Schema::hasColumn('users', 'name')) {
                        $query->addSelect('users.name as creator_name');
                    } elseif (Schema::hasColumn('users', 'username')) {
                        $query->addSelect('users.username as creator_name');
                    } elseif (Schema::hasColumn('users', 'fullname')) {
                        $query->addSelect('users.fullname as creator_name');
                    } else {
                        $query->addSelect(DB::raw('NULL as creator_name'));
                    }
                } else {
                    $query->addSelect(DB::raw('NULL as creator_name'));
                }
            } else {
                $query->addSelect(DB::raw('NULL as creator_name'));
            }

            $apartments = $query->orderBy('apartments.created_at', 'desc')->get();

            // ⚡ BỘ PHÒNG THỦ PAYLOAD KÉP: Trả đồng thời cả 2 dạng định dạng chuỗi để chống lỗi lệch Key ngoài Astro
            return response()->json([
                'project_info' => $project,
                'projectInfo' => $project,
                'apartments'   => $apartments,
                'data'         => $apartments
            ], 200);

        } catch (\Exception $e) {
            try {
                // Luồng dự phòng khẩn cấp khi hệ thống select nâng cao dính lỗi cấu trúc bảng
                \Log::error('Kích hoạt lớp phòng thủ getApartmentsByProject: ' . $e->getMessage());

                $slug = trim($request->query('slug'));
                $project = Project::where('slug', $slug)->first();

                if (!$project) {
                    return response()->json(['project_info' => null, 'apartments' => []], 200);
                }

                $apartments = Apartment::where('project_id', $project->id)
                    ->orderBy('created_at', 'desc')
                    ->get();

                // Tự nạp thông tin phẳng phòng thủ cho mảng
                foreach ($apartments as $item) {
                    $item->project_name = $project->title;
                    $item->project_slug = $project->slug;
                    $item->project_address = $project->address;
                    $item->creator_name = 'Hệ thống';
                }

                return response()->json([
                    'project_info' => $project,
                    'projectInfo' => $project,
                    'apartments'   => $apartments,
                    'data'         => $apartments
                ], 200);

            } catch (\Exception $ex) {
                return response()->json(['success' => false, 'message' => 'Lỗi sập luồng liên kết dữ liệu: ' . $ex->getMessage()], 500);
            }
        }
    }

    // Hiển thị danh sách căn hộ được duyệt
    public function getPublicApartmentList(Request $request)
    {
        try {
            // ⚡ TỐI ƯU SQL: Trích xuất mảng phẳng dữ liệu kèm thông tin dự án cha liên kết
            $query = Apartment::leftJoin('projects', 'apartments.project_id', '=', 'projects.id')
                ->select([
                    'apartments.*',
                    'projects.title as project_name',
                    'projects.slug as project_slug',
                    'projects.address as project_address',
                    'projects.location as project_location'
                ]);

            // 🛡️ BẢO TOÀN LỚP PHÒNG THỦ QUÉT USER ĐĂNG TIN ĐỒNG BỘ THEO DỰ ÁN CỦA TRUNG TÍN
            if (Schema::hasTable('users')) {
                $foreignKey = Schema::hasColumn('apartments', 'user_id') ? 'user_id' : (Schema::hasColumn('apartments', 'created_by') ? 'created_by' : null);

                if ($foreignKey) {
                    $query->leftJoin('users', "apartments.{$foreignKey}", '=', 'users.id');

                    if (Schema::hasColumn('users', 'name')) {
                        $query->addSelect('users.name as creator_name');
                    } elseif (Schema::hasColumn('users', 'username')) {
                        $query->addSelect('users.username as creator_name');
                    } elseif (Schema::hasColumn('users', 'fullname')) {
                        $query->addSelect('users.fullname as creator_name');
                    } else {
                        $query->addSelect(DB::raw('NULL as creator_name'));
                    }
                } else {
                    $query->addSelect(DB::raw('NULL as creator_name'));
                }
            } else {
                $query->addSelect(DB::raw('NULL as creator_name'));
            }

            $apartments = $query->orderBy('apartments.created_at', 'desc')->get();

            // Trả payload kép tương thích hoàn toàn cả snake_case và camelCase
            return response()->json([
                'apartments' => $apartments,
                'data'       => $apartments
            ], 200);

        } catch (\Exception $e) {
            try {
                Log::error('Kích hoạt lớp phòng thủ khẩn cấp getPublicApartmentList: ' . $e->getMessage());

                $apartments = Apartment::leftJoin('projects', 'apartments.project_id', '=', 'projects.id')
                    ->select('apartments.*', 'projects.title as project_name', 'projects.slug as project_slug', 'projects.address as project_address')
                    ->orderBy('apartments.created_at', 'desc')
                    ->get();

                foreach ($apartments as $item) {
                    $item->creator_name = 'Hệ thống';
                }

                return response()->json([
                    'apartments' => $apartments,
                    'data'       => $apartments
                ], 200);
            } catch (\Exception $ex) {
                return response()->json(['success' => false, 'message' => 'Sập luồng tổng kho căn hộ: ' . $ex->getMessage()], 500);
            }
        }
    }

    // Lấy chi tiết thông tin căn hộ
    public function getPublicDetail(Request $request)
    {
        try {
            $projectSlug = trim($request->query('project'));
            $apartmentSlug = trim($request->query('slug'));

            if (empty($projectSlug) || empty($apartmentSlug)) {
                return response()->json(['success' => false, 'message' => 'Thiếu dữ liệu truy vết cấu trúc.'], 400);
            }

            // Định vị dự án cha an toàn bằng Eloquent
            $project = Project::where('slug', $projectSlug)->first();
            if (!$project) {
                return response()->json(['success' => false, 'message' => 'Không tìm thấy dự án liên kết.'], 444);
            }

            // Tìm kiếm căn hộ mục tiêu thuộc dự án cha
            $apartment = Apartment::where('project_id', $project->id)
                ->where('slug', $apartmentSlug)
                ->first();

            if (!$apartment) {
                return response()->json(['success' => false, 'message' => 'Căn hộ không tồn tại hoặc đã giao dịch.'], 404);
            }

            // 🛡️ LỚP PHÒNG THỦ: Cấu hình thông tin hồ sơ môi giới mặc định an toàn hệ thống
            $creatorName = 'Trung Tín';
            $creatorPhone = '0911 502 603';
            $creatorAvatar = '/images/default-avatar.jpg';
            $companyName = 'Phòng Kinh Doanh Bcons';
            $areaFocus = 'Bình Dương - TP. Hồ Chí Minh';
            $licenseNumber = 'BCO-' . $apartment->id;
            $experienceYears = 5;
            $bio = "Chuyên viên hỗ trợ tư vấn sang nhượng, ký gửi căn hộ thuộc chuỗi dự án tập đoàn Bcons. Cam kết thông tin minh bạch, hỗ trợ trọn gói thủ tục pháp lý sang tên sổ hồng.";

            // Kiểm tra cấu trúc cột khóa ngoại liên kết tài khoản đăng bài viết
            $foreignKey = Schema::hasColumn('apartments', 'user_id') ? 'user_id' : (Schema::hasColumn('apartments', 'created_by') ? 'created_by' : null);

            if ($foreignKey && $apartment->$foreignKey) {

                // 🔥 BƯỚC 1: BỐC THẲNG TỪ BẢNG USERS TRƯỚC ĐỂ LẤY AVATAR GỐC
                if (Schema::hasTable('users')) {
                    $user = DB::table('users')->where('id', $apartment->$foreignKey)->first();
                    if ($user) {
                        $creatorName = $user->name ?? $user->username ?? $user->fullname ?? $creatorName;
                        $creatorPhone = $user->phone ?? $user->telephone ?? $creatorPhone;

                        // Quét mọi trường hợp đặt tên cột Avatar trong bảng users
                        $rawUserAvatar = $user->avatar ?? $user->avatar_path ?? $user->image ?? $user->profile_photo_path ?? null;
                        if (!empty($rawUserAvatar)) {
                            $creatorAvatar = $rawUserAvatar;
                        }
                    }
                }

                // 🔥 BƯỚC 2: ĐÈ THÔNG TIN MÔI GIỚI TỪ BẢNG BROKER_PROFILES LÊN (NẾU CÓ BẢN GHI)
                if (Schema::hasTable('broker_profiles')) {
                    $broker = DB::table('broker_profiles')->where('user_id', $apartment->$foreignKey)->first();
                    if ($broker) {
                        // Chỉ ghi đè nếu trường dữ liệu trong broker thực sự có chữ, không bị trống
                        $creatorName = !empty($broker->name) ? $broker->name : (!empty($broker->fullname) ? $broker->fullname : $creatorName);
                        $creatorPhone = !empty($broker->phone) ? $broker->phone : $creatorPhone;

                        $companyName = $broker->company_name ?? $broker->company ?? $companyName;
                        $areaFocus = $broker->area_focus ?? $areaFocus;
                        $licenseNumber = $broker->license_number ?? $broker->license ?? $licenseNumber;
                        $experienceYears = $broker->experience_years ?? $experienceYears;
                        $bio = $broker->bio ?? $bio;

                        // KIỂM TRA AVATAR BROKER: Nếu trống/null thì giữ nguyên $creatorAvatar đã lấy từ bảng users ở Bước 1
                        $rawBrokerAvatar = $broker->avatar ?? $broker->avatar_path ?? $broker->image ?? $broker->profile_picture ?? null;
                        if (!empty($rawBrokerAvatar)) {
                            $creatorAvatar = $rawBrokerAvatar;
                        }
                    }
                }
            }

            // 🔥 BƯỚC 3: CHUẨN HÓA ĐƯỜNG DẪN THEO THƯ MỤC /UPLOAD/ CHO AVATAR ĐẦU RA
            if (!empty($creatorAvatar) && $creatorAvatar !== '/images/default-avatar.jpg') {
                if (!str_starts_with($creatorAvatar, 'http://') && !str_starts_with($creatorAvatar, 'https://')) {
                    $cleanPath = ltrim($creatorAvatar, '/');

                    // Nếu chuỗi lưu trong DB dạng 'public/upload/abc.jpg' -> làm sạch thành 'upload/abc.jpg'
                    if (str_starts_with($cleanPath, 'public/upload/')) {
                        $cleanPath = substr($cleanPath, 7);
                    }
                    // Nếu chuỗi chỉ lưu dạng 'public/abc.jpg' -> bọc chuyển thành 'upload/abc.jpg'
                    elseif (str_starts_with($cleanPath, 'public/')) {
                        $cleanPath = 'upload/' . substr($cleanPath, 7);
                    }

                    // Khóa chặt định dạng đầu ra luôn có tiền tố /upload/ để Astro map đúng link asset công khai
                    if (str_starts_with($cleanPath, 'upload/')) {
                        $creatorAvatar = '/' . $cleanPath;
                    } else {
                        $creatorAvatar = '/upload/' . $cleanPath;
                    }
                }
            }

            // Đóng gói cấu trúc Payload phẳng truyền dữ liệu đồng bộ mượt mà ra Astro
            $payload = [
                'id'                => $apartment->id,
                'name'              => $apartment->name,
                'slug'              => $apartment->slug,
                'image'             => $apartment->image,
                'price'             => $apartment->price,
                'area'              => $apartment->area,
                'bedrooms'          => $apartment->bedrooms,
                'bathrooms'         => $apartment->bathrooms,
                'floor'             => $apartment->floor,
                'direction_main'    => $apartment->direction_main ?? 'Đông',
                'direction_balcony' => $apartment->direction_balcony ?? 'Đông Nam',
                'furniture'         => $apartment->furniture ?? 'Bàn giao cơ bản',
                'block'             => $apartment->block ?? 'Block A',
                'description'       => $apartment->description,
                'lat'               => $project->lat ?? 10.902341,
                'lng'               => $project->lng ?? 106.776512,

                'projectId'         => $project->id,
                'projectName'       => $project->title,
                'projectAddress'    => $project->address ?? $project->location ?? 'Bình Dương',
                'projectStatus'     => $project->status,
                'projectLegal'      => $project->legal,
                'projectSlug'       => $project->slug,

                'user_name'         => $creatorName,
                'user_phone'        => $creatorPhone,
                'user_avatar'       => $creatorAvatar,
                'companyName'       => $companyName,
                'areaFocus'         => $areaFocus,
                'licenseNumber'     => $licenseNumber,
                'experienceYears'   => $experienceYears,
                'bio'               => $bio,

                'created_at'        => $apartment->created_at,
                'createdAt'         => $apartment->created_at,
            ];

            return response()->json($payload, 200);

        } catch (\Exception $e) {
            Log::error('Lỗi nghiêm trọng luồng public-detail: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Lỗi kết nối dữ liệu chi tiết căn hộ.'], 500);
        }
    }

    /**
     * 2. HÀM THUẬT TOÁN CHÍNH XÁC: TÍNH KHOẢNG GIÁ PHỔ BIẾN KHU VỰC REAL-TIME
     */
    public function getPriceRangeStats(Request $request, $id)
    {
        try {
            $apartment = Apartment::find($id);
            if (!$apartment) {
                return response()->json(['success' => false, 'message' => 'Sản phẩm không tồn tại.'], 404);
            }

            $currentPricePerMeter = ($apartment->area > 0) ? ($apartment->price / $apartment->area) / 1000000 : 0;

            $currentProject = Project::find($apartment->project_id);
            $khuVucHienThi = 'Đông Hòa';
            $cleanKhuVucSlug = 'dong hoa';

            if ($currentProject) {
                // 🛡️ BẢO VỆ 1: Ghép chuỗi an toàn, phòng thủ nếu thiếu cột trong Database
                $projAddress = $currentProject->address ?? '';
                $projLocation = isset($currentProject->location) ? $currentProject->location : '';
                $fullAddress = trim($projAddress . ' ' . $projLocation);

                if ($fullAddress !== '') {
                    $addressParts = array_map('trim', explode(',', $fullAddress));
                    $count = count($addressParts);
                    $found = false;

                    foreach ($addressParts as $part) {
                        if (empty($part) || preg_match('/(thành phố|tp|tỉnh)/i', $part)) {
                            continue;
                        }
                        if (preg_match('/^p(\.)?\s+/i', $part) || preg_match('/(phường|xã|thị trấn)/i', $part)) {
                            $khuVucHienThi = $part;
                            $rawSlug = Str::slug($part, ' ');
                            $cleanKhuVucSlug = trim(preg_replace('/^(phuong|p|xa|thi tran)\s+/i', '', $rawSlug));
                            $found = true;
                            break;
                        }
                    }

                    if (!$found && $count >= 3) {
                        $targetPart = $addressParts[$count - 3];
                        if (!preg_match('/(số|đường|quận|huyện|thành phố|tp|tỉnh)/i', $targetPart)) {
                            $khuVucHienThi = $targetPart;
                            $cleanKhuVucSlug = Str::slug($targetPart, ' ');
                            $found = true;
                        }
                    }
                }
            }

            // Đảm bảo từ khóa không bao giờ trống rỗng
            if (empty($cleanKhuVucSlug)) {
                $cleanKhuVucSlug = 'dong hoa';
            }

            // 🛡️ BẢO VỆ 2: Quét lấy danh sách ID dự án bằng cơ chế phòng thủ thuộc tính động
            $allProjects = Project::all();
            $projectIds = [];

            foreach ($allProjects as $p) {
                $pAddress = $p->address ?? '';
                $pLocation = isset($p->location) ? $p->location : '';
                $pTitle = $p->title ?? '';

                $pCombinedText = trim($pAddress . ' ' . $pLocation . ' ' . $pTitle);
                $pSlugified = Str::slug($pCombinedText, ' ');

                // Gom sạch dự án lân cận dựa vào chuỗi không dấu lõi (Ví dụ: "dong hoa")
                if (str_contains($pSlugified, $cleanKhuVucSlug)) {
                    $projectIds[] = $p->id;
                }
            }

            if (empty($projectIds)) {
                $projectIds = [$apartment->project_id];
            }

            // Tiến hành quét đáy giá thấp nhất và đỉnh giá cao nhất của toàn vùng quy chuẩn
            $areaQuery = Apartment::whereIn('project_id', $projectIds)
                ->where('area', '>', 0)
                ->where('price', '>', 0);

            $stats = $areaQuery->select([
                DB::raw('MIN(price / area / 1000000) as min_meter'),
                DB::raw('MAX(price / area / 1000000) as max_meter'),
                DB::raw('AVG(price / area / 1000000) as avg_meter')
            ])->first();

            $minPricePerMeter = $stats->min_meter ?? ($currentPricePerMeter - 5);
            $maxPricePerMeter = $stats->max_meter ?? ($currentPricePerMeter + 7);
            $avgPricePerMeter = $stats->avg_meter ?? $currentPricePerMeter;

            if (round($minPricePerMeter) == round($maxPricePerMeter)) {
                $minPricePerMeter = max(10, $currentPricePerMeter - 5);
                $maxPricePerMeter = $currentPricePerMeter + 7;
            }

            // 🔥 THUẬT TOÁN MỞ RỘNG BIÊN ĐỘ (PADDING MARGIN) THEO Ý TRUNG TÍN:
            // Hạ sàn thấp xuống thêm 3 triệu và đẩy trần cao lên thêm 3 triệu để tạo không gian đệm cho UI
            if ($minPricePerMeter > 5) {
                $minPricePerMeter = $minPricePerMeter - 5; // Nới sàn về bên trái
            } else {
                $minPricePerMeter = max(5, $minPricePerMeter * 0.8); // Phòng thủ nếu giá quá thấp
            }

            $maxPricePerMeter = $maxPricePerMeter + 10;

            // Chuẩn hóa nhãn text hiển thị
            if (!empty($khuVucHienThi)) {
                if (!str_contains(mb_strtolower($khuVucHienThi), 'phường') &&
                    !str_contains(mb_strtolower($khuVucHienThi), 'p.') &&
                    !str_contains(mb_strtolower($khuVucHienThi), 'quận') &&
                    !str_contains(mb_strtolower($khuVucHienThi), 'xã')) {
                    $khuVucHienThi = "PHƯỜNG " . $khuVucHienThi;
                }
                $khuVucHienThi = mb_strtoupper($khuVucHienThi);
            } else {
                $khuVucHienThi = 'PHƯỜNG ĐÔNG HÒA';
            }

            $marketNotes = [
                "Đơn giá trung bình căn hộ toàn vùng " . $khuVucHienThi . " đang giữ mốc " . round($avgPricePerMeter, 1) . " triệu/m².",
                "Trục đo phổ biến quy chiếu từ đáy thấp nhất toàn khu vực sang đỉnh cao nhất của các phân khu mới bàn giao.",
                "Mức độ chênh lệch giá phản ánh tương quan trực tiếp về vị trí nội khu, tiến độ bàn giao và chất lượng tiện ích đi kèm."
            ];

            return response()->json([
                'success'               => true,
                'minPricePerMeter'      => $minPricePerMeter,
                'maxPricePerMeter'      => $maxPricePerMeter,
                'currentPricePerMeter'  => $currentPricePerMeter,
                'khuVuc'                => $khuVucHienThi,
                'marketNotes'           => $marketNotes
            ], 200);

        } catch (\Exception $e) {
            Log::error('Lỗi thuật toán dải khoảng giá m2 cấp phường: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Lỗi xử lý thuật toán dải giá m².'], 500);
        }
    }

    public function getPublicPaths()
    {
        // Bỏ điều kiện whereNull('apartments.deleted_at') do bảng không dùng Soft Deletes
        $paths = \DB::table('apartments')
            ->join('projects', 'apartments.project_id', '=', 'projects.id')
            ->select('apartments.slug as apartmentSlug', 'projects.slug as projectSlug')
            ->get();

        return response()->json($paths);
    }

    // Hiển thị căn hộ cùng dự án
    public function getSimilarApartments(\Illuminate\Http\Request $request)
    {
        try {
            $projectId = $request->query('projectId') ?? $request->query('project_id');
            $projectSlug = $request->query('projectSlug') ?? $request->query('project_slug') ?? $request->query('slug');
            $excludeId = $request->query('excludeId') ?? $request->query('exclude_id');

            // Khởi tạo truy vấn động
            $query = \App\Models\Apartment::query();

            // 🔒 CHIẾN LƯỢC PHÒNG THỦ: Kiểm tra xem có bảng projects hay không để tránh sập 500
            if ($projectId && $projectId !== 'undefined' && $projectId !== 'null') {
                $query->where('project_id', $projectId);
            } elseif ($projectSlug && $projectSlug !== 'undefined' && $projectSlug !== 'null') {
                // Nếu có quan hệ 'project' thì chạy, nếu không thì fallback tìm theo trường project_slug trực tiếp
                if (method_exists(\App\Models\Apartment::class, 'project')) {
                    $query->whereHas('project', function($q) use ($projectSlug) {
                        $q->where('slug', $projectSlug);
                    });
                } else {
                    $query->where('project_slug', $projectSlug);
                }
            } else {
                return response()->json([], 200);
            }

            // Loại trừ căn hộ hiện tại và lấy tối đa 4 căn
            if ($excludeId) {
                $query->where('id', '!=', $excludeId);
            }

            $apartments = $query->latest()->take(4)->get();

            if ($apartments->isEmpty()) {
                return response()->json([], 200);
            }

            // Ép dữ liệu đầu ra thành mảng phẳng, an toàn tuyệt đối
            $formattedData = $apartments->map(function ($apt) {
        // Xử lý chuyển đổi thời gian bằng hàm PHP thuần (An toàn 100% với chuỗi)
        $isoDate = null;
        if (!empty($apt->created_at)) {
            $timestamp = strtotime($apt->created_at);
            if ($timestamp !== false) {
                $isoDate = date('c', $timestamp); // Xuất ra định dạng chuẩn ISO 8601 giống hệt toIso8601String()
            }
        }

        return [
            'id' => $apt->id,
            'name' => $apt->name ?? '',
            'slug' => $apt->slug ?? '',
            'price' => isset($apt->price) ? (float) $apt->price : 0,
            'area' => isset($apt->area) ? (float) $apt->area : 0,
            'bedrooms' => $apt->bedrooms ?? 0,
            'bathrooms' => $apt->bathrooms ?? 0,
            'image' => $apt->image ?? '',

            // 🔥 Đmanager BẢO VỆ: Đã thay thế hoàn toàn Carbon bằng PHP thuần, miễn nhiễm với lỗi Ép kiểu string
            'created_at' => $isoDate,

            'project_slug' => isset($apt->project) ? ($apt->project->slug ?? '') : ($apt->project_slug ?? ''),
            'project_address' => isset($apt->project) ? ($apt->project->address ?? '') : ($apt->project_address ?? 'Bình Dương')
        ];
    });

            return response()->json($formattedData, 200);

        } catch (\Exception $e) {
            // Ghi lại vết lỗi vào file log để ông check nếu có sai sót tên cột trong DB
            \Log::error("Lỗi sập 500 tại hàm getSimilarApartments: " . $e->getMessage());

            // Trả về mảng rỗng để cứu nguy cho Frontend không bị crash giao diện
            return response()->json([], 200);
        }
    }

    //
    public function storeConsultation(\Illuminate\Http\Request $request)
    {
        try {
            // 1. Validate đúng các key trường nhận từ Frontend truyền lên
            $validator = \Validator::make($request->all(), [
                'name'    => 'required|string|max:255',
                'phone'   => 'required|string|max:20',
                'project' => 'nullable|string|max:255',
                'source'  => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
            }

            // 2. Insert trực tiếp vào bảng `leads` có sẵn của ông (Khớp theo cấu trúc ảnh image_9caf5b.png)
            \DB::table('leads')->insert([
                'name'       => $request->input('name'),
                'phone'      => $request->input('phone'),
                'project'    => $request->input('project') ?? 'Bcons',
                'source'     => $request->input('source'), // Tiêu đề căn hộ sẽ nằm ở đây
                'status'     => 'dang_tu_van',             // Trạng thái mặc định ban đầu
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json(['success' => true, 'message' => 'Đã lưu Lead thành công!'], 200);

        } catch (\Exception $e) {
            \Log::error("Lỗi lưu dữ liệu vào bảng leads: " . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Lỗi hệ thống'], 500);
        }
    }
}
