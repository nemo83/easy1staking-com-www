#!/usr/bin/env node
"use strict";
// Explicit CLI: node scripts/check-delegation-flow.cjs --evidence-dir /absolute/owned/temp --playwright /absolute/playwright --chromium /absolute/chrome [--preload /absolute/ssr-tripwire.cjs] (--cases first|all | --case registered-name) [--prepare-only yes]
// Requires a caller-built actual application; starts Next directly, never installs or builds.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),net=require("node:net");
const {spawn,spawnSync}=require("node:child_process"),{once}=require("node:events"),crypto=require("node:crypto");
const {loadDelegationSource}=require("./lib/load-delegation-source.cjs");
const fixture=require("./fixtures/delegation-flow.json"),chain=require("./fixtures/chain-context.json"),vectors=require("./fixtures/stake-builder.json").vectors,keys=require("./fixtures/wallet-signature.json");
const args=process.argv.slice(2),options={};while(args.length){const key=args.shift();assert(key.startsWith("--")&&args.length,"Expected --option value");assert(["evidence-dir","playwright","chromium","preload","cases","case","prepare-only"].includes(key.slice(2)),"Unknown option "+key);assert(!Object.prototype.hasOwnProperty.call(options,key.slice(2)),"Repeated option "+key);options[key.slice(2)]=args.shift();}
// Every registered case declares its exact page dispatches and intercepted POSTs; selectors are strict and checked before any build or browser.
const registered=Object.keys(fixture.expectedCounts);assert.deepEqual([...registered].sort(),[...new Set([...fixture.allCases,...fixture.additionalCases])].sort(),"Every registered case declares counts");assert(fixture.firstCases.every(name=>fixture.allCases.includes(name)),"First cases are registered");
for(const name of registered){const c=fixture.expectedCounts[name];assert.deepEqual(Object.keys(c).sort(),["posts","submitDispatches"],"Count declaration shape "+name);assert(Number.isSafeInteger(c.posts)&&Number.isSafeInteger(c.submitDispatches)&&c.posts>=0&&c.submitDispatches>=0,"Count declaration values "+name);}
if(options["prepare-only"]!==undefined)assert.equal(options["prepare-only"],"yes","Expected --prepare-only yes");
else if(options.case!==undefined){assert.equal(options.cases,undefined,"Use exactly one of --case or --cases");assert(registered.includes(options.case),"Unknown case "+options.case);}
else assert(options.cases==="all"||options.cases==="first","Expected --cases all|first or one registered --case");
assert.match(process.version,/^v24\.22\.1$/);for(const key of ["evidence-dir"])assert(options[key]&&path.isAbsolute(options[key]),"Expected absolute --"+key);
const output=options["evidence-dir"],app=path.resolve(__dirname,".."),root=path.dirname(app),sha=b=>crypto.createHash("sha256").update(b).digest("hex");
assert(output.startsWith(process.env.TMPDIR+path.sep),"Evidence must be in exclusively owned scratch");fs.mkdirSync(output,{recursive:true,mode:0o700});
if(!options.preload){options.preload=path.join(output,"ssr-preload.cjs");fs.writeFileSync(options.preload,`const fs=require('node:fs');global.fetch=async(input,init)=>{const url=String(typeof input==='string'?input:input.url||input);fs.appendFileSync(${JSON.stringify(path.join(output,"server-http.jsonl"))},JSON.stringify({url,method:init?.method||'GET',intercepted:true})+'\\n');if(url.startsWith('https://cardano-mainnet.blockfrost.io/api/v0/')&&(!init?.method||init.method==='GET'))return new Response('{}',{status:503,headers:{'content-type':'application/json'}});throw Error('FORBIDDEN_SERVER_HTTP');};for(const name of ['node:https','node:http','node:tls','node:net','node:dgram']){const m=require(name);for(const key of ['connect','createConnection','request','get','createSocket'])if(typeof m[key]==='function')m[key]=()=>{throw Error('FORBIDDEN_SERVER_SOCKET');};}`);}
if(options["prepare-only"]==="yes"){console.log("PREPARED_SSR_TRIPWIRE "+options.preload);process.exit(0);}
for(const name of ["playwright","chromium"])assert(typeof options[name]==="string"&&path.isAbsolute(options[name]),"Expected absolute --"+name);
assert(fs.statSync(options.playwright).isDirectory(),"Playwright must be an existing package directory");
const playwrightMetadata=path.join(options.playwright,"package.json");
assert.equal(JSON.parse(fs.readFileSync(playwrightMetadata,"utf8")).name,"playwright","Expected the Playwright package");
assert(fs.statSync(options.chromium).isFile(),"Chromium must be an existing executable file");fs.accessSync(options.chromium,fs.constants.X_OK);
const sdk=loadDelegationSource(),raw=sdk.load("source-cbor"),address=raw.addressBech32(chain.addressHex),account=chain.accountBech32;
const baseSlot=BigInt(chain.slot),baseTime=1596059091000+Number(baseSlot-4492800n)*1000;
const id=n=>n.toString(16).padStart(64,"0"),clone=structuredClone;
function point(slot){return{slot:Number(slot),block_height:Number(slot-100000000n),block_time:(1596059091000+Number(slot-4492800n)*1000)/1000,block:id(Number(slot)),index:0};}
function scenario(registered){
 const txs={},routes=new Map(),tx=(hash,at,extra={})=>txs[hash]={hash,valid_contract:true,...point(at),stake_cert_count:0,delegation_count:0,pool_update_count:0,pool_retire_count:0,...extra};
 tx(chain.fundingId,baseSlot-1000n);tx(chain.poolRegistrationId,baseSlot-4000n,{pool_update_count:1});if(registered)tx(chain.registrationId,baseSlot-3000n,{stake_cert_count:1});
 const history=hash=>({tx_hash:hash,tx_slot:txs[hash].slot,block_height:txs[hash].block_height,block_time:txs[hash].block_time});
 routes.set("/epochs/latest",{epoch:664});routes.set("/epochs/664/parameters",{epoch:664,protocol_major_ver:11,protocol_minor_ver:0,min_fee_a:44,min_fee_b:155381,key_deposit:"2000000",coins_per_utxo_size:"4310",max_tx_size:16384,max_val_size:"5000",a0:0.3});
 routes.set("/accounts/"+account,{stake_address:account,registered,active:false,active_epoch:registered?664:null,pool_id:null});
 routes.set("/accounts/"+account+"/registrations",registered?[{...history(chain.registrationId),action:"registered",deposit:"1000000"}]:[]);routes.set("/accounts/"+account+"/delegations",[]);
 routes.set("/pools/"+chain.poolHash,{pool_id:chain.poolId,hex:chain.poolHash,registration:[chain.poolRegistrationId],retirement:[],margin_cost:0.05});
 routes.set("/pools/"+chain.poolHash+"/metadata",{pool_id:chain.poolId,hex:chain.poolHash,ticker:"EASY1"});routes.set("/pools/"+chain.poolHash+"/updates",[{tx_hash:chain.poolRegistrationId,cert_index:0,action:"registered"}]);
 routes.set("/pools/retired",[]);routes.set("/pools/retiring",[]);routes.set(`/txs/${chain.poolRegistrationId}/pool_updates`,[{cert_index:0,pool_id:chain.poolId,active_epoch:664}]);routes.set(`/txs/${chain.registrationId}/stakes`,[{cert_index:0,address:account,registration:true}]);
 const row={address,tx_hash:chain.fundingId,output_index:0,tx_index:999,amount:[{unit:"lovelace",quantity:"100000000"}],block:txs[chain.fundingId].block,data_hash:null,inline_datum:null,reference_script_hash:null};
 routes.set("/addresses/"+address+"/utxos",[row]);routes.set(`/txs/${chain.fundingId}/utxos`,{hash:chain.fundingId,inputs:[],outputs:[{...clone(row),collateral:false}]});
 return{txs,routes,history};
}
function pythonHash(hex,size=32){const r=spawnSync("python3",["-c",`import sys,hashlib;print(hashlib.blake2b(bytes.fromhex(sys.stdin.read()),digest_size=${size}).hexdigest())`],{input:hex,encoding:"utf8"});assert.equal(r.status,0);return r.stdout.trim();}
const signers=[keys.paymentSeed,keys.stakeSeed].map(seed=>{const privateKey=crypto.createPrivateKey({key:Buffer.from("302e020100300506032b657004220420"+seed,"hex"),format:"der",type:"pkcs8"});const publicHex=crypto.createPublicKey(privateKey).export({format:"der",type:"spki"}).subarray(-32).toString("hex");return{privateKey,publicHex,hash:pythonHash(publicHex,28)};}).sort((a,b)=>a.hash.localeCompare(b.hash));

async function freePort(port=0){const s=net.createServer();s.listen(port,"127.0.0.1");await once(s,"listening");const p=s.address().port;await new Promise(r=>s.close(r));return p;}
function failureText(error){return(error instanceof assert.AssertionError&&!error.generatedMessage?String(error.message):String(error?.name||"Error")+": "+String(error?.message??error)).split("\n")[0];}
function descendants(pid){try{return fs.readFileSync(`/proc/${pid}/task/${pid}/children`,"utf8").trim().split(/\s+/).filter(Boolean).map(Number).flatMap(p=>[p,...descendants(p)]);}catch{return[];}}
const report={runnerSha256:sha(fs.readFileSync(__filename)),fixtureSha256:sha(fs.readFileSync(path.join(__dirname,'fixtures/delegation-flow.json'))),node:process.version,source:{},cases:[],chunks:[],unexpected:[],errors:[],cleanup:{},buildId:fs.readFileSync(path.join(app,".next/BUILD_ID"),"utf8").trim()};
for(const name of ["controller","wallet-session","coordination","builder","guard","crypto","chain-context","wallet-codec","source-cbor","blockfrost-reader","provider-json","cbor","types"])report.source[name]=sha(fs.readFileSync(path.join(app,"src/lib/site/delegation",name+".ts")));
// A crash outside the case loop still terminates owned children and leaves a partial report.
function crash(kind,error){if(report.crashed)return;report.crashed={kind,failure:failureText(error)};for(const pid of descendants(process.pid))try{process.kill(pid,"SIGKILL");}catch{}try{fs.writeFileSync(path.join(output,"report.json"),JSON.stringify(report,null,2));}catch{}process.exit(1);}
process.on("unhandledRejection",error=>crash("unhandledRejection",error));process.on("uncaughtException",error=>crash("uncaughtException",error));
report.lock=sha(fs.readFileSync(path.join(app,"package-lock.json")));report.dependencies=Object.fromEntries(["@evolution-sdk/evolution/TransactionBody","@evolution-sdk/evolution/Certificate","@noble/hashes/blake2.js"].map(name=>[name,sha(fs.readFileSync(require.resolve(name)))]));
async function main(){
 const port=await freePort(),origin="http://127.0.0.1:"+port,env={PATH:path.dirname(process.execPath)+":/usr/bin:/bin",HOME:output,TMPDIR:output,NEXT_TELEMETRY_DISABLED:"1",NODE_OPTIONS:"--require="+options.preload};
 let server,browser,serverChildren=[],failure;const pending=[];report.port=port;
 try{
  const log=fs.openSync(path.join(output,"server.log"),"w");server=spawn(process.execPath,[path.join(app,"node_modules/next/dist/bin/next"),"start","--hostname","127.0.0.1","--port",String(port)],{cwd:app,env,stdio:["ignore",log,log]});fs.closeSync(log);report.serverPid=server.pid;
  let ready=false;for(let i=0;i<120;i++){assert.equal(server.exitCode,null,"SERVER_EXIT");try{const r=await fetch(origin+"/pool");if(r.status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready,"SERVER_READY");
  const {chromium}=require(options.playwright);const executable=options.chromium;
  report.tools={playwright:options.playwright,playwrightPackageSha256:sha(fs.readFileSync(playwrightMetadata)),chromium:executable};
  report.chromium={path:executable,sha256:sha(fs.readFileSync(executable))};browser=await chromium.launch({executablePath:executable,headless:true,env:{PATH:env.PATH,HOME:output,TMPDIR:process.env.TMPDIR},args:["--no-sandbox","--disable-background-networking","--disable-component-update","--no-first-run"]});report.chromium.version=browser.version();
  report.chromium.pids=descendants(process.pid).filter(pid=>pid!==server.pid&&!descendants(server.pid).includes(pid));
  for(const name of options.case?[options.case]:options.cases==="all"?fixture.allCases:fixture.firstCases){
   const record={name,http:[],posts:[],signatures:[],tripwires:[],errors:[],routeHandlerErrors:[],chunkReadErrors:[],chunkIdentityFailures:[],chunkReadsAbandonedAtClose:0};report.cases.push(record);const caseReads=[];
   // Route-handler page actions may race case teardown; record their failures instead of throwing.
   const routeStep=async step=>{try{await step();}catch(error){record.routeHandlerErrors.push(String(error?.message??error).split("\n")[0]);}};const s=scenario(name!=="unregistered"),golden=vectors.find(v=>v.registered===(name!=="unregistered"));
   // Status reads for the submitted ID: 404 unless the case's plan includes it; an included transaction is one coherent synthetic chain point.
   const plan=fixture.statusPlans[name]||{notFound:null},otherPool=raw.poolBech32(chain.otherHash),st={lookups:0,inclusion:null,lastTip:null,pinned:null,cborReads:0,historyReads:0,reloaded:false,trace:[]},NOT_FOUND=Symbol("404");
   const statusPath=p=>p==="/txs/"+golden.txId||p.startsWith("/txs/"+golden.txId+"/")||!!st.inclusion&&(p==="/blocks/"+st.inclusion.hash||plan.lag&&p==="/accounts/"+account+"/delegations");
   function include(){
    const t=st.lastTip;let slot=BigInt(t.slot)-2n,height=slot-100000000n,hash=id(Number(slot));
    if(plan.above){slot=BigInt(t.slot)+1n;height=slot-100000000n;hash=id(Number(slot));}
    if(plan.fork){st.pinned=t;slot=BigInt(t.slot)-5n;height=BigInt(t.height);hash="f0".repeat(32);}
    const time=(1596059091000+Number(slot-4492800n)*1000)/1000,acc=s.routes.get("/accounts/"+account);st.inclusion={slot:Number(slot),height:Number(height),time,hash,index:0};
    acc.pool_id=plan.unreconciled?otherPool:chain.poolId;acc.active=true;
    st.ownHistory={active_epoch:666,tx_hash:golden.txId,amount:"100000000",pool_id:chain.poolId,tx_slot:Number(slot),block_time:time,block_height:Number(height)};
    if(!plan.lag)s.routes.get("/accounts/"+account+"/delegations").push(st.ownHistory);
    if(plan.laterOther){const later=id(0x5a5a),q=point(slot+1n);s.txs[later]={hash:later,valid_contract:true,...q,stake_cert_count:0,delegation_count:1,pool_update_count:0,pool_retire_count:0};
     s.routes.set(`/txs/${later}/delegations`,[{cert_index:0,index:0,address:account,pool_id:otherPool,active_epoch:667}]);
     s.routes.get("/accounts/"+account+"/delegations").push({active_epoch:667,tx_hash:later,amount:"100000000",pool_id:otherPool,tx_slot:q.slot,block_time:q.block_time,block_height:q.block_height});acc.pool_id=otherPool;}
   }
   function statusValue(p){
    const tx=golden.txId;
    if(p==="/txs/"+tx){
     st.lookups++;
     if(!st.inclusion){if(plan.notFound===null||name==="check-status-after-reload"&&!st.reloaded||st.lookups<=plan.notFound){st.trace.push({lookup:st.lookups,found:false});return NOT_FOUND;}include();}
     st.trace.push({lookup:st.lookups,found:true});const i=st.inclusion;
     return{hash:tx,block:i.hash,block_height:i.height,block_time:i.time,slot:i.slot,index:i.index,output_amount:[{unit:"lovelace",quantity:golden.change}],fees:golden.fee,deposit:golden.deposit,size:golden.signedSize,
      invalid_before:null,invalid_hereafter:golden.ttl,utxo_count:2,withdrawal_count:0,mir_cert_count:0,delegation_count:1,stake_cert_count:golden.registered?0:1,pool_update_count:0,pool_retire_count:0,asset_mint_or_burn_count:0,redeemer_count:0,valid_contract:true,treasury_donation:"0"};
    }
    if(!st.inclusion)return NOT_FOUND;
    st.trace.push({lookup:st.lookups,path:p.replace(tx,"{tx}")});const i=st.inclusion;
    if(p===`/txs/${tx}/cbor`){st.cborReads++;if(plan.lag&&st.cborReads===1)return NOT_FOUND;const sig=record.signatures[0];return{cbor:plan.wrongBody?"84"+golden.bodyHex.replace("021a0002a389","021a0002a38a")+sig.witness+"f5f6":sig.signedHex};}
    if(p===`/txs/${tx}/delegations`)return[{index:0,cert_index:0,address:account,pool_id:chain.poolId,active_epoch:666}];
    if(p===`/txs/${tx}/stakes`)return[{cert_index:0,address:account,registration:true}];
    if(p==="/blocks/"+i.hash)return{time:i.time,height:i.height,hash:i.hash,slot:i.slot,epoch:664,epoch_slot:(i.slot-4492800)%432000,slot_leader:chain.poolId,size:1024,tx_count:1,output:"100000000",fees:golden.fee,
     block_vrf:"vrf_vk1"+"q".repeat(58),op_cert:"ab".repeat(32),op_cert_counter:"1",previous_block:id(i.slot-1),next_block:null,confirmations:st.lastTip.height-i.height};
    if(p==="/accounts/"+account+"/delegations"){st.historyReads++;const rows=s.routes.get(p);return st.historyReads===1?rows:[...rows,st.ownHistory];}
    return undefined;
   }
   if(name==="already-EASY1"){
    s.txs[chain.registrationId].delegation_count=1;
    s.routes.set(`/txs/${chain.registrationId}/delegations`,[{cert_index:0,index:0,address:account,pool_id:chain.poolId,active_epoch:666}]);
    s.routes.set("/accounts/"+account+"/delegations",[{...s.history(chain.registrationId),pool_id:chain.poolId,amount:"0",active_epoch:666}]);s.routes.get("/accounts/"+account).pool_id=chain.poolId;
   }
   if(name==="contradictory-account")s.routes.get("/accounts/"+account).registered=false;
   const pageOrigin=name==="approved-origin"?"https://easy1staking.com":name==="preview-origin"?"https://preview.easy1staking.com":origin;
   const context=await browser.newContext({viewport:{width:360,height:800},serviceWorkers:"block"});let page,primary,closing=false,onResponse;try{
    await context.exposeFunction("syntheticSign",unsigned=>{
     const tips=record.http.filter(x=>x.path==="/blocks/latest");assert(tips.length>=6,"SOURCE_ASSESSMENTS");assert.equal(tips[2].slot,Number(baseSlot),"ORIGINAL_CONSTRUCTION_SLOT");
     const expectedBody=golden.bodyHex,expectedId=golden.txId;assert.equal(pythonHash(expectedBody),expectedId,"LITERAL_GOLDEN_ID");
     assert.equal(unsigned,"84"+expectedBody+"a0f5f6","EXACT_REVIEWED_UNSIGNED_WRAPPER");
     let witness="a10082"+signers.map(key=>"825820"+key.publicHex+"5840"+crypto.sign(null,Buffer.from(expectedId,"hex"),key.privateKey).toString("hex")).join("");
     if(name==="partial-witness")witness="a10081"+witness.slice(6,208);
     if(name==="foreign-witness")witness=witness.replace(signers[0].publicHex,"ab".repeat(32));
     if(name==="invalid-signature")witness=witness.slice(0,-2)+(witness.endsWith("00")?"01":"00");
     record.signatures.push({bodyHex:expectedBody,txId:expectedId,unsigned,fee:golden.fee,deposit:golden.deposit,witness,signedHex:"84"+expectedBody+witness+"f5f6"});return witness;
    });
    await context.addInitScript(({baseTime,chain,mode,delay})=>{
     const NativeDate=Date,realStart=NativeDate.now();class ObservedDate extends NativeDate{constructor(...args){if(args.length)super(...args);else super(baseTime+NativeDate.now()-realStart+(window.synthetic?.clockDeltaMs||0));}static now(){return baseTime+NativeDate.now()-realStart+(window.synthetic?.clockDeltaMs||0);}}window.Date=ObservedDate;
     const state=window.synthetic={realStart,submitDispatches:0,enableCalls:0,signCalls:0,replyAt:null,signAt:null,mode,release:null,tripwires:[],postReadIndex:0,clockDeltaMs:0,network:mode==="wrong-network"?0:1,address:mode==="unsupported-account"?"61"+"aa".repeat(28):chain.addressHex,utxo:"82825820"+chain.fundingId+"00825839"+chain.addressHex+"1a05f5e100"};
     const nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;let submittingReads=0;
     // Page-level dispatches accumulate across navigations and reloads of this tab through native session storage.
     try{state.submitDispatches=Number(nativeGet.call(sessionStorage,"synthetic:submitDispatches")||0);}catch{}
     if(mode==="locks-unavailable")Object.defineProperty(navigator,'locks',{value:undefined});
     if(mode==="same-account-postreply-focus"){const verify=crypto.subtle.verify.bind(crypto.subtle);crypto.subtle.verify=async(...args)=>{state.verifying=true;const result=await verify(...args);await new Promise(r=>setTimeout(r,300));return result;};}
     Storage.prototype.setItem=function(key,value){
      if(mode==="storage-unavailable"||mode==="storage-prepare-fail"&&String(value).includes('"stage":"prepared"'))throw Error("SYNTHETIC_PRIVATE_CANARY");
      return nativeSet.call(this,key,value);
     };
     Storage.prototype.getItem=function(key){const value=nativeGet.call(this,key);
      if(key==="easy1staking:delegation-recovery"&&value?.includes('"stage":"prepared"')&&mode==="storage-readback-fail")return null;
      if(key==="easy1staking:delegation-recovery"&&value?.includes('"stage":"submitting"')&&["storage-final-loss","storage-final-replaced"].includes(mode)&&++submittingReads===1){
       if(mode==="storage-final-replaced"){const changed=JSON.parse(value);changed.txId='ab'.repeat(32);const replacement=JSON.stringify(changed);nativeSet.call(this,key,replacement);if(nativeGet.call(this,key)!==replacement)throw Error("FAULT_NOT_APPLIED");}
       else{nativeRemove.call(this,key);if(nativeGet.call(this,key)!==null)throw Error("FAULT_NOT_APPLIED");}
       state.faultAt=performance.now();state.faultKind=mode;state.retainedAtAttempt="not-attempted";return value;}
      return value;
     };
     const deny=name=>(...args)=>{state.tripwires.push(name);throw Error("FORBIDDEN_"+name);};
     const nativeFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const u=new URL(typeof input==="string"?input:input.url,location.href);if(u.origin==="https://cardano-mainnet.blockfrost.io"&&init?.method==="POST"){state.submitDispatches++;try{nativeSet.call(sessionStorage,"synthetic:submitDispatches",String(state.submitDispatches));}catch{}}if(u.origin===location.origin)return nativeFetch(input,init);if(u.origin!=="https://cardano-mainnet.blockfrost.io")return deny("unexpected-fetch")();if(init?.method==="POST"){state.attemptAt=performance.now();state.attemptClock=Date.now();if(["storage-final-loss","storage-final-replaced"].includes(mode))state.retainedAtAttempt=nativeGet.call(localStorage,"easy1staking:delegation-recovery");}if(init?.credentials!=="omit"||init?.redirect!=="error"||init?.cache!=="no-store")return deny("transport-options")();return nativeFetch(input,init);};
     window.XMLHttpRequest=function(){return deny("xhr")();};window.WebSocket=function(){return deny("socket")();};window.EventSource=function(){return deny("events")();};navigator.sendBeacon=deny("beacon");window.gtag=deny("analytics");
     navigator.storage.persist=deny("persist-prompt");
     // Responding tripwire controls are exercised without outward I/O.
     try{navigator.sendBeacon("https://invalid.example");}catch{}state.control=state.tripwires.pop();
     async function read(value){state.walletReads=(state.walletReads||0)+1;if(state.replyAt!==null&&["post-reply-deadline","post-reply-deadline-hidden","post-reply-timely-hidden"].includes(mode)&&state.postReadIndex++<3)await new Promise(r=>setTimeout(r,delay));return value;}
     const api={getNetworkId:()=>read(state.network),getChangeAddress:()=>read(state.address),getRewardAddresses:()=>read([]),getUtxos:()=>read([state.utxo]),async signTx(unsigned,partial){state.signCalls++;state.signAt=performance.now();if(partial!==false)throw Error("PARTIAL_FLAG");if(["cancel-approval","account-change","network-change","input-change","registration-change","parameters-change","eligibility-change","same-account-focus"].includes(mode))await new Promise(r=>state.release=r);
      if(mode==="long-consent")await new Promise(r=>setTimeout(r,31000));const witness=await window.syntheticSign(unsigned);state.replyAt=performance.now();
      if(["post-reply-deadline-hidden","post-reply-timely-hidden"].includes(mode)){const before=document.visibilityState;Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});state.visibilityTransition={before,after:document.visibilityState,at:performance.now()};document.dispatchEvent(new Event("visibilitychange"));}
      if(mode.startsWith("presubmit-"))state.clockDeltaMs+=baseTime+(600-Number(mode.slice(10)))*1000-Date.now();
      return witness;},signData:deny("signData"),submitTx:deny("wallet-submit")};
     // After a flagged reload every wallet method throws and is counted; status checking must never call one.
     let throwingWallet=false;try{throwingWallet=nativeGet.call(sessionStorage,"synthetic:throwingWallet")==="1";}catch{}
     state.throwingWalletCalls=0;const refuse=()=>{state.throwingWalletCalls++;throw Error("FORBIDDEN_WALLET_AFTER_RELOAD");};
     window.cardano=mode==="no-wallet"?{}:throwingWallet?{synthetic:{enable:refuse,isEnabled:refuse,getNetworkId:refuse,getChangeAddress:refuse,getRewardAddresses:refuse,getUtxos:refuse,signTx:refuse,signData:refuse,submitTx:refuse}}:{synthetic:{enable:async()=>{state.enableCalls++;return read(api);}}};
     state.controls=[];
     for(const probe of [()=>window.fetch('https://invalid.example'),()=>new XMLHttpRequest(),()=>new WebSocket('wss://invalid.example'),()=>new EventSource('https://invalid.example'),()=>navigator.sendBeacon('https://invalid.example'),()=>api.signData(),()=>api.submitTx(),()=>navigator.storage.persist(),()=>window.gtag()]){try{probe();}catch{}state.controls.push(state.tripwires.pop());}
    },{baseTime,chain,mode:name,delay:fixture.postReplyReadDelayMs});
    await context.route("**/*",async route=>{
     const request=route.request(),u=new URL(request.url());if(u.origin===pageOrigin&&request.method()==="GET"){
      if(pageOrigin===origin)return route.continue();const local=await fetch(origin+u.pathname+u.search);return route.fulfill({status:local.status,headers:Object.fromEntries([...local.headers].filter(([k])=>!["content-encoding","content-length","transfer-encoding"].includes(k))),body:Buffer.from(await local.arrayBuffer())});
     }
     if(u.origin!=="https://cardano-mainnet.blockfrost.io"||!u.pathname.startsWith("/api/v0/")){report.unexpected.push({url:request.url(),method:request.method()});return route.abort();}
     const p=u.pathname.slice(7),entry={url:request.url(),method:request.method(),path:p,at:Date.now()};record.http.push(entry);
     if(request.method()==="POST"){
      assert.equal(p,"/tx/submit");const bytes=request.postDataBuffer(),expected=record.signatures[0];assert(expected,"SIGN_BEFORE_POST");assert.equal(bytes.toString("hex"),expected.signedHex,"EXACT_GUARDED_POST_BYTES");assert.equal(request.headers()["content-type"],"application/cbor");record.posts.push({txId:expected.txId,hex:bytes.toString("hex"),at:Date.now()});
      if(name==="submit-timeout"||name==="confirm-unknown-outcome")await new Promise(r=>setTimeout(r,61000));
      if(name==="cancel-transmission"){await routeStep(()=>page.getByRole("button",{name:"Cancel here"}).click());await new Promise(r=>setTimeout(r,100));}
      if(name==="storage-after-transmission"){await routeStep(async()=>{const other=await context.newPage();await other.goto(origin+"/pool");await other.evaluate(()=>{localStorage.removeItem("easy1staking:delegation-recovery");});await other.close();});await page.waitForTimeout(100);}
      if(name==="submit-bad-status")return route.fulfill({status:500,contentType:"application/json",body:'{"error":"SYNTHETIC_PRIVATE_CANARY"}'});
      if(name==="submit-missing-body")return route.fulfill({status:200,contentType:"application/json",body:""});
      if(name==="submit-malformed")return route.fulfill({status:200,contentType:"application/json",body:'{"raw":"SYNTHETIC_PRIVATE_CANARY"}'});
      if(name==="submit-mismatch")return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify("ab".repeat(32))});
      if(name==="submit-interrupted-body")return route.abort("failed");
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(expected.txId),headers:{"access-control-allow-origin":"*"}});
     }
     assert.equal(request.method(),"GET");let value;
     if((name==="provider-404"||name==="provider-error")&&p==="/accounts/"+account)return route.fulfill({status:name==="provider-404"?404:500,contentType:"application/json",body:'{"raw":"SYNTHETIC_PRIVATE_CANARY"}'});
     if(["cancel-postreply","disconnect-postreply","dispose-postreply"].includes(name)&&p==="/pools/"+chain.poolHash+"/metadata"&&await page.evaluate(()=>window.synthetic.replyAt!==null)){
      record.afterReplyVeto=true;
      if(name==="dispose-postreply")await routeStep(()=>page.goto(origin+'/'));else await routeStep(()=>page.getByRole('button',{name:name==="cancel-postreply"?'Cancel here':'Disconnect wallet'}).click());
     }
     if(["post-reply-deadline","post-reply-deadline-hidden"].includes(name)&&p==="/pools/"+chain.poolHash+"/metadata"&&await page.evaluate(()=>window.synthetic.replyAt!==null))await new Promise(r=>setTimeout(r,8000));
     if(statusPath(p)){
      if(p==="/txs/"+golden.txId&&!st.inclusion&&st.lookups+1===(plan.notFound??-1)+1){
       if(plan.disconnectOnFound)await routeStep(()=>page.getByRole("button",{name:"Disconnect wallet"}).click());
       if(plan.disposeOnFound){await routeStep(()=>page.locator('a[aria-label="easy1staking home"]').first().click());st.navigatedAt=Date.now();}
      }
      value=statusValue(p);entry.status=value===NOT_FOUND?404:200;
      if(value===NOT_FOUND)return route.fulfill({status:404,contentType:"application/json",body:'{"status_code":404,"error":"Not Found","message":"The requested component has not been found."}',headers:{"access-control-allow-origin":"*"}});
     }else if(p==="/blocks/latest"){
      // A navigation or reload can destroy the page context mid-read; that read then fails as transport, never as a handler crash.
      const observed=await page.evaluate(()=>({now:Date.now(),afterReply:window.synthetic.replyAt!==null,jump:window.synthetic.clockDeltaMs})).catch(()=>null);if(!observed)return route.abort();
      const slot=observed.afterReply||observed.jump>0?baseSlot+BigInt(Math.floor((observed.now-baseTime)/1000)):baseSlot;
      value=st.pinned??{slot:Number(slot),epoch:664,hash:slot===baseSlot?chain.tipHash:id(Number(slot)),height:Number(slot-100000000n),time:(baseTime+Number(slot-baseSlot)*1000)/1000};entry.slot=value.slot;st.lastTip=value;
     }else value=s.routes.has(p)?s.routes.get(p):p.startsWith("/txs/")?s.txs[p.slice(5)]:undefined;
     assert.notEqual(value,undefined,"EXPLICIT_SOURCE_FIXTURE "+p);if(Array.isArray(value)&&u.searchParams.has("page")){const n=Number(u.searchParams.get("page"));value=value.slice((n-1)*100,n*100);}
     return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(value),headers:{"access-control-allow-origin":"*"}});
    });
    page=await context.newPage();page.on("pageerror",e=>record.errors.push(String(e)));
    // Each served-chunk read is handled when created and settled in this case's finally: a mismatch or failed read while active disqualifies the case; one cut off by teardown is counted.
    onResponse=response=>{const u=new URL(response.url());if(u.pathname.startsWith("/_next/static/")&&u.pathname.endsWith(".js")){const read=response.body().then(bytes=>{try{const file=path.join(app,".next",u.pathname.replace("/_next/","")),actual=sha(bytes),expected=sha(fs.readFileSync(file));report.chunks.push({path:u.pathname,sha256:actual,bytes:bytes.length});if(actual!==expected)record.chunkIdentityFailures.push({kind:"mismatch",path:u.pathname,actual,expected});}catch(error){record.chunkIdentityFailures.push({kind:"identity-error",path:u.pathname,failure:failureText(error)});}},error=>{if(closing)record.chunkReadsAbandonedAtClose++;else{record.chunkReadErrors.push(failureText(error));record.chunkIdentityFailures.push({kind:"read-error",path:u.pathname,failure:failureText(error)});}});read.catch(()=>{});caseReads.push(read);pending.push(read);}};page.on("response",onResponse);
    await page.goto(pageOrigin+"/pool?uri=https%3A%2F%2Finvalid.example");await page.locator('#delegate [role="status"]').waitFor();
    await page.getByLabel("Wallet",{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.synthetic.enableCalls),0,"NO_AUTO_ENABLE");assert.equal(await page.evaluate(()=>window.synthetic.control),"beacon","TRIPWIRE_RESPONDS");assert.deepEqual(await page.evaluate(()=>window.synthetic.controls),['unexpected-fetch','xhr','socket','events','beacon','signData','wallet-submit','persist-prompt','analytics'],'ALL_TRIPWIRES_RESPOND');
    assert(await page.getByText("On mobile, open this exact page",{exact:false}).isVisible());if(pageOrigin===origin)assert.equal(await page.locator('a[href^="web+cardano:"]').count(),0,"LOCAL_ORIGIN_NO_HOP");
    else{await page.locator('a[href^="web+cardano:"]').waitFor();assert.equal(await page.locator('a[href^="web+cardano:"]').getAttribute("href"),"web+cardano://browse/v1?uri="+encodeURIComponent(pageOrigin+"/pool"),"EXACT_APPROVED_ORIGIN_HOP");}
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"NO_360PX_OVERFLOW");
    if(name==="no-wallet"){assert.equal(await page.getByLabel("Wallet",{exact:true}).locator("option").count(),1);assert.equal(record.posts.length,0);record.passed=true;console.log("PASS actual /pool "+name);continue;}
    await page.getByLabel("Wallet",{exact:true}).selectOption("synthetic");if(name==="registered"){await page.getByLabel("Wallet",{exact:true}).focus();await page.keyboard.press("Tab");assert.equal(await page.getByRole("button",{name:"Connect selected wallet"}).evaluate(e=>document.activeElement===e),true,"KEYBOARD_CONNECT_FOCUS");await page.keyboard.press("Enter");}else await page.getByRole("button",{name:"Connect selected wallet"}).click();if(["wrong-network","unsupported-account","provider-404","provider-error","contradictory-account","already-EASY1","missing-configuration"].includes(name)){
     await page.waitForFunction(()=>/could not be verified|already delegates/.test(document.querySelector('#delegate [role="status"]').textContent));assert.equal(await page.evaluate(()=>window.synthetic.signCalls),0);assert.equal(record.posts.length,0);record.passed=true;console.log("PASS actual /pool "+name);continue;
    }
    await page.getByRole("button",{name:"Build delegation review"}).waitFor({timeout:15000});
    assert.equal(await page.locator('a[href^="web+cardano:"]').count(),0,'NO_CONNECTED_ORIGIN_HOP');
    if(name==="storage-unavailable"||name==="locks-unavailable"){
     await page.getByRole("button",{name:"Build delegation review"}).click();await page.waitForFunction(()=>/coordination/.test(document.querySelector('#delegate [role="status"]').textContent));assert.equal(record.posts.length,0);assert.equal(await page.evaluate(()=>window.synthetic.signCalls),0,'CAPABILITY_REFUSAL_NO_SIGN');record.passed=true;console.log("PASS actual /pool "+name);continue;
    }
    assert.equal(await page.evaluate(()=>window.synthetic.signCalls),0,"NO_SIGN_BEFORE_REVIEW");await page.getByRole("button",{name:"Build delegation review"}).click();await page.getByRole("button",{name:"Approve and sign in wallet"}).waitFor();
    assert(await page.getByText("Exact fee: "+(BigInt(golden.fee)/1000000n)+"."+(BigInt(golden.fee)%1000000n).toString().padStart(6,"0")+" ADA",{exact:true}).isVisible(),"EXACT_FEE_VISIBLE");
    assert(await page.getByText("Separate registration deposit:",{exact:false}).isVisible());assert(await page.getByText("Review expires:",{exact:false}).isVisible());assert.equal(await page.evaluate(()=>window.synthetic.signCalls),0);
    if(["cancel-review","disconnect-review","dispose-review"].includes(name)){
     if(name==="dispose-review")await page.goto(origin+"/");else await page.getByRole("button",{name:name==="cancel-review"?"Cancel here":"Disconnect wallet"}).click();
     await page.waitForTimeout(100);assert.equal(record.posts.length,0);assert.equal(await page.evaluate(()=>window.synthetic.signCalls),0);record.passed=true;console.log("PASS actual /pool "+name);continue;
    }
    if(name==="cloned-approval"||name==="double-approval"){
     await page.evaluate(()=>{let fiber=Object.entries(document.getElementById('delegate')).find(([k])=>k.startsWith('__reactFiber$'))[1];for(;fiber;fiber=fiber.return){let state=fiber.memoizedState;while(state){const c=state.memoizedState?.current;if(c?.getView&&c?.approve){window.testController=c;return;}state=state.next;}}throw Error('CONTROLLER_REF_NOT_FOUND');});
     if(name==="cloned-approval"){await page.evaluate(()=>window.testController.approve({...window.testController.getView().review}));await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>window.synthetic.signCalls),0,"FORBIDDEN_CLONED_APPROVAL_SIGN");}
    }
    if(name==="two-tab-lock"){
     const second=await context.newPage();await second.goto(origin+"/pool");await second.getByLabel("Wallet",{exact:true}).selectOption("synthetic");await second.getByRole("button",{name:"Connect selected wallet"}).click();await second.getByRole("button",{name:"Build delegation review"}).click();await second.getByText("Another delegation operation is active",{exact:false}).waitFor();assert.equal(await second.evaluate(()=>window.synthetic.signCalls),0);record.lockQuery=await page.evaluate(()=>navigator.locks.query());assert.equal(record.lockQuery.held.length,1);await second.close();await page.bringToFront();
    }
    if(name.startsWith("presign-"))await page.evaluate(({baseTime,remaining})=>{window.synthetic.clockDeltaMs+=baseTime+(600-remaining)*1000-Date.now();},{baseTime,remaining:Number(name.slice(8))});
    if(name==="presign-179"){
     await page.getByRole("button",{name:"Approve and sign in wallet"}).click();await page.getByText("Delegation stopped before sending.",{exact:false}).waitFor();assert.equal(await page.evaluate(()=>window.synthetic.signCalls),0,"PRESIGN_179_NO_SIGN");assert.equal(record.posts.length,0);record.passed=true;console.log("PASS actual /pool "+name);continue;
    }
    if(name==="double-approval")await page.evaluate(()=>{const c=window.testController,v=c.getView().review;c.approve(v);c.approve(v);});else await page.getByRole("button",{name:"Approve and sign in wallet"}).click();await page.waitForFunction(()=>window.synthetic.signCalls===1);
    if(["account-change","network-change","input-change","registration-change","parameters-change","eligibility-change","same-account-focus"].includes(name)){
     if(name==="account-change")await page.evaluate(()=>window.synthetic.address='01'+'ab'.repeat(28)+window.synthetic.address.slice(58));
     if(name==="network-change")await page.evaluate(()=>window.synthetic.network=0);
     if(name==="input-change")await page.evaluate(()=>window.synthetic.utxo=window.synthetic.utxo.replace('1a05f5e100','1a05f5e101'));
     if(name==="registration-change")s.routes.get('/accounts/'+account).registered=false;
     if(name==="parameters-change")s.routes.get('/epochs/664/parameters').min_fee_a=45;
     if(name==="eligibility-change")s.routes.set('/pools/retiring',[{pool_id:chain.poolId,epoch:666}]);
     if(name==="same-account-focus"){const other=await context.newPage();await other.goto(origin+'/');await other.bringToFront();await page.bringToFront();await page.waitForTimeout(150);await other.close();record.nativeFocus=true;}
     await page.evaluate(()=>window.synthetic.release());
    }
    if(name==="same-account-postreply-focus"){
     await page.waitForFunction(()=>window.synthetic.verifying);const other=await context.newPage();await other.goto(origin+'/');await other.bringToFront();await page.bringToFront();await other.close();record.nativePostReplyFocus=true;
    }
    if(["cancel-postreply","disconnect-postreply","dispose-postreply"].includes(name)){
     for(let i=0;i<150&&!record.afterReplyVeto;i++)await page.waitForTimeout(20);assert(record.afterReplyVeto,'AFTER_REPLY_VETO_REACHED');await page.waitForTimeout(200);assert.equal(record.posts.length,0,'AFTER_REPLY_ZERO_POST '+name);record.passed=true;console.log('PASS actual /pool '+name);continue;
    }
    if(name==="cancel-approval"){
     await page.getByRole("button",{name:"Cancel here"}).click();await page.evaluate(()=>window.synthetic.release());await page.waitForFunction(()=>window.synthetic.replyAt!==null);await page.waitForTimeout(300);assert.equal(record.posts.length,0,"CANCEL_APPROVAL_ZERO_POST");
    }else if(["post-reply-deadline","post-reply-deadline-hidden"].includes(name)){
     await page.waitForFunction(()=>window.synthetic.replyAt!==null);const reply=await page.evaluate(()=>window.synthetic.replyAt);await page.waitForTimeout(32500);record.realPostReplyElapsedMs=await page.evaluate(reply=>performance.now()-reply,reply);assert(record.realPostReplyElapsedMs>30000,"REAL_TOTAL_REPLY_WINDOW");assert.equal(record.posts.length,0,"POST_REPLY_DEADLINE_ZERO_POST");
    }else if(["account-change","network-change","input-change","registration-change","parameters-change","eligibility-change","partial-witness","foreign-witness","invalid-signature","storage-prepare-fail","storage-readback-fail","storage-final-loss","storage-final-replaced","presubmit-119"].includes(name)){
     await page.waitForFunction(()=>/Delegation stopped before sending|Submitted to Blockfrost|Submission outcome is unknown/.test(document.querySelector('#delegate [role="status"]')?.textContent||''),{},{timeout:15000});assert.equal(record.posts.length,0,"FORBIDDEN_POST_SIGN_VETO "+name);
    }else if(name.startsWith("submit-")||name==="cancel-transmission"||name==="storage-after-transmission"){
     await page.getByText("Submission outcome is unknown.",{exact:false}).waitFor({timeout:65000});assert.equal(record.posts.length,1,"ONE_POSSIBLE_TRANSMISSION");const text=await page.locator('#delegate').innerText();assert(text.includes(record.signatures[0].txId),"UNKNOWN_RETAINS_DERIVED_ID");assert(!text.includes('SYNTHETIC_PRIVATE_CANARY'),"REDACT_RAW_ERROR");await page.waitForTimeout(name==="submit-timeout"?1000:200);assert.equal(record.posts.length,1,"NO_AUTOMATIC_RETRY");assert.equal(await page.evaluate(()=>window.synthetic.submitDispatches),1,"ONE_POSSIBLE_DISPATCH");record.unknownRetained=true;
    }else if(fixture.statusPlans[name]){
     // Status cases: identical registered submission, then read-only status work. Each waits on a terminal state or a fixed real-time observation.
     const apology="Sorry, we couldn't confirm your delegation yet. Confirmation usually takes about 20 seconds but can take longer. Please check again here in a few minutes, or check later in your wallet.";
     const inconsistentText="We found this transaction but couldn't verify it consistently. Nothing was cleared. Check again later, or check it in your wallet or a chain explorer.";
     const changedText="This operation's saved status changed in another tab of this browser. Keep the transaction ID and check it in your wallet or a chain explorer.";
     const statusText=()=>page.evaluate(()=>document.querySelector('#delegate [role="status"]')?.textContent||""),stored=()=>page.evaluate(()=>localStorage.getItem("easy1staking:delegation-recovery"));
     const terminal="^Your delegation transaction was confirmed on chain|couldn't verify it consistently|saved status changed in another tab|^Sorry, we couldn't confirm";
     const waitTerminal=timeout=>page.waitForFunction(source=>new RegExp(source).test(document.querySelector('#delegate [role="status"]')?.textContent||""),terminal,{timeout,polling:100});
     const viewOf=()=>page.evaluate(()=>{let fiber=Object.entries(document.getElementById('delegate')).find(([k])=>k.startsWith('__reactFiber$'))[1];for(;fiber;fiber=fiber.return){let state=fiber.memoizedState;while(state){const c=state.memoizedState?.current;if(c?.getView&&c?.approve)return JSON.parse(JSON.stringify(c.getView()));state=state.next;}}throw Error('CONTROLLER_REF_NOT_FOUND');});
     const until=async(fn,ms,label)=>{for(let i=0;i<ms/100&&!fn();i++)await new Promise(r=>setTimeout(r,100));assert(fn(),label);};
     const statusReads=after=>record.http.filter(x=>x.method==="GET"&&x.at>after&&(x.path==="/blocks/latest"||x.path.startsWith("/txs/"+golden.txId))).length;
     async function confirmedState(copy){
      assert.equal(await stored(),null,"CONFIRMED_RECORD_REMOVED");const text=await statusText();
      assert.match(text,/^Your delegation transaction was confirmed on chain in block \d+ \(\d+ confirmations?\)\.$/,"CONFIRMED_COPY");assert(text.includes("block "+st.inclusion.height+" "),"CONFIRMED_BLOCK");
      const region=await page.locator('[aria-label="Delegation confirmation"]').innerText();assert(region.includes(chain.stakeKeyHash),"CONFIRMATION_NAMES_CREDENTIAL_A");assert(region.includes(copy),"CONFIRMED_ACCOUNT_STATE");
      assert((await page.locator('#delegate').innerText()).includes(golden.txId),"CONFIRMED_KEEPS_ID");assert.equal(await page.getByText("A prior operation is unresolved",{exact:false}).count(),0,"CONFIRMED_NO_PRIOR_NOTICE");
      record.confirmedText=text;return region;
     }
     await page.waitForFunction(()=>window.synthetic.attemptClock!==undefined,{},{timeout:15000});
     record.statusAttempt=await page.evaluate(()=>({clock:window.synthetic.attemptClock,at:window.synthetic.attemptAt}));const postAt=record.posts[0].at;
     const B=chain.addressHex.slice(58)==="cd".repeat(28)?"ce".repeat(28):"cd".repeat(28);
     if(name==="confirm-different-wallet"){
      await page.evaluate(b=>{window.synthetic.address=window.synthetic.address.slice(0,58)+b;},B);
      // A window focus event (browser test input) asks the wallet owner for a fresh observation of the switched account.
      await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
      await page.waitForFunction(b=>document.querySelector('#delegate')?.textContent.includes(b),B,{timeout:15000});record.switchedCredential=B;
     }
     // Hide the document so the wallet owner's visible-only 30 s refresh is idle; any later wallet call would come from status work.
     await page.evaluate(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});});await page.waitForTimeout(1000);
     const walletAt=()=>page.evaluate(()=>({enableCalls:window.synthetic.enableCalls,signCalls:window.synthetic.signCalls,walletReads:window.synthetic.walletReads||0,throwing:window.synthetic.throwingWalletCalls}));
     const baseline=await walletAt();record.walletBaseline=baseline;assert.equal(baseline.signCalls,1);
     if(["confirm-after-poll","confirm-new-inclusion","confirm-index-lag","confirm-later-other-pool","confirm-different-wallet","status-disconnect"].includes(name)){
      await waitTerminal(80000);const region=await confirmedState(name==="confirm-later-other-pool"?"This stake account has since delegated to another pool.":"This stake account currently delegates to EASY1.");
      const found=st.trace.filter(x=>x.found!==undefined);record.lookups=found;
      if(name==="confirm-after-poll")assert.deepEqual(found.map(x=>x.found),[false,false,true],"TWO_404_TICKS_THEN_CONFIRMED");
      if(name==="confirm-new-inclusion"){assert.deepEqual(found.map(x=>x.found),[true,true],"PENDING_THEN_CONFIRMED");assert(!st.trace.some(x=>x.lookup===1&&x.path),"NEWER_THAN_T1_STOPS_BEFORE_BODY");}
      if(name==="confirm-index-lag"){assert.deepEqual(found.map(x=>x.found),[true,true,true],"LAG_PENDING_TWICE_THEN_CONFIRMED");assert.equal(st.cborReads,3,"CBOR_404_THEN_READ_TWICE");assert.equal(st.historyReads,2,"HISTORY_LAG_THEN_COMPLETE");}
      if(name==="confirm-different-wallet"){assert(!region.includes(B),"CONFIRMATION_NEVER_NAMES_CONNECTED_WALLET");assert((await viewOf()).account===B,"DIFFERENT_WALLET_CONNECTED");}
      if(name==="status-disconnect"){assert.equal((await viewOf()).walletId,null,"DISCONNECTED_DURING_CHECK");assert.equal(await page.getByRole("button",{name:"Disconnect wallet"}).count(),0);}
     }else if(name==="confirm-unknown-outcome"){
      await page.getByText("Submission outcome is unknown.",{exact:false}).waitFor({timeout:65000});let v=await viewOf();for(let i=0;i<20&&!v.statusRunning;i++){await page.waitForTimeout(100);v=await viewOf();}record.statusUntil=v.statusUntil;
      assert(v.statusRunning&&Number.isSafeInteger(v.statusUntil),"POLL_RUNNING_AFTER_UNKNOWN");const origin0=v.statusUntil-180000;
      assert(origin0<=record.statusAttempt.clock&&record.statusAttempt.clock-origin0<1000,"DEADLINE_MEASURED_FROM_DISPATCH");
      await waitTerminal(40000);await confirmedState("This stake account currently delegates to EASY1.");
     }else if(name==="confirm-timeout"){
      // Fixed real-time observation 185 s after dispatch; state is read without first waiting for any text.
      await page.waitForFunction(at=>performance.now()-at>=185000,record.statusAttempt.at,{timeout:200000,polling:250});
      const text=await statusText(),raw=await stored(),body=await page.locator('#delegate').innerText();record.observedAt185={text,raw};
      assert.equal(text,apology,"APOLOGY_AT_THREE_MINUTES");assert(raw&&JSON.parse(raw).txId===golden.txId,"RECORD_RETAINED_AT_TIMEOUT");assert(body.includes(golden.txId),"ID_SHOWN_AT_TIMEOUT");
      assert.equal(await page.getByRole("button",{name:"Check status"}).count(),1,"CHECK_STATUS_OFFERED");assert(st.trace.every(x=>x.found===false),"ONLY_404_TICKS");
      assert.equal(record.http.filter(x=>x.method==="GET"&&x.at>postAt+181000&&(x.path==="/blocks/latest"||x.path.startsWith("/txs/"))).length,0,"NO_READS_AFTER_BUDGET");
     }else if(["confirm-wrong-body","confirm-same-height-fork","confirm-unreconciled-account"].includes(name)){
      // Victims wait for either terminal state, then check retained storage before any expected text.
      await waitTerminal(60000);const raw=await stored();record.victimTerminal={text:await statusText(),raw};
      assert(raw!==null&&JSON.parse(raw).txId===golden.txId,{"confirm-wrong-body":"RECORD_RETAINED_ON_MISMATCH","confirm-same-height-fork":"RECORD_RETAINED_ON_INCOHERENCE","confirm-unreconciled-account":"RECORD_RETAINED_ON_ACCOUNT_MISMATCH"}[name]);
      assert.equal(await statusText(),inconsistentText,"INCONSISTENT_MESSAGE");record.statusReason=(await viewOf()).statusReason;assert.equal(record.statusReason,{"confirm-wrong-body":"inconsistent:BODY_ID","confirm-same-height-fork":"inconsistent:POINT_RELATION","confirm-unreconciled-account":"inconsistent:ACCOUNT"}[name],"INCONSISTENT_REASON_CODE");assert((await page.locator('#delegate').innerText()).includes(golden.txId),"INCONSISTENT_KEEPS_ID");
      const lookups=st.lookups;await page.waitForTimeout(11000);assert.equal(st.lookups,lookups,"INCONSISTENT_STOPS_POLL");
     }else if(name==="status-cross-tab"){
      await until(()=>st.lookups>=1,15000,"FIRST_TICK");const second=await context.newPage();await second.goto(origin+"/pool");await second.locator('#delegate [role="status"]').waitFor();
      await second.evaluate(()=>{window.held=navigator.locks.request("easy1staking:delegation",{mode:"exclusive"},()=>new Promise(r=>{window.releaseHeld=r;}));});
      await second.waitForFunction(()=>typeof window.releaseHeld==="function",{},{timeout:15000});const holdStart=Date.now(),lookupsAtHold=st.lookups;await page.waitForTimeout(12000);
      record.busyWindow={holdStart,lookupsAtHold,lookupsAfter:st.lookups,reads:statusReads(holdStart+500)};assert.equal(record.busyWindow.reads,0,"BUSY_TICK_SKIPPED");assert.equal(st.lookups,lookupsAtHold,"BUSY_TICK_NO_LOOKUP");
      await second.evaluate(()=>{localStorage.removeItem("easy1staking:delegation-recovery");window.releaseHeld();});
      await page.getByText(changedText,{exact:true}).waitFor({timeout:15000});assert.equal(await statusText(),changedText,"CHANGED_IN_ANOTHER_TAB");
      assert((await page.locator('#delegate').innerText()).includes(golden.txId),"CHANGED_KEEPS_ID");assert.equal(await stored(),null,"NOTHING_HEALED");
      const v=await viewOf();assert.equal(v.recovery.status,"unknown","LOST_NOT_HEALED");assert.equal(v.canCheckStatus,false);assert.equal(await page.getByRole("button",{name:"Check status"}).count(),0);
      const lookups=st.lookups;await page.waitForTimeout(11000);assert.equal(st.lookups,lookups,"CHANGED_STOPS_POLL");await second.close();
     }else if(name==="status-dispose"){
      await page.waitForURL(origin+"/",{timeout:20000});await until(()=>st.navigatedAt,15000,"DISPOSED_DURING_CHECK");await page.waitForTimeout(12000);
      record.afterDispose={reads:statusReads(st.navigatedAt+1000),raw:await stored()};assert.equal(record.afterDispose.reads,0,"NO_STATUS_AFTER_DISPOSE");
      assert(record.afterDispose.raw&&JSON.parse(record.afterDispose.raw).stage==="submitted","DISPOSE_RETAINS_RECORD");
     }else if(name==="check-status-after-reload"){
      await until(()=>st.lookups>=1,15000,"FIRST_TICK");await page.waitForTimeout(1000);
      await page.evaluate(()=>sessionStorage.setItem("synthetic:throwingWallet","1"));const reloadAt=Date.now();await page.reload();await page.locator('#delegate [role="status"]').waitFor();
      await page.getByRole("button",{name:"Check status"}).waitFor({timeout:15000});st.reloaded=true;await page.waitForTimeout(3000);
      record.afterReload={automaticReads:statusReads(reloadAt)};assert.equal(record.afterReload.automaticReads,0,"NO_AUTOMATIC_STATUS_ON_RELOAD");
      await page.getByRole("button",{name:"Check status"}).click();await waitTerminal(35000);await confirmedState("This stake account currently delegates to EASY1.");
      const w=await walletAt();record.afterReload.wallet=w;assert.deepEqual(w,{enableCalls:0,signCalls:0,walletReads:0,throwing:0},"ZERO_WALLET_CALLS_AFTER_RELOAD");
     }
     if(name!=="check-status-after-reload")assert.deepEqual(await walletAt(),baseline,"STATUS_ZERO_WALLET_CALLS");
     assert.equal(record.posts.length,1,"STATUS_ZERO_POST");
     const foreign=record.http.filter(x=>x.at>postAt&&!(x.method==="GET"&&(x.path==="/blocks/latest"||x.path.startsWith("/txs/")||x.path.startsWith("/blocks/")||x.path.startsWith("/accounts/"+account))));
     assert.deepEqual(foreign.map(x=>x.method+" "+x.path),[],"STATUS_READ_ONLY_NO_BUILD_READS");
     record.statusTrace=st.trace;
    }else{
     await page.getByText("Submitted to Blockfrost.",{exact:false}).waitFor({timeout:name==="long-consent"?45000:name==="post-reply-timely-hidden"?35000:15000});
     await page.waitForTimeout(1500); // Fixed settle window: a late duplicate dispatch is intercepted asynchronously.
     if(name==="long-consent"){record.realConsentElapsedMs=await page.evaluate(()=>window.synthetic.replyAt-window.synthetic.signAt);assert(record.realConsentElapsedMs>=31000,'CONSENT_MAY_EXCEED_30_SECONDS');}assert.equal(record.posts.length,1,"ONE_POST");assert.equal(await page.evaluate(()=>window.synthetic.submitDispatches),1,"ONE_DISPATCH");assert.equal(await page.evaluate(()=>window.synthetic.signCalls),1);const retained=await page.evaluate(()=>JSON.parse(localStorage.getItem("easy1staking:delegation-recovery")));assert.equal(retained.txId,record.signatures[0].txId);assert.equal(retained.stage,"submitted");record.recovery=retained;
     if(name==="origin-recovery"){await page.reload();await page.getByText('A prior operation is unresolved',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Connect selected wallet'}).count(),0);assert.equal(record.posts.length,1);}
     if(name==="isolated-context"){const isolated=await browser.newContext();const p=await isolated.newPage();await p.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===origin?route.continue():route.abort();});await p.goto(origin+'/pool');assert.equal(await p.evaluate(()=>localStorage.getItem('easy1staking:delegation-recovery')),null,'ORIGIN_CONTEXTS_DO_NOT_SHARE');await isolated.close();}
     const signed=record.signatures[0];assert.equal(pythonHash(signed.bodyHex),signed.txId,"INDEPENDENT_ID");assert.deepEqual(Object.keys(retained),["schemaVersion","networkId","poolId","txId","invalidHereafterSlot","inputRefs","createdAt","stage"]);
    }
    record.actual=await page.evaluate(()=>({submitDispatches:window.synthetic.submitDispatches,enableCalls:window.synthetic.enableCalls,signCalls:window.synthetic.signCalls,replyAt:window.synthetic.replyAt,attemptAt:window.synthetic.attemptAt??null,visibilityTransition:window.synthetic.visibilityTransition??null,visibility:document.visibilityState,faultAt:window.synthetic.faultAt??null,faultKind:window.synthetic.faultKind??null,retainedAtAttempt:window.synthetic.retainedAtAttempt??null,tripwires:window.synthetic.tripwires,phaseText:document.querySelector('#delegate [role="status"]')?.textContent??null}));assert.deepEqual(record.actual.tripwires,[]);assert.deepEqual(record.errors,[],"NO_PAGE_ERRORS_BEFORE_CLOSE");assert(!(await page.locator('body').innerText()).includes('SYNTHETIC_PRIVATE_CANARY'),"ERROR_REDACTION");if(["post-reply-deadline-hidden","post-reply-timely-hidden"].includes(name)){
     assert.equal(record.actual.visibility,"hidden","CONTROLLED_HIDDEN_DOCUMENT");assert.equal(record.actual.visibilityTransition?.after,"hidden");assert(record.actual.visibilityTransition.at>=record.actual.replyAt,"HIDDEN_AFTER_AUTHENTIC_REPLY");assert.equal(record.actual.signCalls,1);assert.equal(record.actual.enableCalls,5,"NO_VISIBLE_POLL_REACQUISITION");
     record.constructionSlot=Number(baseSlot);record.currentSlots=record.http.filter(x=>x.path==="/blocks/latest").map(x=>x.slot);
     if(name==="post-reply-timely-hidden"){record.realPostReplyElapsedMs=record.actual.attemptAt-record.actual.replyAt;assert(record.realPostReplyElapsedMs>=fixture.postReplyReadDelayMs*3&&record.realPostReplyElapsedMs<30000,"TIMELY_HIDDEN_EXACT_POST_WITHIN_TOTAL_BUDGET");}
    }
    if(["storage-final-loss","storage-final-replaced"].includes(name)){
     assert(Number.isFinite(record.actual.faultAt)&&record.actual.faultAt>=0&&record.actual.faultAt>=record.actual.replyAt,"INDEPENDENT_STORAGE_FAULT_OCCURRED");assert.equal(record.actual.faultKind,name,"EXACT_STORAGE_FAULT_KIND");assert.equal(record.actual.attemptAt,null,"GUARDED_STORAGE_FAULT_NO_ATTEMPT");assert.equal(record.actual.retainedAtAttempt,"not-attempted","GUARDED_STORAGE_FAULT_PRECEDES_IO");
    }
    record.passed=true;console.log("PASS actual /pool "+name);
   }catch(error){primary=error;record.failure=failureText(error);throw error;}finally{
    // Settle this case's served-chunk identity reads before any verdict; an unsettled read also disqualifies.
    if(!await Promise.race([Promise.allSettled(caseReads).then(()=>true),new Promise(r=>setTimeout(()=>r(false),10000))]))record.chunkIdentityFailures.push({kind:"unsettled",reads:caseReads.length});
    if(page&&!page.isClosed()){try{record.terminal=await page.evaluate(()=>({text:document.querySelector('#delegate')?.textContent||document.body.textContent,submitDispatches:window.synthetic?.submitDispatches??null,signCalls:window.synthetic?.signCalls,tripwires:window.synthetic?.tripwires,replyAt:window.synthetic?.replyAt??null,attemptAt:window.synthetic?.attemptAt??null,enableCalls:window.synthetic?.enableCalls??null,visibility:document?.visibilityState??null,visibilityTransition:window.synthetic?.visibilityTransition??null,faultAt:window.synthetic?.faultAt??null,faultKind:window.synthetic?.faultKind??null,retainedAtAttempt:window.synthetic?.retainedAtAttempt??null}));}catch{}}
    report.chromium.pids=[...new Set([...report.chromium.pids,...descendants(process.pid).filter(pid=>pid!==server.pid&&!descendants(server.pid).includes(pid))])];
    const later=[],check=fn=>{try{fn();}catch(error){later.push(error);}};
    // Exact declared counts: page dispatches accumulate across this tab's navigations/reloads; intercepted POSTs across the whole context.
    const expected=fixture.expectedCounts[name];record.counts={expected,actual:{submitDispatches:record.terminal?.submitDispatches??null,posts:null}};
    check(()=>assert.equal(record.counts.actual.submitDispatches,expected.submitDispatches,"EXACT_DISPATCH_COUNT "+name));
    // Teardown begins: later chunk-read failures are abandoned at close, not case failures.
    closing=true;if(page&&onResponse)page.off("response",onResponse);
    // Unrouted requests must not reach the network before the context closes.
    await context.setOffline(true);await context.unrouteAll({behavior:"ignoreErrors"});
    await context.close();
    record.counts.actual.posts=record.posts.length;check(()=>assert.equal(record.counts.actual.posts,expected.posts,"EXACT_POST_COUNT "+name));
    check(()=>assert.deepEqual(record.routeHandlerErrors,[],"NO_ROUTE_HANDLER_ERRORS"));
    check(()=>assert.deepEqual(record.chunkReadErrors,[],"NO_CHUNK_READ_ERRORS"));
    check(()=>assert.deepEqual(record.errors,[],"NO_PAGE_ERRORS "+name));
    check(()=>assert(!(record.terminal?.text||'').includes('SYNTHETIC_PRIVATE_CANARY'),"REDACT_RAW_ERROR "+name));
    // A case's first failure is its verdict; later cleanup failures never replace it.
    if(!primary&&later.length){record.passed=false;record.failure=failureText(later[0]);}
    if(later.length>(primary?0:1))record.secondaryFailures=later.slice(primary?0:1).map(failureText);
    // Chunk identity is recorded separately; it disqualifies the case (and any control run on it) without replacing a primary failure.
    const disqualified=record.chunkIdentityFailures.length>0;if(disqualified){record.passed=false;record.disqualified="SERVED_CHUNK_IDENTITY";if(!primary&&!later.length)record.failure="SERVED_CHUNK_IDENTITY_DISQUALIFIED";}
    if(!primary&&later.length)throw later[0];
    if(!primary&&disqualified)throw Error("SERVED_CHUNK_IDENTITY_DISQUALIFIED "+name);
   }
  }
  await Promise.all(pending);assert.deepEqual(report.unexpected,[]);report.passed=true;
 }catch(error){failure=error;report.failure=String(error).split("\n")[0];}
 finally{
  if(browser){await browser.close();await new Promise(r=>setTimeout(r,100));report.cleanup.chromium=report.chromium.pids.map(pid=>{try{const stat=fs.readFileSync(`/proc/${pid}/stat`,'utf8');const state=stat.slice(stat.lastIndexOf(')')+2).split(' ')[0];assert.equal(state,'Z','CHROMIUM_CHILD_RUNNING '+pid);return{pid,state:'terminal-zombie'};}catch(error){if(error.code==='ENOENT')return{pid,state:'exited'};throw error;}});}
  if(server){serverChildren=descendants(server.pid);server.kill("SIGTERM");if(server.exitCode===null)await once(server,"exit");report.cleanup.serverExit=server.exitCode;for(const pid of serverChildren){try{process.kill(pid,0);throw Error("CHILD_STILL_RUNNING "+pid);}catch(e){if(e.code!=="ESRCH")throw e;}}}
  await freePort(port);report.cleanup.portRebound=true;report.cleanup.browserClosed=true;report.cleanup.children=serverChildren;
  if(fs.existsSync(path.join(output,'server-http.jsonl')))report.serverHttp=fs.readFileSync(path.join(output,'server-http.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  fs.writeFileSync(path.join(output,"report.json"),JSON.stringify(report,null,2));
 }
 if(failure)throw failure;console.log("FLOW_RESULT "+JSON.stringify({cases:report.cases.length,passed:report.cases.filter(c=>c.passed).length,buildId:report.buildId,port,cleanup:report.cleanup}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
