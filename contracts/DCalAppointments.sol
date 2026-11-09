// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.30;

/// @notice Free, wallet-restricted appointments. No fees, deposits, custody or attendance oracle.
contract DCalAppointments {
    string public constant VERSION = "dcal-appointments-1";
    uint256 public constant MAX_WINDOWS = 62;
    struct Window { uint64 start; uint64 end; uint32 day; }
    struct Offer {
        address host;
        address invitee;
        uint32 duration;
        bool closed;
        string subject;
        string timezone;
    }
    struct Appointment {
        uint256 offerId;
        uint256 windowIndex;
        uint64 start;
        uint64 end;
        bool cancelled;
    }
    uint256 public nextOfferId = 1;
    uint256 public nextAppointmentId = 1;
    mapping(uint256 => Offer) private offers;
    mapping(uint256 => Window[]) private windows;
    mapping(uint256 => Appointment) private appointments;
    mapping(uint256 => mapping(uint32 => uint256)) public dayBooking;
    mapping(bytes32 => uint256) public publishedTerms;
    mapping(address => uint256[]) private walletOffers;
    mapping(address => uint256[]) private walletAppointments;
    mapping(address => uint256) public firstAppointment;
    mapping(address => uint256) public lastAppointment;
    mapping(address => mapping(uint256 => uint256)) public next;
    mapping(address => mapping(uint256 => uint256)) public previous;

    event AvailabilityPublished(uint256 indexed id, address indexed host, address indexed invitee);
    event AvailabilityClosed(uint256 indexed id);
    event AppointmentBooked(uint256 indexed id, uint256 indexed offerId, uint64 start, uint64 end);
    event AppointmentCancelled(uint256 indexed id);

    function getOffer(uint256 id) external view returns (Offer memory, Window[] memory) {
        require(id > 0 && id < nextOfferId, "Unknown availability");
        return (offers[id], windows[id]);
    }
    function getAppointment(uint256 id) external view returns (Appointment memory) {
        require(id > 0 && id < nextAppointmentId, "Unknown appointment");
        return appointments[id];
    }
    function offerCount(address wallet) external view returns (uint256) { return walletOffers[wallet].length; }
    function offerAt(address wallet, uint256 index) external view returns (uint256) { return walletOffers[wallet][index]; }
    function appointmentCount(address wallet) external view returns (uint256) { return walletAppointments[wallet].length; }
    function appointmentAt(address wallet, uint256 index) external view returns (uint256) { return walletAppointments[wallet][index]; }

    function publish(address invitee, uint32 duration, string calldata subject, string calldata timezone, Window[] calldata choices)
        external returns (uint256 id)
    {
        require(invitee != address(0) && invitee != msg.sender, "Invalid invitee");
        require(duration == 900 || duration == 1800 || duration == 3600, "Invalid duration");
        require(bytes(subject).length > 0 && bytes(subject).length <= 200, "Invalid subject");
        require(bytes(timezone).length > 0 && bytes(timezone).length <= 64, "Invalid timezone");
        require(choices.length > 0 && choices.length <= MAX_WINDOWS, "Invalid windows");
        bytes32 key = keccak256(abi.encode(msg.sender, invitee, duration, subject, timezone, choices));
        require(publishedTerms[key] == 0, "Availability already published");
        id = nextOfferId++;
        publishedTerms[key] = id;
        for (uint256 i = 0; i < choices.length; i++) {
            Window calldata choice = choices[i];
            require(choice.day > 0 && choice.end > choice.start && choice.end > block.timestamp, "Invalid interval");
            require(choice.end - choice.start >= duration && choice.end - choice.start <= 1 days, "Invalid window length");
            if (i > 0) require(choices[i - 1].end <= choice.start && choices[i - 1].day <= choice.day, "Unsorted windows");
            windows[id].push(choice);
        }
        offers[id] = Offer(msg.sender, invitee, duration, false, subject, timezone);
        walletOffers[msg.sender].push(id);
        walletOffers[invitee].push(id);
        emit AvailabilityPublished(id, msg.sender, invitee);
    }

    function close(uint256 id) external {
        require(offers[id].host == msg.sender && !offers[id].closed, "Not open host");
        offers[id].closed = true;
        emit AvailabilityClosed(id);
    }

    /// @dev Adapted from DCalBooking's collision-checked linked list, for both participants.
    function findPrev(address wallet, uint64 start, uint64 end) public view returns (uint256 prev) {
        require(end > start, "Invalid interval");
        prev = lastAppointment[wallet];
        while (prev != 0 && appointments[prev].start >= end) prev = previous[wallet][prev];
        require(prev == 0 || appointments[prev].end <= start, "Appointment collision");
    }

    function book(uint256 offerId, uint256 windowIndex, uint64 start, uint256 hostPrev, uint256 inviteePrev)
        external returns (uint256 id)
    {
        Offer storage offer = offers[offerId];
        require(msg.sender == offer.invitee && !offer.closed, "Not invited or closed");
        require(windowIndex < windows[offerId].length, "Unknown window");
        Window storage choice = windows[offerId][windowIndex];
        require(start > block.timestamp && start >= choice.start, "Start unavailable");
        uint64 end = start + offer.duration;
        require(end <= choice.end && (start - choice.start) % offer.duration == 0, "Outside slot grid");
        require(dayBooking[offerId][choice.day] == 0, "Already booked this day");
        id = nextAppointmentId++;
        link(offer.host, id, hostPrev, start, end);
        link(offer.invitee, id, inviteePrev, start, end);
        appointments[id] = Appointment(offerId, windowIndex, start, end, false);
        dayBooking[offerId][choice.day] = id;
        walletAppointments[offer.host].push(id);
        walletAppointments[offer.invitee].push(id);
        emit AppointmentBooked(id, offerId, start, end);
    }

    function cancel(uint256 id) external {
        Appointment storage item = appointments[id];
        Offer storage offer = offers[item.offerId];
        require(msg.sender == offer.host || msg.sender == offer.invitee, "Not participant");
        require(!item.cancelled && item.start > block.timestamp, "Not cancellable");
        item.cancelled = true;
        delete dayBooking[item.offerId][windows[item.offerId][item.windowIndex].day];
        unlink(offer.host, id);
        unlink(offer.invitee, id);
        emit AppointmentCancelled(id);
    }

    function link(address wallet, uint256 id, uint256 prev, uint64 start, uint64 end) private {
        uint256 afterId;
        if (prev == 0) afterId = firstAppointment[wallet];
        else {
            Appointment storage beforeItem = appointments[prev];
            Offer storage beforeOffer = offers[beforeItem.offerId];
            require((beforeOffer.host == wallet || beforeOffer.invitee == wallet) &&
                !beforeItem.cancelled && beforeItem.end <= start, "Appointment collision");
            afterId = next[wallet][prev];
        }
        require(afterId == 0 || appointments[afterId].start >= end, "Appointment collision");
        previous[wallet][id] = prev;
        next[wallet][id] = afterId;
        if (prev == 0) firstAppointment[wallet] = id; else next[wallet][prev] = id;
        if (afterId == 0) lastAppointment[wallet] = id; else previous[wallet][afterId] = id;
    }
    function unlink(address wallet, uint256 id) private {
        uint256 prev = previous[wallet][id];
        uint256 afterId = next[wallet][id];
        if (prev == 0) firstAppointment[wallet] = afterId; else next[wallet][prev] = afterId;
        if (afterId == 0) lastAppointment[wallet] = prev; else previous[wallet][afterId] = prev;
        delete previous[wallet][id];
        delete next[wallet][id];
    }
}
