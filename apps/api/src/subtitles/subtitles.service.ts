/**
 * Multi-language Subtitles Service
 * Generates and manages subtitles in multiple languages using AI
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video } from '../videos/entities/video.entity';
import { OpenAI } from 'openai';

interface SubtitleTrack {
  language: string;
  languageCode: string;
  subtitles: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

@Injectable()
export class SubtitlesService {
  private readonly logger = new Logger(SubtitlesService.name);
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
   * Generate subtitles for a video in the original language
   */
  async generateSubtitles(videoId: string, sourceLanguage: string = 'en'): Promise<SubtitleTrack> {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) {
      throw new Error('Video not found');
    }

    // In production, this would use speech-to-text on the video audio
    // For now, we'll simulate with AI generation based on video metadata
    const subtitles = await this.generateFromMetadata(video, sourceLanguage);

    const track: SubtitleTrack = {
      language: this.getLanguageName(sourceLanguage),
      languageCode: sourceLanguage,
      subtitles,
    };

    // Save subtitles to video entity
    video.subtitles = video.subtitles || {};
    video.subtitles[sourceLanguage] = track;
    await this.videoRepository.save(video);

    this.logger.log(`Generated ${sourceLanguage} subtitles for video ${videoId}`);

    return track;
  }

  /**
   * Translate subtitles to another language
   */
  async translateSubtitles(videoId: string, targetLanguage: string): Promise<SubtitleTrack> {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) {
      throw new Error('Video not found');
    }

    const sourceTrack = video.subtitles?.['en'];
    if (!sourceTrack) {
      throw new Error('No source subtitles found. Generate English subtitles first.');
    }

    // Translate each subtitle segment
    const translatedSubtitles = await Promise.all(
      sourceTrack.subtitles.map(async (subtitle) => {
        const translatedText = await this.translateText(subtitle.text, 'en', targetLanguage);
        return {
          ...subtitle,
          text: translatedText,
        };
      })
    );

    const track: SubtitleTrack = {
      language: this.getLanguageName(targetLanguage),
      languageCode: targetLanguage,
      subtitles: translatedSubtitles,
    };

    // Save translated subtitles
    video.subtitles = video.subtitles || {};
    video.subtitles[targetLanguage] = track;
    await this.videoRepository.save(video);

    this.logger.log(`Translated subtitles to ${targetLanguage} for video ${videoId}`);

    return track;
  }

  /**
   * Generate subtitles in multiple languages at once
   */
  async generateMultiLanguageSubtitles(
    videoId: string,
    languages: string[] = ['en', 'es', 'fr', 'de', 'ja', 'zh'],
  ): Promise<Record<string, SubtitleTrack>> {
    // First generate English subtitles
    await this.generateSubtitles(videoId, 'en');

    const results: Record<string, SubtitleTrack> = {};

    // Translate to all requested languages
    for (const lang of languages) {
      if (lang !== 'en') {
        try {
          results[lang] = await this.translateSubtitles(videoId, lang);
        } catch (error) {
          this.logger.error(`Failed to translate to ${lang}:`, error);
        }
      }
    }

    return results;
  }

  /**
   * Get subtitles for a video in a specific language
   */
  async getSubtitles(videoId: string, language: string): Promise<SubtitleTrack | null> {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) {
      throw new Error('Video not found');
    }

    return video.subtitles?.[language] || null;
  }

  /**
   * Get all available subtitle languages for a video
   */
  async getAvailableLanguages(videoId: string): Promise<string[]> {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) {
      throw new Error('Video not found');
    }

    return Object.keys(video.subtitles || {});
  }

  /**
   * Export subtitles in WebVTT format
   */
  async exportWebVTT(videoId: string, language: string): Promise<string> {
    const track = await this.getSubtitles(videoId, language);
    if (!track) {
      throw new Error('No subtitles available for this language');
    }

    let webvtt = 'WEBVTT\n\n';

    track.subtitles.forEach((subtitle, index) => {
      const startTime = this.formatTime(subtitle.start);
      const endTime = this.formatTime(subtitle.end);
      webvtt += `${index + 1}\n${startTime} --> ${endTime}\n${subtitle.text}\n\n`;
    });

    return webvtt;
  }

  /**
   * Export subtitles in SRT format
   */
  async exportSRT(videoId: string, language: string): Promise<string> {
    const track = await this.getSubtitles(videoId, language);
    if (!track) {
      throw new Error('No subtitles available for this language');
    }

    let srt = '';

    track.subtitles.forEach((subtitle, index) => {
      const startTime = this.formatSRTTime(subtitle.start);
      const endTime = this.formatSRTTime(subtitle.end);
      srt += `${index + 1}\n${startTime} --> ${endTime}\n${subtitle.text}\n\n`;
    });

    return srt;
  }

  /**
   * Auto-sync subtitles with video timing
   */
  async syncSubtitles(videoId: string, language: string): Promise<SubtitleTrack> {
    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) {
      throw new Error('Video not found');
    }

    const track = video.subtitles?.[language];
    if (!track) {
      throw new Error('No subtitles available for this language');
    }

    // Apply timing adjustments using AI
    const syncedSubtitles = await this.adjustTiming(track.subtitles, video.duration);

    track.subtitles = syncedSubtitles;
    video.subtitles[language] = track;
    await this.videoRepository.save(video);

    return track;
  }

  /**
   * Generate subtitles from video audio using OpenAI Whisper speech-to-text
   */
  private async generateFromMetadata(video: Video, language: string): Promise<Array<{
    start: number;
    end: number;
    text: string;
  }>> {
    if (!video.url) {
      this.logger.warn(`Video ${video.id} has no URL — cannot transcribe`);
      return [];
    }

    try {
      // Download the audio/video file
      const response = await fetch(video.url);
      if (!response.ok) throw new Error(`Failed to fetch video: ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Use OpenAI Whisper with verbose JSON to get word-level timestamps
      const transcription = await this.openai.audio.transcriptions.create({
        file: new File([buffer], 'audio.mp4', { type: 'audio/mp4' }),
        model: 'whisper-1',
        response_format: 'verbose_json',
        language: language !== 'en' ? language : undefined,
        timestamp_granularities: ['segment'],
      } as any);

      // Map Whisper segments to our SubtitleTrack format
      if ((transcription as any).segments?.length) {
        return (transcription as any).segments.map((seg: any) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text.trim(),
        }));
      }

      // Fallback: split plain text into 10-second chunks by word count
      const words = transcription.text.split(' ');
      const wordsPerSegment = Math.max(1, Math.round(words.length / Math.ceil(video.duration / 10)));
      const segments: Array<{ start: number; end: number; text: string }> = [];

      for (let i = 0; i * wordsPerSegment < words.length; i++) {
        const chunk = words.slice(i * wordsPerSegment, (i + 1) * wordsPerSegment).join(' ');
        segments.push({
          start: i * 10,
          end: Math.min((i + 1) * 10, video.duration),
          text: chunk,
        });
      }
      return segments;
    } catch (error) {
      this.logger.error(`Whisper transcription failed for video ${video.id}:`, error);
      return [];
    }
  }

  private async translateText(text: string, fromLang: string, toLang: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text from ${fromLang} to ${toLang}. Only return the translated text, nothing else.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
      });

      return response.choices[0].message.content || text;
    } catch (error) {
      this.logger.error('Translation failed:', error);
      return text;
    }
  }

  /**
   * Adjust subtitle timing using AI
   */
  private async adjustTiming(subtitles: Array<{ start: number; end: number; text: string }>, videoDuration: number): Promise<Array<{ start: number; end: number; text: string }>> {
    // In production, this would use audio analysis to sync timing
    // For now, return original timing
    return subtitles;
  }

  /**
   * Format time for WebVTT
   */
  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Format time for SRT
   */
  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Get language name from code
   */
  private getLanguageName(code: string): string {
    const names: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      ja: 'Japanese',
      zh: 'Chinese',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      ar: 'Arabic',
    };
    return names[code] || code;
  }
}
