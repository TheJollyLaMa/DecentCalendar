// Fetch public events for a given wallet address
export const fetchPublicEventsForAddress = (address) => {
  return new Promise((resolve) => {
    const normalizedAddress = address.toLowerCase(); // Normalize to lowercase
    const events = JSON.parse(localStorage.getItem(normalizedAddress)) || [];

    // Ensure classNames is properly included in fetched events
    const updatedEvents = events.map((event) => ({
      ...event,
      classNames: event.classNames || ["public-event"], // Default to "public-event"
    }));

    console.log(`Fetched events for ${normalizedAddress}:`, updatedEvents); // Debugging log
    resolve(updatedEvents);
  });
};
  
  // Add a public event for a given wallet address
  export const addOfficeHours = (address, event) => {
    return new Promise((resolve) => {
      const normalizedAddress = address.toLowerCase(); // Normalize to lowercase
      const events = JSON.parse(localStorage.getItem(normalizedAddress)) || [];
  
      // Ensure classNames is properly set
      const updatedEvent = {
        ...event,
        classNames: event.classNames || ["public-event"], // Default to "public-event" if not set
      };
  
      events.push(updatedEvent);
      localStorage.setItem(normalizedAddress, JSON.stringify(events));
      console.log(`Updated events for ${normalizedAddress}:`, events); // Debugging log
      resolve();
    });
  };