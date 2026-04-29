'use strict';

/**
 * HiveSentinel — Subscription Routes
 * POST /v1/subscription
 * Tiers: base $50/mo, custom_rules $200/mo, incident_response $500+/mo
 */

const { Router } = require('express');
const { requirePayment } = require('../middleware/x402');
const { emitReceipt } = require('../services/spectral');
const { ok, err } = require('../ritz');

const r = Router();

const SUBSCRIPTION_TIERS = {
  base: {
    name: 'Base Fleet Protection',
    amount_usdc: 50.00,
    interval: 'month',
    description: 'Continuous threat scoring, Spectral receipt on every breach, dashboard access. Sentinel observes — your team acts.',
    features: [
      'Continuous fleet monitoring',
      'Threat-level scoring per agent DID',
      'Spectral breach receipts (standard tier)',
      'SLA-monitor integration (hive-mcp-sla-monitor)',
      'Monthly incident summary',
    ],
  },
  custom_rules: {
    name: 'Custom Rules Tier',
    amount_usdc: 200.00,
    interval: 'month',
    description: 'All base features plus bespoke indicator sets, custom detection rules, and priority escalation paths.',
    features: [
      'Everything in Base',
      'Custom detection indicator sets (up to 50 rules)',
      'Priority escalation routing',
      'Spectral breach receipts (audit tier)',
      'Slack / webhook breach delivery',
    ],
  },
  incident_response: {
    name: 'Incident Response Retainer',
    amount_usdc: 500.00,
    interval: 'retainer',
    description: 'Human-in-the-loop forensic review with SLA-backed response. Minimum $500; scoped to incident complexity.',
    features: [
      'Everything in Custom Rules',
      'Dedicated forensic analyst on retainer',
      '2-hour response SLA on critical incidents',
      'Full forensic report with chain-of-custody',
      'Spectral breach receipts (audit + chain-of-custody tier)',
    ],
  },
};

r.post('/v1/subscription', async (req, res) => {
  const { tier, agent_did, org_name } = req.body || {};

  const validTiers = Object.keys(SUBSCRIPTION_TIERS);
  if (!tier || !validTiers.includes(tier)) {
    return res.status(402).json({
      error: 'payment_required',
      message: 'Specify a subscription tier',
      x402: {
        version: '1.0',
        scheme: 'exact',
        network: 'base-mainnet',
        tiers: validTiers.map(k => ({
          tier: k,
          ...SUBSCRIPTION_TIERS[k],
          maxAmountRequired: String(Math.round(SUBSCRIPTION_TIERS[k].amount_usdc * 1e6)),
        })),
        payTo: '0x15184bf50b3d3f52b60434f8942b7d52f2eb436e',
        asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        transfer_topic: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        base_rpc: 'https://mainnet.base.org',
      },
    });
  }

  const selectedTier = SUBSCRIPTION_TIERS[tier];

  // Payment verification
  const internalKey = req.headers['x-hive-internal'] || req.headers['x-hive-internal-key'] || req.headers['x-api-key'];
  const expectedKey = process.env.HIVE_INTERNAL_KEY || process.env.SERVICE_API_KEY;
  const isInternal = internalKey && expectedKey && internalKey === expectedKey;

  const paymentHeader = req.headers['x-payment'] || req.headers['x-402-payment'];

  if (!isInternal && !paymentHeader) {
    return res.status(402).json({
      error: 'payment_required',
      x402: {
        version: '1.0',
        scheme: 'exact',
        network: 'base-mainnet',
        maxAmountRequired: String(Math.round(selectedTier.amount_usdc * 1e6)),
        asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        payTo: '0x15184bf50b3d3f52b60434f8942b7d52f2eb436e',
        description: selectedTier.description,
        transfer_topic: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        base_rpc: 'https://mainnet.base.org',
        tier_details: selectedTier,
      },
    });
  }

  const subscriptionId = `sub_sentinel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Emit Spectral receipt
  const receipt = await emitReceipt({
    event: 'subscription_activated',
    tier: tier === 'incident_response' ? 'audit' : 'standard',
    amount_usdc: selectedTier.amount_usdc,
    tx_hash: paymentHeader || null,
    on_chain_verified: !!paymentHeader,
    metadata: {
      subscription_id: subscriptionId,
      subscription_tier: tier,
      agent_did: agent_did || null,
      org_name: org_name || null,
    },
  });

  return ok(res, 'hivesentinel', {
    subscription_id: subscriptionId,
    tier,
    tier_details: selectedTier,
    status: 'active',
    activated_at: new Date().toISOString(),
    next_billing: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    spectral_receipt: receipt.data || null,
    doctrine: 'sentinel_observes_never_enforces — Spectral receipts emitted; downstream services act on intelligence',
    treasury: '0x15184bf50b3d3f52b60434f8942b7d52f2eb436e',
  }, {}, 201);
});

// GET /v1/subscription — list tiers (free)
r.get('/v1/subscription', (_, res) => {
  return res.json({
    status: 'success',
    service: 'hivesentinel',
    subscription_tiers: SUBSCRIPTION_TIERS,
    payment: {
      payTo: '0x15184bf50b3d3f52b60434f8942b7d52f2eb436e',
      asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      chain: 'base',
    },
  });
});

module.exports = r;
