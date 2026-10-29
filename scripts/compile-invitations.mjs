import { readFile } from 'node:fs/promises';
import { compileBooking } from './compile-booking.mjs';

export async function compileInvitations() {
  const content = await readFile(new URL('../contracts/DCalInvitations.sol', import.meta.url), 'utf8');
  const compiled = await compileBooking({ 'DCalInvitations.sol': { content } });
  return { ...compiled, artifact: compiled.contracts['DCalInvitations.sol'].DCalInvitations };
}
