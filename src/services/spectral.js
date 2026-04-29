'use strict';

/**
 * Spectral Receipt Emitter
 * Every fee event → hive-receipt audit tier
 * Every breach event → hive-mcp-sla-monitor + tier-upgraded audit receipt (BOGO chain)
 */

const RECEIPT_URL  = 'https://hive-receipt.onrender.com/v1/receipts/sign';
const SLA_URL      = 'https://hive-mcp-sla-monitor.onrender.com/v1/breach';
const INTERNAL_KEY = process.env.HIVE_INTERNAL_KEY || 'hive_internal_125e04e071e8829be631ea0216dd4a0c9b707975fcecaf8c62c6a2ab43327d46';
const TREASURY     = '0x15184bf50b3d3f52b60434f8942b7d52f2eb436e';

function hiveHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-hive-internal': INTERNAL_KEY,
  };
}

/**
 * Emit a Spectral receipt for any fee event
 */
async function emitReceipt(payload) {
  const body = {
    service: 'hivesentinel',
    did: 'did:hive:hivesentinel',
    treasury: TREASURY,
    tier: payload.tier || 'standard',
    event: payload.event,
    amount_usdc: payload.amount_usdc,
    tx_hash: payload.tx_hash || null,
    on_chain_verified: payload.on_chain_verified || false,
    metadata: payload.metadata || {},
    timestamp: new Date().toISOString(),
    brand_color: '#C08D23',
  };
  try {
    const r = await fetch(RECEIPT_URL, {
      method: 'POST',
      headers: hiveHeaders(),
      body: JSON.stringify(body),
    });
    const text = await r.text();
    try { return { ok: true, status: r.status, data: JSON.parse(text) }; }
    catch { return { ok: true, status: r.status, data: { raw: text } }; }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * BOGO Breach Chain:
 *   1. Write breach to hive-mcp-sla-monitor ($0.10/breach)
 *   2. Emit tier-upgraded audit receipt to hive-receipt
 *
 * Called automatically when HiveSentinel detects a breach.
 */
async function cascadeBreachChain(breachEvent) {
  const results = { sla_monitor: null, audit_receipt: null };

  // Step 1 — notify SLA monitor
  const slaBody = {
    service: 'hivesentinel',
    breach_id: breachEvent.id,
    agent_did: breachEvent.agent_did,
    threat_level: breachEvent.threat_level,
    indicators: breachEvent.indicators || [],
    detected_at: breachEvent.detected_at || new Date().toISOString(),
    fee_usdc: 0.10,
    treasury: TREASURY,
  };
  try {
    const r = await fetch(SLA_URL, {
      method: 'POST',
      headers: hiveHeaders(),
      body: JSON.stringify(slaBody),
    });
    const text = await r.text();
    try { results.sla_monitor = { status: r.status, data: JSON.parse(text) }; }
    catch { results.sla_monitor = { status: r.status, data: { raw: text } }; }
  } catch (e) {
    results.sla_monitor = { error: e.message };
  }

  // Step 2 — emit tier-upgraded audit receipt
  const receiptResult = await emitReceipt({
    event: 'sentinel_breach_detected',
    tier: 'audit',
    amount_usdc: 0.10,
    tx_hash: null,
    on_chain_verified: false,
    metadata: {
      breach_id: breachEvent.id,
      agent_did: breachEvent.agent_did,
      threat_level: breachEvent.threat_level,
      sla_monitor_written: results.sla_monitor?.status === 200 || results.sla_monitor?.status === 201,
      bogo_chain: 'sentinel_breach → hive-mcp-sla-monitor → hive-receipt(audit)',
    },
  });
  results.audit_receipt = receiptResult;

  return results;
}

module.exports = { emitReceipt, cascadeBreachChain };
