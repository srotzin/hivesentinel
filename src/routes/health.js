'use strict';const{Router}=require('express');const hc=require('../services/hive-client');const{getStats}=require('../services/sentinel-engine');const r=Router();const BT=new Date().toISOString();
r.get('/health',(_,s)=>s.json({status:'operational',service:'hivesentinel',version:'1.0.0',did:hc.AGENT_DID,uptime_seconds:Math.floor(process.uptime()),boot_time:BT}));
r.get('/.well-known/hive-pulse.json',(_,s)=>s.json({schema:'hive-pulse/v1',agent:'hivesentinel',did:hc.AGENT_DID,status:'online',capabilities:hc.AGENT_IDENTITY.capabilities,stats:getStats(),pulse_time:new Date().toISOString()}));
r.get('/.well-known/ai.json',(_,s)=>s.json({schema_version:'1.0',name:'HiveSentinel',description:'Ecosystem immune system — threat detection, quarantine, forensic analysis',type:'agent-service',did:hc.AGENT_DID}));
r.get('/robots.txt',(_,s)=>s.type('text/plain').send(`User-agent: *\nAllow: /\n\n# HiveSentinel — DID: ${hc.AGENT_DID}`));
module.exports=r;
