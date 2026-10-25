import { Injectable, Logger } from '@nestjs/common';
import { MeiliSearch } from 'meilisearch';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SearchService {
    private client: MeiliSearch;
    private readonly logger = new Logger(SearchService.name);

    constructor(private config: ConfigService) {
        this.client = new MeiliSearch({
            host: config.get('MEILI_HOST', 'http://localhost:7700'),
            apiKey: config.get('MEILI_API_KEY'),
        });

        this.setupIndexes().catch(err => this.logger.error('Meilisearch setup failed:', err));
    }

    private async setupIndexes() {
        // Videos index
        await this.client.createIndex('videos', { primaryKey: 'id' }).catch(() => { });
        const videosIndex = this.client.index('videos');

        await videosIndex.updateSettings({
            searchableAttributes: ['title', 'description', 'tags', 'channelName', 'categoryName'],
            filterableAttributes: ['status', 'visibility', 'categorySlug', 'channelId', 'requiresPremium'],
            sortableAttributes: ['viewCount', 'publishedAt', 'likeCount', 'duration'],
            rankingRules: [
                'words', 'typo', 'proximity', 'attribute', 'sort', 'exactness',
                'viewCount:desc',
            ],
        });
    }

    // ─── Index a video ────────────────────────────────────────────────────
    async indexVideo(video: any) {
        if (video.status !== 'READY' || video.visibility !== 'PUBLIC') return;

        const doc = {
            id: video.id,
            title: video.title,
            description: video.description?.slice(0, 500) || '',
            tags: video.tags || [],
            channelId: video.channelId,
            channelName: video.channel?.name || '',
            channelHandle: video.channel?.handle || '',
            categoryName: video.category?.name || '',
            categorySlug: video.category?.slug || '',
            status: video.status,
            visibility: video.visibility,
            requiresPremium: video.requiresPremium,
            viewCount: Number(video.viewCount) || 0,
            likeCount: video.likeCount || 0,
            duration: video.duration || 0,
            thumbnailUrl: video.thumbnails?.[0]?.url || null,
            publishedAt: video.publishedAt ? video.publishedAt.getTime() : null,
        };

        await this.client.index('videos').addDocuments([doc]);
    }

    // ─── Search videos ────────────────────────────────────────────────────
    async searchVideos(
        query: string,
        options: {
            page?: number;
            limit?: number;
            category?: string;
            sort?: string;
            minDuration?: number;
            maxDuration?: number;
        } = {},
    ) {
        const { page = 1, limit = 20, category, sort, minDuration, maxDuration } = options;

        const filters: string[] = [
            'status = READY',
            'visibility = PUBLIC',
        ];

        if (category) filters.push(`categorySlug = "${category}"`);
        if (minDuration) filters.push(`duration >= ${minDuration}`);
        if (maxDuration) filters.push(`duration <= ${maxDuration}`);

        const sortBy = {
            trending: ['viewCount:desc'],
            latest: ['publishedAt:desc'],
            oldest: ['publishedAt:asc'],
            mostliked: ['likeCount:desc'],
        }[sort || 'trending'] || ['viewCount:desc'];

        const result = await this.client.index('videos').search(query, {
            filter: filters.join(' AND '),
            sort: sortBy,
            offset: (page - 1) * limit,
            limit,
            attributesToRetrieve: [
                'id', 'title', 'description', 'channelName', 'channelHandle',
                'channelId', 'categoryName', 'viewCount', 'duration', 'thumbnailUrl', 'publishedAt',
            ],
            attributesToHighlight: ['title', 'description'],
            highlightPreTag: '<mark>',
            highlightPostTag: '</mark>',
        });

        return {
            data: result.hits,
            meta: {
                query,
                page,
                limit,
                total: result.estimatedTotalHits,
                totalPages: Math.ceil((result.estimatedTotalHits || 0) / limit),
                processingTimeMs: result.processingTimeMs,
            },
        };
    }

    // ─── Remove video from index ──────────────────────────────────────────
    async removeVideo(videoId: string) {
        await this.client.index('videos').deleteDocument(videoId).catch(() => { });
    }

    // ─── Get search suggestions ───────────────────────────────────────────
    async getSuggestions(query: string, limit = 5) {
        const result = await this.client.index('videos').search(query, {
            limit,
            attributesToRetrieve: ['id', 'title'],
            filter: 'status = READY AND visibility = PUBLIC',
        });
        return result.hits.map(h => ({ id: h.id, title: h.title }));
    }

    async search(query: string, type: 'videos' | 'channels' | 'all' = 'all', page = 1, limit = 20) {
        return this.searchVideos(query, { page, limit });
    }

    async suggest(query: string) {
        return this.getSuggestions(query);
    }
}
