import {
    Controller, Post, Body, Get, UseGuards, Req,
    HttpCode, HttpStatus, Res, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../common/guards/jwt-refresh.guard';
import { GoogleAuthGuard } from '../common/guards/google-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Public()
    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Register new user' })
    async register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login with email and password' })
    async login(@Body() dto: LoginDto, @Req() req: Request) {
        return this.authService.login(dto, {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }

    @Public()
    @UseGuards(JwtRefreshGuard)
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Refresh access token using refresh token' })
    async refresh(@Req() req: Request) {
        const user = req.user as { id: string; refreshToken: string };
        return this.authService.refreshTokens(user.id, user.refreshToken);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Logout and revoke refresh token' })
    async logout(@CurrentUser('id') userId: string, @Body('refreshToken') refreshToken: string) {
        await this.authService.logout(userId, refreshToken);
        return { message: 'Logged out successfully' };
    }

    @Public()
    @Get('google')
    @UseGuards(GoogleAuthGuard)
    @ApiOperation({ summary: 'Initiate Google OAuth flow' })
    googleAuth() {
        // Handled by GoogleAuthGuard
    }

    @Public()
    @Get('google/callback')
    @UseGuards(GoogleAuthGuard)
    @ApiOperation({ summary: 'Google OAuth callback' })
    async googleCallback(@Req() req: Request, @Res() res: Response) {
        const user = req.user as { id: string };
        const tokens = await this.authService.generateTokensForUser(user.id);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(
            `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
        );
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('me')
    @ApiOperation({ summary: 'Get current authenticated user' })
    async getMe(@CurrentUser() user: any) {
        return user;
    }
}
