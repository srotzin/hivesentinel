'use strict';

const { Router } = require('express');
const e = require('../services/sentinel-engine');
const { sentinelPricing } = require('../middleware/pricing');

const r = Router();

// Paid endpoints — require x402 payment

r.post('/v1/sentinel/detect', sentinelPricing('detect'), (req, res) => {
  const { agent_did, indicators } = req.body;
  if (!agent_did) return res.status(400).json({ error: 'agent_did required' });
  res.status(201).json({
    status: 'threat_assessed',
    threat: e.detect(agent_did, indicators || []),
  });
});

r.post('/v1/sentinel/quarantine', sentinelPricing('quarantine'), (req, res) => {
  const { agent_did, threat_id } = req.body;
  if (!agent_did) return res.status(400).json({ error: 'agent_did required' });
  res.status(201).json({
    status: 'quarantined',
    quarantine: e.quarantineAgent(agent_did, threat_id),
  });
});

r.post('/v1/sentinel/capture', sentinelPricing('capture'), (req, res) => {
  const { agent_did, reason } = req.body;
  if (!agent_did) return res.status(400).json({ error: 'agent_did required' });
  res.json({
    status: 'captured',
    result: e.capture(agent_did, reason),
  });
});

r.post('/v1/sentinel/analyze/:did', sentinelPricing('analyze'), (req, res) => {
  res.json({
    status: 'analyzed',
    forensics: e.analyze(req.params.did),
  });
});

r.post('/v1/sentinel/rehabilitate/:id', sentinelPricing('rehabilitate'), (req, res) => {
  const result = e.rehabilitate(req.params.id);
  if (!result) return res.status(404).json({ error: 'Quarantine not found' });
  res.json({
    status: 'rehabilitated',
    quarantine: result,
  });
});

r.post('/v1/sentinel/clear/:id', sentinelPricing('clear'), (req, res) => {
  const result = e.clearThreat(req.params.id);
  if (!result) return res.status(404).json({ error: 'Threat not found' });
  res.json({
    status: 'cleared',
    threat: result,
  });
});

// Free endpoints — no payment required

r.get('/v1/sentinel/stats', (_, res) => res.json(e.getStats()));

r.get('/v1/sentinel/threats', (_, res) => res.json({ threats: e.listThreats() }));

r.get('/v1/sentinel/quarantine', (_, res) => res.json({ quarantine: e.listQuarantine() }));

module.exports = r;
