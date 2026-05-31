// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRoleManagerAck {
    function STUDENT_ROLE() external view returns (bytes32);
    function hasRole(bytes32 role, address account) external view returns (bool);
    function getGroup(address account) external view returns (string memory);
}

interface IAnnouncementLog {
    function getTargetGroup(uint256 id) external view returns (string memory);
}

contract AcknowledgmentLog {
    IRoleManagerAck public roleManager;
    IAnnouncementLog public announcementLog;

    mapping(uint256 => mapping(address => uint256)) private acknowledgments;

    event Acknowledged(uint256 indexed announcementId, address indexed student, uint256 timestamp);

    constructor(address roleManagerAddress, address announcementLogAddress) {
        roleManager = IRoleManagerAck(roleManagerAddress);
        announcementLog = IAnnouncementLog(announcementLogAddress);
    }

    function acknowledge(uint256 announcementId) external {
        require(
            roleManager.hasRole(roleManager.STUDENT_ROLE(), msg.sender),
            "NOT_STUDENT"
        );
        require(acknowledgments[announcementId][msg.sender] == 0, "ALREADY_ACKED");

        string memory targetGroup = announcementLog.getTargetGroup(announcementId);
        string memory studentGroup = roleManager.getGroup(msg.sender);

        bool isAllowed =
            keccak256(bytes(targetGroup)) == keccak256(bytes("all")) ||
            keccak256(bytes(targetGroup)) == keccak256(bytes(studentGroup));
        require(isAllowed, "WRONG_GROUP");

        acknowledgments[announcementId][msg.sender] = block.timestamp;
        emit Acknowledged(announcementId, msg.sender, block.timestamp);
    }

    function getAcknowledgedAt(uint256 announcementId, address student)
        external
        view
        returns (uint256)
    {
        return acknowledgments[announcementId][student];
    }
}
