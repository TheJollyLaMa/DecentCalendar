/* Calendar.js — <decent-calendar> Web Component (Light DOM)
   Renders calendar controls + FullCalendar wrapper into the light DOM.
   Defines window.on* hooks and wires all modal event listeners.
   Delegates to calendar.js global functions for FullCalendar logic. */

class DecentCalendar extends HTMLElement {
  connectedCallback() {
    // Render into light DOM — FullCalendar requires access to real DOM nodes
    this.innerHTML = `
      <main id="main-content">
        <div id="calendar-controls">
          <div class="address-input">
            <input
              id="lookup-address"
              type="text"
              placeholder="Enter wallet address to view their calendar"
            />
            <button id="fetch-events-btn">Fetch Public Events</button>
          </div>
          <div id="calendar-toggle"></div>
          <button id="add-event-btn" class="add-event-button" title="Add Event">+</button>
          <button id="mint-timeslot-btn" class="mint-button" title="Mint Timeslot NFT">⛏️ Mint Timeslot</button>
        </div>
        <div id="calendar-wrapper">
          <div id="calendar"></div>
        </div>
      </main>
    `;

    // All helper scripts (calendar.js, events.js, etc.) are loaded as globals before
    // this module runs (modules are deferred), so globals are available here.
    this._defineHooks();
    this._wireModalListeners();
    initCalendar();
    refreshCalendarToggle();
  }

  // ---- Global Hook Definitions ----

  _defineHooks() {
    window.onWalletConnected = (address) => {
      loadAndRenderMyEvents();
      this._checkPendingBookings();
    };

    window.onWalletDisconnected = () => {
      clearCalendarEvents();
    };

    window.onIPFSUploadClick = async () => {
      if (!window._walletAddress) {
        alert('Connect your wallet first.');
        return;
      }
      if (!window.w3upClient) {
        alert('Connect to IPFS first (click the IPFS icon).');
        return;
      }
      const events = loadMyEvents(window._walletAddress);
      const data = {
        address: window._walletAddress,
        events,
        exportedAt: new Date().toISOString(),
      };
      const { uploadDataToIPFS } = await import('../helpers/ipfs/uploadToIPFS.js');
      const cid = await uploadDataToIPFS(data, window.w3upClient);
      if (cid) {
        alert(`✅ Calendar saved to IPFS!\nCID: ${cid}`);
        console.log('Calendar CID:', cid);
      } else {
        alert('IPFS upload failed. Check the console for details.');
      }
    };

    window.onIPFSImportCID = async (cid) => {
      try {
        const url = `https://w3s.link/ipfs/${cid}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const data = await res.json();
        if (data.events && Array.isArray(data.events)) {
          setOtherEvents(data.events.map(e => ({ ...e, classNames: ['imported-event'] })));
          setCurrentLookupAddress(data.address || cid);
          refreshCalendarToggle();
          refreshCalendar();
          alert(`✅ Imported ${data.events.length} events from CID`);
        } else {
          alert('No events found in that CID.');
        }
      } catch (err) {
        console.error('CID import error:', err);
        alert('Failed to import from CID: ' + err.message);
      }
    };
  }

  // ---- Modal Event Listeners ----

  _wireModalListeners() {
    // Add Event Modal
    document.getElementById('add-event-btn').addEventListener('click', () => this._openAddEventModal());
    document.getElementById('save-event-btn').addEventListener('click', () => this._handleAddEvent());
    document.getElementById('cancel-event-btn').addEventListener('click', () => this._closeAddEventModal());

    // Keep public/private checkboxes in sync
    document.getElementById('event-public').addEventListener('change', (e) => {
      document.getElementById('event-private').checked = !e.target.checked;
    });
    document.getElementById('event-private').addEventListener('change', (e) => {
      document.getElementById('event-public').checked = !e.target.checked;
    });

    // Mint Timeslot Modal
    document.getElementById('mint-timeslot-btn').addEventListener('click', () => this._openMintModal());
    document.getElementById('confirm-mint-btn').addEventListener('click', () => this._handleMintTimeslot());
    document.getElementById('cancel-mint-btn').addEventListener('click', () => this._closeMintModal());

    // Fetch Public Events
    document.getElementById('fetch-events-btn').addEventListener('click', () => this._handleFetchPublicEvents());

    // Booking Modal
    document.getElementById('cancel-booking-btn').addEventListener('click', () => {
      document.getElementById('booking-modal').classList.add('hidden');
    });

    // Meeting Modal
    document.getElementById('close-meeting-btn').addEventListener('click', () => {
      closeMeetingRoom();
      document.getElementById('meeting-modal').classList.add('hidden');
    });
  }

  // ---- Add Event ----

  _openAddEventModal() {
    if (!window._walletAddress) {
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

  _closeAddEventModal() {
    document.getElementById('add-event-modal').classList.add('hidden');
  }

  async _handleAddEvent() {
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
      addEventToCalendar(saved);
      this._closeAddEventModal();
    } catch (err) {
      console.error('Error saving event:', err);
      alert('Failed to save event: ' + err.message);
    }
  }

  // ---- Mint Timeslot ----

  _openMintModal() {
    if (!window._walletAddress) {
      alert('Please connect your wallet first.');
      return;
    }
    document.getElementById('mint-modal').classList.remove('hidden');
  }

  _closeMintModal() {
    document.getElementById('mint-modal').classList.add('hidden');
  }

  async _handleMintTimeslot() {
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

    this._closeMintModal();

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
        alert(
          `On-chain minting failed: ${err.reason || err.message}\nEvent saved locally only.`
        );
      }
    } else if (!CONTRACT_ADDRESSES.TimeslotNFT) {
      console.warn('Contract not deployed — saving timeslot to localStorage only.');
      if (ipfsCID) {
        alert(`Metadata uploaded to IPFS (CID: ${ipfsCID})\nDeploy contracts to mint on-chain.`);
      } else {
        alert('Timeslot saved locally (no IPFS keys, no contract address configured).');
      }
    }

    // Step 3: Save to localStorage and display on calendar
    timeslotData.ipfsCID = ipfsCID;
    try {
      const saved = await saveEvent(window._walletAddress, timeslotData);
      addEventToCalendar(saved);
    } catch (err) {
      console.error('Error saving minted timeslot:', err);
    }
  }

  // ---- Fetch Public Events ----

  async _handleFetchPublicEvents() {
    const address = document.getElementById('lookup-address').value.trim();
    if (!address) {
      alert('Please enter a wallet address.');
      return;
    }

    try {
      const color = generateColorForAddress(address);
      const events = await fetchPublicEventsForAddress(address);

      const mapped = events.map((event) => ({
        ...event,
        classNames: event.classNames || ['imported-event'],
        backgroundColor: color,
        borderColor: color,
        hourlyRate: event.hourlyRate || 0,
      }));

      // Use setters exposed by calendar.js
      setOtherEvents(mapped);
      setCurrentLookupAddress(address);
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

  // ---- Pending Bookings ----

  _checkPendingBookings() {
    if (!window._walletAddress) return;
    const events = loadMyEvents(window._walletAddress);
    const pending = events.filter((e) => e.status === 'pending');
    if (pending.length > 0) {
      console.log(`You have ${pending.length} pending booking(s). Click the event to confirm.`);
    }
  }
}

customElements.define('decent-calendar', DecentCalendar);
