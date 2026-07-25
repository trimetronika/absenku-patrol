/**
 * WebRTC Camera Locking Engine
 * Strictly forces live device environment camera feed.
 * Strips HTML input file elements to prevent gallery uploads.
 */

export async function initializeLiveCameraStream(videoElement) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("WebRTC camera stream is not supported on this browser.");
  }

  const constraints = {
    video: {
      facingMode: { exact: "environment" }, // Require rear camera
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (videoElement) {
      videoElement.srcObject = stream;
      videoElement.play().catch(e => console.warn("Video play interrupted", e));
    }
    return stream;
  } catch (err) {
    // Fallback to default camera if exact environment camera fails
    const fallbackStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });
    if (videoElement) {
      videoElement.srcObject = fallbackStream;
      videoElement.play().catch(e => console.warn("Video play interrupted", e));
    }
    return fallbackStream;
  }
}

export function captureSnapshotFromStream(videoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth || 640;
  canvas.height = videoElement.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}
