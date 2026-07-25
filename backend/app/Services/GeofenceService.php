<?php

namespace App\Services;

class GeofenceService
{
    /**
     * Calculates Geodesic Distance in meters using Haversine formula.
     */
    public function calculateDistanceMeters(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6371000; // Earth's radius in meters

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadius * $c, 2);
    }

    /**
     * Anti-Cheat check for Mock GPS and accuracy degradation.
     */
    public function validateLocationIntegrity(array $locationData): array
    {
        $accuracy = $locationData['accuracy'] ?? 999.0;
        $isMock = $locationData['is_mock'] ?? false;

        if ($isMock) {
            return [
                'valid' => false,
                'reason' => 'MOCK_GPS_DETECTED: Developer options / Fake GPS application detected on device.'
            ];
        }

        if ($accuracy > 25.0) {
            return [
                'valid' => false,
                'reason' => "GPS_ACCURACY_TOO_LOW: Location accuracy ({$accuracy}m) exceeds 25m threshold."
            ];
        }

        return ['valid' => true, 'reason' => null];
    }
}
