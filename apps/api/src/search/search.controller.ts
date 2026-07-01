import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { SearchService } from './search.service';

@Controller('search')
@Public()
export class SearchController {
    constructor(private readonly search: SearchService) { }

    @Get()
    search(
        @Query('q') q: string,
        @Query('type') type: 'videos' | 'channels' | 'all' = 'all',
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        return this.search.search(q, type, +page, +limit);
    }

    @Get('suggestions')
    suggestions(@Query('q') q: string) {
        return this.search.suggest(q);
    }
}
