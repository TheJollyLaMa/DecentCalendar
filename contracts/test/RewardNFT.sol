// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.30;

interface IRewardReceiver {
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external returns (bytes4);
}
contract RewardNFT {
    mapping(address => mapping(uint256 => uint256)) public balanceOf;
    function mint(address to, uint256 id, uint256 amount) external {
        balanceOf[to][id] += amount;
        receiveToken(msg.sender, address(0), to, id, amount);
    }
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata) external {
        require(msg.sender == from, "Not token holder");
        require(balanceOf[from][id] >= amount, "Missing stock");
        balanceOf[from][id] -= amount;
        balanceOf[to][id] += amount;
        receiveToken(msg.sender, from, to, id, amount);
    }
    function receiveToken(address operator, address from, address to, uint256 id, uint256 amount) private {
        if (to.code.length > 0) require(
            IRewardReceiver(to).onERC1155Received(operator, from, id, amount, "") == 0xf23a6e61,
            "Receiver rejected token"
        );
    }
}
contract RewardGuest {
    bool public rejectToken;
    address public rewardVault;
    uint256 public rewardId;
    bool public reentered;
    function configure(address vault, uint256 id, bool reject) external {
        rewardVault = vault; rewardId = id; rejectToken = reject;
    }
    function book(address registry, uint256 offerId, uint64 start) external {
        (bool success,) = registry.call(abi.encodeWithSignature("book(uint256,uint256,uint64,uint256,uint256)", offerId, 0, start, 0, 0));
        require(success, "Guest booking failed");
    }
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external returns (bytes4) {
        require(!rejectToken, "Guest rejects reward");
        (reentered,) = rewardVault.call(abi.encodeWithSignature("award(uint256)", rewardId));
        return 0xf23a6e61;
    }
}
