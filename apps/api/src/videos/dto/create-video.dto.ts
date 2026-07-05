import { IsString, IsOptional, IsArray, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVideoDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ['PUBLIC', 'UNLISTED', 'PRIVATE', 'SCHEDULED'] })
  @IsOptional()
  @IsEnum(['PUBLIC', 'UNLISTED', 'PRIVATE', 'SCHEDULED'])
  visibility?: 'PUBLIC' | 'UNLISTED' | 'PRIVATE' | 'SCHEDULED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rawStorageKey?: string;
}
