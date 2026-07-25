<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiValidationClient
{
    protected string $aiServiceUrl;

    public function __construct()
    {
        $this->aiServiceUrl = config('services.ai.url', env('AI_SERVICE_URL', 'http://ai-service:8000'));
    }

    /**
     * Sends live captured photos and target reference photos to FastAPI AI Engine.
     */
    public function evaluateVisualSimilarity(string $patrolPointId, array $livePhotosBase64, array $referencePhotosBase64): array
    {
        try {
            $response = Http::timeout(5.0)->post("{$this->aiServiceUrl}/api/v1/ai/validate", [
                'patrol_point_id' => $patrolPointId,
                'live_photos_base64' => $livePhotosBase64,
                'reference_photos_base64' => $referencePhotosBase64
            ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('AI Microservice Response Error: ' . $response->body());
            return [
                'status' => 'FAIL',
                'final_score' => 0.0,
                'pass_threshold' => 85.0,
                'metrics' => [],
                'execution_time_ms' => 0,
                'error' => 'AI Service error response: ' . $response->status()
            ];
        } catch (\Exception $e) {
            Log::error('AI Microservice Connection Exception: ' . $e->getMessage());
            return [
                'status' => 'FAIL',
                'final_score' => 0.0,
                'pass_threshold' => 85.0,
                'metrics' => [],
                'execution_time_ms' => 0,
                'error' => 'AI Microservice unreachable: ' . $e->getMessage()
            ];
        }
    }
}
