// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Minimal interface for calling TimeslotNFT from the market contract.
 */
interface ITimeslotNFT {
    struct Timeslot {
        address creator;
        string ipfsCID;
        uint256 startTime;
        uint256 endTime;
        uint256 hourlyRate;
        string status;
    }

    function timeslots(uint256 tokenId) external view returns (Timeslot memory);
    function setStatus(uint256 tokenId, string memory status) external;
}

/**
 * @title TimeslotMarket
 * @notice Escrow-based booking contract for DecentCalendar timeslots.
 *
 * Flow:
 *   1. Buyer calls bookTimeslot(tokenId) with payment → funds held in escrow,
 *      timeslot status set to "pending".
 *   2. Creator calls confirmAppointment(tokenId) after the meeting →
 *      funds released to creator, status set to "confirmed".
 *   3. Either party calls cancelBooking(tokenId) →
 *      funds refunded to buyer, status reset to "available".
 */
contract TimeslotMarket {
    ITimeslotNFT public nftContract;

    struct Booking {
        address buyer;
        uint256 amount;    // Escrowed amount in wei
        bool confirmed;
        bool cancelled;
    }

    mapping(uint256 => Booking) public bookings;

    event TimeslotBooked(uint256 indexed tokenId, address indexed buyer, uint256 amount);
    event AppointmentConfirmed(uint256 indexed tokenId, address indexed creator, uint256 amount);
    event BookingCancelled(uint256 indexed tokenId, address indexed buyer, uint256 amount);

    constructor(address _nftContract) {
        require(_nftContract != address(0), "Invalid NFT contract address");
        nftContract = ITimeslotNFT(_nftContract);
    }

    /**
     * @notice Book a timeslot. Caller must send the payment as msg.value.
     *         The payment is held in escrow until the appointment is confirmed or cancelled.
     * @param tokenId The token ID of the timeslot to book
     */
    function bookTimeslot(uint256 tokenId) external payable {
        ITimeslotNFT.Timeslot memory slot = nftContract.timeslots(tokenId);
        require(
            keccak256(bytes(slot.status)) == keccak256(bytes("available")),
            "Timeslot not available"
        );
        require(msg.value > 0, "Must send payment");
        require(bookings[tokenId].buyer == address(0), "Already booked");

        bookings[tokenId] = Booking({
            buyer: msg.sender,
            amount: msg.value,
            confirmed: false,
            cancelled: false
        });

        nftContract.setStatus(tokenId, "pending");
        emit TimeslotBooked(tokenId, msg.sender, msg.value);
    }

    /**
     * @notice Creator confirms the appointment after it takes place.
     *         Releases escrowed funds to the creator.
     * @param tokenId The token ID of the booked timeslot
     */
    function confirmAppointment(uint256 tokenId) external {
        ITimeslotNFT.Timeslot memory slot = nftContract.timeslots(tokenId);
        require(msg.sender == slot.creator, "Only creator can confirm");

        Booking storage booking = bookings[tokenId];
        require(booking.buyer != address(0), "No booking exists");
        require(!booking.confirmed && !booking.cancelled, "Already resolved");

        booking.confirmed = true;
        nftContract.setStatus(tokenId, "confirmed");

        uint256 payout = booking.amount;
        booking.amount = 0;

        (bool sent, ) = payable(slot.creator).call{value: payout}("");
        require(sent, "Payment transfer failed");

        emit AppointmentConfirmed(tokenId, slot.creator, payout);
    }

    /**
     * @notice Cancel a booking and refund the buyer.
     *         Can be called by either the creator or the buyer.
     * @param tokenId The token ID of the booked timeslot
     */
    function cancelBooking(uint256 tokenId) external {
        ITimeslotNFT.Timeslot memory slot = nftContract.timeslots(tokenId);
        Booking storage booking = bookings[tokenId];

        require(booking.buyer != address(0), "No booking exists");
        require(
            msg.sender == slot.creator || msg.sender == booking.buyer,
            "Not authorized"
        );
        require(!booking.confirmed && !booking.cancelled, "Already resolved");

        booking.cancelled = true;
        nftContract.setStatus(tokenId, "available");

        uint256 refund = booking.amount;
        booking.amount = 0;

        (bool sent, ) = payable(booking.buyer).call{value: refund}("");
        require(sent, "Refund failed");

        emit BookingCancelled(tokenId, booking.buyer, refund);
    }

    /**
     * @notice View booking details for a timeslot.
     */
    function getBooking(uint256 tokenId) external view returns (Booking memory) {
        return bookings[tokenId];
    }
}
