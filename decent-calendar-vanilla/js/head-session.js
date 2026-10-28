export function bindCalendarSession(head, {
  target = window,
  connected,
  disconnected,
  report,
}) {
  let generation = 0;
  let previous;
  const reset = () => {
    target._walletAddress = null;
    target._walletSigner = null;
    disconnected();
  };
  const update = async state => {
    const identity = [state.connected, state.address, state.chainId, state.provider];
    if (previous && identity.every((value, index) => value === previous[index])) return;
    previous = identity;
    const request = ++generation;
    reset();
    if (!state.connected) {
      report('Local prototype. Connect explicitly to use your calendar; paid bookings and video meetings are not live.');
      return;
    }
    try {
      if (BigInt(state.chainId) !== 8453n) {
        report('Wrong network. Select Base (8453) in your wallet. Transactions are unavailable.');
        return;
      }
      const signer = await state.provider.getSigner(state.address);
      if (request !== generation) return;
      target._walletAddress = state.address;
      target._walletSigner = signer;
      connected(state.address);
      report('Base wallet connected. Calendar data is local unless you explicitly publish availability. Paid bookings and video meetings are not live.');
    } catch (error) {
      if (request !== generation) return;
      reset();
      console.error('[DCal wallet]', error);
      report(`Calendar wallet unavailable: ${error.message}`);
    }
  };
  const unsubscribe = head.on('wallet', state => { void update(state); });
  void update(head.getWallet().snapshot());
  return () => {
    generation++;
    unsubscribe();
    reset();
  };
}
