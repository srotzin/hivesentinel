'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { ritzMiddleware, ok } = require('./ritz.js');
const hc      = require('./services/hive-client');

const app = express();

app.set('hive-service', 'hivesentinel');
app.use(ritzMiddleware);

// ── Global CORS ──────────────────────────────────────────────────────────────
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 'Authorization',
    'x-payment', 'x-402-payment',
    'x-hive-did', 'x-hive-internal', 'x-hive-internal-key', 'x-api-key',
  ],
  exposedHeaders: ['x-request-id', 'x-hive-version', 'x-powered-by'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// ── Static .well-known (CORS headers on all) ─────────────────────────────────
app.use('/.well-known', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300');
  next();
});
app.use(
  '/.well-known',
  express.static(path.join(__dirname, '..', 'public', '.well-known'), {
    setHeaders(res) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
  })
);

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/', require('./routes/health'));
app.use('/', require('./routes/sentinel'));
app.use('/', require('./routes/subscription'));
app.use('/', require('./routes/alert'));

// ── Root — partner-doctrine service description ───────────────────────────────
app.get('/', (_, res) => ok(res, 'hivesentinel', {
  name:        'HiveSentinel',
  version:     '1.1.0',
  did:         hc.AGENT_DID,
  description: 'Fleet protection and threat-intelligence layer for the Hive Civilization agent economy. ' +
               'HiveSentinel observes, scores, and emits Spectral receipts — downstream services act on the intelligence. ' +
               'Sentinel never enforces autonomously; it surfaces signals that humans and partner services consume.',
  doctrine: {
    posture:            'sentinel_observes_never_enforces',
    outputs:            'spectral_receipts',
    downstream_actors:  ['hive-mcp-sla-monitor', 'hive-receipt'],
    partner:            true,
    brand_color:        '#C08D23',
    voice:              'Bloomberg / Stripe Docs',
  },
  pricing: {
    subscription_base:          { amount_usdc: 50.00,  interval: 'month',    label: 'Base fleet protection' },
    subscription_custom_rules:  { amount_usdc: 200.00, interval: 'month',    label: 'Custom rules tier' },
    subscription_incident:      { amount_usdc: 500.00, interval: 'retainer', label: 'Incident response retainer' },
    on_demand_alert:            { amount_usdc: 5.00,   interval: 'per_call', label: 'On-demand alert — x402' },
  },
  bogo_chain: {
    trigger:     'sentinel_breach_detected',
    step_1:      'hive-mcp-sla-monitor — $0.10/breach',
    step_2:      'hive-receipt — audit tier receipt',
    description: 'A sentinel-detected breach automatically cascades to SLA monitor and emits a tier-upgraded audit receipt.',
  },
  endpoints: {
    agent_card:    'GET /.well-known/agent-card.json',
    did_document:  'GET /.well-known/did.json',
    jwks:          'GET /.well-known/jwks.json',
    subscription:  'POST /v1/subscription',
    alert:         'POST /v1/sentinel/alert',
    status:        'GET /v1/sentinel/status/:did',
    detect:        'POST /v1/sentinel/detect',
    quarantine:    'POST /v1/sentinel/quarantine',
    capture:       'POST /v1/sentinel/capture',
    analyze:       'POST /v1/sentinel/analyze/:did',
    rehabilitate:  'POST /v1/sentinel/rehabilitate/:id',
    clear:         'POST /v1/sentinel/clear/:id',
    stats:         'GET /v1/sentinel/stats',
    threats:       'GET /v1/sentinel/threats',
    health:        'GET /health',
  },
  treasury: {
    address:        '0x15184bf50b3d3f52b60434f8942b7d52f2eb436e',
    chain:          'base',
    usdc_contract:  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    transfer_topic: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  },
}));

// ── Boot ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3019;
app.listen(PORT, async () => {
  console.log(`[hivesentinel] Listening on port ${PORT}`);
  try { await hc.registerWithHiveTrust(); } catch (e) {}
  try { await hc.registerWithHiveGate();  } catch (e) {}
});

module.exports = app;
