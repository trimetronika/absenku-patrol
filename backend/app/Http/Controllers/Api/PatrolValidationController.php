<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\GeofenceService;
use App\Services\HmacQrService;
use App\Services\AiValidationClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PatrolValidationController extends Controller
{
    protected GeofenceService $geofenceService;
    protected HmacQrService $qrService;
    protected AiValidationClient $aiClient;

    public function __construct(
        GeofenceService $geofenceService,
        HmacQrService $qrService,
        AiValidationClient $aiClient
    ) {
        $this->geofenceService = $geofenceService;
        $this->qrService = $qrService;
        $this->aiClient = $aiClient;
    }

    /**
     * Executes the 5-Layer Patrol Validation Pipeline.
     */
    public function validateStep(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'schedule_id' => 'required|uuid',
            'patrol_point_id' => 'required|uuid',
            'qr_payload' => 'required|string',
            'location.latitude' => 'required|numeric',
            'location.longitude' => 'required|numeric',
            'location.accuracy' => 'required|numeric',
            'location.is_mock' => 'nullable|boolean',
            'captured_images' => 'required|array|min:1|max:3'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'fail',
                'validation_result' => 'INVALID',
                'errors' => $validator->errors()
            ], 422);
        }

        $userId = $request->user()->id ?? 'c71a39d4-814a-4e2b-9281-01f1293a912e'; // Demo fallbacks
        $companyId = $request->user()->company_id ?? '4b68e910-31a8-4c12-8812-70b10d1921aa';

        // 1. LAYER 1: Schedule Window Validation
        $schedule = DB::table('schedules')->where('id', $request->schedule_id)->first();
        if (!$schedule || !$schedule->is_active) {
            return response()->json([
                'status' => 'fail',
                'validation_result' => 'INVALID',
                'error_code' => 'SCHEDULE_EXPIRED_OR_INACTIVE',
                'failure_reason' => 'Patrol schedule window is inactive or expired.'
            ], 422);
        }

        // Fetch Patrol Point Details
        $point = DB::table('patrol_points')->where('id', $request->patrol_point_id)->first();
        if (!$point) {
            return response()->json([
                'status' => 'fail',
                'validation_result' => 'INVALID',
                'error_code' => 'PATROL_POINT_NOT_FOUND',
                'failure_reason' => 'Invalid patrol point specified.'
            ], 404);
        }

        // Fetch Secret Salt for QR check
        $qrRecord = DB::table('qr_codes')->where('patrol_point_id', $point->id)->first();
        $secretSalt = $qrRecord->secret_salt ?? 'DefaultSecretSalt123!';

        // 2. LAYER 2: Dynamic HMAC QR Code Check
        $isQrValid = $this->qrService->validateQrPayload($request->qr_payload, $point->id, $secretSalt);
        if (!$isQrValid) {
            return response()->json([
                'status' => 'fail',
                'validation_result' => 'INVALID',
                'error_code' => 'INVALID_OR_STALE_QR',
                'failure_reason' => 'QR token is stale, shared, or invalid.'
            ], 422);
        }

        // 3. LAYER 3: GPS Geofence & Anti-Mock Check
        $locCheck = $this->geofenceService->validateLocationIntegrity($request->location);
        if (!$locCheck['valid']) {
            return response()->json([
                'status' => 'fail',
                'validation_result' => 'INVALID',
                'error_code' => 'ANTI_CHEAT_LOCATION_FAIL',
                'failure_reason' => $locCheck['reason']
            ], 422);
        }

        $scannedLat = (float) $request->location['latitude'];
        $scannedLon = (float) $request->location['longitude'];

        $distanceMeters = $this->geofenceService->calculateDistanceMeters(
            $scannedLat,
            $scannedLon,
            (float) $point->latitude,
            (float) $point->longitude
        );

        if ($distanceMeters > $point->geofence_radius_meters) {
            return response()->json([
                'status' => 'fail',
                'validation_result' => 'INVALID',
                'error_code' => 'GEOFENCE_BREACH',
                'failure_reason' => "Geofence breached: Distance ({$distanceMeters}m) exceeds radius ({$point->geofence_radius_meters}m)."
            ], 422);
        }

        // 4. LAYER 4 & 5: AI Computer Vision Validation
        $referencePhotos = DB::table('reference_images')
            ->where('patrol_point_id', $point->id)
            ->pluck('image_url')
            ->toArray();

        // If no references uploaded, mock placeholder base64 for demo
        if (empty($referencePhotos)) {
            $referencePhotos = [$request->captured_images[0]];
        }

        $aiResult = $this->aiClient->evaluateVisualSimilarity(
            $point->id,
            $request->captured_images,
            $referencePhotos
        );

        $aiScore = $aiResult['final_score'] ?? 0.0;
        $isPass = ($aiResult['status'] ?? 'FAIL') === 'PASS';

        // 5. Commit Patrol Log to Database
        $patrolLogId = DB::table('patrol_logs')->insertGetId([
            'id' => DB::raw('uuid_generate_v4()'),
            'company_id' => $companyId,
            'user_id' => $userId,
            'schedule_id' => $request->schedule_id,
            'patrol_point_id' => $point->id,
            'scanned_latitude' => $scannedLat,
            'scanned_longitude' => $scannedLon,
            'gps_distance_meters' => $distanceMeters,
            'ai_similarity_score' => $aiScore,
            'validation_status' => $isPass ? 'VALID' : 'INVALID',
            'failure_reason' => $isPass ? null : 'AI similarity score below threshold.',
            'is_anti_cheat_passed' => true,
            'device_info' => json_encode($request->header('User-Agent')),
            'scanned_at' => now()
        ], 'id');

        if ($isPass) {
            return response()->json([
                'status' => 'success',
                'validation_result' => 'VALID',
                'summary' => [
                    'schedule_valid' => true,
                    'qr_valid' => true,
                    'gps_valid' => true,
                    'gps_distance_meters' => $distanceMeters,
                    'geofence_radius_meters' => $point->geofence_radius_meters,
                    'ai_similarity_score' => $aiScore,
                    'anti_cheat_status' => 'PASSED'
                ],
                'patrol_log_id' => $patrolLogId
            ]);
        } else {
            return response()->json([
                'status' => 'fail',
                'validation_result' => 'INVALID',
                'error_code' => 'AI_VISUAL_SIMILARITY_FAIL',
                'summary' => [
                    'schedule_valid' => true,
                    'qr_valid' => true,
                    'gps_valid' => true,
                    'gps_distance_meters' => $distanceMeters,
                    'geofence_radius_meters' => $point->geofence_radius_meters,
                    'ai_similarity_score' => $aiScore,
                    'failure_reason' => 'Visual scene comparison failed. Camera angle or object context did not match reference.'
                ]
            ], 422);
        }
    }
}
