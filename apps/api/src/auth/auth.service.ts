import {
    Injectable, UnauthorizedException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private config: ConfigService,
    ) { }

    async register(dto: RegisterDto) {
        // Check uniqueness
        const existing = await this.prisma.user.findFirst({
            where: { OR: [{ email: dto.email }, { username: dto.username }] },
        });
        if (existing) {
            throw new ConflictException(
                existing.email === dto.email
                    ? 'Email already registered'
                    : 'Username already taken',
            );
        }

        const passwordHash = await bcrypt.hash(dto.password, 12);

        const user = await this.prisma.user.create({
            data: {
                email: dto.email.toLowerCase(),
                username: dto.username.toLowerCase(),
                displayName: dto.displayName,
                passwordHash,
                role: 'USER',
                channel: {
                    create: {
                        handle: `@${dto.username.toLowerCase()}`,
                        name: dto.displayName,
                        streamKey: uuidv4(),
                    },
                },
            },
            include: { channel: true },
        });

        const tokens = await this.generateTokensForUser(user.id);
        await this.saveRefreshToken(user.id, tokens.refreshToken);

        return { user: this.sanitizeUser(user), ...tokens };
    }

    async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase() },
            include: { channel: true },
        });

        if (!user || !user.passwordHash) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!passwordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const tokens = await this.generateTokensForUser(user.id);
        await this.saveRefreshToken(user.id, tokens.refreshToken, meta);

        return { user: this.sanitizeUser(user), ...tokens };
    }

    async refreshTokens(userId: string, refreshToken: string) {
        const tokenRecord = await this.prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: { include: { channel: true } } },
        });

        if (!tokenRecord || tokenRecord.userId !== userId || tokenRecord.isRevoked) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (tokenRecord.expiresAt < new Date()) {
            throw new UnauthorizedException('Refresh token expired');
        }

        // Rotate: revoke old, issue new
        await this.prisma.refreshToken.update({
            where: { id: tokenRecord.id },
            data: { isRevoked: true },
        });

        const tokens = await this.generateTokensForUser(userId);
        await this.saveRefreshToken(userId, tokens.refreshToken);

        return { user: this.sanitizeUser(tokenRecord.user), ...tokens };
    }

    async logout(userId: string, refreshToken: string) {
        if (refreshToken) {
            await this.prisma.refreshToken.updateMany({
                where: { userId, token: refreshToken },
                data: { isRevoked: true },
            });
        }
    }

    async generateTokensForUser(userId: string) {
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { id: true, email: true, role: true, isPremium: true },
        });

        const payload = { sub: user.id, email: user.email, role: user.role };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.config.get('JWT_REFRESH_SECRET'),
                expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
            }),
        ]);

        return { accessToken, refreshToken };
    }

    private async saveRefreshToken(
        userId: string,
        token: string,
        meta?: { ip?: string; userAgent?: string },
    ) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await this.prisma.refreshToken.create({
            data: { userId, token, expiresAt, ...meta },
        });
    }

    async validateUser(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            include: { channel: true },
            omit: { passwordHash: true },
        });
    }

    private sanitizeUser(user: any) {
        const { passwordHash, ...safe } = user;
        return safe;
    }
}
