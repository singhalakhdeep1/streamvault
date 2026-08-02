// GraphQL resolvers for streamvault

import { PubSub } from 'apollo-server-express';

const pubsub = new PubSub();

export const resolvers = {
  Query: {
    video: async (_: any, { id }: any, { dataSources }: any) => {
      return dataSources.videoAPI.getVideoById(id);
    },
    videos: async (_: any, { limit = 20, offset = 0 }: any, { dataSources }: any) => {
      return dataSources.videoAPI.listVideos(limit, offset);
    },
    stream: async (_: any, { id }: any, { dataSources }: any) => {
      return dataSources.streamAPI.getStreamById(id);
    },
    activeStreams: async (_: any, __: any, { dataSources }: any) => {
      return dataSources.streamAPI.getActiveStreams();
    },
    analysis: async (_: any, { id }: any, { dataSources }: any) => {
      return dataSources.analysisAPI.getAnalysisById(id);
    },
    analyses: async (_: any, { videoId }: any, { dataSources }: any) => {
      return dataSources.analysisAPI.getAnalysesByVideoId(videoId);
    }
  },
  Mutation: {
    createVideo: async (_: any, { title, description, url, duration }: any, { dataSources }: any) => {
      return dataSources.videoAPI.createVideo({ title, description, url, duration });
    },
    updateVideo: async (_: any, { id, title, description }: any, { dataSources }: any) => {
      return dataSources.videoAPI.updateVideo(id, { title, description });
    },
    deleteVideo: async (_: any, { id }: any, { dataSources }: any) => {
      await dataSources.videoAPI.deleteVideo(id);
      return true;
    },
    startStream: async (_: any, { videoId }: any, { dataSources }: any) => {
      const stream = await dataSources.streamAPI.startStream(videoId);
      pubsub.publish('STREAM_STARTED', { streamStarted: stream });
      return stream;
    },
    endStream: async (_: any, { streamId }: any, { dataSources }: any) => {
      const stream = await dataSources.streamAPI.endStream(streamId);
      pubsub.publish('STREAM_ENDED', { streamEnded: stream });
      return stream;
    },
    createAnalysis: async (_: any, { videoId, type, results, confidence }: any, { dataSources }: any) => {
      const analysis = await dataSources.analysisAPI.createAnalysis({ videoId, type, results, confidence });
      pubsub.publish('ANALYSIS_COMPLETED', { analysisCompleted: analysis });
      return analysis;
    }
  },
  Subscription: {
    streamStarted: {
      subscribe: () => pubsub.asyncIterator(['STREAM_STARTED'])
    },
    streamEnded: {
      subscribe: () => pubsub.asyncIterator(['STREAM_ENDED'])
    },
    streamUpdated: {
      subscribe: () => pubsub.asyncIterator(['STREAM_UPDATED'])
    },
    analysisCompleted: {
      subscribe: () => pubsub.asyncIterator(['ANALYSIS_COMPLETED'])
    }
  }
};
