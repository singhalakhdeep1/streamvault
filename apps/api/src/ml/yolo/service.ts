/**
 * YOLOService — Python sidecar bridge for streamvault
 *
 * Architecture (mirrors the dispatch ML pattern):
 *  - PythonYoloAdapter: sends frames to a Python FastAPI sidecar running
 *    Ultralytics YOLO. Set YOLO_SIDECAR_URL to enable.
 *  - DemoYoloAdapter: deterministic in-process fallback for dev/test.
 *    Returns empty detections (no Math.random()). Used automatically when
 *    YOLO_SIDECAR_URL is not set.
 */

export interface BoundingBox { x: number; y: number; width: number; height: number }
export interface YoloDetection { class: string; confidence: number; bbox: BoundingBox }
export interface DetectionResult { detections: YoloDetection[]; timestamp: string }
export interface VideoDetectionResult { videoPath: string; detections: YoloDetection[][]; timestamp: string }
export interface TrackResult { videoPath: string; tracks: { id: number; class: string; frames: BoundingBox[] }[]; timestamp: string }

interface YoloAdapter {
  loadModel(): Promise<{ modelPath: string; loaded: boolean }>;
  detectObjects(imageData: Buffer): Promise<DetectionResult>;
  detectObjectsInVideo(videoPath: string): Promise<VideoDetectionResult>;
  trackObjects(videoPath: string): Promise<TrackResult>;
}

// ── Python sidecar (production) ──────────────────────────────────────────────

class PythonYoloAdapter implements YoloAdapter {
  constructor(private baseUrl: string, private modelPath: string) {}

  async loadModel() {
    const res = await fetch(`${this.baseUrl}/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_path: this.modelPath }),
    });
    if (!res.ok) throw new Error(`YOLO sidecar error ${res.status}`);
    return res.json();
  }

  async detectObjects(imageData: Buffer): Promise<DetectionResult> {
    const res = await fetch(`${this.baseUrl}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: imageData,
    });
    if (!res.ok) throw new Error(`YOLO sidecar error ${res.status}`);
    return res.json();
  }

  async detectObjectsInVideo(videoPath: string): Promise<VideoDetectionResult> {
    const res = await fetch(`${this.baseUrl}/detect-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_path: videoPath }),
    });
    if (!res.ok) throw new Error(`YOLO sidecar error ${res.status}`);
    return res.json();
  }

  async trackObjects(videoPath: string): Promise<TrackResult> {
    const res = await fetch(`${this.baseUrl}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_path: videoPath }),
    });
    if (!res.ok) throw new Error(`YOLO sidecar error ${res.status}`);
    return res.json();
  }
}

// ── Demo adapter (test / dev without sidecar) ────────────────────────────────

class DemoYoloAdapter implements YoloAdapter {
  constructor(private modelPath: string) {}

  async loadModel() { return { modelPath: this.modelPath, loaded: true }; }

  async detectObjects(_imageData: Buffer): Promise<DetectionResult> {
    // Returns empty — deterministic, not random mock data
    return { detections: [], timestamp: new Date().toISOString() };
  }

  async detectObjectsInVideo(videoPath: string): Promise<VideoDetectionResult> {
    return { videoPath, detections: [], timestamp: new Date().toISOString() };
  }

  async trackObjects(videoPath: string): Promise<TrackResult> {
    return { videoPath, tracks: [], timestamp: new Date().toISOString() };
  }
}

// ── Public service ────────────────────────────────────────────────────────────

class YOLOService {
  private adapter: YoloAdapter;

  constructor(
    modelPath = process.env.YOLO_MODEL_PATH ?? 'yolov8n.pt',
    confidenceThreshold = 0.5,
  ) {
    this._confidenceThreshold = confidenceThreshold;
    const url = process.env.YOLO_SIDECAR_URL;
    this.adapter = url ? new PythonYoloAdapter(url, modelPath) : new DemoYoloAdapter(modelPath);
    this._modelPath = modelPath;
  }

  private _modelPath: string;
  private _confidenceThreshold: number;

  get isDemoMode(): boolean { return this.adapter instanceof DemoYoloAdapter; }

  loadModel() { return this.adapter.loadModel(); }

  detectObjects(imageData: Buffer) { return this.adapter.detectObjects(imageData); }

  detectObjectsInVideo(videoPath: string) { return this.adapter.detectObjectsInVideo(videoPath); }

  trackObjects(videoPath: string) { return this.adapter.trackObjects(videoPath); }

  async classifyObjects(imageData: Buffer) {
    const result = await this.detectObjects(imageData);
    return {
      classifications: result.detections.map((d) => ({ class: d.class, confidence: d.confidence })),
      timestamp: result.timestamp,
    };
  }

  setConfidenceThreshold(threshold: number) {
    this._confidenceThreshold = threshold;
    return { confidenceThreshold: threshold };
  }

  getModelInfo() {
    return {
      modelPath: this._modelPath,
      confidenceThreshold: this._confidenceThreshold,
      classes: ['person', 'car', 'bicycle', 'dog', 'cat', 'truck', 'bus', 'motorbike'],
      timestamp: new Date().toISOString(),
    };
  }
}

export default YOLOService;
export { PythonYoloAdapter, DemoYoloAdapter };
