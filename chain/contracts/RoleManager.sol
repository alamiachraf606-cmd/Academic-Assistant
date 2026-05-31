// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

contract RoleManager is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROFESSOR_ROLE = keccak256("PROFESSOR_ROLE");
    bytes32 public constant STUDENT_ROLE = keccak256("STUDENT_ROLE");

    mapping(address => string) private groups;
    mapping(address => bytes32) private primaryRoles;

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);

        _setRoleAdmin(PROFESSOR_ROLE, ADMIN_ROLE);
        _setRoleAdmin(STUDENT_ROLE, ADMIN_ROLE);
    }

    function assignRole(address account, bytes32 role) external onlyRole(ADMIN_ROLE) {
        _grantRole(role, account);
        primaryRoles[account] = role;
    }

    function assignGroup(address account, string calldata group) external onlyRole(ADMIN_ROLE) {
        groups[account] = group;
    }

    function getRole(address account) external view returns (bytes32) {
        return primaryRoles[account];
    }

    function getGroup(address account) external view returns (string memory) {
        return groups[account];
    }
}
