// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.30;

interface IDCalToken {
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Nontransferable group timeboxes. A host's timeboxes never overlap, and time elapsing never releases funds.
/// @dev The owner may only allow or delist ERC-20 assets for new timeboxes and seats; it has no power over escrow.
contract DCalBooking {
    enum Pricing { PerHead, Split }
    enum SlotState { Open, Cancelled }
    enum SeatState { None, Funded, Released, Refunded }

    struct Offer {
        address asset;
        Pricing pricing;
        uint256 price;
        uint64 start;
        uint64 end;
        uint16 minAttendees;
        uint16 maxAttendees;
        bool hardline;
        string subject;
        string timezone;
    }
    struct Slot {
        address host;
        address asset;
        Pricing pricing;
        uint256 price;
        uint64 start;
        uint64 end;
        uint16 minAttendees;
        uint16 maxAttendees;
        /// @dev Seats counted for split pricing; frozen from start, so later host refunds forgo that share.
        uint16 attendees;
        bool hardline;
        SlotState state;
        string subject;
        string hostTimezone;
    }
    struct Seat {
        SeatState state;
        uint256 deposit;
        string timezone;
    }

    uint256 public constant FEE_BPS = 300;
    uint256 public constant REFUND_DELAY = 7 days;
    uint16 public constant MAX_ATTENDEES = 50;
    uint256 public constant MAX_ROSTER = 100;
    string public constant VERSION = "dcal-timebox-1";
    address public immutable feeRecipient;
    address public owner;
    address public pendingOwner;
    uint256 public nextId = 1;
    mapping(address => bool) public allowedToken;
    mapping(uint256 => Slot) private slots;
    mapping(uint256 => mapping(address => Seat)) private seats;
    mapping(uint256 => address[]) private rosters;
    mapping(address => uint256) public firstSlot;
    mapping(address => uint256) public lastSlot;
    mapping(uint256 => uint256) public nextSlot;
    mapping(uint256 => uint256) public prevSlot;
    mapping(address => mapping(address => uint256)) public credits;
    bool private entered;

    event SlotCreated(uint256 indexed id, address indexed host, uint64 start, uint64 end);
    event SlotCancelled(uint256 indexed id);
    event SeatJoined(uint256 indexed id, address indexed attendee, uint256 deposit);
    event SeatResolved(uint256 indexed id, address indexed attendee, SeatState state, uint256 charge, uint256 fee);
    event CreditWithdrawn(address indexed owner, address indexed asset, address indexed destination, uint256 amount);
    event TokenAllowed(address indexed token, bool allowed);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier guarded() {
        require(!entered, "Reentrant call");
        entered = true;
        _;
        entered = false;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address recipient, address initialOwner, address[] memory tokens) {
        require(recipient != address(0) && initialOwner != address(0), "Invalid deployment");
        feeRecipient = recipient;
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
        for (uint256 i = 0; i < tokens.length; i++) setTokenInternal(tokens[i], true);
    }

    // ---- token allowlist administration ----

    function setToken(address token, bool allowed) external onlyOwner {
        setTokenInternal(token, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner && msg.sender != address(0), "Not pending owner");
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
        pendingOwner = address(0);
    }

    // ---- views ----

    function getSlot(uint256 id) public view returns (Slot memory) {
        require(id > 0 && id < nextId, "Unknown slot");
        return slots[id];
    }

    function getSeat(uint256 id, address attendee) external view returns (Seat memory) {
        require(id > 0 && id < nextId, "Unknown slot");
        return seats[id][attendee];
    }

    function rosterOf(uint256 id) external view returns (address[] memory) {
        require(id > 0 && id < nextId, "Unknown slot");
        return rosters[id];
    }

    function depositFor(uint256 id) public view returns (uint256) {
        Slot storage slot = slots[id];
        return slot.pricing == Pricing.PerHead ? slot.price : ceilDiv(slot.price, slot.minAttendees);
    }

    /// @notice Final per-seat charge once the attendee count is frozen at start.
    function chargeFor(uint256 id) public view returns (uint256) {
        Slot storage slot = slots[id];
        if (slot.pricing == Pricing.PerHead) return slot.price;
        return slot.attendees == 0 ? depositFor(id) : ceilDiv(slot.price, slot.attendees);
    }

    /// @notice Insertion hint for a new host timebox; reverts if [start, end) collides with an open timebox.
    /// @dev Walks back from the host's latest timebox, so cost grows only with timeboxes after `start`.
    function findPrev(address host, uint64 start, uint64 end) public view returns (uint256 prev) {
        prev = lastSlot[host];
        while (prev != 0 && slots[prev].start >= end) prev = prevSlot[prev];
        require(prev == 0 || slots[prev].end <= start, "Time collision");
    }

    // ---- host actions ----

    function createSlot(Offer calldata offer, uint256 prevHint) external returns (uint256 id) {
        require(offer.asset == address(0) || allowedToken[offer.asset], "Unsupported asset");
        require(offer.start > block.timestamp && offer.end > offer.start, "Invalid interval");
        require(offer.minAttendees >= 1 && offer.minAttendees <= offer.maxAttendees && offer.maxAttendees <= MAX_ATTENDEES, "Invalid attendees");
        require(bytes(offer.subject).length > 0 && bytes(offer.subject).length <= 200, "Invalid subject");
        require(validTimezone(offer.timezone), "Invalid timezone");
        id = nextId++;
        link(msg.sender, id, prevHint, offer.start, offer.end);
        slots[id] = Slot(msg.sender, offer.asset, offer.pricing, offer.price, offer.start, offer.end,
            offer.minAttendees, offer.maxAttendees, 0, offer.hardline, SlotState.Open, offer.subject, offer.timezone);
        emit SlotCreated(id, msg.sender, offer.start, offer.end);
    }

    /// @notice Host cancels the timebox, frees its time and credits every funded seat in full.
    function cancel(uint256 id) external {
        Slot storage slot = slots[id];
        require(slot.host == msg.sender && slot.state == SlotState.Open, "Not open host");
        slot.state = SlotState.Cancelled;
        unlink(slot.host, id);
        address[] storage roster = rosters[id];
        for (uint256 i = 0; i < roster.length; i++) {
            Seat storage seat = seats[id][roster[i]];
            if (seat.state == SeatState.Funded) refundSeat(id, slot, roster[i], seat);
        }
        emit SlotCancelled(id);
    }

    // ---- attendee actions ----

    /// @dev The attendee supplies the asset and exact deposit, so a misread timebox reverts.
    function join(uint256 id, address asset, uint256 deposit, string calldata timezone) external payable guarded {
        Slot storage slot = slots[id];
        require(id > 0 && id < nextId && slot.state == SlotState.Open, "Not open");
        require(msg.sender != slot.host && block.timestamp < slot.start, "Cannot join");
        require(seats[id][msg.sender].state == SeatState.None, "Already joined");
        require(slot.attendees < slot.maxAttendees && rosters[id].length < MAX_ROSTER, "Timebox full");
        require(slot.asset == asset && (asset == address(0) || allowedToken[asset]), "Unsupported asset");
        require(deposit == depositFor(id), "Terms changed");
        require(validTimezone(timezone), "Invalid timezone");
        slot.attendees++;
        rosters[id].push(msg.sender);
        seats[id][msg.sender] = Seat(SeatState.Funded, deposit, timezone);
        if (asset == address(0)) {
            require(msg.value == deposit, "Incorrect ETH");
        } else {
            require(msg.value == 0, "Unexpected ETH");
            if (deposit > 0) {
                uint256 beforeBalance = IDCalToken(asset).balanceOf(address(this));
                tokenCall(asset, abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), deposit));
                require(IDCalToken(asset).balanceOf(address(this)) == beforeBalance + deposit, "Unsupported token transfer");
            }
        }
        emit SeatJoined(id, msg.sender, deposit);
    }

    /// @notice After the end of a confirmed timebox, an attendee releases their own charge to the host and receives any split rebate.
    function release(uint256 id) external {
        Slot storage slot = slots[id];
        Seat storage seat = seats[id][msg.sender];
        require(slot.state == SlotState.Open && seat.state == SeatState.Funded, "Not funded attendee");
        require(block.timestamp >= slot.end, "Session not ended");
        require(slot.attendees >= slot.minAttendees, "Minimum not reached");
        uint256 charge = chargeFor(id);
        uint256 fee = charge / 10000 * FEE_BPS + (charge % 10000) * FEE_BPS / 10000;
        seat.state = SeatState.Released;
        credits[slot.host][slot.asset] += charge - fee;
        credits[feeRecipient][slot.asset] += fee;
        if (seat.deposit > charge) credits[msg.sender][slot.asset] += seat.deposit - charge;
        emit SeatResolved(id, msg.sender, SeatState.Released, charge, fee);
    }

    /// @notice Host refunds any funded seat; an attendee may reclaim if the minimum was not met by start or seven days after the end.
    function refund(uint256 id, address attendee) external {
        Slot storage slot = slots[id];
        Seat storage seat = seats[id][attendee];
        require(slot.state == SlotState.Open && seat.state == SeatState.Funded, "Not funded");
        bool host = msg.sender == slot.host;
        bool self = msg.sender == attendee && block.timestamp >= slot.start &&
            (slot.attendees < slot.minAttendees || block.timestamp >= uint256(slot.end) + REFUND_DELAY);
        require(host || self, "Refund not authorized");
        if (block.timestamp < slot.start) slot.attendees--;
        refundSeat(id, slot, attendee, seat);
    }

    /// @notice Failed recipients can retry to a different destination without relocking escrow.
    function withdraw(address asset, address payable destination) external guarded {
        require(destination != address(0) && destination != address(this), "Invalid destination");
        uint256 amount = credits[msg.sender][asset];
        require(amount > 0, "No credit");
        credits[msg.sender][asset] = 0;
        if (asset == address(0)) {
            (bool success,) = destination.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            tokenCall(asset, abi.encodeWithSignature("transfer(address,uint256)", destination, amount));
        }
        emit CreditWithdrawn(msg.sender, asset, destination, amount);
    }

    // ---- internals ----

    function refundSeat(uint256 id, Slot storage slot, address attendee, Seat storage seat) private {
        seat.state = SeatState.Refunded;
        credits[attendee][slot.asset] += seat.deposit;
        emit SeatResolved(id, attendee, SeatState.Refunded, 0, 0);
    }

    function link(address host, uint256 id, uint256 prev, uint64 start, uint64 end) private {
        uint256 next;
        if (prev == 0) {
            next = firstSlot[host];
        } else {
            Slot storage before = slots[prev];
            require(before.host == host && before.state == SlotState.Open && before.end <= start, "Time collision");
            next = nextSlot[prev];
        }
        require(next == 0 || slots[next].start >= end, "Time collision");
        prevSlot[id] = prev;
        nextSlot[id] = next;
        if (prev == 0) firstSlot[host] = id; else nextSlot[prev] = id;
        if (next == 0) lastSlot[host] = id; else prevSlot[next] = id;
    }

    function unlink(address host, uint256 id) private {
        uint256 prev = prevSlot[id];
        uint256 next = nextSlot[id];
        if (prev == 0) firstSlot[host] = next; else nextSlot[prev] = next;
        if (next == 0) lastSlot[host] = prev; else prevSlot[next] = prev;
        delete prevSlot[id];
        delete nextSlot[id];
    }

    function setTokenInternal(address token, bool allowed) private {
        require(token != address(0) && (!allowed || token.code.length > 0), "Invalid token");
        allowedToken[token] = allowed;
        emit TokenAllowed(token, allowed);
    }

    /// @dev IANA-style identifiers only; the app validates the zone with Intl before signing.
    function validTimezone(string calldata value) private pure returns (bool) {
        bytes calldata text = bytes(value);
        if (text.length == 0 || text.length > 64) return false;
        for (uint256 i = 0; i < text.length; i++) {
            bytes1 c = text[i];
            if (!((c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || (c >= "0" && c <= "9") ||
                c == "/" || c == "_" || c == "+" || c == "-")) return false;
        }
        return true;
    }

    function ceilDiv(uint256 a, uint256 b) private pure returns (uint256) {
        return a / b + (a % b == 0 ? 0 : 1);
    }

    function tokenCall(address token, bytes memory data) private {
        (bool success, bytes memory result) = token.call(data);
        require(success && (result.length == 0 || (result.length == 32 && abi.decode(result, (bool)))), "Token transfer failed");
    }
}
