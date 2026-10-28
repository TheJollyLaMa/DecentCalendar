import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Contract, ContractFactory, FetchRequest, JsonRpcProvider, getAddress, keccak256, toUtf8Bytes } from 'ethers';
import { compileBooking } from './compile-booking.mjs';
import { BOOKING_ABI, ZERO_ADDRESS } from '../decent-calendar-vanilla/js/booking-client.js';
import { ASSETS } from '../decent-calendar-vanilla/js/assets.js';

export function matchesRuntime(actual, artifact) {
  const expected = artifact.evm.deployedBytecode;
  const normalize = code => {
    let hex = code.replace(/^0x/, '').toLowerCase();
    for (const refs of Object.values(expected.immutableReferences)) for (const { start, length } of refs) {
      hex = `${hex.slice(0, start * 2)}${'0'.repeat(length * 2)}${hex.slice((start + length) * 2)}`;
    }
    return hex;
  };
  return actual.length === expected.object.length + 2 && normalize(actual) === normalize(expected.object);
}

export async function prepareDeployment({ feeRecipient, owner = feeRecipient, address, baseRpc = 'https://mainnet.base.org', ensRpc = 'https://ethereum-rpc.publicnode.com' }) {
  const recipient = getAddress(feeRecipient);
  const admin = getAddress(owner);
  if (recipient === ZERO_ADDRESS || admin === ZERO_ADDRESS) throw new Error('Fee recipient and owner cannot be zero.');
  const provider = url => {
    const request = new FetchRequest(url); request.timeout = 15000;
    return new JsonRpcProvider(request);
  };
  const base = provider(baseRpc), ethereum = provider(ensRpc);
  try {
    const [chain, resolved, code] = await Promise.all([
      base.send('eth_chainId', []), ethereum.resolveName('DecentAgency.eth'), base.getCode(ASSETS[1].address),
    ]);
    if (BigInt(chain) !== 8453n || code === '0x') throw new Error('Base chain or canonical USDC bytecode check failed.');
    if (!resolved || getAddress(resolved) !== recipient || admin !== recipient) {
      throw new Error('Fee recipient and token-allowlist owner must both match the current DecentAgency.eth record. Stop for steward confirmation.');
    }
    const token = new Contract(ASSETS[1].address, ['function decimals() view returns (uint8)'], base);
    if (await token.decimals() !== 6n) throw new Error('Canonical USDC decimal check failed.');
    const { artifact, input, compiler } = await compileBooking();
    const data = (await new ContractFactory(artifact.abi, artifact.evm.bytecode.object).getDeployTransaction(recipient, admin, [ASSETS[1].address])).data;
    const result = {
      operation: 'READ-ONLY preparation; no transaction submitted', chainId: 8453, compiler,
      sourceHash: keccak256(toUtf8Bytes(input.sources['DCalBooking.sol'].content)),
      constructorArguments: [recipient, admin, [getAddress(ASSETS[1].address)]],
      enabledAssets: ['ETH (native, always allowed)', `USDC ${getAddress(ASSETS[1].address)}`],
      creationCodeHash: keccak256(data), deploymentData: data,
      releaseGates: 'Independent review, repeat fork acceptance for reviewed source, steward confirmation/signature required. writesEnabled remains false.',
    };
    if (address) {
      const deployedAddress = getAddress(address), runtime = await base.getCode(deployedAddress);
      if (!matchesRuntime(runtime, artifact)) throw new Error('Deployed runtime does not match this compiled source.');
      const contract = new Contract(deployedAddress, BOOKING_ABI, base);
      const [version, fee, delay, maxAttendees, deployedFee, deployedOwner, usdc] = await Promise.all([
        contract.VERSION(), contract.FEE_BPS(), contract.REFUND_DELAY(), contract.MAX_ATTENDEES(),
        contract.feeRecipient(), contract.owner(), contract.allowedToken(ASSETS[1].address),
      ]);
      if (version !== 'dcal-timebox-1' || fee !== 300n || delay !== 604800n || maxAttendees !== 50n ||
          getAddress(deployedFee) !== recipient || getAddress(deployedOwner) !== admin || usdc !== true) {
        throw new Error('Deployed policy or immutable addresses differ from the approved configuration.');
      }
      result.bookingConfig = { address: deployedAddress, runtimeCodeHash: keccak256(runtime), feeRecipient: recipient, writesEnabled: false };
    }
    return result;
  } finally { base.destroy(); ethereum.destroy(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: {
    'fee-recipient': { type: 'string' }, owner: { type: 'string' }, address: { type: 'string' },
    'base-rpc': { type: 'string' }, 'ens-rpc': { type: 'string' },
  } });
  if (!values['fee-recipient']) throw new Error('Supply --fee-recipient with the exact steward-confirmed address. No ENS-only signing instructions.');
  console.log(JSON.stringify(await prepareDeployment({
    feeRecipient: values['fee-recipient'], owner: values.owner, address: values.address,
    baseRpc: values['base-rpc'], ensRpc: values['ens-rpc'],
  }), null, 2));
}
