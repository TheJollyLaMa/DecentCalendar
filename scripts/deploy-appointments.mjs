import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { FetchRequest, JsonRpcProvider, Wallet, formatEther, parseEther, getAddress } from 'ethers';
import { prepareAppointments } from './prepare-appointments-deployment.mjs';
import { prepareBookingRewards } from './prepare-booking-rewards.mjs';

export function appointmentDeploymentBudget(gas, fees, balance, budget) {
  const maxFeePerGas = fees.maxFeePerGas ?? fees.gasPrice;
  if (maxFeePerGas == null || maxFeePerGas <= 0n || gas <= 0n || budget <= 0n) throw new Error('Valid gas, fee and budget estimates are required.');
  const gasLimit = (gas * 120n + 99n) / 100n;
  // Base charges L1 data separately. This conservative reserve is not an exact fee quote.
  const dataFeeReserve = parseEther('0.00001');
  const estimatedBudget = gasLimit * maxFeePerGas + dataFeeReserve;
  if (estimatedBudget > budget) throw new Error('Estimated deployment budget exceeds DCAL_DEPLOY_BUDGET_ETH. Nothing signed.');
  if (estimatedBudget > balance) throw new Error('Base ETH balance is below the conservative deployment budget. Nothing signed.');
  return { gasLimit, maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas ?? 0n, dataFeeReserve, estimatedBudget };
}

export async function deploymentPreflight({ provider, ethereum, name, key, budget, prepare = prepareAppointments }) {
  if (!['DecentAgency.eth', 'TheJollyLama.eth'].includes(name)) throw new Error('Use a steward-approved test ENS wallet.');
  if (key && (!/^0x[0-9a-fA-F]{64}$/.test(key) || BigInt(key) === 0n ||
      BigInt(key) >= 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n)) {
    throw new Error('Invalid local deployer key. Use a valid 0x-prefixed key; its value is never printed.');
  }
  if (BigInt(await provider.send('eth_chainId', [])) !== 8453n ||
      BigInt(await ethereum.send('eth_chainId', [])) !== 1n) throw new Error('Verify Base and Ethereum RPC networks.');
  const address = await ethereum.resolveName(name);
  if (!address) throw new Error('Test ENS name could not be resolved.');
  if (key && getAddress(new Wallet(key).address) !== getAddress(address)) throw new Error('Local deployer key does not match the selected ENS wallet.');
  const plan = await prepare();
  const [balance, fees, gas] = await Promise.all([
    provider.getBalance(address), provider.getFeeData(), provider.estimateGas({ from:address, data:plan.deploymentData }),
  ]);
  return { plan, address, balance, ...appointmentDeploymentBudget(gas, fees, balance, budget) };
}

async function main() {
  const { values } = parseArgs({ options:{ broadcast:{ type:'boolean', default:false }, rewards:{type:'boolean',default:false} } });
  const prepare = values.rewards ? prepareBookingRewards : prepareAppointments;
  const approval = values.rewards ? 'DEPLOY BOOKING REWARDS' : 'DEPLOY APPOINTMENTS';
  const env = name => process.env[name]?.trim() || '';
  const name = env('DCAL_DEPLOYER_ENS') || 'DecentAgency.eth';
  const key = env('DEPLOYER_PRIVATE_KEY');
  const budget = parseEther(env('DCAL_DEPLOY_BUDGET_ETH') || '0.0001');
  const existing = env(values.rewards ? 'DCAL_REWARDS_ADDRESS' : 'DCAL_APPOINTMENTS_ADDRESS');
  const record = new URL(values.rewards ? '../docs/deployments/base-dcal-booking-rewards-1.json' : '../docs/deployments/base-dcal-appointments-1.json', import.meta.url);
  const pending = new URL(values.rewards ? '../.booking-rewards-deployment-pending.json' : '../.appointments-deployment-pending.json', import.meta.url);
  const exists = async path => {
    try { await access(path); return true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; return false; }
  };
  if (existing || await exists(record) || await exists(pending)) {
    throw new Error('Existing deployment or pending evidence found. Reconcile and verify it; do not deploy again.');
  }
  const rpc = url => { const request = new FetchRequest(url); request.timeout = 15000; return new JsonRpcProvider(request); };
  const provider = rpc(env('DCAL_DEPLOY_RPC') || 'https://mainnet.base.org');
  const ethereum = rpc(env('DCAL_ENS_RPC') || 'https://ethereum-rpc.publicnode.com');
  try {
    const preflight = await deploymentPreflight({ provider, ethereum, name, key, budget, prepare });
    console.log(JSON.stringify({ operation:values.broadcast ? 'Awaiting typed deployment approval' : 'READ ONLY; nothing signed',
      name, address:preflight.address, baseETH:formatEther(preflight.balance),
      gasLimit:preflight.gasLimit.toString(), executionFeeCapETH:formatEther(preflight.gasLimit * preflight.maxFeePerGas),
      l1DataReserveETH:formatEther(preflight.dataFeeReserve), budgetETH:formatEther(budget),
      sourceHash:preflight.plan.sourceHash, runtimeCodeHash:preflight.plan.runtimeCodeHash }, null, 2));
    if (!values.broadcast) return;
    if (!key) throw new Error('Fill DEPLOYER_PRIVATE_KEY locally for this CLI. Normal appointment publishing and booking use the browser wallet; no attendee key belongs in this file.');
    if (!process.stdin.isTTY) throw new Error('Deployment requires an interactive terminal and typed approval; no piped confirmation.');
    const prompt = createInterface({ input:process.stdin, output:process.stdout });
    let answer;
    try { answer = await prompt.question(`Deploy this ${values.rewards ? 'ten-gift reward vault' : 'fundless registry'} once on Base? Type ${approval}: `); }
    finally { prompt.close(); }
    if (answer.trim() !== approval) { console.log('Cancelled; nothing signed.'); return; }
    const checked = await deploymentPreflight({ provider, ethereum, name, key, budget, prepare });
    const wallet = new Wallet(key, provider);
    // Record the signed transaction hash before broadcast so an interrupted process cannot lose it.
    const prepared = await wallet.populateTransaction({ data:checked.plan.deploymentData,
      gasLimit:checked.gasLimit, maxFeePerGas:checked.maxFeePerGas, maxPriorityFeePerGas:checked.maxPriorityFeePerGas });
    const signed = await wallet.signTransaction(prepared);
    const { keccak256 } = await import('ethers');
    const hash = keccak256(signed);
    await writeFile(pending, `${JSON.stringify({ transaction:hash, deployer:checked.address, chainId:8453, sourceHash:checked.plan.sourceHash })}\n`, { flag:'wx', mode:0o600 });
    const tx = await provider.broadcastTransaction(signed);
    console.log(`Submitted ${tx.hash}; reconcile this hash if interrupted. Do not redeploy.`);
    const receipt = await tx.wait(2);
    if (!receipt || receipt.status !== 1 || !receipt.contractAddress) throw new Error(`Deployment ${hash} failed or is unconfirmed. Reconcile the pending evidence.`);
    const verified = await prepare({ address:receipt.contractAddress, rpc:env('DCAL_DEPLOY_RPC') || 'https://mainnet.base.org' });
    await mkdir(new URL('./', record), { recursive:true });
    const appConfig = values.rewards ? verified.rewardsConfig : verified.appointmentsConfig;
    await writeFile(record, `${JSON.stringify({ contract:values.rewards ? 'DCalBookingRewards' : 'DCalAppointments', chainId:8453, address:receipt.contractAddress,
      transaction:hash, block:receipt.blockNumber, deployer:checked.address,
      sourceHash:verified.sourceHash, runtimeCodeHash:verified.runtimeCodeHash,
      [values.rewards ? 'rewardsConfig' : 'appointmentsConfig']:appConfig }, null, 2)}\n`, { flag:'wx' });
    console.log(JSON.stringify({ confirmedAddress:receipt.contractAddress, config:appConfig,
      next:values.rewards
        ? 'Set DCAL_REWARDS_ADDRESS locally; clear deployer key. Separately fund 10 unlisted copies from the custodian, approve activation, then review worker/site enablement. Nothing transferred or activated by deployment.'
        : 'Set DCAL_APPOINTMENTS_ADDRESS locally. Review/pin app config separately; writes remain disabled. Clear the local deployer key.' }, null, 2));
  } finally { provider.destroy(); ethereum.destroy(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
