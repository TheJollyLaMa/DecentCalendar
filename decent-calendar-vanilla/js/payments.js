/* payments.js — Crypto, PayPal, and Card payment flows */

// ---- Currently selected event for booking ----
let _pendingBookingEvent = null;

function setPendingBookingEvent(event) {
  _pendingBookingEvent = event;
}

function getPendingBookingEvent() {
  return _pendingBookingEvent;
}

/**
 * Pay with crypto (POL/ETH) via TimeslotMarket contract (escrow).
 * @param {number} tokenId - on-chain tokenId of the timeslot
 * @param {number} totalCostPOL - total cost in POL (as a float)
 */
async function payWithCrypto(tokenId, totalCostPOL) {
  if (!window._walletSigner) {
    alert('Please connect your wallet first.');
    return;
  }

  if (!CONTRACT_ADDRESSES.TimeslotMarket) {
    // Fallback: direct ETH transfer to creator (legacy behavior — no escrow)
    const event = getPendingBookingEvent();
    if (!event || !event.creator) {
      alert('Cannot determine payment recipient.');
      return;
    }
    try {
      const valueWei = ethers.parseEther(totalCostPOL.toString());
      const tx = await window._walletSigner.sendTransaction({
        to: event.creator,
        value: valueWei,
      });
      console.log('Direct payment tx:', tx.hash);
      await tx.wait();
      alert('Payment sent directly to creator! (No escrow — contract not deployed)');
    } catch (err) {
      console.error('Direct payment failed:', err);
      alert('Payment failed: ' + (err.reason || err.message));
    }
    return;
  }

  try {
    const valueWei = ethers.parseEther(totalCostPOL.toString());
    await bookTimeslot(tokenId, valueWei);
    alert('Booking confirmed on-chain! Funds held in escrow until appointment is confirmed.');
    closeBookingModal();
  } catch (err) {
    console.error('Crypto payment error:', err);
    alert('Transaction failed: ' + (err.reason || err.message));
  }
}

/**
 * Pay with PayPal — renders PayPal button SDK into the booking modal.
 * @param {object} eventData - the event being booked
 */
async function payWithPayPal(eventData) {
  // Load PayPal JS SDK on demand
  // Sanitize the client ID — only allow alphanumeric chars and hyphens
  const rawId = localStorage.getItem('paypal_client_id') || 'YOUR_PAYPAL_CLIENT_ID';
  const paypalClientId = rawId.replace(/[^A-Za-z0-9_-]/g, '');
  if (!window.paypal) {
    await loadScript(`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypalClientId)}&currency=USD`);
  }

  const container = document.getElementById('booking-details');
  container.innerHTML += '<div id="paypal-button-container"></div>';

  window.paypal.Buttons({
    createOrder: (data, actions) => {
      const duration = calcDurationHours(eventData);
      const totalUSD = (eventData.hourlyRate || 0) * duration;
      return actions.order.create({
        purchase_units: [{ amount: { value: totalUSD.toFixed(2) } }],
      });
    },
    onApprove: async (data, actions) => {
      const order = await actions.order.capture();
      console.log('PayPal payment approved:', order);
      // Mark event as fiat-booked in localStorage
      const event = { ...eventData, status: 'booked-fiat', paypalOrderId: order.id };
      await saveEvent(eventData.owner || eventData.creator, event);
      alert('PayPal payment successful! Your appointment is booked.');
      closeBookingModal();
    },
    onError: (err) => {
      console.error('PayPal error:', err);
      alert('PayPal payment failed. Please try again.');
    },
  }).render('#paypal-button-container');
}

/**
 * Pay with Card — placeholder for Stripe integration.
 */
async function payWithCard(eventData) {
  alert('Card payments coming soon! (Stripe integration in progress)');
}

/**
 * Utility: calculate duration in hours between event start and end.
 */
function calcDurationHours(event) {
  if (!event.start || !event.end) return 1;
  const diff = new Date(event.end) - new Date(event.start);
  return diff / (1000 * 60 * 60);
}

/**
 * Utility: load an external script dynamically.
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
