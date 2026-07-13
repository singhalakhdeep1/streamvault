/**
 * Content Moderation Service
 * Uses AI to detect inappropriate content in videos and streams
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video } from '../videos/entities/video.entity';
import { OpenAI } from 'openai';

@Injectable()
export class ContentModerationService {
  private readonly logger = new Logger(ContentModerationService.name);
  private openai: OpenAI;

  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Moderate video content using AI
   */
  async moderateVideo(videoId: string): Promise<{
    approved: boolean;
    flags: string[];
    confidence: number;
  }> {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) {
      throw new Error('Video not found');
    }

    // Analyze video title and description
    const textAnalysis = await this.analyzeText(video.title, video.description);
    
    // Analyze video thumbnail (if available)
    const imageAnalysis = video.thumbnailUrl 
      ? await this.analyzeImage(video.thumbnailUrl)
      : { flags: [], confidence: 0 };

    // Combine results
    const allFlags = [...textAnalysis.flags, ...imageAnalysis.flags];
    const avgConfidence = (textAnalysis.confidence + imageAnalysis.confidence) / 2;

    // Determine if content is approved
    const approved = allFlags.length === 0 || avgConfidence < 0.7;

    // Update video status
    video.moderationStatus = approved ? 'approved' : 'flagged';
    video.moderationFlags = allFlags;
    video.moderationConfidence = avgConfidence;
    await this.videoRepository.save(video);

    this.logger.log(`Video ${videoId} moderation: ${approved ? 'approved' : 'flagged'}`);

    return {
      approved,
      flags: allFlags,
      confidence: avgConfidence,
    };
  }

  /**
   * Moderate live stream in real-time
   */
  async moderateStream(streamKey: string, transcript: string): Promise<{
    approved: boolean;
    flags: string[];
    action: 'continue' | 'warn' | 'terminate';
  }> {
    const analysis = await this.analyzeText(transcript, '');

    // Determine action based on severity
    let action: 'continue' | 'warn' | 'terminate' = 'continue';
    
    if (analysis.flags.includes('hate_speech') || analysis.flags.includes('violence')) {
      action = 'terminate';
    } else if (analysis.flags.length > 0) {
      action = 'warn';
    }

    this.logger.log(`Stream ${streamKey} moderation: ${action}, flags: ${analysis.flags.join(', ')}`);

    return {
      approved: action !== 'terminate',
      flags: analysis.flags,
      action,
    };
  }

  /**
   * Analyze text content for inappropriate material
   */
  private async analyzeText(title: string, description: string): Promise<{
    flags: string[];
    confidence: number;
  }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a content moderator. Analyze the following text for inappropriate content including:
            - Hate speech
            - Violence
            - Sexual content
            - Harassment
            - Self-harm
            - Illegal activities
            
            Return a JSON object with:
            - flags: array of detected categories (empty if none)
            - confidence: 0-1 score for how confident you are about the flags`
          },
          {
            role: 'user',
            content: `Title: ${title}\nDescription: ${description}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content);
      return {
        flags: result.flags || [],
        confidence: result.confidence || 0,
      };
    } catch (error) {
      this.logger.error('Text analysis failed:', error);
      return { flags: [], confidence: 0 };
    }
  }

  /**
   * Analyze image content for inappropriate material
   */
  private async analyzeImage(imageUrl: string): Promise<{
    flags: string[];
    confidence: number;
  }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'system',
            content: `You are a content moderator. Analyze the image for inappropriate content including:
            - Nudity or sexual content
            - Violence or gore
            - Hate symbols
            - Illegal activities
            
            Return a JSON object with:
            - flags: array of detected categories (empty if none)
            - confidence: 0-1 score for how confident you are about the flags`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image for inappropriate content',
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 300,
      });

      const result = JSON.parse(response.choices[0].message.content);
      return {
        flags: result.flags || [],
        confidence: result.confidence || 0,
      };
    } catch (error) {
      this.logger.error('Image analysis failed:', error);
      return { flags: [], confidence: 0 };
    }
  }

  /**
   * Batch moderate multiple videos
   */
  async batchModerate(videoIds: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    for (const videoId of videoIds) {
      try {
        const result = await this.moderateVideo(videoId);
        results.set(videoId, result);
      } catch (error) {
        this.logger.error(`Failed to moderate video ${videoId}:`, error);
        results.set(videoId, { approved: false, flags: ['error'], confidence: 0 });
      }
    }

    return results;
  }

  /**
   * Get moderation statistics
   */
  async getModerationStats(): Promise<{
    totalModerated: number;
    approved: number;
    flagged: number;
    flagBreakdown: Record<string, number>;
  }> {
    const videos = await this.videoRepository.find({
      where: { moderationStatus: 'approved' },
    });
    const flaggedVideos = await this.videoRepository.find({
      where: { moderationStatus: 'flagged' },
    });

    const flagBreakdown: Record<string, number> = {};
    flaggedVideos.forEach((video) => {
      if (video.moderationFlags) {
        video.moderationFlags.forEach((flag) => {
          flagBreakdown[flag] = (flagBreakdown[flag] || 0) + 1;
        });
      }
    });

    return {
      totalModerated: videos.length + flaggedVideos.length,
      approved: videos.length,
      flagged: flaggedVideos.length,
      flagBreakdown,
    };
  }
}
