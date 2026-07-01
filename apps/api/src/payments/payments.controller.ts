import {
    Controller, Post, Get, Body, Headers, RawBodyRequest, Req, UseGuards
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
    constructor(private readonly payments: PaymentsService) { }

    @Post('checkout')
    @UseGuards(JwtAuthGuard)
    createCheckout(
        @CurrentUser() user: any,
        @Body() body: { planId: 'MONTHLY' | 'ANNUAL' | 'FAMILY' },
    ) {
        return this.payments.createCheckoutSession(user.id, body.planId);
    }

    @Post('portal')
    @UseGuards(JwtAuthGuard)
    createPortal(@CurrentUser() user: any) {
        return this.payments.createPortalSession(user.id);
    }

    @Post('connect')
    @UseGuards(JwtAuthGuard)
    connectAccount(@CurrentUser() user: any) {
        return this.payments.createConnectAccount(user.id);
    }

    @Post('webhook')
    @Public()
    webhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers('stripe-signature') sig: string,
    ) {
        return this.payments.handleWebhook(req.rawBody!, sig);
    }
}
