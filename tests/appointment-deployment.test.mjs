import test from 'node:test';
import assert from 'node:assert/strict';
import { appointmentDeploymentBudget, deploymentPreflight } from '../scripts/deploy-appointments.mjs';
import { parseEther } from 'ethers';

test('deployment budget covers gas buffer and explicit L1 reserve without permitting an over-budget send', () => {
  const result = appointmentDeploymentBudget(1996957n, { maxFeePerGas:11000000n, maxPriorityFeePerGas:1000000n },
    parseEther('0.001'), parseEther('0.0001'));
  assert.equal(result.gasLimit,2396349n);
  assert.equal(result.estimatedBudget,result.gasLimit * 11000000n + parseEther('0.00001'));
  for (const args of [
    [1n,{},parseEther('1'),parseEther('1')],
    [0n,{gasPrice:1n},parseEther('1'),parseEther('1')],
    [1996957n,{gasPrice:11000000n},0n,parseEther('1')],
    [1996957n,{gasPrice:11000000n},parseEther('1'),parseEther('0.00001')],
  ]) assert.throws(()=>appointmentDeploymentBudget(...args));
});
test('deployment preflight rejects wrong networks, unresolved names and arbitrary wallets before preparing transactions', async () => {
  await assert.rejects(deploymentPreflight({ name:'other.eth' }),/approved/);
  await assert.rejects(deploymentPreflight({ name:'DecentAgency.eth', provider:{send:async()=> '0x1'}, ethereum:{} }),/networks/);
  await assert.rejects(deploymentPreflight({ name:'DecentAgency.eth', provider:{send:async()=> '0x2105'},
    ethereum:{send:async()=> '0x1',resolveName:async()=>null} }),/could not be resolved/);
  for(const key of ['invalid-private-value','0x'+'00'.repeat(32),'0x'+'ff'.repeat(32)]) {
    await assert.rejects(deploymentPreflight({name:'DecentAgency.eth',key}), error =>
      error.message.includes('Invalid local deployer key') && !error.message.includes(key));
  }
});
