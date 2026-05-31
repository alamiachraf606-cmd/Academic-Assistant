import hre from "hardhat";

async function main() {
  const [deployer] = await hre.viem.getWalletClients();

  const roleManager = await hre.viem.deployContract("RoleManager", [deployer.account.address]);
  const announcementLog = await hre.viem.deployContract("AnnouncementLog", [roleManager.address]);
  const documentRegistry = await hre.viem.deployContract("DocumentRegistry", [roleManager.address]);
  const acknowledgmentLog = await hre.viem.deployContract("AcknowledgmentLog", [
    roleManager.address,
    announcementLog.address
  ]);

  console.log("ROLE_MANAGER_ADDRESS=", roleManager.address);
  console.log("ANNOUNCEMENT_LOG_ADDRESS=", announcementLog.address);
  console.log("DOCUMENT_REGISTRY_ADDRESS=", documentRegistry.address);
  console.log("ACKNOWLEDGMENT_LOG_ADDRESS=", acknowledgmentLog.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
