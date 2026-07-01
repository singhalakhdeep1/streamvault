import Link from 'next/link';
import { Check, Zap } from 'lucide-react';

const PLANS = [
    {
        id: 'monthly',
        name: 'Monthly',
        price: '₹199',
        period: '/month',
        desc: 'Perfect for casual viewers',
        features: [
            'Ad-free viewing',
            'HD & 4K streaming',
            'Background play',
            'Offline downloads',
            'Premium content access',
        ],
        cta: 'Start Monthly',
        highlight: false,
    },
    {
        id: 'annual',
        name: 'Annual',
        price: '₹1,499',
        period: '/year',
        badge: 'Best Value — Save 37%',
        desc: 'For serious streamers',
        features: [
            'Everything in Monthly',
            'Priority support',
            'Exclusive creator content',
            'Early feature access',
            '2 months free',
        ],
        cta: 'Start Annual',
        highlight: true,
    },
    {
        id: 'family',
        name: 'Family',
        price: '₹399',
        period: '/month',
        desc: 'Up to 5 family members',
        features: [
            'Everything in Annual',
            '5 separate profiles',
            'Parental controls',
            'Shared watch lists',
            'Per-profile recommendations',
        ],
        cta: 'Start Family Plan',
        highlight: false,
    },
];

export default function PricingPage() {
    return (
        <div className="max-w-5xl mx-auto px-4 py-12">
            <div className="text-center mb-12">
                <div className="flex items-center justify-center gap-2 mb-4">
                    <Zap className="w-6 h-6 text-yellow-400" />
                    <span className="text-yellow-400 font-semibold text-sm uppercase tracking-wider">StreamVault Premium</span>
                </div>
                <h1 className="text-4xl font-bold text-white mb-4">Go Premium</h1>
                <p className="text-gray-400 max-w-md mx-auto">
                    Unlock the full StreamVault experience. No ads, better quality, exclusive content.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLANS.map((plan) => (
                    <div
                        key={plan.id}
                        className={`relative rounded-2xl border p-7 flex flex-col ${plan.highlight
                                ? 'border-white bg-white/5 ring-1 ring-white/20'
                                : 'border-gray-800 bg-[#111]'
                            }`}
                    >
                        {plan.badge && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <span className="bg-white text-black text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                                    {plan.badge}
                                </span>
                            </div>
                        )}

                        <h2 className="text-white font-bold text-lg mb-1">{plan.name}</h2>
                        <p className="text-gray-500 text-sm mb-5">{plan.desc}</p>

                        <div className="mb-6">
                            <span className="text-4xl font-bold text-white">{plan.price}</span>
                            <span className="text-gray-500 text-sm">{plan.period}</span>
                        </div>

                        <ul className="space-y-3 mb-8 flex-1">
                            {plan.features.map((f) => (
                                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-300">
                                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                                    {f}
                                </li>
                            ))}
                        </ul>

                        <form action="/api/checkout" method="POST">
                            <input type="hidden" name="plan" value={plan.id} />
                            <button
                                type="submit"
                                className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${plan.highlight
                                        ? 'bg-white text-black hover:bg-gray-200'
                                        : 'bg-gray-800 text-white hover:bg-gray-700'
                                    }`}
                            >
                                {plan.cta}
                            </button>
                        </form>
                    </div>
                ))}
            </div>

            <p className="text-center text-gray-600 text-xs mt-8">
                Cancel anytime. All plans include a 7-day free trial.
            </p>
        </div>
    );
}
