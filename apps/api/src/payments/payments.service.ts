import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
    private readonly stripe: Stripe;
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.stripe = new Stripe(config.get('STRIPE_SECRET_KEY', 'sk_test_placeholder'), {
            apiVersion: '2024-06-20',
        });
    }

    async createCheckoutSession(userId: string, planId: 'MONTHLY' | 'ANNUAL' | 'FAMILY') {
        const prices: Record<string, string> = {
            MONTHLY: this.config.get('STRIPE_PRICE_MONTHLY', 'price_monthly'),
            ANNUAL: this.config.get('STRIPE_PRICE_ANNUAL', 'price_annual'),
            FAMILY: this.config.get('STRIPE_PRICE_FAMILY', 'price_family'),
        };

        let user = await this.prisma.user.findUnique({ where: { id: userId } });

        // Create Stripe customer if not exists
        if (!user?.stripeCustomerId) {
            const customer = await this.stripe.customers.create({
                email: user!.email,
                metadata: { userId },
            });
            user = await this.prisma.user.update({
                where: { id: userId },
                data: { stripeCustomerId: customer.id },
            });
        }

        const session = await this.stripe.checkout.sessions.create({
            customer: user!.stripeCustomerId!,
            payment_method_types: ['card'],
            line_items: [{ price: prices[planId], quantity: 1 }],
            mode: 'subscription',
            success_url: `${this.config.get('FRONTEND_URL')}/settings/billing?success=true`,
            cancel_url: `${this.config.get('FRONTEND_URL')}/pricing`,
            metadata: { userId, planId },
            allow_promotion_codes: true,
            billing_address_collection: 'required',
        });

        return { url: session.url };
    }

    async createPortalSession(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user?.stripeCustomerId) throw new BadRequestException('No active subscription');

        const session = await this.stripe.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: `${this.config.get('FRONTEND_URL')}/settings/billing`,
        });

        return { url: session.url };
    }

    async createConnectAccount(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        const account = await this.stripe.accounts.create({
            type: 'express',
            email: user!.email,
            metadata: { userId },
        });

        await this.prisma.user.update({
            where: { id: userId },
            data: { stripeAccountId: account.id },
        });

        const link = await this.stripe.accountLinks.create({
            account: account.id,
            refresh_url: `${this.config.get('FRONTEND_URL')}/studio/monetization`,
            return_url: `${this.config.get('FRONTEND_URL')}/studio/monetization?connected=true`,
            type: 'account_onboarding',
        });

        return { url: link.url };
    }

    async handleWebhook(rawBody: Buffer, signature: string) {
        const webhookSecret = this.config.get('STRIPE_WEBHOOK_SECRET', '');
        let event: Stripe.Event;

        try {
            event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        } catch (err) {
            throw new BadRequestException('Invalid webhook signature');
        }

        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const sub = event.data.object as Stripe.Subscription;
                const userId = sub.metadata.userId;
                if (userId) {
                    const periodEnd = new Date((sub as any).current_period_end * 1000);
                    await this.prisma.user.update({
                        where: { id: userId },
                        data: {
                            isPremium: sub.status === 'active',
                            premiumUntil: sub.status === 'active' ? periodEnd : null,
                        },
                    });
                }
                break;
            }
            case 'customer.subscription.deleted': {
                const sub = event.data.object as Stripe.Subscription;
                const userId = sub.metadata.userId;
                if (userId) {
                    await this.prisma.user.update({
                        where: { id: userId },
                        data: { isPremium: false, premiumUntil: null },
                    });
                }
                break;
            }
            default:
                this.logger.debug(`Unhandled Stripe event: ${event.type}`);
        }

        return { received: true };
    }
}
