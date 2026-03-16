/* app.js — Entry point: wires together all modules */

document.addEventListener('DOMContentLoaded', () => {

  // ---- Wallet ----
  document.getElementById('wallet-btn').addEventListener('click', () => {
    if (walletState.address) {
      disconnectWallet();
    } else {
      connectWallet();
    }
  });

  // ---- Add Event Modal ----
  document.getElementById('add-event-btn').addEventListener('click', openAddEventModal);
  document.getElementById('save-event-btn').addEventListener('click', handleAddEvent);
  document.getElementById('cancel-event-btn').addEventListener('click', closeAddEventModal);

  // Keep public/private checkboxes in sync
  document.getElementById('event-public').addEventListener('change', (e) => {
    document.getElementById('event-private').checked = !e.target.checked;
  });
  document.getElementById('event-private').addEventListener('change', (e) => {
    document.getElementById('event-public').checked = !e.target.checked;
  });

  // ---- Mint Timeslot Modal ----
  document.getElementById('mint-timeslot-btn').addEventListener('click', openMintModal);
  document.getElementById('confirm-mint-btn').addEventListener('click', handleMintTimeslot);
  document.getElementById('cancel-mint-btn').addEventListener('click', closeMintModal);

  // ---- Fetch Public Events ----
  document.getElementById('fetch-events-btn').addEventListener('click', handleFetchPublicEvents);

  // ---- Booking Modal ----
  document.getElementById('cancel-booking-btn').addEventListener('click', () => {
    document.getElementById('booking-modal').classList.add('hidden');
  });

  // ---- Meeting Modal ----
  document.getElementById('close-meeting-btn').addEventListener('click', () => {
    closeMeetingRoom();
    document.getElementById('meeting-modal').classList.add('hidden');
  });

  // ---- Confirm Modal (dismiss without action) ----
  // Buttons are wired in calendar.js openConfirmModal()

  // ---- Init Calendar (empty until wallet connects) ----
  initCalendar();
  refreshCalendarToggle();
});

// ---------- Wallet callbacks (called by wallet.js) ----------

function onWalletConnected() {
  loadAndRenderMyEvents();
  checkPendingBookings();
}

function onWalletDisconnected() {
  clearCalendarEvents();
}

// ---------- Add Event ----------

function openAddEventModal() {
  if (!walletState.address) {
    alert('Please connect your wallet first.');
    return;
  }
  document.getElementById('event-title').value = '';
  document.getElementById('event-start').value = '';
  document.getElementById('event-end').value = '';
  document.getElementById('event-rate').value = '';
  document.getElementById('event-public').checked = true;
  document.getElementById('event-private').checked = false;
  document.getElementById('add-event-modal').classList.remove('hidden');
}

function closeAddEventModal() {
  document.getElementById('add-event-modal').classList.add('hidden');
}

async function handleAddEvent() {
  const title = document.getElementById('event-title').value.trim();
  const start = document.getElementById('event-start').value;
  const end = document.getElementById('event-end').value;
  const hourlyRate = parseFloat(document.getElementById('event-rate').value) || 0;
  const isPublic = document.getElementById('event-public').checked;

  if (!title || !start || !end) {
    alert('Please fill out all fields.');
    return;
  }
  if (new Date(end) <= new Date(start)) {
    alert('End time must be after start time.');
    return;
  }

  const classNames = isPublic ? ['public-event'] : ['private-event'];
  const meetingRoomId = isPublic ? `meeting-${Date.now()}-${walletState.address}` : null;

  const newEvent = {
    title,
    start,
    end,
    hourlyRate,
    isPublic,
    classNames,
    meetingRoomId,
    creator: walletState.address,
    status: 'available',
  };

  try {
    const saved = await saveEvent(walletState.address, newEvent);
    addEventToCalendar(saved);
    closeAddEventModal();
  } catch (err) {
    console.error('Error saving event:', err);
    alert('Failed to save event: ' + err.message);
  }
}

// ---------- Mint Timeslot ----------

function openMintModal() {
  if (!walletState.address) {
    alert('Please connect your wallet first.');
    return;
  }
  document.getElementById('mint-modal').classList.remove('hidden');
}

function closeMintModal() {
  document.getElementById('mint-modal').classList.add('hidden');
}

async function handleMintTimeslot() {
  const title = document.getElementById('mint-title').value.trim();
  const date = document.getElementById('mint-date').value;
  const startTime = document.getElementById('mint-start').value;
  const endTime = document.getElementById('mint-end').value;
  const hourlyRate = parseFloat(document.getElementById('mint-rate').value) || 0;
  const description = document.getElementById('mint-description').value.trim();

  if (!title || !date || !startTime || !endTime) {
    alert('Please fill out all required fields.');
    return;
  }

  const startISO = `${date}T${startTime}`;
  const endISO = `${date}T${endTime}`;
  if (new Date(endISO) <= new Date(startISO)) {
    alert('End time must be after start time.');
    return;
  }

  const startTs = Math.floor(new Date(startISO).getTime() / 1000);
  const endTs = Math.floor(new Date(endISO).getTime() / 1000);
  const durationMinutes = Math.round((endTs - startTs) / 60);
  const hourlyRateWei = ethers.parseEther(hourlyRate.toString()).toString();

  const timeslotData = {
    version: '0.1',
    type: 'timeslot',
    tokenId: null,
    owner: walletState.address,
    title,
    description,
    date,
    startTime,
    endTime,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    durationMinutes,
    hourlyRate,
    currency: 'POL',
    status: 'available',
    meetingRoomId: `meeting-${Date.now()}-${walletState.address}`,
    fiatOptions: { paypal: true, card: true, fiatRateUSD: 0 },
    isPublic: true,
    classNames: ['public-event'],
    creator: walletState.address,
    start: startISO,
    end: endISO,
    createdAt: new Date().toISOString(),
    ipfsCID: null,
  };

  closeMintModal();

  // Step 1: Upload metadata to IPFS
  let ipfsCID = null;
  try {
    ipfsCID = await uploadToIPFS(timeslotData);
  } catch (err) {
    console.warn('IPFS upload failed, continuing without CID:', err);
  }

  // Step 2: Mint on-chain if contract is configured
  if (CONTRACT_ADDRESSES.TimeslotNFT && ipfsCID) {
    try {
      const tokenId = await mintTimeslot(ipfsCID, startTs, endTs, hourlyRateWei);
      timeslotData.tokenId = tokenId;
      timeslotData.ipfsCID = ipfsCID;
      alert(`Timeslot minted! Token ID: ${tokenId}`);
    } catch (err) {
      console.error('Minting failed:', err);
      alert('On-chain minting failed: ' + (err.reason || err.message) + '\nEvent saved locally only.');
    }
  } else if (!CONTRACT_ADDRESSES.TimeslotNFT) {
    console.warn('Contract not deployed — saving timeslot to localStorage only.');
    if (ipfsCID) alert(`Metadata uploaded to IPFS (CID: ${ipfsCID})\nDeploy contracts to mint on-chain.`);
    else alert('Timeslot saved locally (no IPFS keys, no contract address configured).');
  }

  // Step 3: Save to localStorage and display on calendar
  timeslotData.ipfsCID = ipfsCID;
  try {
    const saved = await saveEvent(walletState.address, timeslotData);
    addEventToCalendar(saved);
  } catch (err) {
    console.error('Error saving minted timeslot:', err);
  }
}

// ---------- Fetch Public Events ----------

async function handleFetchPublicEvents() {
  const address = document.getElementById('lookup-address').value.trim();
  if (!address) {
    alert('Please enter a wallet address.');
    return;
  }

  try {
    const color = generateColorForAddress(address);
    const events = await fetchPublicEventsForAddress(address);

    otherEvents = events.map((event) => ({
      ...event,
      classNames: event.classNames || ['imported-event'],
      backgroundColor: color,
      borderColor: color,
      hourlyRate: event.hourlyRate || 0,
    }));

    currentLookupAddress = address;
    refreshCalendarToggle();
    refreshCalendar();

    if (events.length === 0) {
      alert('No public events found for this address.');
    }
  } catch (err) {
    console.error('Fetch public events error:', err);
    alert('Failed to fetch events: ' + err.message);
  }
}

// ---------- Pending Bookings (owner notification) ----------

/**
 * Check if any of the owner's events have status "pending" (someone booked them)
 * and show the confirmation modal for the first one found.
 */
function checkPendingBookings() {
  if (!walletState.address) return;
  const pending = myEvents.filter((e) => e.status === 'pending');
  if (pending.length > 0) {
    // Show a notification — the full confirm modal is triggered via event click
    console.log(`You have ${pending.length} pending booking(s). Click the event to confirm.`);
  }
}
