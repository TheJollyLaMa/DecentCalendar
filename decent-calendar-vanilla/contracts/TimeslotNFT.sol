// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TimeslotNFT
 * @notice ERC-721 contract for minting calendar timeslots as NFTs.
 *         Each token represents a bookable time block.
 *         Metadata is stored on IPFS; the CID is stored on-chain.
 */
contract TimeslotNFT is ERC721, Ownable {
    uint256 private _tokenIdCounter;

    struct Timeslot {
        address creator;
        string ipfsCID;       // Points to full event JSON on IPFS
        uint256 startTime;    // Unix timestamp (seconds)
        uint256 endTime;      // Unix timestamp (seconds)
        uint256 hourlyRate;   // In wei (POL)
        string status;        // "available" | "pending" | "booked" | "confirmed" | "cancelled"
    }

    mapping(uint256 => Timeslot) public timeslots;

    event TimeslotMinted(uint256 indexed tokenId, address indexed creator, string ipfsCID);
    event StatusUpdated(uint256 indexed tokenId, string status);

    constructor() ERC721("DecentTimeslot", "DTS") Ownable(msg.sender) {}

    /**
     * @notice Mint a new timeslot NFT.
     * @param ipfsCID    IPFS CID of the event metadata JSON
     * @param startTime  Unix timestamp of the slot start
     * @param endTime    Unix timestamp of the slot end
     * @param hourlyRate Rate in wei per hour
     * @return tokenId   The ID of the newly minted token
     */
    function mintTimeslot(
        string memory ipfsCID,
        uint256 startTime,
        uint256 endTime,
        uint256 hourlyRate
    ) external returns (uint256) {
        require(endTime > startTime, "End must be after start");
        require(bytes(ipfsCID).length > 0, "IPFS CID required");

        uint256 tokenId = _tokenIdCounter++;
        _safeMint(msg.sender, tokenId);

        timeslots[tokenId] = Timeslot({
            creator: msg.sender,
            ipfsCID: ipfsCID,
            startTime: startTime,
            endTime: endTime,
            hourlyRate: hourlyRate,
            status: "available"
        });

        emit TimeslotMinted(tokenId, msg.sender, ipfsCID);
        return tokenId;
    }

    /**
     * @notice Update the status of a timeslot. Only the creator or contract owner can call this.
     * @param tokenId The ID of the timeslot token
     * @param status  New status string
     */
    function setStatus(uint256 tokenId, string memory status) external {
        require(
            msg.sender == timeslots[tokenId].creator || msg.sender == owner(),
            "Not authorized"
        );
        timeslots[tokenId].status = status;
        emit StatusUpdated(tokenId, status);
    }

    /**
     * @notice Read the full timeslot struct for a given token.
     */
    function getTimeslot(uint256 tokenId) external view returns (Timeslot memory) {
        return timeslots[tokenId];
    }

    /**
     * @notice Returns the IPFS URI for a token's metadata.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked("ipfs://", timeslots[tokenId].ipfsCID));
    }
}
