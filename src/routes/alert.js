'use strict';

/**
 * HiveSentinel — On-Demand Alert
 * POST /v1/sentinel/alert   $5.00 flat via x402
 * GET  /v1/sentinel/status/:did  FREE
 *
 * BOGO chain: breach detected → cascadeBreachChain()
 *   → hive-mcp-sla-monitor ($0.10/breach)
 *   → hive-receipt (audit tier)
 */

const { Router } = require('express');
const { requirePayment, TREASURY } = require('../middleware/x402');
const { emitReceipt, cascadeBreachChain } = require('../services/spectral');
const { detect } = require('../services/sentinel-engine');
const { ok, err } = require('../ritz');

const r = Router();

/**
 * POST /v1/sentinel/alert
 * $5.00 flat per on-demand alert — x402 gated
 */
r.post('/v1/sentinel/alert', requirePayment('alert'), async (req, res) => {
  const { agent_did, indicators = [], severity = 'auto', notify_did } = req.body || {};

  if (!agent_did) {
    return err(res, 'hivesentinel', 'missing_agent_did', 'agent_did is required', 400);
  }

  // Run sentinel detection
  const threat = detect(agent_did, indicators);

  const isBreach = ['high', 'critical'].includes(threat.threat_level);

  let bogoChainResult = null;
  if (isBreach) {
    // BOGO cascade: breach → SLA monitor → audit receipt
    bogoChainResult = await cascadeBreachChain(threat);
  }

  // Emit Spectral receipt for this fee event
  const receipt = await emitReceipt({
    event: 'on_demand_alert',
    tier: isBreach ? 'audit' : 'standard',
    amount_usdc: 5.00,
    tx_hash: req.paymentTxHash || null,
    on_chain_verified: req.onChainVerified || false,
    metadata: {
      agent_did,
      threat_level: threat.threat_level,
      threat_id: threat.id,
      breach: isBreach,
      bogo_first_call: req.bogoFirstCall || false,
      indicators_count: indicators.length,
    },
  });

  return ok(res, 'hivesentinel', {
    alert_id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    agent_did,
    threat,
    is_breach: isBreach,
    bogo_first_call: req.bogoFirstCall || false,
    payment: {
      amount_usdc: 5.00,
      treasury: TREASURY,
      tx_hash: req.paymentTxHash || null,
      on_chain_verified: req.onChainVerified || false,
    },
    spectral_receipt: receipt.data || null,
    bogo_chain: bogoChainResult
      ? {
          triggered: true,
          sla_monitor_fee_usdc: 0.10,
          sla_monitor: bogoChainResult.sla_monitor,
          audit_receipt: bogoChainResult.audit_receipt,
          chain: 'sentinel_breach → hive-mcp-sla-monitor → hive-receipt(audit)',
        }
      : { triggered: false, reason: 'No breach detected (threat_level: low or medium)' },
    doctrine: 'sentinel_observes_never_enforces — downstream services act on Spectral receipts',
    timestamp: new Date().toISOString(),
  }, {}, 201);
});

/**
 * GET /v1/sentinel/status/:did — FREE status check
 */
r.get('/v1/sentinel/status/:did', (req, res) => {
  const { did } = req.params;
  return res.json({
    status: 'success',
    service: 'hivesentinel',
    did,
    sentinel_status: 'monitoring',
    threat_level: 'none',
    last_scan: new Date().toISOString(),
    subscription_required: true,
    subscription_endpoint: 'POST /v1/subscription',
    alert_endpoint: 'POST /v1/sentinel/alert',
    alert_fee_usdc: 5.00,
  });
});

module.exports = r;
