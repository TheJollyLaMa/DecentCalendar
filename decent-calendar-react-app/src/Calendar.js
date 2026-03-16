import React, { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import "./Calendar.css";
import { fetchPublicEventsForAddress, addOfficeHours } from "./MockPublicEvents";
import MeetingRoom from "./MeetingRoom"; // Import the MeetingRoom component
import MetamaskLogo from "./assets/Metamask_Logo.png";
import OmmmTokenLogo from "./assets/Ommm_Token_Logo.png";
import DecentSmartHomeLogo from "./assets/DecentSmartHome_Logo.png";


const Calendar = ({ walletAddress }) => {
  const [myEvents, setMyEvents] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    start: "",
    end: "",
    isPublic: true,
  });
  
  const [inputAddress, setInputAddress] = useState("");
  const [otherEvents, setOtherEvents] = useState([]);
  
  const [meetingRoomID, setMeetingRoomID] = useState(null); // For the meeting room ID
  const [isHost, setIsHost] = useState(false); // To track if the user is the host

  const [myEventsVisible, setMyEventsVisible] = useState(true);
  const [otherEventsVisible, setOtherEventsVisible] = useState(true);
  
  // Load events from localStorage on component mount if wallet is connected
  useEffect(() => {
    if (walletAddress) {
      const loadMyEvents = async () => {
        const storedEvents = await fetchPublicEventsForAddress(walletAddress);
        setMyEvents(storedEvents); // Initialize myEvents with stored events
      };
      loadMyEvents();
    } else {
      setMyEvents([]); // Clear events if wallet is disconnected
    }
  }, [walletAddress]);

  const handleEventClick = (info) => {
    const selectedEvent = info.event.extendedProps;
  
    console.log("Clicked event:", selectedEvent); // Debugging log
  
    // Safeguard: Ensure classNames exists and is an array
    const classNames = info.event.classNames || selectedEvent.classNames || []; // Check both sources
    console.log("ClassNames from click:", classNames); // Debugging log
  
    if (selectedEvent.hourlyRate && classNames.includes("public-event")) {
      const duration = (new Date(info.event.end) - new Date(info.event.start)) / (1000 * 60 * 60); // Calculate duration in hours
      const totalCost = selectedEvent.hourlyRate * duration;
  
      const confirmBooking = async () => {
        if (window.ethereum) {
          try {
            const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            const sender = accounts[0];
            const transaction = {
              to: selectedEvent.creator, // Address of the event creator
              value: window.ethereum.utils.toWei(totalCost.toString(), "ether"), // Convert ETH to Wei
            };
  
            await window.ethereum.request({
              method: "eth_sendTransaction",
              params: [transaction],
            });
  
            saveBooking(info.event.id, sender);
  
            alert("Booking successful!");
          } catch (error) {
            console.error("Transaction failed:", error);
            alert("Transaction failed. Please try again.");
          }
        } else {
          alert("MetaMask is not available.");
        }
      };
  
      if (window.confirm(`Book this timeslot for ${totalCost} ETH?`)) {
        confirmBooking();
      }
    } else {
      console.log("Event is not available for booking:", {
        hourlyRate: selectedEvent.hourlyRate,
        classNames,
      }); // Debugging log
      alert("This event is not available for booking.");
    }
  };

  const handleAddEventClick = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setNewEvent({ title: "", start: "", end: "", isPublic: true });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewEvent((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.start || !newEvent.end) {
      alert("Please fill out all fields.");
      return;
    }
  
    const eventClassName = newEvent.isPublic ? "public-event" : "private-event";
    const meetingRoomID = `meeting-${Date.now()}-${walletAddress}`; // Unique meeting room ID
  
    const newEventObj = {
      title: newEvent.title,
      start: newEvent.start,
      end: newEvent.end,
      classNames: [eventClassName], // Ensure classNames is set
      hourlyRate: newEvent.isPublic ? parseFloat(newEvent.hourlyRate) || 0 : 0,
      meetingRoomID: newEvent.isPublic ? meetingRoomID : null, // Only public events have meeting rooms
      creator: walletAddress, // Save the creator's wallet address
    };
  
    setMyEvents((prevEvents) => [...prevEvents, newEventObj]);
  
    if (newEvent.isPublic) {
      await addOfficeHours(walletAddress, newEventObj); // Save to mock public events
    }
  
    handleCloseModal();
  };

  const handleFetchPublicEvents = async () => {
    if (!inputAddress) {
      alert("Please enter a wallet or calendar address.");
      return;
    }
  
    const color = generateColorForAddress(inputAddress); // Generate unique color
    const events = await fetchPublicEventsForAddress(inputAddress);
  
    const eventsWithClassNames = events.map((event) => ({
      ...event,
      classNames: event.classNames || ["imported-event"],
      backgroundColor: color, // Assign unique color
      borderColor: color, // Assign unique border color
      hourlyRate: event.hourlyRate || 0, // Default hourly rate to 0 if not set
    }));
  
    console.log("Fetched public events:", eventsWithClassNames); // Debugging log
    setOtherEvents(eventsWithClassNames);
  };
  
  const saveBooking = (eventId, buyerAddress) => {
    const updatedEvents = [...myEvents];
    const eventIndex = updatedEvents.findIndex((event) => event.id === eventId);
  
    if (eventIndex !== -1) {
      updatedEvents[eventIndex].buyer = buyerAddress; // Add buyer to event
      setMyEvents(updatedEvents); // Update state
      localStorage.setItem(walletAddress, JSON.stringify(updatedEvents)); // Save to localStorage
    }
  };

  const generateColorForAddress = (address) => {
    const hash = address.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360; // Generate a hue based on the address
    return `hsl(${hue}, 70%, 50%)`; // HSL color format
  };

  return (
    <div className="calendar-container">
      {walletAddress ? (
        <>
          {/* Input for Other Calendar */}
          <div className="address-input">
            <input
              type="text"
              placeholder="Enter wallet or calendar address"
              value={inputAddress}
              onChange={(e) => setInputAddress(e.target.value)}
            />
            <button onClick={handleFetchPublicEvents}>Fetch Public Events</button>
          </div>

          {/* "+" Button */}
          <button className="add-event-button" onClick={handleAddEventClick}>
            +
          </button>
          
          {/* Calendar Toggle */}
          <div className="calendar-toggle">
              <label style={{ color: "#00FF00" }}> {/* Legend color for your calendar */}
                <input
                  type="checkbox"
                  checked={myEventsVisible}
                  onChange={(e) => setMyEventsVisible(e.target.checked)}
                />
                Your Calendar: 
                <span className="calendar-shower-wallet-addr">
                  {walletAddress.slice(0, 6)}
                </span>
                <div className="wallet-icons">
                  <img src={DecentSmartHomeLogo} alt="Icon 1" className="icon-small" />
                  <img src={OmmmTokenLogo} alt="Icon 2" className="icon-small" />
                  <img src={OmmmTokenLogo} alt="Icon 3" className="icon-small" />
                  <img src={DecentSmartHomeLogo} alt="Icon 4" className="icon-small" />
                </div>
                <span className="calendar-shower-wallet-addr">
                  {walletAddress.slice(-4)}
                </span>
              </label>
              <br />
              <label style={{ color: "#FF6347" }}> {/* Legend color for imported calendars */}
                <input
                  type="checkbox"
                  checked={otherEventsVisible}
                  onChange={(e) => setOtherEventsVisible(e.target.checked)}
                />
                Imported Calendar: 
                <span className="calendar-shower-wallet-addr">
                  {inputAddress.slice(0, 6)}
                </span>
                <div className="wallet-icons">
                  <img src={MetamaskLogo} alt="Icon 1" className="icon-small" />
                  <img src={DecentSmartHomeLogo} alt="Icon 2" className="icon-small" />
                  <img src={OmmmTokenLogo} alt="Icon 3" className="icon-small" />
                  <img src={MetamaskLogo} alt="Icon 4" className="icon-small" />
                </div>
                <span className="calendar-shower-wallet-addr">
                  {inputAddress.slice(-4)}
                </span>
              </label>
            </div>


          {/* FullCalendar Component */}
          <div className="calendar-wrapper">

          <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              events={[
                ...(myEventsVisible ? myEvents : []),
                ...(otherEventsVisible ? otherEvents : []),
              ]}
              eventClick={handleEventClick}
              slotDuration="00:15:00" // Quarter-hour slots
              eventClassNames={(event) => {
                const classNames = event?.classNames || event?.extendedProps?.classNames || [];
                console.log("Applying classNames for event:", classNames);
                return classNames;
              }}
              eventDataTransform={(event) => {
                const transformedEvent = {
                  ...event,
                  title: `${event.title} (${event.hourlyRate || 0} ETH/hr)`,
                  backgroundColor: event.backgroundColor || undefined,
                  borderColor: event.borderColor || undefined,
                  classNames: event.classNames || ["public-event"],
                };
                console.log("Transformed Event:", transformedEvent);
                return transformedEvent;
              }}
            />

          </div>


        {/* Meeting Room Modal */}
        {meetingRoomID && (
          <div className="meeting-modal">
            <h3>Meeting Room</h3>
            <MeetingRoom roomId={meetingRoomID} isHost={isHost} />
            <button onClick={() => setMeetingRoomID(null)}>Close</button>
          </div>
        )}

          {/* Modal */}
          {isModalOpen && (
            <div className="modal">
              <div className="modal-content">
                <h3>Add New Event</h3>
                <label>
                  Event Title:
                  <input
                    type="text"
                    name="title"
                    value={newEvent.title}
                    onChange={handleInputChange}
                  />
                </label>
                <label>
                  Start Time:
                  <input
                    type="datetime-local"
                    name="start"
                    value={newEvent.start}
                    onChange={handleInputChange}
                  />
                </label>
                <label>
                  End Time:
                  <input
                    type="datetime-local"
                    name="end"
                    value={newEvent.end}
                    onChange={handleInputChange}
                  />
                </label>
                <label>
                  Hourly Rate (POL):
                  <input
                    type="number"
                    name="hourlyRate"
                    value={newEvent.hourlyRate || ""}
                    onChange={handleInputChange}
                    step="0.01"
                  />
                </label>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      name="isPublic"
                      checked={newEvent.isPublic}
                      onChange={handleInputChange}
                    />
                    Public Event
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="isPrivate"
                      checked={!newEvent.isPublic}
                      onChange={() =>
                        setNewEvent((prev) => ({
                          ...prev,
                          isPublic: !prev.isPublic,
                        }))
                      }
                    />
                    Private Event
                  </label>
                </div>
                <button onClick={handleAddEvent}>Add Event</button>
                <button onClick={handleCloseModal}>Cancel</button>
                
              </div>
            </div>
          )}
        </>
      ) : (
        <h3 className="neon-text">Connect your wallet to view or add events</h3>
      )}

    </div>



  );
};

export default Calendar;