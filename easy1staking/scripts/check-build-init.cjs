// Run with: node scripts/check-build-init.cjs. All SDK, wallet and browser APIs are mocks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const fixtureKey = 'test-only-blockfrost-key';
const nft = { assetName: '00', assetNameDecoded: 'Example', policyId: 'policy',
  txHash: 'nft-tx', outputIndex: 0, utxoId: 'nft-tx#0' };
const collateral = { input: { txHash: 'collateral', outputIndex: 0 },
  output: { amount: [{ unit: 'lovelace', quantity: '20000000' }] } };

function harness(key, environment = 'production') {
  const providers = [], builders = [], logs = [], effects = [], analytics = [], toasts = [], walletCalls = [];
  let hotjarLoads = 0, stateIndex = 0;
  const wallet = Object.fromEntries(Object.entries({
    getCollateral: [collateral], getUtxos: [collateral], getUsedAddresses: ['wallet-address'],
    getBalance: collateral.output.amount, getRewardAddresses: ['reward-address'],
    signTx: 'signed', submitTx: 'submitted',
  }).map(([name, result]) => [name, async (...args) => {
    walletCalls.push([name, ...args]);
    return result;
  }]));
  class BlockfrostProvider {
    constructor(apiKey) {
      providers.push(this);
      this.apiKey = apiKey;
      // Model the real constructor's inability to initialize without configuration.
      if (!apiKey || !apiKey.trim()) throw new Error('mock provider missing key');
    }
    async fetchAccountInfo(address) {
      this.accountAddress = address;
      return { active: true, poolId: 'easy1-pool' };
    }
    async fetchUTxOs(hash) {
      this.utxoHash = hash;
      return [{ output: { amount: nft.amount || collateral.output.amount } }];
    }
  }
  class MeshTxBuilder {
    constructor(options) {
      const calls = [];
      const builder = new Proxy({ options, calls, txHex: 'unsigned' }, {
        get(target, name) {
          if (name === 'then') return undefined;
          if (name in target) return target[name];
          return (...args) => { calls.push([name, ...args]); return builder; };
        },
      });
      builders.push(builder);
      return builder;
    }
  }
  const react = {
    useEffect: effect => effects.push(effect),
    useMemo: calculate => calculate(),
    useState: initial => [stateIndex++ === 0 ? 'wallet-address' : stateIndex === 2 ? [nft] : initial, () => {}],
  };
  const jsx = (type, props) => ({ type, props });
  const constants = { BLOCKFROST_API_KEY: key, EASY1_STAKE_POOL_ID: 'easy1-pool',
    EASY1_STAKE_POOL_HASH: 'pool-hash', EASY1STAKING_API: 'mock-api',
    WMT_CONVERSION_SCRIPT: { code: 'wmt-script' }, KREATE_SCRIPT: { code: 'kreate-script' } };
  const toast = Object.fromEntries(['error', 'loading', 'success', 'dismiss'].map(name =>
    [name, (...args) => toasts.push([name, ...args])]));
  function mockRequire(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (name === '@meshsdk/core') return { BlockfrostProvider, MeshTxBuilder,
      mConStr: (...args) => args, deserializeAddress: () => ({ pubKeyHash: 'payment-hash' }) };
    if (name === '@meshsdk/react') return { useWallet: () => ({ wallet, connected: true }), MeshProvider: 'MeshProvider' };
    if (name.endsWith('Constants')) return constants;
    if (name.endsWith('AppTypes')) return { EASY1DelegationType: { Unregistered: 0, Undelegated: 1, Delegated: 2, DelegatedOther: 3 } };
    if (name === 'react-hot-toast') return { __esModule: true, default: toast };
    if (name === '@mui/material') return new Proxy({}, { get: (_, property) => property });
    if (name === '@hotjar/browser') {
      hotjarLoads++;
      // Loading this module on the server must also be avoided.
      if (!context.window) throw new Error('mock Hotjar import requires window');
      return { __esModule: true, default: { init: (...args) => analytics.push(args) } };
    }
    if (name.endsWith('.css')) return {};
    if (name === 'next/head' || name.startsWith('@mui/icons-material/') || name.startsWith('@/components/'))
      return { __esModule: true, default: name };
    throw new Error(`Unexpected dependency: ${name}`);
  }
  const context = vm.createContext({ require: mockRequire, process: { env: {
    NODE_ENV: environment, NEXT_PUBLIC_BLOCKFROST_API_KEY: key,
  } }, console: Object.fromEntries(['log', 'warn', 'error', 'info', 'debug'].map(name =>
    [name, (...args) => logs.push([name, ...args])])), Buffer, Set, setTimeout });
  function load(relativePath) {
    const filename = path.join(root, relativePath);
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, { fileName: filename, compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const module = { exports: {} };
    context.module = module;
    context.exports = module.exports;
    vm.runInContext(output, context, { filename });
    return module.exports.default;
  }
  return { load, providers, builders, logs, effects, analytics, toasts, walletCalls,
    get hotjarLoads() { return hotjarLoads; },
    mountClient: async () => {
      context.window = {};
      context.document = {};
      for (const effect of effects) await effect();
      await new Promise(resolve => setImmediate(resolve));
    } };
}

function delistAction(page) {
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.map(visit).find(Boolean);
    if (node.type === 'Button' && node.props.children === 'Delist') return node.props.onClick;
    return visit(node.props?.children);
  };
  const action = visit(page());
  assert.equal(typeof action, 'function', 'rendered delist button must expose the actual handler');
  return action;
}

const configurationError = /NEXT_PUBLIC_BLOCKFROST_API_KEY.*(?:required|configured|missing)/i;
const checks = [];
const check = (name, run) => checks.push({ name, run });

for (const [label, key] of [['missing', undefined], ['blank', '  \t ']]) {
  check(`TransactionUtil ${label} key: safe import, descriptive demand failure`, async () => {
    const h = harness(key);
    const util = h.load('src/lib/util/TransactionUtil.tsx');
    assert.equal(h.providers.length, 0, 'provider must be lazy');
    assert.equal(h.builders.length, 0, 'builder must be lazy');
    await assert.rejects(util.canBeDelegated('stake-address'), configurationError);
    assert.equal(h.providers.length, 0, 'invalid config must not reach SDK constructor');
  });
  check(`Kreate ${label} key: safe render, handler catches configuration failure`, async () => {
    const h = harness(key);
    const action = delistAction(h.load('src/pages/kreate-delist/index.tsx'));
    assert.equal(h.providers.length, 0, 'render must not initialize provider');
    await action();
    assert.ok(h.toasts.some(([name, message]) => name === 'error' && configurationError.test(message)),
      'existing error toast must receive descriptive configuration failure');
    assert.equal(h.providers.length, 0);
    assert.equal(h.builders.length, 0);
    assert.ok(!h.walletCalls.some(([name]) => name === 'signTx' || name === 'submitTx'));
  });
}

check('TransactionUtil configured demand: provider/builder reuse and no key logging', async () => {
  const h = harness(fixtureKey);
  const util = h.load('src/lib/util/TransactionUtil.tsx');
  assert.equal(h.providers.length, 0);
  assert.equal(h.builders.length, 0);
  assert.equal(await util.canBeDelegated('stake-address'), 2);
  await util.canBeDelegated('stake-address');
  assert.equal(h.providers.length, 1);
  assert.equal(h.providers[0].apiKey, fixtureKey);
  assert.equal(h.providers[0].accountAddress, 'stake-address');
  assert.equal(h.builders.length, 0, 'account query must not initialize builder');
  // Every wallet function is mocked: this constructs no real transaction or network call.
  const wallet = {
    getCollateral: async () => [collateral], getUtxos: async () => [collateral],
    getUsedAddresses: async () => ['wallet-address'], getBalance: async () => collateral.output.amount,
  };
  for (let i = 0; i < 2; i++) assert.equal(await util.convertWMTtoWTMx(wallet, '100', '2000000', 2), 'unsigned');
  assert.equal(h.providers.length, 1);
  assert.equal(h.builders.length, 1);
  assert.equal(h.builders[0].options.fetcher, h.providers[0]);
  assert.equal(h.builders[0].options.submitter, h.providers[0]);
  assert.equal(h.builders[0].calls.filter(([name]) => name === 'reset').length, 2);
  assert.equal(h.builders[0].calls.filter(([name]) => name === 'complete').length, 2);
  assert.ok(!JSON.stringify(h.logs).includes(fixtureKey), 'key must never be logged');
});

check('Kreate configured demand: reuse provider and preserve builder/sign/submit wiring', async () => {
  const h = harness(fixtureKey);
  const action = delistAction(h.load('src/pages/kreate-delist/index.tsx'));
  assert.equal(h.providers.length, 0);
  await action();
  await action();
  assert.equal(h.providers.length, 1);
  assert.equal(h.providers[0].apiKey, fixtureKey);
  assert.equal(h.providers[0].utxoHash, nft.txHash);
  assert.equal(h.builders.length, 2);
  for (const builder of h.builders) {
    assert.equal(builder.options.fetcher, h.providers[0]);
    assert.equal(builder.options.submitter, h.providers[0]);
    assert.deepEqual(builder.calls.map(([name]) => name), ['spendingPlutusScriptV2', 'txIn',
      'txInInlineDatumPresent', 'txInRedeemerValue', 'txInScript', 'txOut', 'changeAddress',
      'txInCollateral', 'selectUtxosFrom', 'requiredSignerHash', 'complete']);
  }
  assert.deepEqual(h.walletCalls.filter(([name]) => name === 'signTx' || name === 'submitTx'),
    [['signTx', 'unsigned'], ['submitTx', 'signed'], ['signTx', 'unsigned'], ['submitTx', 'signed']]);
  assert.ok(!JSON.stringify(h.logs).includes(fixtureKey), 'key must never be logged');
});

for (const environment of ['production', 'development', 'test']) {
  check(`Hotjar ${environment}: server loading is safe, mount respects environment`, async () => {
    const h = harness(undefined, environment);
    const app = h.load('src/pages/_app.tsx');
    app({ Component: () => null, pageProps: {} });
    assert.equal(h.hotjarLoads, 0, 'server import/render must not load browser analytics');
    assert.equal(h.analytics.length, 0);
    await h.mountClient();
    assert.deepEqual(h.analytics.map(args => Array.from(args)), environment === 'production' ? [[3741402, 6]] : []);
    assert.equal(h.hotjarLoads, environment === 'production' ? 1 : 0);
  });
}

let completed = 0;
process.on('beforeExit', () => {
  if (completed !== checks.length) {
    console.error(`FAIL runner stopped after ${completed}/${checks.length} initialization checks`);
    process.exitCode = 1;
  }
});

(async () => {
  let failed = 0;
  for (const { name, run } of checks) {
    try { await run(); console.log(`PASS ${name}`); }
    catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
    completed++;
  }
  console.log(`${checks.length - failed}/${checks.length} initialization checks passed`);
  if (failed) process.exitCode = 1;
})();
