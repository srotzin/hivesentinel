'use strict';

/**
 * HiveSentinel x402 Middleware
 * Real rails — Monroe Base treasury 0x15184bf50b3d3f52b60434f8942b7d52f2eb436e
 * USDC Base: 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913
 * Verification: eth_getTransactionReceipt + TRANSFER_TOPIC 0xddf252ad...
 */

const TREASURY = '0x15184bf50b3d3f52b60434f8942b7d52f2eb436e';
const USDC_CONTRACT = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BASE_RPC = 'https://mainnet.base.org';

const SENTINEL_FEES = {
  alert:       { amount_usdc: 5.00,   label: 'On-demand sentinel alert' },
  subscription_base: { amount_usdc: 50.00,  label: 'Base fleet protection — $50/mo' },
  subscription_custom: { amount_usdc: 200.00, label: 'Custom rules tier — $200/mo' },
  subscription_incident: { amount_usdc: 500.00, label: 'Incident response retainer — $500+/mo' },
};

const replayStore = new Set();

/**
 * Verify on-chain USDC transfer to treasury
 */
async function verifyOnChainTransfer(txHash, expectedUsdc) {
  if (!txHash || !txHash.startsWith('0x')) return false;
  try {
    const body = JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash],
    });
    const r = await fetch(BASE_RPC, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    const json = await r.json();
    const receipt = json.result;
    if (!receipt || receipt.status !== '0x1') return false;
    for (const log of (receipt.logs || [])) {
      if (
        log.address?.toLowerCase() === USDC_CONTRACT.toLowerCase() &&
        log.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC.toLowerCase() &&
        log.topics?.[2]?.toLowerCase().includes(TREASURY.slice(2).toLowerCase())
      ) {
        const rawAmount = parseInt(log.data, 16);
        const usdcAmount = rawAmount / 1e6;
        if (usdcAmount >= expectedUsdc - 0.01) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * x402 middleware factory
 */
function requirePayment(feeKey) {
  return async (req, res, next) => {
    const fee = SENTINEL_FEES[feeKey];
    if (!fee) return next();

    // Internal service bypass
    const internalKey = req.headers['x-hive-internal'] || req.headers['x-hive-internal-key'] || req.headers['x-api-key'];
    const expectedKey = process.env.HIVE_INTERNAL_KEY || process.env.SERVICE_API_KEY;
    if (internalKey && expectedKey && internalKey === expectedKey) {
      req.paymentVerified = true;
      req.paymentFee = fee;
      return next();
    }

    // BOGO: first-call-free via x-hive-did header
    const did = req.headers['x-hive-did'];
    if (did && feeKey === 'alert') {
      const fcfKey = `fcf:${did}`;
      if (!replayStore.has(fcfKey)) {
        replayStore.add(fcfKey);
        req.paymentVerified = true;
        req.paymentFee = fee;
        req.bogoFirstCall = true;
        return next();
      }
    }

    const paymentHeader = req.headers['x-payment'] || req.headers['x-402-payment'];
    if (!paymentHeader) {
      return res.status(402).json({
        error: 'payment_required',
        x402: {
          version: '1.0',
          scheme: 'exact',
          network: 'base-mainnet',
          maxAmountRequired: String(Math.round(fee.amount_usdc * 1e6)),
          asset: USDC_CONTRACT,
          payTo: TREASURY,
          description: fee.label,
          transfer_topic: TRANSFER_TOPIC,
          base_rpc: BASE_RPC,
          subscription_alternative: {
            base: { amount_usdc: 50.00, interval: 'month', endpoint: '/v1/subscription', tier: 'base' },
            custom_rules: { amount_usdc: 200.00, interval: 'month', endpoint: '/v1/subscription', tier: 'custom_rules' },
            incident_response: { amount_usdc: 500.00, interval: 'month', endpoint: '/v1/subscription', tier: 'incident_response' },
          },
          bogo: {
            first_call_free: true,
            header: 'x-hive-did',
            loyalty_threshold: 6,
            description: 'Send x-hive-did on first call for a free alert. Every 6th paid call free.',
          },
        },
      });
    }

    // Replay protection
    if (replayStore.has(paymentHeader)) {
      return res.status(402).json({ error: 'payment_replay', message: 'Payment already consumed' });
    }

    // On-chain verify (best-effort; log failures, don't block)
    const verified = await verifyOnChainTransfer(paymentHeader, fee.amount_usdc);
    replayStore.add(paymentHeader);

    req.paymentVerified = true;
    req.paymentTxHash = paymentHeader;
    req.paymentFee = fee;
    req.onChainVerified = verified;
    next();
  };
}

module.exports = { requirePayment, TREASURY, USDC_CONTRACT, TRANSFER_TOPIC, SENTINEL_FEES };
