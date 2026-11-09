import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Contract, Interface, JsonRpcProvider, getAddress, keccak256, toUtf8Bytes } from 'ethers';
import { compileBooking } from './compile-booking.mjs';

export const REWARD_REGISTRY = '0xa61869FD9C4376fF1DA9E7dF48b5Ba746d4bD048';
export const REWARD_NFT = '0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B';
export const REWARD_TOKEN = 77n;
export async function compileBookingRewards(extraSources = {}) {
  const source = await readFile(new URL('../contracts/DCalBookingRewards.sol', import.meta.url), 'utf8');
  const result = await compileBooking({ 'DCalBookingRewards.sol': { content:source }, ...extraSources });
  return { ...result, source, artifact:result.contracts['DCalBookingRewards.sol'].DCalBookingRewards };
}
export async function prepareBookingRewards({ address, rpc = 'https://mainnet.base.org' } = {}) {
  const { artifact, source, compiler } = await compileBookingRewards();
  const runtimeCodeHash = keccak256(`0x${artifact.evm.deployedBytecode.object}`);
  const deploymentData = `0x${artifact.evm.bytecode.object}${new Interface(artifact.abi).encodeDeploy([REWARD_REGISTRY, REWARD_NFT, REWARD_TOKEN]).slice(2)}`;
  const result = { operation:'READ ONLY; nothing signed', chainId:8453, compiler,
    sourceHash:keccak256(toUtf8Bytes(source)), runtimeCodeHash, deploymentData,
    rewardsConfig:{ address:'', runtimeCodeHash, registry:REWARD_REGISTRY, nft:REWARD_NFT, tokenId:'77', enabled:false },
    limit:10, gates:'Review/tests, deployment approval, sale-escrow delist/transfer/relist cutover of 10 copies, activation, worker/site enablement and live rehearsal.' };
  if (address) {
    const provider = new JsonRpcProvider(rpc, 8453, { staticNetwork:true });
    try {
      if (BigInt(await provider.send('eth_chainId', [])) !== 8453n) throw new Error('Verify rewards on Base.');
      address = getAddress(address);
      if (keccak256(await provider.getCode(address)) !== runtimeCodeHash) throw new Error('Reward runtime does not match reviewed source.');
      const contract = new Contract(address, artifact.abi, provider);
      if (await contract.VERSION() !== 'dcal-first-booking-rewards-1' || await contract.LIMIT() !== 10n ||
          getAddress(await contract.appointments()) !== REWARD_REGISTRY || getAddress(await contract.nft()) !== REWARD_NFT ||
          await contract.tokenId() !== REWARD_TOKEN) throw new Error('Reward contract configuration mismatch.');
      result.rewardsConfig.address = address;
    } finally { provider.destroy(); }
  }
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options:{ address:{type:'string'}, rpc:{type:'string'} } });
  const { deploymentData, ...result } = await prepareBookingRewards(values);
  console.log(JSON.stringify({ ...result, creationBytes:(deploymentData.length - 2) / 2 }, null, 2));
}
