// TensorFlow service for streamvault

import * as tf from '@tensorflow/tfjs-node';

class TensorFlowService {
  private model: tf.LayersModel | null = null;

  async loadModel(modelPath: string) {
    this.model = await tf.loadLayersModel(`file://${modelPath}`);
  }

  async predictVideoFeatures(videoFrames: number[][][]) {
    if (!this.model) throw new Error('Model not loaded');
    
    const input = tf.tensor4d([videoFrames]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const features = await prediction.array();
    input.dispose();
    prediction.dispose();
    
    return features[0];
  }

  async classifyContent(frames: number[][][]) {
    if (!this.model) throw new Error('Model not loaded');
    
    const input = tf.tensor4d([frames]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const classes = await prediction.array();
    input.dispose();
    prediction.dispose();
    
    return classes[0];
  }

  async detectObjects(frames: number[][][]) {
    if (!this.model) throw new Error('Model not loaded');
    
    const input = tf.tensor4d([frames]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const detections = await prediction.array();
    input.dispose();
    prediction.dispose();
    
    return detections[0];
  }

  async extractEmbeddings(frames: number[][][]) {
    if (!this.model) throw new Error('Model not loaded');
    
    const input = tf.tensor4d([frames]);
    const embedding = this.model.predict(input) as tf.Tensor;
    const embeddings = await embedding.array();
    input.dispose();
    embedding.dispose();
    
    return embeddings[0];
  }

  async similaritySearch(embedding1: number[], embedding2: number[]) {
    const vec1 = tf.tensor1d(embedding1);
    const vec2 = tf.tensor1d(embedding2);
    const cosineSimilarity = tf.losses.cosineDistance(vec1, vec2, 0);
    const similarity = await cosineSimilarity.data();
    vec1.dispose();
    vec2.dispose();
    
    return 1 - similarity[0];
  }

  async trainModel(trainingData: any, epochs = 10) {
    const model = tf.sequential();
    
    model.add(tf.layers.conv2d({
      inputShape: [224, 224, 3],
      filters: 32,
      kernelSize: 3,
      activation: 'relu'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    model.add(tf.layers.conv2d({ filters: 64, kernelSize: 3, activation: 'relu' }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 10, activation: 'softmax' }));
    
    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    await model.fit(trainingData.inputs, trainingData.labels, {
      epochs,
      batchSize: 32
    });
    
    return model;
  }

  dispose() {
    if (this.model) {
      this.model.dispose();
    }
  }
}

export default TensorFlowService;
