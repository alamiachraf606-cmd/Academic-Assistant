// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRoleManagerDoc {
    function PROFESSOR_ROLE() external view returns (bytes32);
    function hasRole(bytes32 role, address account) external view returns (bool);
}

contract DocumentRegistry {
    struct Document {
        bytes32 fileHash;
        string fileName;
        string targetGroup;
        uint256 timestamp;
        address publisher;
    }

    IRoleManagerDoc public roleManager;
    uint256 public documentCount;
    mapping(uint256 => Document) private documents;

    event DocumentRegistered(
        uint256 indexed id,
        bytes32 indexed fileHash,
        string fileName,
        string targetGroup,
        address indexed publisher,
        uint256 timestamp
    );

    constructor(address roleManagerAddress) {
        roleManager = IRoleManagerDoc(roleManagerAddress);
    }

    modifier onlyProfessor() {
        require(
            roleManager.hasRole(roleManager.PROFESSOR_ROLE(), msg.sender),
            "NOT_PROFESSOR"
        );
        _;
    }

    function register(
        bytes32 fileHash,
        string calldata fileName,
        string calldata targetGroup
    ) external onlyProfessor returns (uint256) {
        documentCount += 1;
        documents[documentCount] = Document({
            fileHash: fileHash,
            fileName: fileName,
            targetGroup: targetGroup,
            timestamp: block.timestamp,
            publisher: msg.sender
        });

        emit DocumentRegistered(
            documentCount,
            fileHash,
            fileName,
            targetGroup,
            msg.sender,
            block.timestamp
        );

        return documentCount;
    }

    function verifyDocument(uint256 id, bytes32 fileHash) external view returns (bool) {
        return documents[id].fileHash == fileHash;
    }

    function getDocument(uint256 id) external view returns (Document memory) {
        return documents[id];
    }
}
