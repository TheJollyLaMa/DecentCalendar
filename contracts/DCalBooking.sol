// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.30;

interface IDCalToken {
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Nontransferable slot agreements. Time elapsing never releases funds.
contract DCalBooking {
    enum State { Available, Funded, Settled, Refunded, Withdrawn }
    struct Slot {
        address host;
        address buyer;
        address asset;
        uint256 gross;
        uint64 start;
        uint64 end;
        bool hardline;
        State state;
        string metadata;
    }

    uint256 public constant FEE_BPS = 300;
    uint256 public constant REFUND_DELAY = 7 days;
    string public constant VERSION = "dcal-booking-1";
    address public immutable feeRecipient;
    address public immutable usdc;
    uint256 public nextId;
    mapping(uint256 => Slot) private slots;
    mapping(address => mapping(address => uint256)) public credits;
    bool private entered;

    event SlotCreated(uint256 indexed id, address indexed host, address asset, uint256 gross, uint64 start, uint64 end, bool hardline, string metadata);
    event SlotBooked(uint256 indexed id, address indexed buyer);
    event SlotResolved(uint256 indexed id, State state, uint256 fee);
    event CreditWithdrawn(address indexed owner, address indexed asset, address indexed destination, uint256 amount);

    modifier guarded() {
        require(!entered, "Reentrant call");
        entered = true;
        _;
        entered = false;
    }

    constructor(address recipient, address usdcAddress) {
        require(recipient != address(0) && usdcAddress.code.length > 0, "Invalid deployment");
        feeRecipient = recipient;
        usdc = usdcAddress;
    }

    function getSlot(uint256 id) public view returns (Slot memory) {
        require(id < nextId, "Unknown slot");
        return slots[id];
    }

    function createSlot(address asset, uint256 gross, uint64 start, uint64 end, bool hardline, string calldata metadata)
        external returns (uint256 id)
    {
        require(asset == address(0) || asset == usdc, "Unsupported asset");
        require(start > block.timestamp && end > start, "Invalid interval");
        require(bytes(metadata).length > 0 && bytes(metadata).length <= 200, "Invalid metadata");
        id = nextId++;
        slots[id] = Slot(msg.sender, address(0), asset, gross, start, end, hardline, State.Available, metadata);
        emit SlotCreated(id, msg.sender, asset, gross, start, end, hardline, metadata);
    }

    function withdrawOffer(uint256 id) external {
        Slot storage slot = slots[id];
        require(slot.host == msg.sender && slot.state == State.Available, "Not available host");
        slot.state = State.Withdrawn;
        emit SlotResolved(id, State.Withdrawn, 0);
    }

    /// @dev The buyer supplies every agreed economic field, so stale quotes revert.
    function book(uint256 id, address asset, uint256 gross, uint64 start, uint64 end, bool hardline) external payable guarded {
        Slot storage slot = slots[id];
        require(id < nextId && slot.state == State.Available, "Not available");
        require(msg.sender != slot.host && block.timestamp < slot.start, "Cannot book");
        require(slot.asset == asset && slot.gross == gross && slot.start == start && slot.end == end && slot.hardline == hardline, "Terms changed");
        slot.buyer = msg.sender;
        slot.state = State.Funded;
        if (asset == address(0)) {
            require(msg.value == gross, "Incorrect ETH");
        } else {
            require(msg.value == 0, "Unexpected ETH");
            if (gross > 0) {
                uint256 beforeBalance = IDCalToken(asset).balanceOf(address(this));
                tokenCall(asset, abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), gross));
                require(IDCalToken(asset).balanceOf(address(this)) == beforeBalance + gross, "Unsupported token transfer");
            }
        }
        emit SlotBooked(id, msg.sender);
    }

    function release(uint256 id) external {
        Slot storage slot = slots[id];
        require(slot.state == State.Funded && slot.buyer == msg.sender, "Not funded buyer");
        require(block.timestamp >= slot.end, "Session not ended");
        slot.state = State.Settled;
        uint256 fee = slot.gross / 10000 * FEE_BPS + (slot.gross % 10000) * FEE_BPS / 10000;
        credits[slot.host][slot.asset] += slot.gross - fee;
        credits[feeRecipient][slot.asset] += fee;
        emit SlotResolved(id, State.Settled, fee);
    }

    function refund(uint256 id) external {
        Slot storage slot = slots[id];
        require(slot.state == State.Funded, "Not funded");
        bool buyer = msg.sender == slot.buyer;
        require(msg.sender == slot.host || (buyer && (block.timestamp < slot.start || block.timestamp >= uint256(slot.end) + REFUND_DELAY)), "Refund not authorized");
        slot.state = State.Refunded;
        credits[slot.buyer][slot.asset] += slot.gross;
        emit SlotResolved(id, State.Refunded, 0);
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

    function tokenCall(address token, bytes memory data) private {
        (bool success, bytes memory result) = token.call(data);
        require(success && (result.length == 0 || (result.length == 32 && abi.decode(result, (bool)))), "Token transfer failed");
    }
}
