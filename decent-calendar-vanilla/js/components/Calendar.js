import { fetchEventsForAddress, saveEvent, getAllMyEvents } from '../events.js';
import { initMeetingRoom } from '../meetingRoom.js';

export class DecentCalendar extends HTMLElement {
  connectedCallback() {
    this.calendar = null;
    this.walletAddress = null;
    this.myEventsVisible = true;
    this.otherEventsVisible = true;
    this.otherEvents = [];
    this.meetingRoomId = null;
    this.meetingPeer = null;

    this.initCalendar();
    this.wireControls();
    this.wireModals();

    // Hook called by WalletConnect after successful connect
    window.onWalletConnected = (address) => {
      window._walletAddress = address;
      this.walletAddress = address;
      this.loadMyEvents(address);
      this.renderCalendarToggle(address);
    };

    // Hook called by IPFSStatus when IPFS icon is clicked
    window.onIPFSUploadClick = async () => {
      if (window._walletAddress && window.w3upClient) {
        await this.uploadEventsToIPFS();
      } else {
        alert('Please connect your wallet and IPFS before uploading events.');
      }
    };
  }

  initCalendar() {
    const calEl = document.getElementById('calendar');
    if (!calEl || typeof FullCalendar === 'undefined') {
      console.warn('FullCalendar not ready yet, retrying...');
      setTimeout(() => this.initCalendar(), 500);
      return;
    }

    this.calendar = new FullCalendar.Calendar(calEl, {
      initialView: 'timeGridWeek',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay',
      },
      slotDuration: '00:15:00',
      events: [],
      eventClick: (info) => this.handleEventClick(info),
      eventDataTransform: (event) => ({
        ...event,
        title: `${event.title} (${event.hourlyRate || 0} POL/hr)`,
        backgroundColor: event.backgroundColor || undefined,
        borderColor: event.borderColor || undefined,
        classNames: event.classNames || ['public-event'],
      }),
    });
    this.calendar.render();
  }

  async loadMyEvents(address) {
    const events = await fetchEventsForAddress(address);
    this.renderEvents(events, this.otherEvents);
  }

  renderEvents(myEvents, otherEvents) {
    if (!this.calendar) return;
    this.calendar.removeAllEvents();
    if (this.myEventsVisible) {
      myEvents.forEach(e => this.calendar.addEvent(e));
    }
    if (this.otherEventsVisible) {
      otherEvents.forEach(e => this.calendar.addEvent(e));
    }
  }

  renderCalendarToggle(address) {
    const toggleEl = document.getElementById('calendar-toggle');
    if (!toggleEl) return;
    toggleEl.innerHTML = `
      <label style="color:#00FF00;">
        <input type="checkbox" id="my-events-toggle" ${this.myEventsVisible ? 'checked' : ''} />
        Your Calendar:
        <span class="calendar-shower-wallet-addr">${address.slice(0, 6)}</span>
        <img src="img/DecentSmartHome_Logo.png" class="icon-small" alt="" />
        <img src="img/Ommm_Token_Logo.png" class="icon-small" alt="" />
        <span class="calendar-shower-wallet-addr">${address.slice(-4)}</span>
      </label>
      <br/>
      <label style="color:#FF6347;" id="imported-toggle-label">
        <input type="checkbox" id="other-events-toggle" ${this.otherEventsVisible ? 'checked' : ''} />
        Imported Calendar
      </label>
    `;

    document.getElementById('my-events-toggle').addEventListener('change', async (e) => {
      this.myEventsVisible = e.target.checked;
      const myEvents = await fetchEventsForAddress(this.walletAddress || '');
      this.renderEvents(myEvents, this.otherEvents);
    });

    document.getElementById('other-events-toggle').addEventListener('change', async (e) => {
      this.otherEventsVisible = e.target.checked;
      const myEvents = await fetchEventsForAddress(this.walletAddress || '');
      this.renderEvents(myEvents, this.otherEvents);
    });
  }

  wireControls() {
    // Fetch public events button
    const fetchBtn = document.getElementById('fetch-events-btn');
    if (fetchBtn) {
      fetchBtn.addEventListener('click', () => this.handleFetchPublicEvents());
    }

    // Add event button
    const addBtn = document.getElementById('add-event-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (!this.walletAddress) {
          alert('Please connect your wallet first.');
          return;
        }
        document.getElementById('add-event-modal').classList.remove('modal-hidden');
      });
    }

    // Mint timeslot button
    const mintBtn = document.getElementById('mint-timeslot-btn');
    if (mintBtn) {
      mintBtn.addEventListener('click', () => {
        if (!this.walletAddress) {
          alert('Please connect your wallet first.');
          return;
        }
        document.getElementById('mint-modal').classList.remove('modal-hidden');
      });
    }
  }

  wireModals() {
    // Add event modal
    document.getElementById('save-event-btn')?.addEventListener('click', () => this.handleAddEvent());
    document.getElementById('cancel-event-btn')?.addEventListener('click', () => {
      document.getElementById('add-event-modal').classList.add('modal-hidden');
    });

    // Sync public/private checkboxes in add-event modal
    document.getElementById('event-is-public')?.addEventListener('change', (e) => {
      if (e.target.checked) document.getElementById('event-is-private').checked = false;
    });
    document.getElementById('event-is-private')?.addEventListener('change', (e) => {
      if (e.target.checked) document.getElementById('event-is-public').checked = false;
    });

    // Mint modal
    document.getElementById('confirm-mint-btn')?.addEventListener('click', () => this.handleMintTimeslot());
    document.getElementById('cancel-mint-btn')?.addEventListener('click', () => {
      document.getElementById('mint-modal').classList.add('modal-hidden');
    });

    // Booking modal
    document.getElementById('confirm-booking-btn')?.addEventListener('click', () => this.handleConfirmBooking());
    document.getElementById('cancel-booking-btn')?.addEventListener('click', () => {
      document.getElementById('booking-modal').classList.add('modal-hidden');
      this._pendingBooking = null;
    });

    // Meeting modal
    document.getElementById('close-meeting-btn')?.addEventListener('click', () => {
      document.getElementById('meeting-modal').classList.add('modal-hidden');
      if (this.meetingPeer) {
        this.meetingPeer.disconnect();
        this.meetingPeer = null;
      }
    });

    document.getElementById('join-meeting-btn')?.addEventListener('click', () => {
      if (this.meetingRoomId) {
        initMeetingRoom(this.meetingRoomId, false, document.getElementById('meeting-video'));
      }
    });
  }

  handleEventClick(info) {
    const selectedEvent = info.event.extendedProps;
    const classNames = info.event.classNames || selectedEvent.classNames || [];

    // If event has a meeting room ID, open meeting modal
    if (selectedEvent.meetingRoomID) {
      this.meetingRoomId = selectedEvent.meetingRoomID;
      const isHost = Boolean(this.walletAddress) &&
        Boolean(selectedEvent.creator) &&
        selectedEvent.creator.toLowerCase() === this.walletAddress.toLowerCase();
      document.getElementById('meeting-modal').classList.remove('modal-hidden');

      const joinBtn = document.getElementById('join-meeting-btn');
      const statusEl = document.getElementById('meeting-status');
      if (isHost) {
        statusEl.textContent = 'Waiting for participants...';
        joinBtn.classList.add('hidden');
        initMeetingRoom(this.meetingRoomId, true, document.getElementById('meeting-video'));
      } else {
        statusEl.textContent = 'Click Join to enter the meeting.';
        joinBtn.classList.remove('hidden');
      }
      return;
    }

    // Bookable public event
    if (selectedEvent.hourlyRate && classNames.includes('public-event')) {
      const start = new Date(info.event.start);
      const end = new Date(info.event.end);
      const duration = (end - start) / (1000 * 60 * 60);
      const totalCost = (selectedEvent.hourlyRate * duration).toFixed(4);

      this._pendingBooking = {
        creator: selectedEvent.creator,
        totalCost,
        eventId: info.event.id,
      };

      document.getElementById('booking-details').textContent =
        `Book "${info.event.title}" for ${totalCost} POL?`;
      document.getElementById('booking-modal').classList.remove('modal-hidden');
      return;
    }

    alert('This event is not available for booking.');
  }

  async handleAddEvent() {
    const title = document.getElementById('event-title').value.trim();
    const start = document.getElementById('event-start').value;
    const end = document.getElementById('event-end').value;
    const hourlyRate = parseFloat(document.getElementById('event-hourly-rate').value) || 0;
    const isPublic = document.getElementById('event-is-public').checked;

    if (!title || !start || !end) {
      alert('Please fill out all fields.');
      return;
    }

    const meetingRoomID = isPublic ? `meeting-${Date.now()}-${this.walletAddress}` : null;
    const eventClassName = isPublic ? 'public-event' : 'private-event';

    const newEvent = {
      id: `evt-${Date.now()}`,
      title,
      start,
      end,
      classNames: [eventClassName],
      hourlyRate: isPublic ? hourlyRate : 0,
      meetingRoomID,
      creator: this.walletAddress,
    };

    await saveEvent(this.walletAddress, newEvent);
    const myEvents = await fetchEventsForAddress(this.walletAddress);
    this.renderEvents(myEvents, this.otherEvents);

    document.getElementById('add-event-modal').classList.add('modal-hidden');
    document.getElementById('event-title').value = '';
    document.getElementById('event-start').value = '';
    document.getElementById('event-end').value = '';
    document.getElementById('event-hourly-rate').value = '';
    document.getElementById('event-is-public').checked = true;
    document.getElementById('event-is-private').checked = false;
  }

  async handleMintTimeslot() {
    const start = document.getElementById('mint-start').value;
    const end = document.getElementById('mint-end').value;
    const hourlyRate = parseFloat(document.getElementById('mint-hourly-rate').value) || 0;

    if (!start || !end) {
      alert('Please fill out all fields.');
      return;
    }

    if (!this.walletAddress) {
      alert('Connect your wallet first.');
      return;
    }

    try {
      const { mintTimeslot } = await import('../contract.js');
      await mintTimeslot(start, end, hourlyRate, this.walletAddress);
      alert('Timeslot NFT minted successfully!');
      document.getElementById('mint-modal').classList.add('modal-hidden');
    } catch (err) {
      console.error('Mint failed:', err);
      alert('Mint failed: ' + err.message);
    }
  }

  async handleFetchPublicEvents() {
    const address = document.getElementById('lookup-address').value.trim();
    if (!address) {
      alert('Please enter a wallet address.');
      return;
    }

    const color = this.generateColorForAddress(address);
    const events = await fetchEventsForAddress(address);

    this.otherEvents = events.map(event => ({
      ...event,
      classNames: event.classNames || ['imported-event'],
      backgroundColor: color,
      borderColor: color,
      hourlyRate: event.hourlyRate || 0,
    }));

    // Update the imported calendar toggle label
    const importedLabel = document.getElementById('imported-toggle-label');
    if (importedLabel) {
      importedLabel.innerHTML = `
        <input type="checkbox" id="other-events-toggle" ${this.otherEventsVisible ? 'checked' : ''} />
        Imported:
        <span class="calendar-shower-wallet-addr">${address.slice(0, 6)}</span>
        ...
        <span class="calendar-shower-wallet-addr">${address.slice(-4)}</span>
      `;
      document.getElementById('other-events-toggle').addEventListener('change', async (e) => {
        this.otherEventsVisible = e.target.checked;
        const myEvents = await fetchEventsForAddress(this.walletAddress || '');
        this.renderEvents(myEvents, this.otherEvents);
      });
    }

    const myEvents = await fetchEventsForAddress(this.walletAddress || '');
    this.renderEvents(myEvents, this.otherEvents);
  }

  async handleConfirmBooking() {
    if (!this._pendingBooking) return;
    const { creator, totalCost } = this._pendingBooking;
    const paymentType = document.querySelector('input[name="payment"]:checked')?.value || 'pol';

    try {
      const { payForBooking } = await import('../payments.js');
      await payForBooking(creator, totalCost, paymentType, this.walletAddress);
      alert('Booking successful!');
      document.getElementById('booking-modal').classList.add('modal-hidden');
      this._pendingBooking = null;
    } catch (err) {
      console.error('Booking payment failed:', err);
      alert('Payment failed: ' + err.message);
    }
  }

  async uploadEventsToIPFS() {
    try {
      const events = await getAllMyEvents(this.walletAddress);
      const blob = new Blob([JSON.stringify(events)], { type: 'application/json' });
      const file = new File([blob], 'calendar-events.json');
      const cid = await window.w3upClient.uploadFile(file);
      console.log('Uploaded to IPFS:', cid.toString());

      const history = JSON.parse(localStorage.getItem('calendarIPFSHistory') || '[]');
      history.unshift({ cid: cid.toString(), timestamp: new Date().toISOString() });
      localStorage.setItem('calendarIPFSHistory', JSON.stringify(history.slice(0, 50)));

      alert(`Events uploaded to IPFS!\nCID: ${cid.toString()}`);
    } catch (err) {
      console.error('IPFS upload failed:', err);
      alert('Upload failed: ' + err.message);
    }
  }

  generateColorForAddress(address) {
    const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }
}

customElements.define('decent-calendar', DecentCalendar);
