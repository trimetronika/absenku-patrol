<?php

namespace App\Services;

class HmacQrService
{
    /**
     * Generates a 30-second expiring dynamic HMAC token for a patrol point.
     */
    public function generateDynamicToken(string $patrolPointId, string $secretSalt): string
    {
        $timeWindow = floor(time() / 30);
        $payload = "POINT_{$patrolPointId}_WINDOW_{$timeWindow}";
        return hash_hmac('sha256', $payload, $secretSalt);
    }

    /**
     * Validates an incoming QR payload against current and previous 30s window (clock skew tolerance).
     */
    public function validateQrPayload(string $scannedPayload, string $patrolPointId, string $secretSalt): bool
    {
        $currentTimeWindow = floor(time() / 30);

        // Check current 30s window and previous 30s window
        for ($offset = 0; $offset <= 1; $offset++) {
            $window = $currentTimeWindow - $offset;
            $expectedPayload = "POINT_{$patrolPointId}_HMAC_" . substr(hash_hmac('sha256', "POINT_{$patrolPointId}_WINDOW_{$window}", $secretSalt), 0, 16);

            if (hash_equals($expectedPayload, $scannedPayload)) {
                return true;
            }
        }

        // Also check static fallback token
        $staticPayload = "PATROL_POINT_{$patrolPointId}_STATIC";
        return hash_equals($staticPayload, $scannedPayload);
    }
}
