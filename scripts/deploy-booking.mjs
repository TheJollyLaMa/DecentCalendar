// Signs the DCalBooking deployment with DEPLOYER_PRIVATE_KEY from the gitignored .env.
// Usage: npm run deploy:booking            (deploy, after typed confirmation)
//        npm run deploy:booking -- --verify-only 0xAddress   (publish source on Basescan)
import { createInterface } from 'node:readline/promises';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { AbiCoder, FetchRequest, JsonRpcProvider, Wallet, formatEther, getAddress } from 'ethers';
import { compileBooking } from './compile-booking.mjs';
import { prepareDeployment } from './prepare-booking-deployment.mjs';

const { values } = parseArgs({ options: {
  'verify-only': { type: 'string' }, record: { type: 'string' }, config: { type: 'string' },
} });
const env = name => process.env[name]?.trim() || '';
const root = new URL('../', import.meta.url);
const recordPath = values.record || new URL('docs/deployments/base-dcal-timebox-1.json', root).pathname;
const configPath = values.config || new URL('decent-calendar-vanilla/decent.config.js', root).pathname;
const feeRecipient = env('DCAL_FEE_RECIPIENT'), owner = env('DCAL_OWNER') || feeRecipient;
const baseRpc = env('DCAL_DEPLOY_RPC') || 'https://mainnet.base.org';
const ensRpc = env('DCAL_ENS_RPC') || 'https://ethereum-rpc.publicnode.com';
if (!feeRecipient) throw new Error('Set DCAL_FEE_RECIPIENT in .env to the steward-confirmed DecentAgency.eth address.');

async function verifySource(address, constructorArguments) {
  const apiKey = env('ETHERSCAN_API_KEY');
  if (!apiKey) { console.log('ETHERSCAN_API_KEY not set; skipped Basescan source verification.'); return; }
  const { input, compiler } = await compileBooking();
  const encoded = AbiCoder.defaultAbiCoder().encode(['address', 'address', 'address[]'], constructorArguments).slice(2);
  const api = 'https://api.etherscan.io/v2/api?chainid=8453';
  const body = new URLSearchParams({ apikey: apiKey, module: 'contract', action: 'verifysourcecode', contractaddress: address,
    sourceCode: JSON.stringify(input), codeformat: 'solidity-standard-json-input', contractname: 'DCalBooking.sol:DCalBooking',
    compilerversion: `v${compiler.replace(/\.Emscripten.*$/, '')}`, constructorArguements: encoded });
  const submitted = await (await fetch(api, { method: 'POST', body })).json();
  if (submitted.status !== '1') throw new Error(`Basescan verification was not accepted: ${submitted.result}`);
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const query = new URLSearchParams({ apikey: apiKey, module: 'contract', action: 'checkverifystatus', guid: submitted.result });
    const status = await (await fetch(`${api}&${query}`)).json();
    if (status.status === '1' || /already verified/i.test(status.result)) { console.log(`Basescan: ${status.result}`); return; }
    if (!/pending/i.test(status.result)) throw new Error(`Basescan verification failed: ${status.result}`);
  }
  throw new Error('Basescan verification is still pending; rerun with --verify-only later.');
}

if (values['verify-only']) {
  const address = getAddress(values['verify-only']);
  const checked = await prepareDeployment({ feeRecipient, owner, address, baseRpc, ensRpc });
  await verifySource(address, checked.constructorArguments);
  process.exit(0);
}

const key = env('DEPLOYER_PRIVATE_KEY');
if (!/^(0x)?[0-9a-fA-F]{64}$/.test(key)) throw new Error('Set DEPLOYER_PRIVATE_KEY in .env (64 hex characters). It is never printed.');
const request = new FetchRequest(baseRpc); request.timeout = 30000;
const provider = new JsonRpcProvider(request, 8453, { staticNetwork: true });
try {
  const deployer = new Wallet(key.startsWith('0x') ? key : `0x${key}`, provider);
  if (getAddress(deployer.address) === getAddress(feeRecipient) || getAddress(deployer.address) === getAddress(owner)) {
    console.warn('Deploying from the DecentAgency.eth fee/owner wallet. Its key controls credits and the token allowlist: clear it from .env after deploying.');
  }
  // Rechecks Base, canonical USDC and the live DecentAgency.eth record against the .env addresses.
  const plan = await prepareDeployment({ feeRecipient, owner, baseRpc, ensRpc });
  const [balance, fees, gas] = await Promise.all([
    provider.getBalance(deployer.address), provider.getFeeData(),
    provider.estimateGas({ from: deployer.address, data: plan.deploymentData }),
  ]);
  const maxCost = gas * (fees.maxFeePerGas ?? fees.gasPrice);
  console.log(JSON.stringify({ network: 'Base mainnet (8453)', deployer: deployer.address, deployerBalance: `${formatEther(balance)} ETH`,
    estimatedGas: gas.toString(), maxGasCost: `${formatEther(maxCost)} ETH`, constructorArguments: plan.constructorArguments,
    enabledAssets: plan.enabledAssets, compiler: plan.compiler, sourceHash: plan.sourceHash, creationCodeHash: plan.creationCodeHash }, null, 2));
  if (balance < maxCost) throw new Error('Deployer balance is below the estimated maximum gas cost. Fund it with a little Base ETH.');
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question('This permanently deploys real-money escrow on Base. Type DEPLOY to sign: ');
  prompt.close();
  if (answer.trim() !== 'DEPLOY') { console.log('Cancelled. Nothing was signed.'); process.exit(1); }

  const tx = await deployer.sendTransaction({ data: plan.deploymentData, gasLimit: gas * 12n / 10n });
  console.log(`Submitted ${tx.hash}. Waiting for 2 confirmations...`);
  const receipt = await tx.wait(2);
  if (!receipt || receipt.status !== 1 || !receipt.contractAddress) throw new Error(`Deployment ${tx.hash} did not succeed. Inspect it on Basescan.`);
  const checked = await prepareDeployment({ feeRecipient, owner, address: receipt.contractAddress, baseRpc, ensRpc });
  const record = {
    contract: 'DCalBooking', version: 'dcal-timebox-1', chainId: 8453, address: receipt.contractAddress,
    transaction: tx.hash, block: receipt.blockNumber, deployer: deployer.address, deployedAt: new Date().toISOString(),
    compiler: checked.compiler, sourceHash: checked.sourceHash, creationCodeHash: checked.creationCodeHash,
    constructorArguments: checked.constructorArguments, enabledAssets: checked.enabledAssets,
    runtimeCodeHash: checked.bookingConfig.runtimeCodeHash,
  };
  await mkdir(new URL('.', `file://${recordPath}`), { recursive: true });
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`);
  // Pin the verified deployment with writes still off; opening transactions is a separate reviewed change.
  const config = await readFile(configPath, 'utf8');
  const pinned = config.replace(/booking: \{[^}]*\}/, `booking: {
    address: '${checked.bookingConfig.address}',
    runtimeCodeHash: '${checked.bookingConfig.runtimeCodeHash}',
    feeRecipient: '${checked.bookingConfig.feeRecipient}',
    writesEnabled: false,
  }`);
  if (pinned === config) throw new Error('Could not find the booking config block; pin bookingConfig manually.');
  await writeFile(configPath, pinned);
  console.log(JSON.stringify({ deployed: record, bookingConfig: checked.bookingConfig }, null, 2));
  console.log(`Wrote ${recordPath} and pinned ${configPath} with writesEnabled: false.`);
  await verifySource(receipt.contractAddress, checked.constructorArguments).catch(error => console.warn(error.message));
} finally { provider.destroy(); }
