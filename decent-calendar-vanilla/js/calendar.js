/* calendar.js — FullCalendar v6 initialization and event management */

let calendarInstance = null;
let myEvents = [];
let otherEvents = [];
let myEventsVisible = true;
let otherEventsVisible = true;
let currentLookupAddress = '';

/**
 * Initialize FullCalendar on the #calendar element.
 */
function initCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;

  calendarInstance = new FullCalendar.Calendar(calendarEl, {
    plugins: [], // FullCalendar global build includes all plugins
    initialView: 'timeGridWeek',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    },
    slotDuration: '00:15:00',
    events: getVisibleEvents(),
    eventClick: handleEventClick,
    eventContent: info => window.renderSlotContent
      ? window.renderSlotContent(info)
      : { text: `${info.timeText} ${info.event.title}` },
    eventClassNames: (info) => info.event.classNames || [],
    eventDataTransform: (eventData) => ({
      ...eventData,
      originalTitle: eventData.title,
      title: `${eventData.title} (${eventData.rateAmount ?? eventData.hourlyRate ?? 0} ${eventData.currency || 'POL'}/hr)`,
      backgroundColor: eventData.backgroundColor || undefined,
      borderColor: eventData.borderColor || undefined,
      classNames: eventData.classNames || ['public-event'],
    }),
    height: 'auto',
  });

  calendarInstance.render();
}

/**
 * Return the combined list of events currently visible.
 */
function getVisibleEvents() {
  const visible = [];
  if (myEventsVisible) visible.push(...myEvents);
  if (otherEventsVisible) visible.push(...otherEvents);
  return visible;
}

/**
 * Reload events from localStorage for the connected wallet and refresh.
 */
function loadAndRenderMyEvents() {
  if (!window._walletAddress) return;
  myEvents = loadMyEvents(window._walletAddress);
  refreshCalendarToggle();
  refreshCalendar();
}

/**
 * Add a single event object to the calendar.
 */
function addEventToCalendar(eventObj) {
  myEvents.push(eventObj);
  refreshCalendar();
}

/**
 * Refresh (re-render) the calendar with current event arrays.
 */
function refreshCalendar() {
  if (calendarInstance) {
    calendarInstance.removeAllEventSources();
    calendarInstance.addEventSource(getVisibleEvents());
  }
}

/**
 * Remove all events from display (called on wallet disconnect).
 */
function clearCalendarEvents() {
  myEvents = [];
  otherEvents = [];
  currentLookupAddress = '';
  refreshCalendarToggle();
  refreshCalendar();
}

/**
 * Setter: update the imported/other events array.
 * Called from Calendar.js (ES module) to update this global variable.
 */
function setOtherEvents(events) {
  otherEvents = events;
}

/**
 * Setter: update the current lookup address.
 * Called from Calendar.js (ES module) to update this global variable.
 */
function setCurrentLookupAddress(address) {
  currentLookupAddress = address;
}

/**
 * Handle a click on a calendar event.
 * - If it's a public event with an hourly rate and the viewer is NOT the owner → booking flow
 * - If the viewer IS the owner → confirmation/meeting room flow
 * - Otherwise → info alert
 */
function handleEventClick(info) {
  const fcEvent = info.event;
  const props = fcEvent.extendedProps;
  const classNames = fcEvent.classNames || props.classNames || [];

  if (window.openSlotDetails) {
    void window.openSlotDetails({
      ...props, title: props.originalTitle || fcEvent.title,
      start: fcEvent.start?.toISOString(), end: fcEvent.end?.toISOString(),
    }).catch(error => {
      console.error('[DCal slot]', error);
      alert(`Could not open slot: ${error.message}`);
    });
    return;
  }
  if (props.readOnly) {
    alert(`Read-only public availability: ${fcEvent.title}\nThis is not a verified booking or meeting invitation.`);
    return;
  }
  console.log('Clicked event:', fcEvent.title, props);

  const isOwner =
    window._walletAddress &&
    props.creator &&
    window._walletAddress.toLowerCase() === props.creator.toLowerCase();

  // Owner clicking their own booked event → confirm/meeting room
  if (isOwner && props.status === 'pending') {
    openConfirmModal(fcEvent);
    return;
  }

  // Owner clicking available event → open meeting room
  if (isOwner && props.meetingRoomId) {
    openMeetingModal(props.meetingRoomId, true);
    return;
  }

  // Buyer clicking a public event → booking flow
  if (classNames.includes('public-event') && props.hourlyRate > 0) {
    const duration =
      fcEvent.end && fcEvent.start
        ? (fcEvent.end - fcEvent.start) / (1000 * 60 * 60)
        : 1;
    const totalCost = props.hourlyRate * duration;
    openBookingModal(fcEvent, totalCost);
    return;
  }

  // Buyer with access to a meeting room
  if (props.meetingRoomId && props.status === 'booked') {
    openMeetingModal(props.meetingRoomId, false);
    return;
  }

  alert(
    `Event: ${fcEvent.title.split(' (')[0]}\n` +
      (props.description ? `Description: ${props.description}\n` : '') +
      (props.isPublic === false ? 'This is a private event.' : '')
  );
}

/**
 * Open the booking modal for a public event.
 */
function openBookingModal(fcEvent, totalCost) {
  if (!CALENDAR_PAID_ACTIONS_ENABLED) {
    alert(CALENDAR_RELEASE_MESSAGE);
    return;
  }
  const props = fcEvent.extendedProps;
  const title = fcEvent.title.split(' (')[0];
  const start = fcEvent.start ? fcEvent.start.toLocaleString() : '';
  const end = fcEvent.end ? fcEvent.end.toLocaleString() : '';

  document.getElementById('booking-details').innerHTML = `
    <p><strong>Title:</strong> ${title}</p>
    <p><strong>Start:</strong> ${start}</p>
    <p><strong>End:</strong> ${end}</p>
    <p><strong>Rate:</strong> ${props.hourlyRate} POL/hr</p>
    <p><strong>Total:</strong> <span style="color:#0ff;">${totalCost.toFixed(4)} POL</span></p>
    ${props.creator ? `<p><strong>Host:</strong> ${props.creator.slice(0, 6)}...${props.creator.slice(-4)}</p>` : ''}
  `;

  // Store for payment handlers
  setPendingBookingEvent({ ...props, start: fcEvent.start, end: fcEvent.end, title });
  document.getElementById('booking-modal').classList.remove('hidden');

  // Wire payment buttons with current event data
  document.getElementById('pay-crypto-btn').onclick = () =>
    payWithCrypto(props.tokenId, totalCost);
  document.getElementById('pay-paypal-btn').onclick = () =>
    payWithPayPal({ ...props, title });
  document.getElementById('pay-card-btn').onclick = () =>
    payWithCard({ ...props, title });
}

/**
 * Close the booking modal.
 */
function closeBookingModal() {
  document.getElementById('booking-modal').classList.add('hidden');
}

/**
 * Open the confirm-appointment modal (owner confirming a pending booking).
 */
function openConfirmModal(fcEvent) {
  if (!CALENDAR_PAID_ACTIONS_ENABLED) {
    alert(CALENDAR_RELEASE_MESSAGE);
    return;
  }
  const props = fcEvent.extendedProps;
  const title = fcEvent.title.split(' (')[0];
  document.getElementById('confirm-details').innerHTML = `
    <p><strong>Title:</strong> ${title}</p>
    <p><strong>Status:</strong> ${props.status || 'pending'}</p>
    ${props.buyer ? `<p><strong>Buyer:</strong> ${props.buyer}</p>` : ''}
    ${props.tokenId !== null && props.tokenId !== undefined ? `<p><strong>Token ID:</strong> ${props.tokenId}</p>` : ''}
  `;

  document.getElementById('confirm-appointment-btn').onclick = async () => {
    if (props.tokenId !== null && props.tokenId !== undefined) {
      try {
        await confirmAppointment(props.tokenId);
        alert('Appointment confirmed! Funds released to your wallet.');
      } catch (err) {
        alert('Confirmation failed: ' + (err.reason || err.message));
        return;
      }
    }
    document.getElementById('confirm-modal').classList.add('hidden');
    loadAndRenderMyEvents();
  };

  document.getElementById('cancel-appointment-btn').onclick = async () => {
    if (props.tokenId !== null && props.tokenId !== undefined) {
      try {
        await cancelBooking(props.tokenId);
        alert('Booking cancelled. Buyer has been refunded.');
      } catch (err) {
        alert('Cancellation failed: ' + (err.reason || err.message));
        return;
      }
    }
    document.getElementById('confirm-modal').classList.add('hidden');
    loadAndRenderMyEvents();
  };

  document.getElementById('confirm-modal').classList.remove('hidden');
}

/**
 * Open the meeting room modal.
 */
function openMeetingModal(roomId, isHost) {
  if (!CALENDAR_MEETINGS_ENABLED) {
    alert(CALENDAR_MEETING_MESSAGE);
    return;
  }
  document.getElementById('meeting-modal').classList.remove('hidden');
  initMeetingRoom(roomId, isHost);
}

/**
 * Render the calendar toggle checkboxes.
 */
function refreshCalendarToggle() {
  const toggle = document.getElementById('calendar-toggle');
  if (!toggle) return;

  const addr = window._walletAddress || '';
  const lookupAddr = currentLookupAddress || '';

  toggle.innerHTML = `
    <label style="color:#00FF00;">
      <input type="checkbox" id="my-events-toggle" ${myEventsVisible ? 'checked' : ''} />
      Your Calendar:
      <span class="calendar-shower-wallet-addr">${addr.slice(0, 6)}</span>
      <span class="calendar-shower-wallet-addr">${addr.slice(-4)}</span>
    </label>
    <label style="color:#FF6347;">
      <input type="checkbox" id="other-events-toggle" ${otherEventsVisible ? 'checked' : ''} />
      Imported Calendar:
      <span class="calendar-shower-wallet-addr">${lookupAddr.slice(0, 6)}</span>
      <span class="calendar-shower-wallet-addr">${lookupAddr.slice(-4)}</span>
    </label>
  `;

  document.getElementById('my-events-toggle').addEventListener('change', (e) => {
    myEventsVisible = e.target.checked;
    refreshCalendar();
  });

  document.getElementById('other-events-toggle').addEventListener('change', (e) => {
    otherEventsVisible = e.target.checked;
    refreshCalendar();
  });
}
