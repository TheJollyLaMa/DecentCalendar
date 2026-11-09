// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.30;

interface IRewardAppointments {
    struct Window { uint64 start; uint64 end; uint32 day; }
    struct Offer { address host; address invitee; uint32 duration; bool closed; string subject; string timezone; }
    struct Appointment { uint256 offerId; uint256 windowIndex; uint64 start; uint64 end; bool cancelled; }
    function VERSION() external view returns (string memory);
    function nextAppointmentId() external view returns (uint256);
    function getOffer(uint256 id) external view returns (Offer memory, Window[] memory);
    function getAppointment(uint256 id) external view returns (Appointment memory);
}

interface IRewardNFT {
    function balanceOf(address wallet, uint256 id) external view returns (uint256);
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
}

/// @notice One gift per booking guest, not proof of attendance or unique humanity.
contract DCalBookingRewards {
    string public constant VERSION = "dcal-first-booking-rewards-1";
    uint256 public constant LIMIT = 10;
    address public owner;
    IRewardAppointments public appointments;
    IRewardNFT public nft;
    uint256 public tokenId;
    uint256 public startAppointmentId;
    uint256 public awarded;
    bool public enabled;
    bool private entered;
    mapping(address => uint256) public rewardedAppointment;

    event PromotionActivated(uint256 indexed startAppointmentId);
    event PromotionEnabled(bool enabled);
    event BookingRewarded(uint256 indexed appointmentId, address indexed recipient, uint256 indexed tokenId);
    event StockReturned(address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not promotion owner");
        _;
    }
    modifier nonReentrant() {
        require(!entered, "Reward reentrancy");
        entered = true;
        _;
        entered = false;
    }

    constructor(address registry, address collection, uint256 id) {
        require(registry.code.length > 0 && collection.code.length > 0, "Missing reward contracts");
        appointments = IRewardAppointments(registry);
        require(keccak256(bytes(appointments.VERSION())) == keccak256("dcal-appointments-1"), "Wrong appointment registry");
        nft = IRewardNFT(collection);
        tokenId = id;
        owner = msg.sender;
    }

    function activate() external onlyOwner {
        require(startAppointmentId == 0, "Promotion already activated");
        require(nft.balanceOf(address(this), tokenId) >= LIMIT, "Fund all ten rewards first");
        startAppointmentId = appointments.nextAppointmentId();
        enabled = true;
        emit PromotionActivated(startAppointmentId);
        emit PromotionEnabled(true);
    }

    function setEnabled(bool value) external onlyOwner {
        require(startAppointmentId != 0, "Promotion not activated");
        if (value) require(nft.balanceOf(address(this), tokenId) >= LIMIT - awarded, "Reward stock missing");
        enabled = value;
        emit PromotionEnabled(value);
    }

    function eligible(uint256 id) public view returns (address recipient) {
        if (!enabled || awarded >= LIMIT || id < startAppointmentId || id >= appointments.nextAppointmentId()) return address(0);
        IRewardAppointments.Appointment memory item = appointments.getAppointment(id);
        if (item.cancelled) return address(0);
        (IRewardAppointments.Offer memory offer,) = appointments.getOffer(item.offerId);
        if (offer.invitee == address(0) || offer.invitee == offer.host || rewardedAppointment[offer.invitee] != 0) return address(0);
        return offer.invitee;
    }

    /// @notice Anyone may pay gas, but cannot select or redirect the recipient.
    function award(uint256 id) external nonReentrant {
        address recipient = eligible(id);
        require(recipient != address(0), "Booking not reward eligible");
        require(nft.balanceOf(address(this), tokenId) > 0, "Reward stock missing");
        rewardedAppointment[recipient] = id;
        awarded++;
        nft.safeTransferFrom(address(this), recipient, tokenId, 1, "");
        emit BookingRewarded(id, recipient, tokenId);
    }

    function returnStock(address to, uint256 amount) external onlyOwner nonReentrant {
        require(!enabled && to != address(0) && amount > 0, "Disable promotion before returning stock");
        nft.safeTransferFrom(address(this), to, tokenId, amount, "");
        emit StockReturned(to, amount);
    }

    function onERC1155Received(address, address, uint256 id, uint256 amount, bytes calldata) external view returns (bytes4) {
        require(msg.sender == address(nft) && id == tokenId && amount > 0, "Wrong reward stock");
        return this.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure returns (bytes4) {
        revert("Send one reward token type");
    }
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7 || id == 0x4e2312e0;
    }
}
