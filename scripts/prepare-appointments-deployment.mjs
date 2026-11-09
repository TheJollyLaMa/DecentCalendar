import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Contract, JsonRpcProvider, getAddress, keccak256, toUtf8Bytes } from 'ethers';
import { compileBooking } from './compile-booking.mjs';
import { APPOINTMENT_ABI } from '../decent-calendar-vanilla/js/appointment-client.js';

export async function compileAppointments() {
  const source = await readFile(new URL('../contracts/DCalAppointments.sol', import.meta.url), 'utf8');
  const result = await compileBooking({ 'DCalAppointments.sol': { content:source } });
  return { ...result, artifact:result.contracts['DCalAppointments.sol'].DCalAppointments, source };
}
export async function prepareAppointments({ address, rpc = 'https://mainnet.base.org' } = {}) {
  const { artifact, source, compiler } = await compileAppointments();
  const runtimeCodeHash = keccak256(`0x${artifact.evm.deployedBytecode.object}`);
  const result = {
    operation:'Read-only preparation. No deployment, publication or transaction sent.',
    chainId:8453, compiler, sourceHash:keccak256(toUtf8Bytes(source)),
    deploymentData:`0x${artifact.evm.bytecode.object}`, runtimeCodeHash,
    appointmentsConfig:{ address:'', runtimeCodeHash, writesEnabled:false },
    gates:'Review source and passing local tests, steward approves and signs deployment, verify deployed runtime, then explicitly enable writes. Existing paid contract is unchanged.',
  };
  if (address) {
    const provider = new JsonRpcProvider(rpc);
    try {
      if (BigInt(await provider.send('eth_chainId', [])) !== 8453n) throw new Error('Verify on Base (8453).');
      address = getAddress(address);
      if (keccak256(await provider.getCode(address)) !== runtimeCodeHash) throw new Error('Deployed appointment runtime differs from this reviewed source.');
      const contract = new Contract(address, APPOINTMENT_ABI, provider);
      if (await contract.VERSION() !== 'dcal-appointments-1' || await contract.MAX_WINDOWS() !== 62n) throw new Error('Unexpected deployed appointment policy.');
      result.appointmentsConfig.address = address;
    } finally { provider.destroy(); }
  }
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options:{ address:{ type:'string' }, rpc:{ type:'string' } } });
  console.log(JSON.stringify(await prepareAppointments(values), null, 2));
}
