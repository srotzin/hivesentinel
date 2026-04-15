'use strict';const express=require('express');const cors=require('cors');const app=express();const PORT=process.env.PORT||3019;
app.use(cors());app.use(express.json());app.use('/',require('./routes/health'));app.use('/',require('./routes/sentinel'));
app.get('/',(_,r)=>r.json({service:'hivesentinel',version:'1.0.0',description:'Ecosystem immune system — threat detection, quarantine, forensic analysis, rehabilitation',endpoints:{detect:'POST /v1/sentinel/detect',quarantine:'POST /v1/sentinel/quarantine',capture:'POST /v1/sentinel/capture',analyze:'POST /v1/sentinel/analyze/:did',rehabilitate:'POST /v1/sentinel/rehabilitate/:id',clear:'POST /v1/sentinel/clear/:id',stats:'GET /v1/sentinel/stats',threats:'GET /v1/sentinel/threats',quarantine_list:'GET /v1/sentinel/quarantine',health:'GET /health'}}));
const hc=require('./services/hive-client');
app.listen(PORT,async()=>{console.log(`[hivesentinel] Listening on port ${PORT}`);try{await hc.registerWithHiveTrust()}catch(e){}try{await hc.registerWithHiveGate()}catch(e){}});
module.exports=app;
