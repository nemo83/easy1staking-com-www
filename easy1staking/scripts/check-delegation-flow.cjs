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
// The second operation's reviewed body is a literal; it must equal the accepted registered vector with only its TTL bytes substituted.
{const v=vectors.find(x=>x.registered),b=fixture.secondOperation,hex=n=>BigInt(n).toString(16).padStart(8,"0");assert.equal(BigInt(b.ttl),BigInt(b.constructionSlot)+600n,"SECOND_TTL_RULE");assert.equal(v.bodyHex.split("031a"+hex(v.ttl)).length,2,"UNIQUE_TTL_SEGMENT");assert.equal(b.bodyHex,v.bodyHex.replace("031a"+hex(v.ttl),"031a"+hex(b.ttl)),"SECOND_BODY_IS_TTL_SUBSTITUTION");assert.equal(pythonHash(b.bodyHex),b.txId,"SECOND_LITERAL_ID");assert.notEqual(b.txId,v.txId);}
assert.equal(parseInt("0007a120",16),Number(fixture.insufficientFundsLovelace),"INSUFFICIENT_FUNDS_FIXTURE");
const signers=[keys.paymentSeed,keys.stakeSeed].map(seed=>{const privateKey=crypto.createPrivateKey({key:Buffer.from("302e020100300506032b657004220420"+seed,"hex"),format:"der",type:"pkcs8"});const publicHex=crypto.createPublicKey(privateKey).export({format:"der",type:"spki"}).subarray(-32).toString("hex");return{privateKey,publicHex,hash:pythonHash(publicHex,28)};}).sort((a,b)=>a.hash.localeCompare(b.hash));

async function freePort(port=0){const s=net.createServer();s.listen(port,"127.0.0.1");await once(s,"listening");const p=s.address().port;await new Promise(r=>s.close(r));return p;}
function failureText(error){return(error instanceof assert.AssertionError&&!error.generatedMessage?String(error.message):String(error?.name||"Error")+": "+String(error?.message??error)).split("\n")[0];}
function descendants(pid){try{return fs.readFileSync(`/proc/${pid}/task/${pid}/children`,"utf8").trim().split(/\s+/).filter(Boolean).map(Number).flatMap(p=>[p,...descendants(p)]);}catch{return[];}}
const report={runnerSha256:sha(fs.readFileSync(__filename)),fixtureSha256:sha(fs.readFileSync(path.join(__dirname,'fixtures/delegation-flow.json'))),node:process.version,source:{},cases:[],chunks:[],unexpected:[],errors:[],cleanup:{},buildId:fs.readFileSync(path.join(app,".next/BUILD_ID"),"utf8").trim()};
for(const name of ["controller","wallet-session","coordination","recovery-verifier","builder","guard","crypto","chain-context","wallet-codec","source-cbor","blockfrost-reader","provider-json","cbor","types","messages"]){const file=path.join(app,"src/lib/site/delegation",name+".ts");report.source[name]=fs.existsSync(file)?sha(fs.readFileSync(file)):null;}
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
   const record={name,layout:{samples:[]},http:[],posts:[],signatures:[],tripwires:[],errors:[],routeHandlerErrors:[],chunkReadErrors:[],chunkIdentityFailures:[],chunkReadsAbandonedAtClose:0};report.cases.push(record);const caseReads=[];
   // Route-handler page actions may race case teardown; record their failures instead of throwing.
   const routeStep=async step=>{try{await step();}catch(error){record.routeHandlerErrors.push(String(error?.message??error).split("\n")[0]);}};const s=scenario(name!=="unregistered"),golden=vectors.find(v=>v.registered===(name!=="unregistered"));
   // Status reads for the submitted ID: 404 unless the case's plan includes it; an included transaction is one coherent synthetic chain point.
   const plan=fixture.statusPlans[name]||{notFound:null},otherPool=raw.poolBech32(chain.otherHash),st={lookups:0,inclusion:null,lastTip:null,pinned:null,cborReads:0,historyReads:0,reloaded:false,trace:[],consumed:null,rowsServed:[],holdRows:false,found:false},NOT_FOUND=Symbol("404");
   // Another tab's pending record and a second operation's transaction are not on chain: their status lookups answer 404.
   const unseen=new Set([plan.otherTab&&"/txs/"+fixture.otherTabRecord.txId,plan.secondOperation&&"/txs/"+fixture.secondOperation.txId].filter(Boolean));
   const statusPath=p=>p==="/txs/"+golden.txId||p.startsWith("/txs/"+golden.txId+"/")||!!st.inclusion&&(p==="/blocks/"+st.inclusion.hash||plan.lag&&p==="/accounts/"+account+"/delegations");
   function include(){
    const t=st.lastTip;let slot=BigInt(t.slot)-2n,height=slot-100000000n,hash=id(Number(slot));
    if(plan.above){slot=BigInt(t.slot)+1n;height=slot-100000000n;hash=id(Number(slot));}
    if(plan.fork){st.pinned=t;slot=BigInt(t.slot)-5n;height=BigInt(t.height);hash="f0".repeat(32);}
    // Later fork: the inclusion sits 10 slots back; a later delegation elsewhere is in a different block at the same height, 5 slots on.
    if(plan.laterFork||plan.laterHashReuse){slot=BigInt(t.slot)-10n;height=slot-100000000n;hash=id(Number(slot));}
    // Tip hash reuse: T2 is pinned two slots above T1 and the inclusion block reports T2's hash 5 slots and 5 heights lower.
    if(plan.tipHashReuse){slot=BigInt(st.pinned.slot)-5n;height=slot-100000000n;hash=st.pinned.hash;}
    // T1 hash reuse: T2 is pinned two slots above T1 and the inclusion block reports T1's hash 5 slots and 5 heights lower.
    if(plan.t1HashReuse){slot=BigInt(t.slot)-5n;height=slot-100000000n;hash=t.hash;}
    // Dismissal cases may place the inclusion at a fixed slot (TTL-10: landed before expiry behind a lagging index).
    if(st.inclusionSlot!==undefined){slot=st.inclusionSlot;height=slot-100000000n;hash=id(Number(slot));}
    const time=(1596059091000+Number(slot-4492800n)*1000)/1000,acc=s.routes.get("/accounts/"+account);st.inclusion={slot:Number(slot),height:Number(height),time,hash,index:0};
    acc.pool_id=plan.unreconciled?otherPool:chain.poolId;acc.active=true;
    st.ownHistory={active_epoch:666,tx_hash:golden.txId,amount:"100000000",pool_id:chain.poolId,tx_slot:Number(slot),block_time:time,block_height:Number(height)};
    if(!plan.lag)s.routes.get("/accounts/"+account+"/delegations").push(st.ownHistory);
    // Later hash reuse: the later delegation elsewhere reports the inclusion block's hash at another index, 5 slots and 5 heights on.
    // Later tip fork: T2 is pinned two slots above T1; the later delegation elsewhere is at T2's height in another block, one slot below T2 (above T1).
    if(plan.laterOther||plan.laterFork||plan.laterHashReuse||plan.laterTipFork){const later=id(0x5a5a),q=plan.laterFork?{...point(slot+5n),block_height:Number(height)}:plan.laterHashReuse?{...point(slot+5n),block:hash,index:1}:plan.laterTipFork?{...point(BigInt(st.pinned.slot)-1n),block_height:st.pinned.height}:point(slot+1n);s.txs[later]={hash:later,valid_contract:true,...q,stake_cert_count:0,delegation_count:1,pool_update_count:0,pool_retire_count:0};
     s.routes.set(`/txs/${later}/delegations`,[{cert_index:0,index:0,address:account,pool_id:otherPool,active_epoch:667}]);
     s.routes.get("/accounts/"+account+"/delegations").push({active_epoch:667,tx_hash:later,amount:"100000000",pool_id:otherPool,tx_slot:q.slot,block_time:q.block_time,block_height:q.block_height});acc.pool_id=otherPool;}
   }
   function statusValue(p){
    const tx=golden.txId;
    if(p==="/txs/"+tx){
     st.lookups++;
     if(!st.inclusion){if(!st.found&&(plan.notFound===null||name==="check-status-after-reload"&&!st.reloaded||st.lookups<=plan.notFound)){st.trace.push({lookup:st.lookups,found:false});return NOT_FOUND;}include();}
     st.trace.push({lookup:st.lookups,found:true});const i=st.inclusion;
     return{hash:tx,block:i.hash,block_height:i.height,block_time:i.time,slot:i.slot,index:i.index,output_amount:[{unit:"lovelace",quantity:golden.change}],fees:golden.fee,deposit:golden.deposit,size:golden.signedSize,
      invalid_before:null,invalid_hereafter:golden.ttl,utxo_count:2,withdrawal_count:0,mir_cert_count:0,delegation_count:1,stake_cert_count:golden.registered?0:1,pool_update_count:0,pool_retire_count:0,asset_mint_or_burn_count:0,redeemer_count:0,valid_contract:true,treasury_donation:"0"};
    }
    if(!st.inclusion)return NOT_FOUND;
    st.trace.push({lookup:st.lookups,path:p.replace(tx,"{tx}")});const i=st.inclusion;
    if(p===`/txs/${tx}/cbor`){st.cborReads++;if((plan.lag||st.lagCbor)&&st.cborReads===1)return NOT_FOUND;const sig=record.signatures[0];return{cbor:plan.wrongBody?"84"+golden.bodyHex.replace("021a0002a389","021a0002a38a")+sig.witness+"f5f6":sig.signedHex};}
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
   if(name==="pool-ineligible")s.routes.set("/pools/retiring",[{pool_id:chain.poolId,epoch:666}]);
   // One input below fee plus minimum change, identical in the wallet CBOR and the provider rows.
   if(name==="insufficient-funds"){const amount=[{unit:"lovelace",quantity:fixture.insufficientFundsLovelace}];s.routes.get("/addresses/"+address+"/utxos")[0].amount=amount;s.routes.get(`/txs/${chain.fundingId}/utxos`).outputs[0].amount=clone(amount);}
   const pageOrigin=name==="approved-origin"?"https://easy1staking.com":name==="preview-origin"?"https://preview.easy1staking.com":origin;
   const context=await browser.newContext({viewport:{width:360,height:800},serviceWorkers:"block"});let page,primary,closing=false,onResponse;try{
    // Page-side 360 px layout samples arrive here from every page of the context, across navigations and reloads.
    await context.exposeFunction("syntheticLayout",sample=>{record.layout.samples.push(sample);});
    await context.exposeFunction("syntheticSign",unsigned=>{
     const tips=record.http.filter(x=>x.path==="/blocks/latest");assert(tips.length>=6,"SOURCE_ASSESSMENTS");assert.equal(tips[2].slot,Number(baseSlot),"ORIGINAL_CONSTRUCTION_SLOT");
     const second=!!plan.secondOperation&&record.signatures.length===1,expectedBody=second?fixture.secondOperation.bodyHex:golden.bodyHex,expectedId=second?fixture.secondOperation.txId:golden.txId;assert.equal(pythonHash(expectedBody),expectedId,"LITERAL_GOLDEN_ID");
     assert.equal(unsigned,"84"+expectedBody+"a0f5f6","EXACT_REVIEWED_UNSIGNED_WRAPPER");
     let witness="a10082"+signers.map(key=>"825820"+key.publicHex+"5840"+crypto.sign(null,Buffer.from(expectedId,"hex"),key.privateKey).toString("hex")).join("");
     if(name==="partial-witness")witness="a10081"+witness.slice(6,208);
     if(name==="foreign-witness")witness=witness.replace(signers[0].publicHex,"ab".repeat(32));
     if(name==="invalid-signature")witness=witness.slice(0,-2)+(witness.endsWith("00")?"01":"00");
     record.signatures.push({bodyHex:expectedBody,txId:expectedId,unsigned,fee:golden.fee,deposit:golden.deposit,witness,signedHex:"84"+expectedBody+witness+"f5f6"});return witness;
    });
    await context.addInitScript(({baseTime,chain,mode,delay})=>{
     const NativeDate=Date,realStart=NativeDate.now();class ObservedDate extends NativeDate{constructor(...args){if(args.length)super(...args);else super(baseTime+NativeDate.now()-realStart+(window.synthetic?.clockDeltaMs||0));}static now(){return baseTime+NativeDate.now()-realStart+(window.synthetic?.clockDeltaMs||0);}}window.Date=ObservedDate;
     const state=window.synthetic={realStart,submitDispatches:0,enableCalls:0,signCalls:0,replyAt:null,signAt:null,mode,release:null,tripwires:[],postReadIndex:0,clockDeltaMs:0,network:mode==="wrong-network"?0:1,address:mode==="unsupported-account"?"61"+"aa".repeat(28):chain.addressHex,utxo:"82825820"+chain.fundingId+"00825839"+chain.addressHex+(mode==="insufficient-funds"?"1a0007a120":"1a05f5e100")};
     const nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;let submittingReads=0;
     // Page-level dispatches accumulate across navigations and reloads of this tab through native session storage.
     try{state.submitDispatches=Number(nativeGet.call(sessionStorage,"synthetic:submitDispatches")||0);}catch{}
     if(mode==="locks-unavailable")Object.defineProperty(navigator,'locks',{value:undefined});
     if(mode==="final-barrier-expiry"){const verify=crypto.subtle.verify.bind(crypto.subtle);state.verifyJumps=0;state.verifyJumpMs=0;crypto.subtle.verify=async(...args)=>{const result=await verify(...args);if(state.replyAt!==null){state.clockDeltaMs+=1500;state.verifyJumps++;state.verifyJumpMs+=1500;}return result;};}
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
     if(mode==="status-visible-refresh"){const every=window.setInterval.bind(window);window.setInterval=(fn,ms,...rest)=>every(ms===30000&&typeof fn==="function"?(...a)=>{state.intervalTicks=(state.intervalTicks||0)+1;return fn(...a);}:fn,ms,...rest);}
     const api={getNetworkId:()=>state.failReads?Promise.reject(Error("SYNTHETIC_REFRESH_FAILURE")):read(state.network),getChangeAddress:()=>read(state.address),getRewardAddresses:()=>read([]),getUtxos:()=>read([state.utxo]),async signTx(unsigned,partial){state.signCalls++;state.signAt=performance.now();if(partial!==false)throw Error("PARTIAL_FLAG");if(mode==="sign-declined")throw {code:2,info:"SYNTHETIC_PRIVATE_CANARY"};if(["cancel-approval","account-change","network-change","input-change","registration-change","parameters-change","eligibility-change","same-account-focus"].includes(mode))await new Promise(r=>state.release=r);
      if(mode==="long-consent")await new Promise(r=>setTimeout(r,31000));const witness=await window.syntheticSign(unsigned);state.replyAt=performance.now();
      if(["post-reply-deadline-hidden","post-reply-timely-hidden"].includes(mode)){const before=document.visibilityState;Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});state.visibilityTransition={before,after:document.visibilityState,at:performance.now()};document.dispatchEvent(new Event("visibilitychange"));}
      if(mode.startsWith("presubmit-"))state.clockDeltaMs+=baseTime+(600-Number(mode.slice(10)))*1000-Date.now();
      if(mode==="dismiss-poll-after-expiry")state.clockDeltaMs+=baseTime+(600-130)*1000-Date.now();
      if(mode==="final-barrier-expiry")state.clockDeltaMs+=baseTime+(600-124)*1000-Date.now();
      return witness;},signData:deny("signData"),submitTx:deny("wallet-submit")};
     // After a flagged reload every wallet method throws and is counted; status checking must never call one.
     let throwingWallet=false;try{throwingWallet=nativeGet.call(sessionStorage,"synthetic:throwingWallet")==="1";}catch{}
     state.throwingWalletCalls=0;const refuse=()=>{state.throwingWalletCalls++;throw Error("FORBIDDEN_WALLET_AFTER_RELOAD");};
     window.cardano=mode==="no-wallet"?{}:throwingWallet?{synthetic:{enable:refuse,isEnabled:refuse,getNetworkId:refuse,getChangeAddress:refuse,getRewardAddresses:refuse,getUtxos:refuse,signTx:refuse,signData:refuse,submitTx:refuse}}:{synthetic:{enable:async()=>{state.enableCalls++;if(mode==="connect-denied")throw {code:-3,info:"SYNTHETIC_PRIVATE_CANARY"};return read(api);}}};
     state.controls=[];
     for(const probe of [()=>window.fetch('https://invalid.example'),()=>new XMLHttpRequest(),()=>new WebSocket('wss://invalid.example'),()=>new EventSource('https://invalid.example'),()=>navigator.sendBeacon('https://invalid.example'),()=>api.signData(),()=>api.submitTx(),()=>navigator.storage.persist(),()=>window.gtag()]){try{probe();}catch{}state.controls.push(state.tripwires.pop());}
     // 360 px layout sampler (browser test input only). A MutationObserver on the document records the status-line text and the rendered phase on every batch.
     // The three overflow probes run only on batches where styles are applied: parsing is done and every stylesheet link has its sheet. Earlier parse-time
     // batches are counted (styled:false), never probed, because the browser never paints that unstyled state. Once styles apply, one probe also runs on the
     // next animation frame, so the first styled state is measured even when no further mutation follows.
     // Page: scrollWidth beyond clientWidth. Elements and text nodes (Range rects) inside #delegate: right edge beyond clientWidth + 0.5, outside overflow-x auto/scroll containers.
     const scrolled=n=>{for(let e=n.parentElement;e&&e!==document.documentElement;e=e.parentElement){const o=getComputedStyle(e).overflowX;if(o==="auto"||o==="scroll")return true;}return false;};
     const label=e=>e?e.tagName.toLowerCase()+(e.id?"#"+e.id:"")+(typeof e.className==="string"&&e.className.trim()?"."+e.className.trim().split(/\s+/).join("."):""):null;
     const probe=()=>{const root=document.documentElement,limit=root.clientWidth+0.5,delegate=document.getElementById("delegate"),out={page:root.scrollWidth>root.clientWidth,elements:[],texts:[]};
      if(delegate){for(const e of delegate.querySelectorAll("*")){const r=e.getBoundingClientRect();if(r.right>limit&&!scrolled(e))out.elements.push({node:label(e),right:r.right});}
       const walk=document.createTreeWalker(delegate,NodeFilter.SHOW_TEXT);for(let n=walk.nextNode();n;n=walk.nextNode()){if(!n.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(n);if([...range.getClientRects()].some(r=>r.right>limit)&&!scrolled(n))out.texts.push({parent:label(n.parentElement),text:n.textContent.slice(0,80)});}}
      return out;};
     const styled=()=>document.readyState!=="loading"&&[...document.querySelectorAll('link[rel="stylesheet"]')].every(l=>l.sheet!==null);
     // The rendered phase is read from the panel's React state (a pure read; the controller is never called).
     const renderedPhase=()=>{try{const d=document.getElementById("delegate"),key=d&&Object.keys(d).find(k=>k.startsWith("__reactFiber$"));for(let f=key?d[key]:null;f;f=f.return)for(let h=f.memoizedState;h&&typeof h==="object"&&"next" in h;h=h.next){const v=h.memoizedState;if(v&&typeof v==="object"&&typeof v.phase==="string"&&"recovery" in v)return v.phase;}}catch{}return null;};
     state.probe=probe;state.styled=styled;state.renderedPhase=renderedPhase;state.layoutBatches=0;state.preStyleBatches=0;state.probedSamples=0;let lastSample="",framed=false;
     const send=s=>{if(typeof window.syntheticLayout==="function")window.syntheticLayout(s).catch(()=>{});};
     const sample=frame=>{try{const status=document.querySelector('#delegate [role="status"]')?.textContent??null,phase=renderedPhase();
      if(!styled()){state.preStyleBatches++;send({path:location.pathname,status,phase,styled:false,fired:false,at:Date.now()});return;}
      state.probedSamples++;let p;try{p=probe();}catch(error){p={page:false,elements:[],texts:[],error:String(error)};}
      const s={path:location.pathname,status,phase,styled:true,frame,page:p.page,elements:p.elements,texts:p.texts,error:p.error??null};
      s.fired=!!(s.error||s.page||s.elements.length||s.texts.length);const key=JSON.stringify([s.path,s.status,s.phase,s.fired]);if(key===lastSample&&!s.fired&&!frame)return;lastSample=key;s.at=Date.now();send(s);
      if(!framed){framed=true;requestAnimationFrame(()=>sample(true));}}catch{}};
     // Styles can apply with no further mutation: a frame watch probes the first styled state once.
     const watch=()=>{if(framed)return;try{if(styled()){framed=true;sample(true);return;}}catch{}requestAnimationFrame(watch);};requestAnimationFrame(watch);
     new MutationObserver(()=>{state.layoutBatches++;sample(false);}).observe(document,{subtree:true,childList:true,characterData:true,attributes:true});
    },{baseTime,chain,mode:name,delay:fixture.postReplyReadDelayMs});
    await context.route("**/*",async route=>{
     const request=route.request(),u=new URL(request.url());if(u.origin===pageOrigin&&request.method()==="GET"){
      if(pageOrigin===origin)return route.continue();const local=await fetch(origin+u.pathname+u.search);return route.fulfill({status:local.status,headers:Object.fromEntries([...local.headers].filter(([k])=>!["content-encoding","content-length","transfer-encoding"].includes(k))),body:Buffer.from(await local.arrayBuffer())});
     }
     if(u.origin!=="https://cardano-mainnet.blockfrost.io"||!u.pathname.startsWith("/api/v0/")){report.unexpected.push({url:request.url(),method:request.method()});return route.abort();}
     const p=u.pathname.slice(7),entry={url:request.url(),method:request.method(),path:p,at:Date.now()};record.http.push(entry);
     if(request.method()==="POST"){
      assert.equal(p,"/tx/submit");const bytes=request.postDataBuffer(),expected=record.signatures[record.signatures.length-1];assert(expected,"SIGN_BEFORE_POST");assert.equal(bytes.toString("hex"),expected.signedHex,"EXACT_GUARDED_POST_BYTES");assert.equal(request.headers()["content-type"],"application/cbor");record.posts.push({txId:expected.txId,hex:bytes.toString("hex"),at:Date.now()});
      if(name==="submit-timeout"||name==="confirm-unknown-outcome")await new Promise(r=>setTimeout(r,61000));
      // The tab "resumes" after the POST is dispatched and before status starts: the existing synthetic page clock moves past dispatch + 180 s.
      if(name==="confirm-resumed-after-deadline"||plan.visibleRefresh)await routeStep(async()=>{record.walletAtPost=await page.evaluate(()=>({enableCalls:window.synthetic.enableCalls,signCalls:window.synthetic.signCalls,walletReads:window.synthetic.walletReads||0,throwing:window.synthetic.throwingWalletCalls}));});
      // Dismissal cases resume the same way (except the poll case), so status work shows the apology with no reads; the poll case moves to TTL + 2 s instead.
      if(name==="dismiss-poll-after-expiry")await routeStep(async()=>{record.clockJump=await page.evaluate(target=>{const before=Date.now();window.synthetic.clockDeltaMs+=target-Date.now();return{target,before,after:Date.now()};},baseTime+600*1000+2000);});
      if(name==="confirm-resumed-after-deadline"||name.startsWith("dismiss-")&&name!=="dismiss-poll-after-expiry")await routeStep(async()=>{record.clockJump=await page.evaluate(()=>{const before=Date.now();window.synthetic.clockDeltaMs+=181000;return{ms:181000,before,after:Date.now()};});});
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
      // A visible wallet refresh while the first check's transaction lookup is in flight.
      if(plan.visibleRefresh&&p==="/txs/"+golden.txId&&st.lookups===0&&!st.refresh)await routeStep(async()=>{const counts=()=>page.evaluate(()=>({enableCalls:window.synthetic.enableCalls,walletReads:window.synthetic.walletReads||0,visibility:document.visibilityState}));
       const before=await counts();await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await page.waitForFunction(n=>window.synthetic.enableCalls>n,before.enableCalls,{timeout:5000,polling:50});await page.waitForTimeout(500);st.refresh={before,after:await counts(),at:Date.now()};});
      value=statusValue(p);entry.status=value===NOT_FOUND?404:200;
      if(value===NOT_FOUND)return route.fulfill({status:404,contentType:"application/json",body:'{"status_code":404,"error":"Not Found","message":"The requested component has not been found."}',headers:{"access-control-allow-origin":"*"}});
     }else if(unseen.has(p)){entry.status=404;return route.fulfill({status:404,contentType:"application/json",body:'{"status_code":404,"error":"Not Found","message":"The requested component has not been found."}',headers:{"access-control-allow-origin":"*"}});
     }else if(name.startsWith("dismiss-")&&name!=="dismiss-missing-rows"&&p===`/txs/${chain.fundingId}/utxos`&&record.posts.length){
      // W7 eligibility rows after the POST: every funding output carries an own consumed_by_tx key (the case's spender, null by default); a held read waits 3 s first.
      const held=st.holdRows;if(held){st.holdRows=false;st.heldAt=Date.now();await new Promise(r=>setTimeout(r,3000));st.heldUntil=Date.now();}
      value=clone(s.routes.get(p));value.outputs=value.outputs.map(o=>({...o,consumed_by_tx:st.consumed}));entry.consumed=st.consumed;
      st.rowsServed.push({consumed:st.consumed,ownKey:value.outputs.every(o=>Object.prototype.hasOwnProperty.call(o,"consumed_by_tx")),held});
      // A held read can outlive its page (Keep, dispose, navigation): its late fulfilment is recorded, never thrown from the route handler.
      if(held)try{return await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(value),headers:{"access-control-allow-origin":"*"}});}catch(error){st.heldFulfilment=String(error?.message??error).split("\n")[0];return;}
     }else if(p==="/blocks/latest"){
      // A navigation or reload can destroy the page context mid-read; that read then fails as transport, never as a handler crash.
      const observed=await page.evaluate(()=>({now:Date.now(),afterReply:window.synthetic.replyAt!==null,jump:window.synthetic.clockDeltaMs})).catch(()=>null);if(!observed)return route.abort();
      const slot=observed.afterReply||observed.jump>0?baseSlot+BigInt(Math.floor((observed.now-baseTime)/1000)):baseSlot;
      const at=n=>({slot:Number(n),epoch:664,hash:n===baseSlot?chain.tipHash:id(Number(n)),height:Number(n-100000000n),time:(baseTime+Number(n-baseSlot)*1000)/1000});
      // Split tips: the first read after the POST pins T2 at the live tip and answers T1 two slots below it, so T1 and T2 differ.
      if((plan.tipHashReuse||plan.t1HashReuse||plan.laterTipFork)&&record.posts.length&&!st.pinned){st.pinned=at(slot);value=at(slot-2n);}
      // Rollback during final confirmation: the recheck's first tip read answers the live tip and its second 3 slots lower.
      else if(st.rollback&&st.rollback.reads<2){if(!st.rollback.live)st.rollback.live=at(slot);value=st.rollback.reads++===0?st.rollback.live:at(BigInt(st.rollback.live.slot)-3n);}
      else value=st.pinned??at(slot);entry.slot=value.slot;st.lastTip=value;
     }else value=s.routes.has(p)?s.routes.get(p):p.startsWith("/txs/")?s.txs[p.slice(5)]:undefined;
     assert.notEqual(value,undefined,"EXPLICIT_SOURCE_FIXTURE "+p);if(Array.isArray(value)&&u.searchParams.has("page")){const n=Number(u.searchParams.get("page"));value=value.slice((n-1)*100,n*100);}
     return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(value),headers:{"access-control-allow-origin":"*"}});
    });
    page=await context.newPage();page.on("pageerror",e=>record.errors.push(String(e)));
    const statusLine=()=>page.evaluate(()=>document.querySelector('#delegate [role="status"]')?.textContent||"");
    const currentView=()=>page.evaluate(()=>{let fiber=Object.entries(document.getElementById('delegate')).find(([k])=>k.startsWith('__reactFiber$'))[1];for(;fiber;fiber=fiber.return){let state=fiber.memoizedState;while(state){const c=state.memoizedState?.current;if(c?.getView&&c?.approve)return JSON.parse(JSON.stringify(c.getView()));state=state.next;}}throw Error('CONTROLLER_REF_NOT_FOUND');});
    // Exact stop copy and machine reason for the listed pre-send stops, after a fixed settle; the text is asserted before the reason.
    const stopCopy=async()=>{const expect=fixture.stopCopies[name];if(!expect)return;await page.waitForTimeout(500);const text=await statusLine(),v=await currentView();record.stop={text,phase:v.phase,failureReason:v.failureReason};assert.equal(text,expect.text,"STOP_COPY");assert.equal(v.failureReason,expect.reason,"STOP_REASON");};
    // Each served-chunk read is handled when created and settled in this case's finally: a mismatch or failed read while active disqualifies the case; one cut off by teardown is counted.
    onResponse=response=>{const u=new URL(response.url());if(u.pathname.startsWith("/_next/static/")&&u.pathname.endsWith(".js")){const read=response.body().then(bytes=>{try{const file=path.join(app,".next",u.pathname.replace("/_next/","")),actual=sha(bytes),expected=sha(fs.readFileSync(file));report.chunks.push({path:u.pathname,sha256:actual,bytes:bytes.length});if(actual!==expected)record.chunkIdentityFailures.push({kind:"mismatch",path:u.pathname,actual,expected});}catch(error){record.chunkIdentityFailures.push({kind:"identity-error",path:u.pathname,failure:failureText(error)});}},error=>{if(closing)record.chunkReadsAbandonedAtClose++;else{record.chunkReadErrors.push(failureText(error));record.chunkIdentityFailures.push({kind:"read-error",path:u.pathname,failure:failureText(error)});}});read.catch(()=>{});caseReads.push(read);pending.push(read);}};page.on("response",onResponse);
    await page.goto(pageOrigin+"/pool?uri=https%3A%2F%2Finvalid.example");await page.locator('#delegate [role="status"]').waitFor();
    await page.getByLabel("Wallet",{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.synthetic.enableCalls),0,"NO_AUTO_ENABLE");assert.equal(await page.evaluate(()=>window.synthetic.control),"beacon","TRIPWIRE_RESPONDS");assert.deepEqual(await page.evaluate(()=>window.synthetic.controls),['unexpected-fetch','xhr','socket','events','beacon','signData','wallet-submit','persist-prompt','analytics'],'ALL_TRIPWIRES_RESPOND');
    assert(await page.getByText("On mobile, open this exact page",{exact:false}).isVisible());if(pageOrigin===origin)assert.equal(await page.locator('a[href^="web+cardano:"]').count(),0,"LOCAL_ORIGIN_NO_HOP");
    else{await page.locator('a[href^="web+cardano:"]').waitFor();assert.equal(await page.locator('a[href^="web+cardano:"]').getAttribute("href"),"web+cardano://browse/v1?uri="+encodeURIComponent(pageOrigin+"/pool"),"EXACT_APPROVED_ORIGIN_HOP");}
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"NO_360PX_OVERFLOW");
    // The page-side probes respond: a planted 400 px element and a planted unbroken 120-character text node in a 100 px block, then all three clear.
    record.layoutSelfTest=await page.evaluate(()=>{const d=document.getElementById("delegate"),probe=window.synthetic.probe,n=x=>({page:x.page,elements:x.elements.length,texts:x.texts.length});
     const wide=document.createElement("div");wide.style.width="400px";wide.style.height="1px";d.appendChild(wide);const withWide=n(probe());wide.remove();
     const box=document.createElement("div");box.style.width="100px";box.style.whiteSpace="nowrap";box.style.wordBreak="normal";box.style.overflowWrap="normal";box.appendChild(document.createTextNode("x".repeat(120)));d.appendChild(box);const withText=n(probe());box.remove();
     return{withWide,withText,clean:n(probe())};});
    assert(record.layoutSelfTest.withWide.elements>0&&record.layoutSelfTest.withText.texts>0&&!record.layoutSelfTest.clean.page&&record.layoutSelfTest.clean.elements===0&&record.layoutSelfTest.clean.texts===0,"LAYOUT_PROBES_RESPOND");
    if(name==="no-wallet"){assert.equal(await page.getByLabel("Wallet",{exact:true}).locator("option").count(),1);assert.equal(record.posts.length,0);record.passed=true;console.log("PASS actual /pool "+name);continue;}
    await page.getByLabel("Wallet",{exact:true}).selectOption("synthetic");if(name==="registered"){await page.getByLabel("Wallet",{exact:true}).focus();await page.keyboard.press("Tab");assert.equal(await page.getByRole("button",{name:"Connect selected wallet"}).evaluate(e=>document.activeElement===e),true,"KEYBOARD_CONNECT_FOCUS");await page.keyboard.press("Enter");}else await page.getByRole("button",{name:"Connect selected wallet"}).click();if(fixture.connectRefusals[name]){
     // Exact per-case copy: wait until the connect settles (rendered phase refused, already-EASY1 or ready), a fixed settle, then the text before the reason.
     const expect=fixture.connectRefusals[name];await page.waitForFunction(()=>["refused","already-EASY1","ready"].includes(window.synthetic.renderedPhase()),{},{timeout:20000,polling:100});await page.waitForTimeout(500);
     const text=await statusLine(),v=await currentView();record.refusal={text,phase:v.phase,failureReason:v.failureReason};assert.equal(text,expect.text,"REFUSAL_COPY");if(expect.reason!==null)assert.equal(v.failureReason,expect.reason,"REFUSAL_REASON");
     if(name==="pool-ineligible")assert.equal(await page.getByRole("button",{name:"Build delegation review"}).count(),0,"NO_BUILD_WHEN_INELIGIBLE");
     assert.equal(await page.evaluate(()=>window.synthetic.signCalls),0);assert.equal(record.posts.length,0);record.passed=true;console.log("PASS actual /pool "+name);continue;
    }
    await page.getByRole("button",{name:"Build delegation review"}).waitFor({timeout:15000});
    assert.equal(await page.locator('a[href^="web+cardano:"]').count(),0,'NO_CONNECTED_ORIGIN_HOP');
    if(name==="storage-unavailable"||name==="locks-unavailable"){
     await page.getByRole("button",{name:"Build delegation review"}).click();await page.waitForFunction(()=>/coordination/.test(document.querySelector('#delegate [role="status"]').textContent));assert.equal(record.posts.length,0);assert.equal(await page.evaluate(()=>window.synthetic.signCalls),0,'CAPABILITY_REFUSAL_NO_SIGN');record.passed=true;console.log("PASS actual /pool "+name);continue;
    }
    if(name==="insufficient-funds"){
     await page.getByRole("button",{name:"Build delegation review"}).click();await page.waitForFunction(()=>/^Delegation stopped before sending/.test(document.querySelector('#delegate [role="status"]')?.textContent||""),{},{timeout:15000});
     assert.equal(await page.getByRole("button",{name:"Approve and sign in wallet"}).count(),0,"NO_REVIEW_WITHOUT_FUNDS");await stopCopy();assert.equal(await page.evaluate(()=>window.synthetic.signCalls),0,"INSUFFICIENT_FUNDS_NO_SIGN");assert.equal(record.posts.length,0);record.passed=true;console.log("PASS actual /pool "+name);continue;
    }
    assert.equal(await page.evaluate(()=>window.synthetic.signCalls),0,"NO_SIGN_BEFORE_REVIEW");await page.getByRole("button",{name:"Build delegation review"}).click();await page.getByRole("button",{name:"Approve and sign in wallet"}).waitFor();
    assert(await page.getByText("Exact fee: "+(BigInt(golden.fee)/1000000n)+"."+(BigInt(golden.fee)%1000000n).toString().padStart(6,"0")+" ADA",{exact:true}).isVisible(),"EXACT_FEE_VISIBLE");
    assert(await page.getByText("Separate registration deposit:",{exact:false}).isVisible());assert(await page.getByText("Review expires:",{exact:false}).isVisible());assert.equal(await page.evaluate(()=>window.synthetic.signCalls),0);
    if(["cancel-review","disconnect-review","dispose-review"].includes(name)){
     if(name==="dispose-review")await page.goto(origin+"/");else await page.getByRole("button",{name:name==="cancel-review"?"Cancel here":"Disconnect wallet"}).click();
     await page.waitForTimeout(100);assert.equal(record.posts.length,0);assert.equal(await page.evaluate(()=>window.synthetic.signCalls),0);
     if(name!=="dispose-review"){
      await page.waitForFunction(review=>document.querySelector('#delegate [role="status"]')?.textContent!==review,"Review the account, EASY1 target, exact fee, separate deposit and expiry before approving.",{timeout:5000,polling:50});await page.waitForTimeout(300);
      const text=await statusLine(),v=await currentView();record.cancel={text,phase:v.phase,failureReason:v.failureReason,disconnectedLine:await page.getByText(fixture.cancelCopies.disconnected,{exact:true}).count()};
      assert.equal(text,fixture.cancelCopies.idle,"CANCEL_IDLE_COPY");if(name==="cancel-review")assert.equal(v.failureReason,"stop:cancel-idle","CANCEL_REASON");else assert(await page.getByText(fixture.cancelCopies.disconnected,{exact:true}).isVisible(),"WALLET_DISCONNECTED_LINE");
     }
     record.passed=true;console.log("PASS actual /pool "+name);continue;
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
     await page.getByRole("button",{name:"Approve and sign in wallet"}).click();await page.getByText("Delegation stopped before sending.",{exact:false}).waitFor();assert.equal(await page.evaluate(()=>window.synthetic.signCalls),0,"PRESIGN_179_NO_SIGN");assert.equal(record.posts.length,0);await stopCopy();record.passed=true;console.log("PASS actual /pool "+name);continue;
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
     const text=await statusLine(),v=await currentView();record.cancel={text,phase:v.phase,failureReason:v.failureReason};assert.equal(text,fixture.cancelCopies.open,"CANCEL_OPEN_COPY");assert.equal(v.failureReason,"stop:cancel-open","CANCEL_REASON");
    }else if(["post-reply-deadline","post-reply-deadline-hidden"].includes(name)){
     await page.waitForFunction(()=>window.synthetic.replyAt!==null);const reply=await page.evaluate(()=>window.synthetic.replyAt);await page.waitForTimeout(32500);record.realPostReplyElapsedMs=await page.evaluate(reply=>performance.now()-reply,reply);assert(record.realPostReplyElapsedMs>30000,"REAL_TOTAL_REPLY_WINDOW");assert.equal(record.posts.length,0,"POST_REPLY_DEADLINE_ZERO_POST");await stopCopy();
    }else if(["account-change","network-change","input-change","registration-change","parameters-change","eligibility-change","partial-witness","foreign-witness","invalid-signature","storage-prepare-fail","storage-readback-fail","storage-final-loss","storage-final-replaced","presubmit-119","final-barrier-expiry","sign-declined"].includes(name)){
     await page.waitForFunction(()=>/Delegation stopped before sending|Submitted to Blockfrost|Submission outcome is unknown/.test(document.querySelector('#delegate [role="status"]')?.textContent||''),{},{timeout:15000});assert.equal(record.posts.length,0,"FORBIDDEN_POST_SIGN_VETO "+name);
     if(name==="final-barrier-expiry")record.barrier={stoppedAt:Date.now(),...await page.evaluate(()=>({pageNow:Date.now(),verifyJumps:window.synthetic.verifyJumps,verifyJumpMs:window.synthetic.verifyJumpMs}))};
     if(name==="sign-declined")assert.equal(await page.evaluate(()=>window.synthetic.signCalls),1,"ONE_DECLINED_SIGN");await stopCopy();
     if(name==="final-barrier-expiry"){
      // Recorded evidence, not pass/fail (r3 note (c)): verify jumps, the source margin (TTL minus the last /blocks/latest slot served before the stop) and the wall margin (TTL minus the page-clock slot at the stop).
      const b=record.barrier,ttl=Number(baseSlot)+600,tips=record.http.filter(x=>x.path==="/blocks/latest"&&x.at<=b.stoppedAt&&x.slot!==undefined);b.ttl=ttl;b.lastTipSlot=tips.length?tips[tips.length-1].slot:null;b.sourceMargin=b.lastTipSlot===null?null:ttl-b.lastTipSlot;
      b.wallSlot=Number(baseSlot)+Math.floor((b.pageNow-baseTime)/1000);b.wallMargin=ttl-b.wallSlot;b.TIP_MARGIN_HELD=b.sourceMargin!==null&&b.sourceMargin>=120;b.VERIFY_JUMPS=b.verifyJumps>=4;
      // beginAttempt precedes finalBarrier, so its veto keeps the golden intent at stage submitting (no clearing or rebuild exception on this path).
      b.stored=await page.evaluate(()=>localStorage.getItem("easy1staking:delegation-recovery"));const kept=b.stored===null?null:JSON.parse(b.stored);assert(kept!==null&&kept.txId===golden.txId&&kept.stage==="submitting","BARRIER_VETO_RETAINS_INTENT");
     }
    }else if(name.startsWith("submit-")||name==="cancel-transmission"||name==="storage-after-transmission"){
     await page.getByText("Submission outcome is unknown.",{exact:false}).waitFor({timeout:65000});assert.equal(record.posts.length,1,"ONE_POSSIBLE_TRANSMISSION");const text=await page.locator('#delegate').innerText();assert(text.includes(record.signatures[0].txId),"UNKNOWN_RETAINS_DERIVED_ID");assert(!text.includes('SYNTHETIC_PRIVATE_CANARY'),"REDACT_RAW_ERROR");await page.waitForTimeout(name==="submit-timeout"?1000:200);assert.equal(record.posts.length,1,"NO_AUTOMATIC_RETRY");assert.equal(await page.evaluate(()=>window.synthetic.submitDispatches),1,"ONE_POSSIBLE_DISPATCH");record.unknownRetained=true;
    }else if(fixture.statusPlans[name]){
     // Status cases: identical registered submission, then read-only status work. Each waits on a terminal state or a fixed real-time observation.
     const apology="Sorry, we couldn't confirm your delegation yet. Confirmation usually takes about 20 seconds but can take longer. Please check again here in a few minutes, or check later in your wallet.";
     const inconsistentText="We found this transaction but couldn't verify it consistently. Nothing was cleared. Check again later, or check it in your wallet or a chain explorer.";
     const otherPendingText="Another delegation from this browser is pending. Keep its transaction ID and check its status.";
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
     // The confirmed result keeps its copy and its own caption whatever the wallet/action phase now shows.
     async function kept(label){
      const n=await page.locator('[aria-label="Delegation confirmation"]').count(),region=n?await page.locator('[aria-label="Delegation confirmation"]').innerText():"",body=await page.locator('#delegate').innerText();
      record.protected=(record.protected||[]).concat([{label,status:await statusText(),region}]);
      assert(region.includes("Transaction ID — confirmed on chain")&&region.includes(golden.txId)&&(region.includes(record.confirmedText)||(await statusText())===record.confirmedText)&&!body.includes("outcome pending or unknown")&&!body.includes("submitted, confirmation pending"),label);
     }
     await page.waitForFunction(()=>window.synthetic.attemptClock!==undefined,{},{timeout:15000});
     record.statusAttempt=await page.evaluate(()=>({clock:window.synthetic.attemptClock,at:window.synthetic.attemptAt}));
     // attemptClock witnesses only the page's fetch call; the route handler records the POST asynchronously. Latch on that record (bounded) before reading it.
     // The latch only waits: postAt stays the route-recorded time and product budgets keep the page-side dispatch time (statusAttempt) as their origin.
     await until(()=>record.posts.length>0,10000,"POST_OBSERVED");const postAt=record.posts[0].at;
     const B=chain.addressHex.slice(58)==="cd".repeat(28)?"ce".repeat(28):"cd".repeat(28);
     if(name==="confirm-different-wallet"){
      await page.evaluate(b=>{window.synthetic.address=window.synthetic.address.slice(0,58)+b;},B);
      // A window focus event (browser test input) asks the wallet owner for a fresh observation of the switched account.
      await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
      await page.waitForFunction(b=>document.querySelector('#delegate')?.textContent.includes(b),B,{timeout:15000});record.switchedCredential=B;
     }
     // Hide the document so the wallet owner's visible-only 30 s refresh is idle; any later wallet call would come from status work.
     if(!plan.visibleRefresh)await page.evaluate(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});});await page.waitForTimeout(1000);
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
     }else if(["confirm-wrong-body","confirm-same-height-fork","confirm-unreconciled-account","confirm-later-fork","confirm-later-hash-reuse","confirm-tip-hash-reuse","confirm-t1-hash-reuse","confirm-later-tip-fork"].includes(name)){
      // Victims wait for either terminal state, then check retained storage before any expected text.
      await waitTerminal(60000);const raw=await stored();record.victimTerminal={text:await statusText(),raw};
      assert(raw!==null&&JSON.parse(raw).txId===golden.txId,{"confirm-wrong-body":"RECORD_RETAINED_ON_MISMATCH","confirm-same-height-fork":"RECORD_RETAINED_ON_INCOHERENCE","confirm-unreconciled-account":"RECORD_RETAINED_ON_ACCOUNT_MISMATCH","confirm-later-fork":"RECORD_RETAINED_ON_INCOHERENCE","confirm-later-hash-reuse":"RECORD_RETAINED_ON_INCOHERENCE","confirm-tip-hash-reuse":"RECORD_RETAINED_ON_INCOHERENCE","confirm-t1-hash-reuse":"RECORD_RETAINED_ON_INCOHERENCE","confirm-later-tip-fork":"RECORD_RETAINED_ON_INCOHERENCE"}[name]);
      assert.equal(await statusText(),inconsistentText,"INCONSISTENT_MESSAGE");record.statusReason=(await viewOf()).statusReason;assert.equal(record.statusReason,{"confirm-wrong-body":"inconsistent:BODY_ID","confirm-same-height-fork":"inconsistent:POINT_RELATION","confirm-unreconciled-account":"inconsistent:ACCOUNT","confirm-later-fork":"inconsistent:POINT_PAIR","confirm-later-hash-reuse":"inconsistent:POINT_PAIR","confirm-tip-hash-reuse":"inconsistent:POINT_RELATION","confirm-t1-hash-reuse":"inconsistent:POINT_RELATION","confirm-later-tip-fork":"inconsistent:POINT_RELATION"}[name],"INCONSISTENT_REASON_CODE");assert((await page.locator('#delegate').innerText()).includes(golden.txId),"INCONSISTENT_KEEPS_ID");
      const lookups=st.lookups;await page.waitForTimeout(11000);assert.equal(st.lookups,lookups,"INCONSISTENT_STOPS_POLL");
     }else if(name==="confirm-resumed-after-deadline"){
      // Either terminal-looking text, then a fixed settle; the apology is the first expected text asserted.
      await page.waitForFunction(()=>/^Sorry, we couldn't confirm|^Submitted to Blockfrost/.test(document.querySelector('#delegate [role="status"]')?.textContent||""),{},{timeout:15000,polling:100});await page.waitForTimeout(2000);
      const text=await statusText(),raw=await stored(),v=await viewOf(),pageNow=await page.evaluate(()=>Date.now());record.resumed={text,raw,pageNow,attemptClock:record.statusAttempt.clock,clockJump:record.clockJump,statusRunning:v.statusRunning,phase:v.phase};
      assert(pageNow-record.statusAttempt.clock>180000,"PAGE_CLOCK_PAST_BUDGET");
      assert.equal(text,apology,"APOLOGY_AFTER_RESUME");assert(raw&&JSON.parse(raw).txId===golden.txId,"RECORD_RETAINED_AFTER_RESUME");assert((await page.locator('#delegate').innerText()).includes(golden.txId),"ID_SHOWN_AFTER_RESUME");
      assert.equal(await page.getByRole("button",{name:"Check status"}).count(),1,"CHECK_STATUS_AFTER_RESUME");assert.equal(v.statusRunning,false,"NO_POLL_AFTER_RESUME");
      assert.equal(record.http.filter(x=>x.method==="GET"&&x.at>postAt&&(x.path.startsWith("/txs/")||x.path.startsWith("/blocks/")||x.path.startsWith("/accounts/"))).length,0,"ZERO_STATUS_READS_AFTER_RESUME");
      assert.deepEqual(await walletAt(),record.walletAtPost,"ZERO_WALLET_EFFECTS_AFTER_POST");
      assert.equal(await page.getByRole("button",{name:fixture.dismissalCopy.offer}).count(),0,"NO_DISMISS_OFFER");
     }else if(name==="confirm-then-disconnect"){
      await waitTerminal(60000);await confirmedState("This stake account currently delegates to EASY1.");record.statusCutoff=Date.now();assert.deepEqual(await walletAt(),baseline,"STATUS_ZERO_WALLET_CALLS");
      await page.getByRole("button",{name:"Disconnect wallet"}).click();await page.waitForTimeout(300);
      await kept("CONFIRMED_LABEL_KEPT");assert.equal((await viewOf()).walletId,null,"DISCONNECTED_AFTER_CONFIRMATION");
      // An idle Disconnect keeps the confirmation and its status line, adds the disconnected line and shows no cancellation copy.
      record.afterDisconnect={status:await statusText(),line:await page.getByText(fixture.cancelCopies.disconnected,{exact:true}).count()};assert.equal(record.afterDisconnect.status,record.confirmedText,"DISCONNECT_KEEPS_STATUS");
      assert(await page.getByText(fixture.cancelCopies.disconnected,{exact:true}).isVisible(),"WALLET_DISCONNECTED_LINE");assert(!(await page.locator('#delegate').innerText()).includes("Cancelled here"),"NO_CANCELLED_COPY");
      await page.getByLabel("Wallet",{exact:true}).selectOption("synthetic");await page.getByRole("button",{name:"Connect selected wallet"}).click();
      await page.waitForFunction(()=>/already delegates|could not be verified|eligibility checked/.test(document.querySelector('#delegate [role="status"]')?.textContent||""),{},{timeout:20000,polling:100});
      await kept("CONFIRMED_LABEL_KEPT_AFTER_CONNECT");assert.equal(await page.getByText(fixture.cancelCopies.disconnected,{exact:true}).count(),0,"LINE_CLEARED_ON_CONNECT");
     }else if(name==="confirm-then-refresh-failure"){
      await waitTerminal(60000);await confirmedState("This stake account currently delegates to EASY1.");record.statusCutoff=Date.now();assert.deepEqual(await walletAt(),baseline,"STATUS_ZERO_WALLET_CALLS");
      // The page becomes visible again; the wallet owner's refresh read throws.
      await page.evaluate(()=>{window.synthetic.failReads=true;Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"visible"});document.dispatchEvent(new Event("visibilitychange"));});
      await page.waitForFunction(()=>/wallet changed or became unavailable/.test(document.querySelector('#delegate [role="status"]')?.textContent||""),{},{timeout:15000,polling:100});
      record.refreshFailure=await walletAt();assert.equal(record.refreshFailure.enableCalls,baseline.enableCalls+1,"VISIBLE_REFRESH_RAN");assert.equal((await viewOf()).walletId,"synthetic","WALLET_STILL_SELECTED");
      await kept("CONFIRMED_LABEL_KEPT");
     }else if(name==="confirm-then-other-tab-pending"||name==="confirm-then-other-tab-removed"){
      await waitTerminal(60000);await confirmedState("This stake account currently delegates to EASY1.");
      // A second same-origin tab writes a well-formed pending record for B under the origin lock (the step its own prepare would take); the first tab only observes.
      const other=fixture.otherTabRecord,raw=JSON.stringify(other),second=await context.newPage();await second.goto(origin+"/pool");await second.locator('#delegate [role="status"]').waitFor();
      await second.evaluate(r=>navigator.locks.request("easy1staking:delegation",{mode:"exclusive"},async()=>{localStorage.setItem("easy1staking:delegation-recovery",r);}),raw);
      record.otherTab={written:await second.evaluate(()=>localStorage.getItem("easy1staking:delegation-recovery"))};if(name!=="confirm-then-other-tab-removed")await second.close();assert.equal(record.otherTab.written,raw,"OTHER_TAB_RECORD_WRITTEN");
      // A fixed settle; the active ID is asserted before any expected text.
      await page.waitForTimeout(1000);const v=await viewOf(),codes=await page.locator('#delegate code').allInnerTexts(),body=await page.locator('#delegate').innerText();
      record.otherTab.view={txId:v.txId,phase:v.phase,message:v.message,confirmation:v.confirmation,canCheckStatus:v.canCheckStatus,recovery:v.recovery.status,codes};
      assert(v.txId===other.txId&&codes.includes(other.txId),"ACTIVE_ID_SHOWN");
      assert.equal(await statusText(),otherPendingText,"OTHER_PENDING_MESSAGE");
      assert(v.confirmation===null&&await page.locator('[aria-label="Delegation confirmation"]').count()===0&&!body.includes("confirmed on chain")&&!body.includes(record.confirmedText)&&!body.includes(golden.txId),"PRIOR_CONFIRMATION_HIDDEN");
      assert(body.includes("Transaction ID — outcome pending or unknown")&&!body.includes("submitted, confirmation pending"),"PENDING_CAPTION");
      assert(v.canCheckStatus&&v.recovery.status==="pending"&&await page.getByRole("button",{name:"Check status"}).count()===1,"CHECK_STATUS_OFFERED");
      if(name==="confirm-then-other-tab-removed"){
       // The second tab then removes B's record under the origin lock; a fixed 1000 ms settle, then the active ID before any expected text.
       const removedAt=Date.now();
       await second.evaluate(()=>navigator.locks.request("easy1staking:delegation",{mode:"exclusive"},async()=>{localStorage.removeItem("easy1staking:delegation-recovery");}));record.otherTab.removedByTab=await second.evaluate(()=>localStorage.getItem("easy1staking:delegation-recovery"));await second.close();await page.waitForTimeout(1000);
       const w=await viewOf(),wc=await page.locator('#delegate code').allInnerTexts(),wb=await page.locator('#delegate').innerText();
       record.otherTab.removed={txId:w.txId,phase:w.phase,message:w.message,confirmation:w.confirmation,canCheckStatus:w.canCheckStatus,recovery:w.recovery.status,codes:wc};
       assert(w.txId===other.txId&&wc.includes(other.txId),"ACTIVE_ID_KEPT");
       assert.equal(await statusText(),changedText,"CHANGED_MESSAGE");
       assert(w.confirmation===null&&await page.locator('[aria-label="Delegation confirmation"]').count()===0&&!wb.includes(golden.txId)&&!wb.includes(record.confirmedText),"A_NOT_RESTORED");
       assert(!w.canCheckStatus&&await page.getByRole("button",{name:"Check status"}).count()===0,"NO_CHECK_STATUS");
       assert.equal(await stored(),null,"NOTHING_HEALED");
       record.otherTab.removedReads=record.http.filter(x=>x.at>=removedAt&&x.path.startsWith("/txs/")).map(x=>x.path);assert.deepEqual(record.otherTab.removedReads,[],"ZERO_STATUS_READS_AFTER_REMOVAL");
       assert.deepEqual(await walletAt(),baseline,"ZERO_WALLET_CALLS_SINCE_BASELINE");
      }else{
      // Check status applies to B: one bounded check reads B's transaction (404 here), never A's.
      const clickAt=Date.now();await page.getByRole("button",{name:"Check status"}).click();await page.getByText(apology,{exact:true}).waitFor({timeout:35000});
      const reads=record.http.filter(x=>x.at>=clickAt&&x.method==="GET"&&x.path.startsWith("/txs/"));record.otherTab.checkReads=reads.map(x=>x.path+" "+x.status);
      assert(reads.length===1&&reads[0].path==="/txs/"+other.txId&&reads[0].status===404,"CHECK_STATUS_APPLIES_TO_ACTIVE_ID");
      assert.equal(await stored(),raw,"OTHER_RECORD_RETAINED");const after=await viewOf();assert(after.txId===other.txId&&after.confirmation===null,"ACTIVE_ID_AFTER_CHECK");
      }
     }else if(name==="confirm-then-second-operation"){
      await waitTerminal(60000);await confirmedState("This stake account has since delegated to another pool.");record.statusCutoff=Date.now();assert.deepEqual(await walletAt(),baseline,"STATUS_ZERO_WALLET_CALLS");
      // A fixed construction tip for the separately reviewed second body: the page clock moves to it and the tip is held there until the review shows.
      const B=fixture.secondOperation,X=BigInt(B.constructionSlot);st.pinned={slot:Number(X),epoch:664,hash:id(Number(X)),height:Number(X-100000000n),time:(baseTime+Number(X-baseSlot)*1000)/1000};
      await page.evaluate(target=>{window.synthetic.clockDeltaMs+=target-Date.now();},baseTime+Number(X-baseSlot)*1000+1000);
      await page.getByLabel("Wallet",{exact:true}).selectOption("synthetic");await page.getByRole("button",{name:"Connect selected wallet"}).click();
      await page.waitForFunction(()=>/eligibility checked/.test(document.querySelector('#delegate [role="status"]')?.textContent||""),{},{timeout:20000,polling:100});
      await kept("CONFIRMED_LABEL_KEPT_AFTER_CONNECT");
      await page.getByRole("button",{name:"Build delegation review"}).click();await page.getByRole("button",{name:"Approve and sign in wallet"}).waitFor({timeout:20000});
      await kept("CONFIRMED_LABEL_KEPT_AFTER_REVIEW");st.pinned=null;
      await page.getByRole("button",{name:"Approve and sign in wallet"}).click();await page.getByText("Submitted to Blockfrost.",{exact:false}).waitFor({timeout:30000});await page.waitForTimeout(1500);
      const v=await viewOf(),codes=await page.locator('#delegate code').allInnerTexts(),body=await page.locator('#delegate').innerText(),raw=await stored();
      record.secondOperation={txId:v.txId,phase:v.phase,confirmation:v.confirmation,codes,raw,constructionTips:record.http.filter(x=>x.path==="/blocks/latest"&&x.slot===Number(X)).length};
      assert(v.txId===B.txId&&codes.includes(B.txId),"ACTIVE_ID_SHOWN");
      assert(v.confirmation===null&&await page.locator('[aria-label="Delegation confirmation"]').count()===0&&!body.includes("confirmed on chain")&&!body.includes(record.confirmedText)&&!body.includes(golden.txId),"NO_INHERITED_CONFIRMATION");
      assert(body.includes("Transaction ID — submitted, confirmation pending")&&!body.includes("outcome pending or unknown"),"OWN_CAPTION");
      await until(()=>record.posts.length>1,10000,"POST_OBSERVED");
      assert(record.signatures.length===2&&record.signatures[1].txId===B.txId&&record.posts.length===2&&record.posts[1].hex===record.signatures[1].signedHex&&record.posts[1].txId!==record.posts[0].txId,"SECOND_EXACT_REVIEWED_POST");
      assert(raw&&JSON.parse(raw).txId===B.txId&&JSON.parse(raw).stage==="submitted"&&JSON.parse(raw).invalidHereafterSlot===B.ttl,"SECOND_RECORD");
      assert.equal(await page.evaluate(()=>window.synthetic.submitDispatches),2,"TWO_DISPATCHES");
     }else if(name==="status-visible-refresh"){
      await waitTerminal(60000);await confirmedState("This stake account currently delegates to EASY1.");record.statusCutoff=Date.now();
      // Counted from the POST: the refresh may land before the settle-window baseline.
      const atPost=record.walletAtPost,w=await walletAt(),ticks=await page.evaluate(()=>window.synthetic.intervalTicks||0),acquisitions=w.enableCalls-atPost.enableCalls;
      record.visibleRefresh={atPost,baseline,after:w,refresh:st.refresh,intervalTicks:ticks,acquisitions,visibility:await page.evaluate(()=>document.visibilityState),lookups:st.trace.filter(x=>x.found!==undefined)};
      assert.equal(record.visibleRefresh.visibility,"visible","VISIBLE_PAGE");assert(st.refresh&&st.refresh.after.enableCalls>st.refresh.before.enableCalls&&st.refresh.before.visibility==="visible","REFRESH_DURING_CHECK");
      assert.deepEqual(record.visibleRefresh.lookups.map(x=>x.found),[false,true],"POLL_CONTINUES_TO_CONFIRMATION");
      // Status work never calls the wallet: every enable is a visible refresh (the runner's focus or an instrumented 30 s tick), each with its seven reads.
      assert.equal(w.signCalls,atPost.signCalls,"STATUS_ZERO_SIGN");assert(acquisitions>=1&&acquisitions<=1+ticks,"ENABLE_ONLY_FROM_REFRESH");assert.equal(w.walletReads-atPost.walletReads,7*acquisitions,"WALLET_READS_ONLY_FROM_REFRESH");
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
     }else if(name.startsWith("dismiss-")){
      // W7 manual dismissal. Each deliberate check waits for its first tip read and for the status work to end, then asserts the exact statusReason first.
      const R={expiredUnseen:"This transaction has expired and was not found on chain when checked. That does not prove it was never included. After you check its ID in your wallet or a chain explorer, you can dismiss this record.",
       spentById:"This transaction was not found, but one of its inputs is recorded as spent by this same transaction ID, so it may be on chain. Nothing was cleared. Check it in your wallet or a chain explorer.",
       seenUnverified:"An earlier chain-data response reported this transaction, but verification is still unresolved. Nothing was cleared. Check again later, or check it in your wallet or a chain explorer.",
       dismissed:"You dismissed this record after checking the transaction ID yourself. This page did not confirm it. Keep the ID; a new delegation needs a new review and your approval.",
       kept:"The record was kept in this browser. To dismiss it, check status again, or check the ID in your wallet or a chain explorer."};
      const copy=fixture.dismissalCopy,rowsPath=`/txs/${chain.fundingId}/utxos`,TTL=baseSlot+600n,slotTime=n=>baseTime+Number(n-baseSlot)*1000,i0=record.layout.samples.length;record.dismiss={checks:[]};
      const tipAt=n=>({slot:Number(n),epoch:664,hash:n===baseSlot?chain.tipHash:id(Number(n)),height:Number(n-100000000n),time:slotTime(n)/1000});
      const clockTo=target=>page.evaluate(t=>{window.synthetic.clockDeltaMs+=t-Date.now();},target);
      // Tips follow the page clock unless pinned; a pinned tip gets the page clock at its time + 1000 ms.
      const follow=n=>{st.pinned=null;return clockTo(slotTime(n));},pin=n=>{st.pinned=tipAt(n);return clockTo(slotTime(n)+1000);};
      const offerCount=()=>page.getByRole("button",{name:copy.offer}).count(),region=()=>page.locator(`[aria-label="${copy.region}"]`),dismissedRegion=()=>page.locator(`[aria-label="${copy.dismissedRegion}"]`);
      const reads=after=>record.http.filter(x=>x.at>after),rowsReads=after=>reads(after).filter(x=>x.method==="GET"&&x.path===rowsPath).length,lookupsAfter=after=>reads(after).filter(x=>x.method==="GET"&&x.path==="/txs/"+golden.txId).length;
      const retained=async label=>{const raw=await stored();assert(raw!==null&&JSON.parse(raw).txId===golden.txId,label);return raw;};
      const storageKeys=()=>page.evaluate(()=>({local:Object.keys(localStorage).sort(),session:Object.keys(sessionStorage).sort()}));
      const testController=()=>page.evaluate(()=>{let fiber=Object.entries(document.getElementById('delegate')).find(([k])=>k.startsWith('__reactFiber$'))[1];for(;fiber;fiber=fiber.return){let state=fiber.memoizedState;while(state){const c=state.memoizedState?.current;if(c?.getView&&c?.approve){window.testController=c;return;}state=state.next;}}throw Error('CONTROLLER_REF_NOT_FOUND');});
      async function check(expected){
       await page.getByRole("button",{name:"Check status"}).waitFor({timeout:15000});const at=Date.now();await page.getByRole("button",{name:"Check status"}).click();
       await until(()=>record.http.some(x=>x.at>=at&&x.path==="/blocks/latest"),15000,"CHECK_STARTED");
       for(let i=0;i<300&&(await viewOf()).statusRunning;i++)await page.waitForTimeout(100);await page.waitForTimeout(500);
       const v=await viewOf();record.statusReason=v.statusReason;record.dismiss.checks.push({statusReason:v.statusReason,phase:v.phase,text:await statusText(),dismissal:v.dismissal});
       assert.equal(v.statusReason,expected,"DISMISS_STATUS_REASON");return at;
      }
      const open=async()=>{await page.getByRole("button",{name:copy.offer}).click();await region().waitFor({timeout:5000});};
      const fill=value=>page.getByLabel(copy.attestationLabel,{exact:true}).fill(value??copy.attestationPhrase);
      // A confirm attempt has ended when no status work runs and no dismissal is confirming; then a fixed settle.
      async function settled(){for(let i=0;i<300;i++){const v=await viewOf();if(!v.statusRunning&&v.dismissal?.stage!=="confirming")break;await page.waitForTimeout(100);}await page.waitForTimeout(500);return Date.now();}
      async function confirmClick(){const at=Date.now();await page.getByRole("button",{name:copy.confirm}).click();await settled();return at;}
      const noBuild=end=>{const phases=record.layout.samples.slice(i0,end).map(x=>x.phase);record.dismiss.phases=[...new Set(phases)];assert(!phases.some(p=>["building","review","signing","checking","submitting"].includes(p)),"NO_BUILD_DURING_DISMISSAL");};
      async function cutoff(){record.statusCutoff=Date.now();const end=record.layout.samples.length;assert.deepEqual(await walletAt(),baseline,"STATUS_ZERO_WALLET_CALLS");noBuild(end);}
      // The full dismissal: offer at TTL+5 (tips follow the clock), open, the exact phrase, Confirm; then the dismissed state and nothing new stored.
      async function dismissAll(spender){
       st.consumed=spender;await follow(TTL+5n);const checkAt=await check("not-found:EXPIRED_UNSEEN");
       assert.equal(await statusText(),R.expiredUnseen,"DISMISS_STATUS_TEXT");assert.equal(await offerCount(),1,"DISMISS_OFFERED");await retained("RECORD_RETAINED_ON_OFFER");
       assert(st.rowsServed.length>0&&st.rowsServed.every(x=>x.ownKey&&x.consumed===spender),"ROWS_SERVED_WITH_CONSUMED");
       await open();const lines=await region().locator("p").allInnerTexts();record.dismiss.region=lines;assert(lines.includes(copy.disclosure),"DISCLOSURE_COPY");
       if(spender===null)assert(!lines.includes(copy.spentElsewhere),"NO_SPENT_ELSEWHERE_LINE");else assert(lines.includes(copy.spentElsewhere),"SPENT_ELSEWHERE_LINE");
       const before=await storageKeys();await fill();await confirmClick();const doneAt=Date.now();
       assert.equal(await stored(),null,"DISMISSED_RECORD_REMOVED");
       assert.equal(await statusText(),R.dismissed,"DISMISSED_COPY");const v=await viewOf();assert.equal(v.statusReason,"dismissed:USER","DISMISSED_REASON");
       assert(v.dismissed&&v.dismissed.txId===golden.txId,"DISMISSED_VIEW_ID");assert.equal(v.confirmation,null,"DISMISSED_NOT_CONFIRMED");
       const shown=await dismissedRegion().innerText(),code=dismissedRegion().locator("code");assert(shown.includes(copy.dismissedCaption)&&(await code.innerText())===golden.txId,"DISMISSED_REGION");
       assert.notEqual(await code.evaluate(e=>getComputedStyle(e).userSelect),"none","DISMISSED_ID_COPYABLE");
       const body=await page.locator('#delegate').innerText();assert(!body.includes("outcome pending or unknown")&&!body.includes("confirmed on chain"),"DISMISSED_NO_OTHER_CAPTION");
       const after=await storageKeys();record.dismiss.storage={before,after};
       assert(before.local.includes("easy1staking:delegation-recovery")&&JSON.stringify(after.local)===JSON.stringify(before.local.filter(k=>k!=="easy1staking:delegation-recovery"))&&after.session.every(k=>k.startsWith("synthetic:")),"NOTHING_NEW_STORED");
       const span=record.http.filter(x=>x.at>=checkAt&&x.at<=doneAt);record.dismiss.span=span.map(x=>x.method+" "+x.path);
       assert.equal(span.filter(x=>x.path===rowsPath).length,2,"TWO_ELIGIBILITY_ROW_READS");
       assert.deepEqual(span.filter(x=>!(x.method==="GET"&&(x.path==="/blocks/latest"||x.path===rowsPath||x.path==="/txs/"+golden.txId||x.path.startsWith("/txs/"+golden.txId+"/")))).map(x=>x.method+" "+x.path),[],"NO_OTHER_READS_DURING_DISMISSAL");
      }
      const dismissedKept=async label=>{const n=await dismissedRegion().count(),shown=n?await dismissedRegion().innerText():"",code=n?await dismissedRegion().locator("code").innerText():"";assert(n===1&&shown.includes(copy.dismissedCaption)&&code===golden.txId,label);};
      async function reconnect(){
       await page.getByLabel("Wallet",{exact:true}).selectOption("synthetic");await page.getByRole("button",{name:"Connect selected wallet"}).click();
       await page.waitForFunction(()=>["refused","already-EASY1","ready"].includes(window.synthetic.renderedPhase()),{},{timeout:20000,polling:100});await page.waitForTimeout(500);
       const v=await viewOf();record.dismiss.reconnect={text:await statusText(),phase:v.phase,failureReason:v.failureReason};return v;
      }
      if(name==="dismiss-poll-after-expiry"){
       // The automatic poll runs past TTL within its budget; it never asks for eligibility, so no offer, no expired-unseen phase and no rows read until the apology.
       let offered=0;const started=Date.now();
       while(!/^Sorry, we couldn't confirm/.test(await statusText())&&Date.now()-started<90000){offered+=await offerCount();await page.waitForTimeout(250);}
       const phases=record.layout.samples.map(x=>x.phase),tips=record.http.filter(x=>x.at>postAt&&x.path==="/blocks/latest").map(x=>x.slot);
       record.dismiss.poll={offered,phases:[...new Set(phases)],rows:rowsReads(postAt),lookups:st.lookups,tips,text:await statusText()};
       assert(record.dismiss.poll.text===apology&&offered===0&&await offerCount()===0&&!phases.includes("expired-unseen")&&rowsReads(postAt)===0,"NO_DISMISSAL_DURING_POLL");
       assert(st.lookups>0&&tips.some(s=>s>=Number(TTL)),"POLL_RAN_PAST_TTL");
       await check("not-found:EXPIRED_UNSEEN");assert.equal(await offerCount(),1,"DISMISS_OFFERED");await retained("RECORD_RETAINED_ON_OFFER");
      }else if(name==="dismiss-expired"){
       await dismissAll(null);await cutoff();
       // Reconnect after the cutoff: a fresh review builds and is never approved.
       const v=await reconnect();assert.equal(v.phase,"ready","RECONNECT_READY");await page.getByRole("button",{name:"Build delegation review"}).waitFor({timeout:5000});
       await dismissedKept("DISMISSED_LABEL_KEPT_AFTER_CONNECT");
       await page.getByRole("button",{name:"Build delegation review"}).click();await page.getByRole("button",{name:"Approve and sign in wallet"}).waitFor({timeout:20000});
       await dismissedKept("DISMISSED_LABEL_KEPT_AFTER_REVIEW");
       assert(await page.evaluate(()=>window.synthetic.signCalls)===1&&record.posts.length===1,"OWN_REVIEW_NOT_APPROVED");
      }else if(name==="dismiss-at-ttl"){
       assert.equal(await offerCount(),0,"NO_OFFER_BEFORE_CHECK");await pin(TTL);await check("not-found:EXPIRED_UNSEEN");assert.equal(await offerCount(),1,"DISMISS_OFFERED");
       assert.equal(await page.getByText(copy.priorNotice,{exact:true}).count(),1,"PRIOR_NOTICE_COPY");await retained("RECORD_RETAINED_ON_OFFER");
       assert((await viewOf()).confirmation===null&&await page.locator('[aria-label="Delegation confirmation"]').count()===0,"NOTHING_CONFIRMED");
      }else if(name==="dismiss-before-expiry"){
       // The tip is fresh at TTL-1 while the local clock is past the TTL's wall time: only the eligibility guard decides.
       st.pinned=tipAt(TTL-1n);await clockTo(slotTime(TTL-1n)+20000);const at=await check("not-found:NOT_FOUND");
       assert.equal(await statusText(),apology,"APOLOGY_BEFORE_EXPIRY");assert.equal(await offerCount(),0,"NO_DISMISS_OFFER");assert.equal(rowsReads(at),0,"NO_ELIGIBILITY_READS_BEFORE_EXPIRY");await retained("RECORD_RETAINED_BEFORE_EXPIRY");
      }else if(name==="dismiss-spent-by-id"){
       st.consumed=golden.txId;await follow(TTL+5n);await check("inconsistent:SPENT_BY_ID");
       assert.equal(await statusText(),R.spentById,"DISMISS_STATUS_TEXT");assert.equal(await offerCount(),0,"NO_DISMISS_OFFER");await retained("RECORD_RETAINED_ON_SPENT_BY_ID");
       // A later all-null answer does not erase the page-lifetime spend veto.
       st.consumed=null;await check("not-found:EXPIRED_UNSEEN");
       assert.equal(await statusText(),R.spentById,"LATER_404_DOES_NOT_ERASE");assert.equal(await offerCount(),0,"NO_DISMISS_OFFER");await retained("RECORD_RETAINED_AFTER_LATER_404");
      }else if(name==="dismiss-spent-elsewhere"){
       await dismissAll(id(0x5b5b));await cutoff();
       const v=await reconnect();
       assert.equal(record.dismiss.reconnect.text,"Current chain information could not be verified. Use your wallet directly or reconnect later.","SOURCE_FALLBACK_COPY");assert.equal(v.failureReason,"source:INPUT","SOURCE_INPUT_REASON");
       assert.equal(await page.getByRole("button",{name:"Build delegation review"}).count(),0,"NO_BUILD_AFTER_SPENT_ELSEWHERE");
      }else if(name==="dismiss-missing-rows"){
       await follow(TTL+5n);await check("unavailable:INPUT_ROWS");
       assert.equal(await statusText(),apology,"APOLOGY_ON_MISSING_ROWS");assert.equal(await offerCount(),0,"NO_DISMISS_OFFER");await retained("RECORD_RETAINED_ON_MISSING_ROWS");
      }else if(name==="dismiss-then-already-easy1"){
       await dismissAll(null);await cutoff();
       s.txs[chain.registrationId].delegation_count=1;
       s.routes.set(`/txs/${chain.registrationId}/delegations`,[{cert_index:0,index:0,address:account,pool_id:chain.poolId,active_epoch:666}]);
       s.routes.set("/accounts/"+account+"/delegations",[{...s.history(chain.registrationId),pool_id:chain.poolId,amount:"0",active_epoch:666}]);s.routes.get("/accounts/"+account).pool_id=chain.poolId;
       await reconnect();assert.equal(record.dismiss.reconnect.text,"This account already delegates to EASY1. No transaction is needed.","ALREADY_EASY1_COPY");
       assert.equal(await page.getByRole("button",{name:"Build delegation review"}).count(),0,"NO_BUILD_WHEN_ALREADY_EASY1");await dismissedKept("DISMISSED_LABEL_KEPT_AFTER_CONNECT");
      }else if(name==="dismiss-cancel"){
       await follow(TTL+5n);await check("not-found:EXPIRED_UNSEEN");await open();await fill();const typedAt=Date.now();await page.waitForTimeout(3000);
       const locks=await page.evaluate(()=>navigator.locks.query());record.dismiss.typing={reads:reads(typedAt).length,held:locks.held.length};
       assert.equal(reads(typedAt).length,0,"NO_READS_WHILE_TYPING");await retained("RECORD_RETAINED_WHILE_TYPING");assert.equal(locks.held.length,0,"LOCK_NOT_HELD_WHILE_TYPING");
       await page.getByRole("button",{name:copy.keep}).click();await page.waitForTimeout(300);
       let v=await viewOf();assert(await region().count()===0&&await offerCount()===0&&v.dismissal===null,"KEEP_CLOSES_OFFER");
       assert.equal(await statusText(),R.kept,"KEPT_COPY");assert.equal(v.statusReason,"dismiss:KEPT","KEPT_REASON");await retained("RECORD_RETAINED_ON_KEEP");
       // Keep during the confirm recheck: the held rows read is abandoned and no removal follows its end.
       await check("not-found:EXPIRED_UNSEEN");await open();await fill();st.holdRows=true;await page.getByRole("button",{name:copy.confirm}).click();
       await until(()=>st.heldAt!==undefined,15000,"RECHECK_HELD");await page.getByRole("button",{name:copy.keep}).click();await page.waitForTimeout(300);
       v=await viewOf();assert.equal(await statusText(),R.kept,"KEPT_COPY_DURING_RECHECK");assert.equal(v.statusReason,"dismiss:KEPT","KEPT_REASON_DURING_RECHECK");await retained("RECORD_RETAINED_ON_CANCEL");
       await until(()=>st.heldUntil!==undefined,10000,"HOLD_ENDED");await page.waitForTimeout(2000);await retained("NO_REMOVAL_AFTER_HOLD");
       assert.equal(await statusText(),R.kept,"KEPT_AFTER_HOLD");
      }else if(name==="dismiss-without-attestation"){
       await follow(TTL+5n);await check("not-found:EXPIRED_UNSEEN");await open();await testController();
       const callAt=Date.now();record.dismiss.calls=await page.evaluate(async()=>{const c=window.testController,v=c.getView().dismissal;const a=await c.confirmDismissal(v,"");const b=await c.confirmDismissal(v,"i checked this id");return{empty:a===undefined,folded:b===undefined};});
       await page.waitForTimeout(3000);await retained("RECORD_RETAINED_WITHOUT_ATTESTATION");
       assert.equal(reads(callAt).length,0,"NO_STATUS_READS_WITHOUT_ATTESTATION");assert.equal((await viewOf()).dismissal?.stage,"open","STAGE_STILL_OPEN");
       await fill("I checked this");assert(await page.getByRole("button",{name:copy.confirm}).isDisabled(),"CONFIRM_DISABLED_WITHOUT_PHRASE");
       await fill();assert(await page.getByRole("button",{name:copy.confirm}).isEnabled(),"CONFIRM_ENABLED_WITH_PHRASE");
      }else if(name==="dismiss-double-confirm"){
       await follow(TTL+5n);await check("not-found:EXPIRED_UNSEEN");await open();await fill();await testController();
       const callAt=Date.now();await page.evaluate(phrase=>{const c=window.testController,v=c.getView().dismissal;c.confirmDismissal(v,phrase);c.confirmDismissal(v,phrase);},copy.attestationPhrase);
       await settled();await page.waitForTimeout(1000);record.dismiss.double={lookups:lookupsAfter(callAt),rows:rowsReads(callAt)};
       assert(lookupsAfter(callAt)===1&&rowsReads(callAt)===1,"ONE_RECHECK");assert.equal(await stored(),null,"DISMISSED_ONCE");assert.equal(await statusText(),R.dismissed,"DISMISSED_COPY");
       assert.deepEqual(record.errors,[],"NO_PAGE_ERROR");
      }else if(name==="dismiss-reload"){
       await follow(TTL+5n);await check("not-found:EXPIRED_UNSEEN");await open();await fill();await cutoff();
       await page.evaluate(()=>sessionStorage.setItem("synthetic:throwingWallet","1"));const reloadAt=Date.now();await page.reload();await page.locator('#delegate [role="status"]').waitFor();
       await page.getByRole("button",{name:"Check status"}).waitFor({timeout:15000});await page.waitForTimeout(3000);
       assert(await region().count()===0&&await offerCount()===0,"NO_OFFER_AFTER_RELOAD");assert.equal(await page.getByText(copy.priorNotice,{exact:true}).count(),1,"PRIOR_NOTICE_AFTER_RELOAD");
       await retained("RECORD_RETAINED_AFTER_RELOAD");assert.equal(reads(reloadAt).length,0,"NO_AUTOMATIC_READS_AFTER_RELOAD");
       assert.deepEqual(await walletAt(),{enableCalls:0,signCalls:0,walletReads:0,throwing:0},"ZERO_WALLET_CALLS_AFTER_RELOAD");
      }else if(name==="dismiss-busy"){
       await follow(TTL+5n);await check("not-found:EXPIRED_UNSEEN");await open();await fill();
       const second=await context.newPage();await second.goto(origin+"/pool");await second.locator('#delegate [role="status"]').waitFor();
       await second.evaluate(()=>{window.held=navigator.locks.request("easy1staking:delegation",{mode:"exclusive"},()=>new Promise(r=>{window.releaseHeld=r;}));});
       await second.waitForFunction(()=>typeof window.releaseHeld==="function",{},{timeout:15000});
       const clickAt=await confirmClick(),v=await viewOf();
       assert.equal(await statusText(),R.kept,"KEPT_COPY_ON_BUSY");assert.equal(v.statusReason,"dismiss:BUSY","BUSY_REASON");await retained("RECORD_RETAINED_ON_BUSY");assert.equal(reads(clickAt).length,0,"NO_STATUS_READS_WHEN_BUSY");
       await second.evaluate(()=>window.releaseHeld());await second.close();
      }else if(name==="dismiss-dispose"){
       await follow(TTL+5n);await check("not-found:EXPIRED_UNSEEN");await open();await fill();st.holdRows=true;await page.getByRole("button",{name:copy.confirm}).click();
       await until(()=>st.heldAt!==undefined,15000,"RECHECK_HELD");await page.locator('a[aria-label="easy1staking home"]').first().click();const navAt=Date.now();await page.waitForURL(origin+"/",{timeout:20000});
       await until(()=>st.heldUntil!==undefined,10000,"HOLD_ENDED");await page.waitForTimeout(3000);
       record.dismiss.dispose={raw:await stored(),reads:reads(navAt+1000).map(x=>x.path),heldFulfilment:st.heldFulfilment??null};
       assert(record.dismiss.dispose.raw&&JSON.parse(record.dismiss.dispose.raw).txId===golden.txId,"DISMISS_DISPOSE_RETAINS_RECORD");assert.deepEqual(record.dismiss.dispose.reads,[],"NO_READS_AFTER_DISPOSE");
      }else if(name==="dismiss-stale-record"){
       await follow(TTL+5n);await check("not-found:EXPIRED_UNSEEN");await open();await fill();
       // A second tab rewrites the same-ID record under the origin lock with stage "unknown"; the open offer stays until Confirm.
       const original=await stored(),changed=JSON.stringify({...JSON.parse(original),stage:"unknown"}),second=await context.newPage();await second.goto(origin+"/pool");await second.locator('#delegate [role="status"]').waitFor();
       await second.evaluate(r=>navigator.locks.request("easy1staking:delegation",{mode:"exclusive"},async()=>{localStorage.setItem("easy1staking:delegation-recovery",r);}),changed);await page.waitForTimeout(1000);
       assert((await viewOf()).dismissal?.stage==="open"&&await region().count()===1,"OFFER_KEPT_ON_SAME_ID_UPDATE");
       await confirmClick();assert.equal(await stored(),changed,"RECORD_RETAINED_AFTER_CHANGE");
       let v=await viewOf();assert.equal(await statusText(),R.kept,"KEPT_COPY_ON_CHANGE");assert.equal(v.statusReason,"dismiss:RESOLUTION","RESOLUTION_REASON");
       // A new deliberate check binds a new offer to the rewritten record; its removal in the other tab withdraws the offer and heals nothing.
       await check("not-found:EXPIRED_UNSEEN");assert.equal(await offerCount(),1,"DISMISS_OFFERED");
       await second.evaluate(()=>navigator.locks.request("easy1staking:delegation",{mode:"exclusive"},async()=>{localStorage.removeItem("easy1staking:delegation-recovery");}));await second.close();await page.waitForTimeout(1000);
       v=await viewOf();assert.equal(await statusText(),changedText,"CHANGED_ON_REMOVAL");assert(v.dismissal===null&&await offerCount()===0&&await region().count()===0,"NO_OFFER_AFTER_REMOVAL");
       assert(!v.canCheckStatus&&await page.getByRole("button",{name:"Check status"}).count()===0,"NO_CHECK_STATUS");assert.equal(await stored(),null,"NOTHING_HEALED");
      }else if(name==="dismiss-rollback-on-confirm"){
       await follow(TTL+5n);await check("not-found:EXPIRED_UNSEEN");await open();await fill();st.rollback={reads:0};await confirmClick();
       const v=await viewOf();record.statusReason=v.statusReason;record.dismiss.rollback=st.rollback;
       assert.equal(v.statusReason,"unavailable:TIP","CONFIRM_RECHECK_REASON");assert.equal(await statusText(),R.kept,"KEPT_COPY_ON_ROLLBACK");await retained("RECORD_RETAINED_ON_ROLLBACK");
       assert(v.dismissal===null&&await offerCount()===0&&await region().count()===0,"NO_OFFER_AFTER_ROLLBACK");
      }else if(name==="dismiss-confirmed-on-confirm"){
       // Offer on a 404; the confirm recheck finds a coherent inclusion at TTL-10 that landed before expiry behind the lagging index.
       await follow(TTL+5n);await check("not-found:EXPIRED_UNSEEN");assert.equal(await offerCount(),1,"DISMISS_OFFERED");await open();await fill();
       st.found=true;st.inclusionSlot=TTL-10n;await confirmClick();
       await confirmedState("This stake account currently delegates to EASY1.");
       const v=await viewOf();record.statusReason=v.statusReason;assert.equal(v.statusReason,"confirmed:CONFIRMED","CONFIRMED_ON_CONFIRM_REASON");assert.equal(v.dismissed,null,"NOT_DISMISSED");
       assert.equal(await page.getByText(copy.dismissedCaption,{exact:false}).count(),0,"NO_DISMISSED_CAPTION");assert.equal(await offerCount(),0,"NO_DISMISS_OFFER");
       assert.deepEqual(await walletAt(),baseline,"STATUS_ZERO_WALLET_CALLS");
      }else if(name==="dismiss-seen-then-404"){
       // A credible inclusion (TTL-10) whose first cbor read lags latches the witness; the route then forgets it.
       await follow(TTL+5n);st.found=true;st.inclusionSlot=TTL-10n;st.lagCbor=true;await check("pending:INDEX_LAG");
       assert.equal(await statusText(),apology,"APOLOGY_ON_INDEX_LAG");assert.equal(await offerCount(),0,"NO_DISMISS_OFFER");
       st.found=false;st.inclusion=null;await check("not-found:EXPIRED_UNSEEN");
       assert.equal(await statusText(),R.seenUnverified,"DISMISS_STATUS_TEXT");assert.equal(await offerCount(),0,"NO_DISMISS_OFFER");await retained("RECORD_RETAINED_AFTER_SEEN");
      }else throw Error("UNHANDLED_DISMISS_CASE "+name);
      if(record.statusCutoff===undefined)noBuild(record.layout.samples.length);
     }else if(name==="check-status-after-reload"){
      await until(()=>st.lookups>=1,15000,"FIRST_TICK");await page.waitForTimeout(1000);
      await page.evaluate(()=>sessionStorage.setItem("synthetic:throwingWallet","1"));const reloadAt=Date.now();await page.reload();await page.locator('#delegate [role="status"]').waitFor();
      await page.getByRole("button",{name:"Check status"}).waitFor({timeout:15000});st.reloaded=true;await page.waitForTimeout(3000);
      record.afterReload={automaticReads:statusReads(reloadAt)};assert.equal(record.afterReload.automaticReads,0,"NO_AUTOMATIC_STATUS_ON_RELOAD");
      await page.getByRole("button",{name:"Check status"}).click();await waitTerminal(35000);await confirmedState("This stake account currently delegates to EASY1.");
      const w=await walletAt();record.afterReload.wallet=w;assert.deepEqual(w,{enableCalls:0,signCalls:0,walletReads:0,throwing:0},"ZERO_WALLET_CALLS_AFTER_RELOAD");
     }
     // Cases that act after confirmation (disconnect, reconnect, refresh, a second operation) check status-work wallet effects at their cutoff.
     if(!["check-status-after-reload","confirm-then-disconnect","confirm-then-refresh-failure","status-visible-refresh","confirm-then-second-operation","dismiss-expired","dismiss-spent-elsewhere","dismiss-then-already-easy1","dismiss-reload"].includes(name))assert.deepEqual(await walletAt(),baseline,"STATUS_ZERO_WALLET_CALLS");
     assert.equal(record.posts.length,fixture.expectedCounts[name].posts,"STATUS_ZERO_POST");
     const foreign=record.http.filter(x=>x.at>postAt&&x.at<=(record.statusCutoff??Infinity)&&!(x.method==="GET"&&(x.path==="/blocks/latest"||x.path.startsWith("/txs/")||x.path.startsWith("/blocks/")||x.path.startsWith("/accounts/"+account))));
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
    if(page&&!page.isClosed()){try{record.terminal=await page.evaluate(()=>({text:document.querySelector('#delegate')?.textContent||document.body.textContent,submitDispatches:window.synthetic?.submitDispatches??null,signCalls:window.synthetic?.signCalls,tripwires:window.synthetic?.tripwires,replyAt:window.synthetic?.replyAt??null,attemptAt:window.synthetic?.attemptAt??null,enableCalls:window.synthetic?.enableCalls??null,layoutBatches:window.synthetic?.layoutBatches??null,preStyleBatches:window.synthetic?.preStyleBatches??null,probedSamples:window.synthetic?.probedSamples??null,visibility:document?.visibilityState??null,visibilityTransition:window.synthetic?.visibilityTransition??null,faultAt:window.synthetic?.faultAt??null,faultKind:window.synthetic?.faultKind??null,retainedAtAttempt:window.synthetic?.retainedAtAttempt??null}));}catch{}}
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
    // Every sampled state of this case: no 360 px overflow probe fired, and every status-line text is in the enumerated set.
    const confirmedPattern=new RegExp(fixture.confirmedPattern),samples=record.layout.samples;record.layout.preStyleBatches=samples.filter(x=>!x.styled).length;record.layout.probed=samples.filter(x=>x.styled).length;
    record.layout.fired=samples.filter(x=>x.styled&&x.fired);record.layout.statusTexts=[...new Set(samples.map(x=>x.status).filter(x=>x!==null))];
    record.layout.unknownStatus=record.layout.statusTexts.filter(x=>!fixture.statusTexts.includes(x)&&!confirmedPattern.test(x));
    check(()=>assert(record.layout.probed>0,"LAYOUT_SAMPLED"));
    check(()=>assert.deepEqual(record.layout.fired,[],"LAYOUT_360"));
    check(()=>assert.deepEqual(record.layout.unknownStatus,[],"STATUS_TEXT_KNOWN"));
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
