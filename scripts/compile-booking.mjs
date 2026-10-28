import { readFile } from 'node:fs/promises';
import solc from 'solc';

export async function compileBooking(extraSources = {}) {
  const source = await readFile(new URL('../contracts/DCalBooking.sol', import.meta.url), 'utf8');
  const settings = { evmVersion: 'shanghai', optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'evm.deployedBytecode.immutableReferences'] } } };
  const input = { language: 'Solidity', sources: { 'DCalBooking.sol': { content: source }, ...extraSources }, settings };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter(error => error.severity === 'error');
  if (errors.length) throw new Error(errors.map(error => error.formattedMessage).join('\n'));
  return { artifact: output.contracts['DCalBooking.sol'].DCalBooking, contracts: output.contracts, input, compiler: solc.version() };
}
