// OpenCV service for streamvault

import cv from 'opencv4nodejs';

class OpenCVService {
  async processFrame(frame: Buffer) {
    const mat = cv.imdecode(frame);
    return mat;
  }

  async detectEdges(frame: Buffer) {
    const mat = cv.imdecode(frame);
    const gray = mat.cvtColor(cv.COLOR_BGR2GRAY);
    const edges = gray.canny(50, 150);
    return cv.imencode('.jpg', edges);
  }

  async detectFaces(frame: Buffer) {
    const mat = cv.imdecode(frame);
    const gray = mat.cvtColor(cv.COLOR_BGR2GRAY);
    const classifier = new cv.CascadeClassifier(cv.HAAR_FRONTALFACE_DEFAULT);
    const faces = classifier.detectMultiScale(gray).objects;
    
    return faces.map(face => ({
      x: face.x,
      y: face.y,
      width: face.width,
      height: face.height
    }));
  }

  async detectMotion(frame1: Buffer, frame2: Buffer) {
    const mat1 = cv.imdecode(frame1);
    const mat2 = cv.imdecode(frame2);
    
    const gray1 = mat1.cvtColor(cv.COLOR_BGR2GRAY);
    const gray2 = mat2.cvtColor(cv.COLOR_BGR2GRAY);
    
    const diff = gray1.absdiff(gray2);
    const thresh = diff.threshold(25, 255, cv.THRESH_BINARY);
    
    const contours = thresh.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    return contours.map(contour => ({
      area: contour.area,
      boundingRect: contour.boundingRect
    }));
  }

  async applyBlur(frame: Buffer, kernelSize = 15) {
    const mat = cv.imdecode(frame);
    const blurred = mat.gaussianBlur(new cv.Size(kernelSize, kernelSize), 0);
    return cv.imencode('.jpg', blurred);
  }

  async resizeFrame(frame: Buffer, width: number, height: number) {
    const mat = cv.imdecode(frame);
    const resized = mat.resize(width, height);
    return cv.imencode('.jpg', resized);
  }

  async extractFrames(videoPath: string, frameRate = 30) {
    const cap = new cv.VideoCapture(videoPath);
    const frames = [];
    
    let frameIndex = 0;
    while (true) {
      const frame = cap.read();
      if (frame.empty) break;
      
      if (frameIndex % frameRate === 0) {
        frames.push(cv.imencode('.jpg', frame));
      }
      
      frameIndex++;
    }
    
    cap.release();
    return frames;
  }

  async createVideo(frames: Buffer[], outputPath: string, fps = 30) {
    const firstFrame = cv.imdecode(frames[0]);
    const writer = new cv.VideoWriter(outputPath, cv.VideoWriter_fourcc('M', 'J', 'P', 'G'), fps, firstFrame.size);
    
    for (const frame of frames) {
      const mat = cv.imdecode(frame);
      writer.write(mat);
    }
    
    writer.release();
  }

  async detectObjects(frame: Buffer) {
    const mat = cv.imdecode(frame);
    const blob = cv.blobFromImage(mat, 1/255, new cv.Size(416, 416), new cv.Vec3(0, 0, 0), true, false);
    
    // Load YOLO model and perform detection
    // This is a placeholder for actual YOLO implementation
    return [];
  }

  async trackObjects(frames: Buffer[]) {
    const trackedObjects = [];
    
    for (let i = 0; i < frames.length; i++) {
      const objects = await this.detectObjects(frames[i]);
      trackedObjects.push({ frameIndex: i, objects });
    }
    
    return trackedObjects;
  }
}

export default OpenCVService;
