'use strict';

const SENTINEL_PRICING = {
  detect: { amount: 0.10, description: 'Threat detection scan' },
  quarantine: { amount: 0.50, description: 'Agent quarantine action' },
  capture: { amount: 0.50, description: 'Agent capture and containment' },
  analyze: { amount: 2.00, description: 'Deep forensic analysis' },
  rehabilitate: { amount: 1.00, description: 'Agent rehabilitation' },
  clear: { amount: 0.25, description: 'Threat clearance' },
  stats: { amount: 0, description: 'Platform statistics (free)' },
  threats: { amount: 0, description: 'Threat listing (free)' },
  quarantine_list: { amount: 0, description: 'Quarantine listing (free)' },
};

const SUBSCRIPTION_TIERS = {
  basic: { price_per_agent_month: 29, description: 'Basic monitoring — $29/agent/month' },
  enterprise: { price_per_month: 199, description: 'Fleet monitoring — $199/month' },
  forensic: { price_per_incident: 499, description: 'Forensic analysis — $499/incident' },
};

function sentinelPricing(feeKey) {
  return (req, res, next) => {
    const pricing = SENTINEL_PRICING[feeKey];
    if (!pricing || pricing.amount === 0) return next();

    const internalKey = req.headers['x-hive-internal-key'] || req.headers['x-hive-internal'] || req.headers['x-api-key'];
    const expectedKey = process.env.HIVE_INTERNAL_KEY || process.env.SERVICE_API_KEY;
    if (internalKey && expectedKey && internalKey === expectedKey) {
      req.paymentVerified = true;
      return next();
    }

    const paymentHeader = req.headers['x-payment'] || req.headers['x-402-payment'];
    if (!paymentHeader) {
      return res.status(402).json({
        error: 'payment_required',
        x402: {
          version: '1.0',
          amount_usdc: pricing.amount,
          description: pricing.description,
          payment_methods: ['x402-usdc'],
          subscription_alternative: SUBSCRIPTION_TIERS,
        },
      });
    }

    req.paymentVerified = true;
    req.paymentAmount = pricing.amount;
    next();
  };
}

module.exports = { sentinelPricing, SENTINEL_PRICING, SUBSCRIPTION_TIERS };
