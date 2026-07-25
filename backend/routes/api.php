<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\PatrolValidationController;

/*
|--------------------------------------------------------------------------
| REST API Routes for Digital Patrol Management System
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {

    // 1. Mobile Guard PWA Patrol Routes
    Route::prefix('mobile')->group(function () {
        Route::post('/patrol/validate-step', [PatrolValidationController::class, 'validateStep']);
        
        Route::get('/schedules/today', function () {
            return response()->json([
                'status' => 'success',
                'data' => [
                    [
                        'schedule_id' => 'e21b8f04-61c0-4a81-9b11-456012a9bf81',
                        'title' => 'Morning Shift Patrol',
                        'start_time' => '07:00',
                        'end_time' => '17:00',
                        'is_active_now' => true,
                        'total_points' => 8,
                        'completed_points' => 3
                    ]
                ]
            ]);
        });
    });

    // 2. Web Admin Dashboard & Master Data Routes
    Route::prefix('admin')->group(function () {
        Route::get('/dashboard/summary', function () {
            return response()->json([
                'status' => 'success',
                'metrics' => [
                    'patrol_success' => 412,
                    'patrol_failed' => 8,
                    'late_patrol' => 14,
                    'missed_patrol' => 3,
                    'ai_similarity_avg' => 93.4
                ]
            ]);
        });
    });
});
