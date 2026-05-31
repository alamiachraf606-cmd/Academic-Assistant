import hre from "hardhat";
import dotenv from "dotenv";

dotenv.config({ path: "../backend/.env" });

const roleManagerAddress = process.env.ROLE_MANAGER_ADDRESS;

async function main() {
  if (!roleManagerAddress) {
    throw new Error("ROLE_MANAGER_ADDRESS not set");
  }

  const [admin, professor, student] = await hre.viem.getWalletClients();
  const roleManager = await hre.viem.getContractAt("RoleManager", roleManagerAddress);

  const professorRole = await roleManager.read.PROFESSOR_ROLE();
  const studentRole = await roleManager.read.STUDENT_ROLE();

  await roleManager.write.assignRole([professor.account.address, professorRole], {
    account: admin.account
  });
  await roleManager.write.assignGroup([professor.account.address, "M1"], {
    account: admin.account
  });

  await roleManager.write.assignRole([student.account.address, studentRole], {
    account: admin.account
  });
  await roleManager.write.assignGroup([student.account.address, "M1"], {
    account: admin.account
  });

  console.log("Seeded roles:");
  console.log("Professor:", professor.account.address);
  console.log("Student:", student.account.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
