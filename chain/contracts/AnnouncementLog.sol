// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRoleManager {
    function PROFESSOR_ROLE() external view returns (bytes32);
    function hasRole(bytes32 role, address account) external view returns (bool);
    function getGroup(address account) external view returns (string memory);
}

contract AnnouncementLog {
    struct Announcement {
        bytes32 contentHash;
        string category;
        string targetGroup;
        uint256 timestamp;
        address publisher;
    }

    IRoleManager public roleManager;
    uint256 public announcementCount;
    mapping(uint256 => Announcement) private announcements;

    event AnnouncementPublished(
        uint256 indexed id,
        bytes32 indexed contentHash,
        string category,
        string targetGroup,
        address indexed publisher,
        uint256 timestamp
    );

    constructor(address roleManagerAddress) {
        roleManager = IRoleManager(roleManagerAddress);
    }

    modifier onlyProfessor() {
        require(
            roleManager.hasRole(roleManager.PROFESSOR_ROLE(), msg.sender),
            "NOT_PROFESSOR"
        );
        _;
    }

    function publish(
        bytes32 contentHash,
        string calldata category,
        string calldata targetGroup
    ) external onlyProfessor returns (uint256) {
        announcementCount += 1;
        announcements[announcementCount] = Announcement({
            contentHash: contentHash,
            category: category,
            targetGroup: targetGroup,
            timestamp: block.timestamp,
            publisher: msg.sender
        });

        emit AnnouncementPublished(
            announcementCount,
            contentHash,
            category,
            targetGroup,
            msg.sender,
            block.timestamp
        );

        return announcementCount;
    }

    function verify(uint256 id, bytes32 contentHash) external view returns (bool) {
        return announcements[id].contentHash == contentHash;
    }

    function getAnnouncement(uint256 id) external view returns (Announcement memory) {
        return announcements[id];
    }

    function getTargetGroup(uint256 id) external view returns (string memory) {
        return announcements[id].targetGroup;
    }
}
