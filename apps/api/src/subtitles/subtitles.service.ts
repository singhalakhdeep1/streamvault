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
   * Generate subtitles from video metadata (simulated)
   */
  private async generateFromMetadata(video: Video, language: string): Promise<Array<{
    start: number;
    end: number;
    text: string;
  }>> {
    // In production, this would use actual speech-to-text
    // For now, generate placeholder subtitles based on video content
    const segments = Math.ceil(video.duration / 10); // One segment every 10 seconds
    const subtitles = [];

    for (let i = 0; i < segments; i++) {
      const start = i * 10;
      const end = Math.min((i + 1) * 10, video.duration);
      
      // Generate placeholder text based on video category
      const placeholderText = this.generatePlaceholderText(video, i, language);
      
      subtitles.push({
        start,
        end,
        text: placeholderText,
      });
    }

    return subtitles;
  }

  /**
   * Generate placeholder subtitle text
   */
  private generatePlaceholderText(video: Video, segment: number, language: string): string {
    const texts = {
      en: [
        'Welcome to this video',
        'In this section, we will explore',
        'Let me show you how this works',
        'As you can see here',
        'This is an important point',
        'Moving on to the next topic',
        'Let me demonstrate this',
        'Here are the key takeaways',
        'To summarize what we discussed',
        'Thank you for watching',
      ],
      es: [
        'Bienvenido a este video',
        'En esta sección, exploraremos',
        'Déjame mostrarte cómo funciona',
        'Como puedes ver aquí',
        'Este es un punto importante',
        'Pasando al siguiente tema',
        'Déjame demostrar esto',
        'Aquí están los puntos clave',
        'Para resumir lo que discutimos',
        'Gracias por ver',
      ],
      fr: [
        'Bienvenue dans cette vidéo',
        'Dans cette section, nous allons explorer',
        'Laissez-moi vous montrer comment cela fonctionne',
        'Comme vous pouvez le voir ici',
        'C\'est un point important',
        'Passons au sujet suivant',
        'Laissez-moi vous montrer cela',
        'Voici les points clés',
        'Pour résumer ce que nous avons discuté',
        'Merci d\'avoir regardé',
      ],
      de: [
        'Willkommen in diesem Video',
        'In diesem Abschnitt werden wir erkunden',
        'Lassen Sie mich zeigen, wie das funktioniert',
        'Wie Sie hier sehen können',
        'Das ist ein wichtiger Punkt',
        'Lassen Sie uns zum nächsten Thema übergehen',
        'Lassen Sie mich das demonstrieren',
        'Hier sind die wichtigsten Punkte',
        'Um zusammenzufassen, was wir besprochen haben',
        'Danke fürs Zuschauen',
      ],
      ja: [
        'このビデオへようこそ',
        'このセクションでは、探索します',
        'これがどのように機能するか見せてください',
        'ここで見ることができます',
        'これは重要なポイントです',
        '次のトピックに移りましょう',
        'これを実演しましょう',
        'ここに重要なポイントがあります',
        '議論したことを要約すると',
        'ご視聴ありがとうございます',
      ],
      zh: [
        '欢迎观看此视频',
        '在本节中，我们将探索',
        '让我向您展示这是如何工作的',
        '正如您在这里看到的',
        '这是一个重要点',
        '让我们进入下一个主题',
        '让我演示一下',
        '这里是关键要点',
        '总结我们讨论的内容',
        '感谢观看',
      ],
    };

    const languageTexts = texts[language] || texts['en'];
    return languageTexts[segment % languageTexts.length];
  }

  /**
   * Translate text using AI
   */
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
