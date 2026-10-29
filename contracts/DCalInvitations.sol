// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.30;

import "./DCalBooking.sol";

/// @notice Public host-authenticated invitations. Never reserves seats or moves funds.
contract DCalInvitations {
    string public constant VERSION = "dcal-invitations-1";
    DCalBooking public immutable booking;
    uint256 public constant MAX_INVITES_PER_SLOT = 200;

    struct Invitation {
        uint256 slotId;
        address host;
        address recipient;
        uint8 preference;
        bool active;
        uint64 revision;
    }

    mapping(bytes32 => Invitation) private invitations;
    mapping(address => bytes32[]) private inboxes;
    mapping(uint256 => uint256) public invitationCount;
    event InvitationUpdated(bytes32 indexed key, address indexed recipient, address indexed host, uint256 slotId, uint8 preference, bool active, uint64 revision);

    constructor(address registry) {
        require(registry.code.length > 0, "Invalid booking registry");
        booking = DCalBooking(registry);
        require(keccak256(bytes(booking.VERSION())) == keccak256("dcal-timebox-1"), "Unsupported booking version");
    }

    function invite(uint256 slotId, address recipient, uint8 preference) external {
        DCalBooking.Slot memory slot = booking.getSlot(slotId);
        require(msg.sender == slot.host, "Not timebox host");
        require(slot.state == DCalBooking.SlotState.Open && block.timestamp < slot.start, "Timebox not accepting invitations");
        require(recipient != address(0) && recipient != slot.host, "Invalid recipient");
        require(preference <= 2, "Invalid preference");
        bytes32 key = keccak256(abi.encode(slotId, recipient));
        Invitation storage item = invitations[key];
        if (item.recipient == address(0)) {
            require(invitationCount[slotId] < MAX_INVITES_PER_SLOT, "Invitation limit");
            invitationCount[slotId]++;
            inboxes[recipient].push(key);
            item.slotId = slotId;
            item.host = msg.sender;
            item.recipient = recipient;
        }
        item.preference = preference;
        item.active = true;
        item.revision++;
        emit InvitationUpdated(key, recipient, msg.sender, slotId, preference, true, item.revision);
    }

    function withdrawInvitation(bytes32 key) external {
        Invitation storage item = invitations[key];
        require(item.host == msg.sender && item.active, "Not active host invitation");
        item.active = false;
        item.revision++;
        emit InvitationUpdated(key, item.recipient, msg.sender, item.slotId, item.preference, false, item.revision);
    }

    function getInvitation(bytes32 key) external view returns (Invitation memory) {
        return invitations[key];
    }

    function inboxCount(address recipient) external view returns (uint256) {
        return inboxes[recipient].length;
    }

    /// @notice Bounded pagination, newest first. Offset counts from the newest invitation.
    function inbox(address recipient, uint256 offset, uint256 limit) external view returns (bytes32[] memory keys, Invitation[] memory items) {
        require(limit >= 1 && limit <= 50, "Page size 1-50");
        uint256 count = inboxes[recipient].length;
        uint256 size = offset >= count ? 0 : (count - offset < limit ? count - offset : limit);
        keys = new bytes32[](size);
        items = new Invitation[](size);
        for (uint256 i; i < size; i++) {
            keys[i] = inboxes[recipient][count - 1 - offset - i];
            items[i] = invitations[keys[i]];
        }
    }
}
