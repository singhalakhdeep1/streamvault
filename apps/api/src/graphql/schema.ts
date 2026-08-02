// GraphQL schema for streamvault

import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  type Video {
    id: ID!
    title: String!
    description: String
    url: String!
    thumbnailUrl: String
    duration: Int!
    views: Int!
    status: String!
    createdAt: String!
    updatedAt: String!
  }

  type Stream {
    id: ID!
    videoId: String!
    streamKey: String!
    status: String!
    viewerCount: Int!
    startedAt: String!
    endedAt: String
  }

  type Analysis {
    id: ID!
    videoId: String!
    type: String!
    results: String!
    confidence: Float!
    createdAt: String!
  }

  type Query {
    video(id: ID!): Video
    videos(limit: Int, offset: Int): [Video!]!
    stream(id: ID!): Stream
    activeStreams: [Stream!]!
    analysis(id: ID!): Analysis
    analyses(videoId: String!): [Analysis!]!
  }

  type Mutation {
    createVideo(title: String!, description: String, url: String!, duration: Int!): Video!
    updateVideo(id: ID!, title: String, description: String): Video!
    deleteVideo(id: ID!): Boolean!
    startStream(videoId: String!): Stream!
    endStream(streamId: String!): Stream!
    createAnalysis(videoId: String!, type: String!, results: String!, confidence: Float!): Analysis!
  }

  type Subscription {
    streamStarted: Stream!
    streamEnded: Stream!
    streamUpdated: Stream!
    analysisCompleted: Analysis!
  }
`;
