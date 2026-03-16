/* Calendar.js — DecentCalendar Web Component (light DOM)
 * Wires all calendar UI events and delegates to the global functions
 * defined in calendar.js, events.js, contract.js, payments.js, meetingRoom.js.
 * Does NOT use shadow DOM so FullCalendar renders directly into the page. */

export class DecentCalendar extends HTMLElement {
  connectedCallback() {
    // Wait for full DOM before wiring
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._init());
    } else {
      this._init();
    }
  }

  _init() {
    // ---- Set global wallet callbacks ----
    window.onWalletConnected = (address) => {
      window._walletAddress = address;
      if (typeof loadAndRenderMyEvents === 'function') loadAndRenderMyEvents();
      if (typeof checkPendingBookings === 'function') checkPendingBookings();
    };

    window.onWalletDisconnected = () => {
      window._walletAddress = null;
      window._walletProvider = null;
      window._walletSigner = null;
      if (typeof clearCalendarEvents === 'function') clearCalendarEvents();
    };

    // ---- Set IPFS upload hook ----
    window.onIPFSUploadClick = async () => {
      if (!window._walletAddress) {
        alert('Please connect your wallet before uploading.');
        return;
      }
      const key = localStorage.getItem('pinata_api_key') || '';
      const secret = localStorage.getItem('pinata_api_secret') || '';
      if (!key || !secret) {
        alert('Configure your Pinata API keys first (click the IPFS icon).');
        return;
      }
      try {
        const events = typeof loadMyEvents === 'function'
          ? loadMyEvents(window._walletAddress)
          : [];
        if (events.length === 0) {
          alert('No events to upload.');
          return;
        }
        const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'pinata_api_key': key,
            'pinata_secret_api_key': secret,
          },
          body: JSON.stringify({
            pinataContent: { address: window._walletAddress, events },
            pinataMetadata: { name: `decent-calendar-${window._walletAddress.slice(0, 8)}` },
          }),
        });
        if (!response.ok) throw new Error(await response.text());
        const result = await response.json();
        const cid = result.IpfsHash;

        const history = JSON.parse(localStorage.getItem('calendarIPFSHistory') || '[]');
        history.unshift({ cid, timestamp: new Date().toISOString() });
        localStorage.setItem('calendarIPFSHistory', JSON.stringify(history.slice(0, 50)));

        alert(`Calendar uploaded to IPFS!\nCID: ${cid}\n\nhttps://gateway.pinata.cloud/ipfs/${cid}`);
      } catch (err) {
        console.error('IPFS upload failed:', err);
        alert('Upload failed: ' + err.message);
      }
    };

    // ---- Init FullCalendar ----
    if (typeof initCalendar === 'function') initCalendar();
    if (typeof refreshCalendarToggle === 'function') refreshCalendarToggle();

    // ---- Wire Add Event Modal ----
    document.getElementById('add-event-btn')?.addEventListener('click', () => {
      if (!window._walletAddress) {
        alert('Please connect your wallet first.');
        return;
      }
      const modal = document.getElementById('add-event-modal');
      if (modal) {
        document.getElementById('event-title').value = '';
        document.getElementById('event-start').value = '';
        document.getElementById('event-end').value = '';
        document.getElementById('event-rate').value = '';
        document.getElementById('event-public').checked = true;
        document.getElementById('event-private').checked = false;
        modal.classList.remove('hidden');
      }
    });

    document.getElementById('save-event-btn')?.addEventListener('click', () => this._handleAddEvent());
    document.getElementById('cancel-event-btn')?.addEventListener('click', () => {
      document.getElementById('add-event-modal')?.classList.add('hidden');
    });

    document.getElementById('event-public')?.addEventListener('change', (e) => {
      const priv = document.getElementById('event-private');
      if (priv) priv.checked = !e.target.checked;
    });
    document.getElementById('event-private')?.addEventListener('change', (e) => {
      const pub = document.getElementById('event-public');
      if (pub) pub.checked = !e.target.checked;
    });

    // ---- Wire Mint Modal ----
    document.getElementById('mint-timeslot-btn')?.addEventListener('click', () => {
      if (!window._walletAddress) {
        alert('Please connect your wallet first.');
        return;
      }
      document.getElementById('mint-modal')?.classList.remove('hidden');
    });

    document.getElementById('confirm-mint-btn')?.addEventListener('click', () => this._handleMintTimeslot());
    document.getElementById('cancel-mint-btn')?.addEventListener('click', () => {
      document.getElementById('mint-modal')?.classList.add('hidden');
    });

    // ---- Wire Fetch Public Events ----
    document.getElementById('fetch-events-btn')?.addEventListener('click', () => this._handleFetchPublicEvents());

    // ---- Wire Booking Modal ----
    document.getElementById('cancel-booking-btn')?.addEventListener('click', () => {
      document.getElementById('booking-modal')?.classList.add('hidden');
    });

    // ---- Wire Meeting Modal ----
    document.getElementById('close-meeting-btn')?.addEventListener('click', () => {
      if (typeof closeMeetingRoom === 'function') closeMeetingRoom();
      document.getElementById('meeting-modal')?.classList.add('hidden');
    });
  }

  // ---- Add Event handler (ported from app.js) ----
  async _handleAddEvent() {
    const title = document.getElementById('event-title')?.value.trim();
    const start = document.getElementById('event-start')?.value;
    const end = document.getElementById('event-end')?.value;
    const hourlyRate = parseFloat(document.getElementById('event-rate')?.value) || 0;
    const isPublic = document.getElementById('event-public')?.checked ?? true;

    if (!title || !start || !end) {
      alert('Please fill out all fields.');
      return;
    }
    if (new Date(end) <= new Date(start)) {
      alert('End time must be after start time.');
      return;
    }

    const classNames = isPublic ? ['public-event'] : ['private-event'];
    const meetingRoomId = isPublic ? `meeting-${Date.now()}-${window._walletAddress}` : null;

    const newEvent = {
      title,
      start,
      end,
      hourlyRate,
      isPublic,
      classNames,
      meetingRoomId,
      creator: window._walletAddress,
      status: 'available',
    };

    try {
      const saved = await saveEvent(window._walletAddress, newEvent);
      if (typeof addEventToCalendar === 'function') addEventToCalendar(saved);
      document.getElementById('add-event-modal')?.classList.add('hidden');
    } catch (err) {
      console.error('Error saving event:', err);
      alert('Failed to save event: ' + err.message);
    }
  }

  // ---- Mint Timeslot handler (ported from app.js) ----
  async _handleMintTimeslot() {
    const title = document.getElementById('mint-title')?.value.trim();
    const date = document.getElementById('mint-date')?.value;
    const startTime = document.getElementById('mint-start')?.value;
    const endTime = document.getElementById('mint-end')?.value;
    const hourlyRate = parseFloat(document.getElementById('mint-rate')?.value) || 0;
    const description = document.getElementById('mint-description')?.value.trim() || '';

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
      owner: window._walletAddress,
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
      meetingRoomId: `meeting-${Date.now()}-${window._walletAddress}`,
      fiatOptions: { paypal: true, card: true, fiatRateUSD: 0 },
      isPublic: true,
      classNames: ['public-event'],
      creator: window._walletAddress,
      start: startISO,
      end: endISO,
      createdAt: new Date().toISOString(),
      ipfsCID: null,
    };

    document.getElementById('mint-modal')?.classList.add('hidden');

    // Upload to IPFS if Pinata is configured
    let ipfsCID = null;
    try {
      if (typeof uploadToIPFS === 'function') {
        ipfsCID = await uploadToIPFS(timeslotData);
      }
    } catch (err) {
      console.warn('IPFS upload failed, continuing without CID:', err);
    }

    // Mint on-chain if contract is configured
    const contractAddr = window.DECENT_CONFIG?.contractAddresses?.TimeslotNFT || '';
    if (contractAddr && ipfsCID && typeof mintTimeslot === 'function') {
      try {
        const tokenId = await mintTimeslot(ipfsCID, startTs, endTs, hourlyRateWei);
        timeslotData.tokenId = tokenId;
        timeslotData.ipfsCID = ipfsCID;
        alert(`Timeslot minted! Token ID: ${tokenId}`);
      } catch (err) {
        console.error('Minting failed:', err);
        alert('On-chain minting failed: ' + (err.reason || err.message) + '\nEvent saved locally only.');
      }
    } else if (!contractAddr) {
      console.warn('Contract not deployed — saving timeslot to localStorage only.');
      if (ipfsCID) alert(`Metadata uploaded to IPFS (CID: ${ipfsCID})\nDeploy contracts to mint on-chain.`);
    }

    timeslotData.ipfsCID = ipfsCID;
    try {
      const saved = await saveEvent(window._walletAddress, timeslotData);
      if (typeof addEventToCalendar === 'function') addEventToCalendar(saved);
    } catch (err) {
      console.error('Error saving minted timeslot:', err);
    }
  }

  // ---- Fetch Public Events handler (ported from app.js) ----
  async _handleFetchPublicEvents() {
    const address = document.getElementById('lookup-address')?.value.trim();
    if (!address) {
      alert('Please enter a wallet address.');
      return;
    }
    try {
      const color = typeof generateColorForAddress === 'function'
        ? generateColorForAddress(address)
        : `hsl(${address.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 50%)`;

      const events = typeof fetchPublicEventsForAddress === 'function'
        ? await fetchPublicEventsForAddress(address)
        : [];

      // Set otherEvents and currentLookupAddress via exposed setters in calendar.js
      const mapped = events.map((event) => ({
        ...event,
        classNames: event.classNames || ['imported-event'],
        backgroundColor: color,
        borderColor: color,
        hourlyRate: event.hourlyRate || 0,
      }));
      if (typeof setOtherEvents === 'function') setOtherEvents(mapped);
      if (typeof setCurrentLookupAddress === 'function') setCurrentLookupAddress(address);

      if (typeof refreshCalendarToggle === 'function') refreshCalendarToggle();
      if (typeof refreshCalendar === 'function') refreshCalendar();

      if (events.length === 0) alert('No public events found for this address.');
    } catch (err) {
      console.error('Fetch public events error:', err);
      alert('Failed to fetch events: ' + err.message);
    }
  }
}

customElements.define('decent-calendar', DecentCalendar);
