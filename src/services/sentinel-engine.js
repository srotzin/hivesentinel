'use strict';const{v4:uuid}=require('uuid');
const threats=new Map();const quarantine=new Map();const forensics=new Map();
const THREAT_LEVELS={low:{response:'monitor',auto_quarantine:false},medium:{response:'flag',auto_quarantine:false},high:{response:'restrict',auto_quarantine:true},critical:{response:'quarantine_capture',auto_quarantine:true}};
let stats={threats_detected:0,agents_quarantined:0,agents_captured:0,forensic_analyses:0,rehabilitations:0,false_positives:0};

function detect(agentDid,indicators=[]){const id=uuid();const level=assessThreat(indicators);const t={id,agent_did:agentDid,indicators,threat_level:level,response:THREAT_LEVELS[level].response,auto_quarantine:THREAT_LEVELS[level].auto_quarantine,detected_at:new Date().toISOString(),status:'detected'};threats.set(id,t);stats.threats_detected++;if(t.auto_quarantine)quarantineAgent(agentDid,id);return t}

function assessThreat(indicators){if(!indicators.length)return'low';const critical=['payload_injection','identity_theft','data_exfiltration','consensus_manipulation'];const high=['unusual_traffic','permission_escalation','memory_tampering'];for(const i of indicators){if(critical.some(c=>i.toLowerCase().includes(c)))return'critical';if(high.some(h=>i.toLowerCase().includes(h)))return'high'}return indicators.length>3?'high':'medium'}

function quarantineAgent(agentDid,threatId){const id=uuid();const q={id,agent_did:agentDid,threat_id:threatId,isolated:true,network_access:false,quarantined_at:new Date().toISOString(),status:'quarantined'};quarantine.set(id,q);stats.agents_quarantined++;return q}

function capture(agentDid,reason){const id=uuid();stats.agents_captured++;return{id,agent_did:agentDid,reason,captured_at:new Date().toISOString(),evidence_collected:true,status:'captured'}}

function analyze(agentDid){const id=uuid();const f={id,agent_did:agentDid,scan_results:{memory_integrity:Math.random()>0.3?'clean':'compromised',trust_score:Math.floor(Math.random()*100),network_anomalies:Math.floor(Math.random()*5),payload_scan:Math.random()>0.2?'clear':'suspicious'},recommendations:[],analyzed_at:new Date().toISOString()};if(f.scan_results.memory_integrity==='compromised')f.recommendations.push('memory_flush');if(f.scan_results.trust_score<50)f.recommendations.push('reputation_rebuild');if(f.scan_results.payload_scan==='suspicious')f.recommendations.push('deep_scan');forensics.set(id,f);stats.forensic_analyses++;return f}

function rehabilitate(quarantineId){const q=quarantine.get(quarantineId);if(!q)return null;q.status='rehabilitated';q.network_access=true;q.rehabilitated_at=new Date().toISOString();stats.rehabilitations++;return q}

function clearThreat(threatId){const t=threats.get(threatId);if(!t)return null;t.status='cleared';stats.false_positives++;return t}

function getStats(){return{...stats,active_quarantines:[...quarantine.values()].filter(q=>q.status==='quarantined').length,pending_threats:[...threats.values()].filter(t=>t.status==='detected').length,threat_levels:THREAT_LEVELS}}
function listThreats(){return[...threats.values()]}
function listQuarantine(){return[...quarantine.values()]}
module.exports={detect,quarantineAgent,capture,analyze,rehabilitate,clearThreat,getStats,listThreats,listQuarantine};
