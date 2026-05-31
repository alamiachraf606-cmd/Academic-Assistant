import { expect } from "chai";
import hre from "hardhat";
import { keccak256, toHex } from "viem";

describe("Academic Assistant Contracts", function () {
  async function expectRevert(promise: Promise<unknown>, message: string) {
    try {
      await promise;
      throw new Error("Expected revert");
    } catch (error) {
      const text = String((error as Error).message ?? error);
      expect(text).to.include(message);
    }
  }

  async function setup() {
    const [admin, professor, student, outsider] = await hre.viem.getWalletClients();
    const roleManager = await hre.viem.deployContract("RoleManager", [admin.account.address]);
    const announcementLog = await hre.viem.deployContract("AnnouncementLog", [roleManager.address]);
    const documentRegistry = await hre.viem.deployContract("DocumentRegistry", [roleManager.address]);
    const acknowledgmentLog = await hre.viem.deployContract("AcknowledgmentLog", [
      roleManager.address,
      announcementLog.address
    ]);

    await roleManager.write.assignRole([
      professor.account.address,
      await roleManager.read.PROFESSOR_ROLE()
    ], { account: admin.account });
    await roleManager.write.assignRole([
      student.account.address,
      await roleManager.read.STUDENT_ROLE()
    ], { account: admin.account });
    await roleManager.write.assignRole([
      outsider.account.address,
      await roleManager.read.STUDENT_ROLE()
    ], { account: admin.account });

    await roleManager.write.assignGroup([student.account.address, "MF1"], { account: admin.account });
    await roleManager.write.assignGroup([outsider.account.address, "MF2"], { account: admin.account });

    return {
      admin,
      professor,
      student,
      outsider,
      roleManager,
      announcementLog,
      documentRegistry,
      acknowledgmentLog
    };
  }

  it("allows professor to publish announcements", async function () {
    const { professor, announcementLog } = await setup();
    const contentHash = keccak256(toHex("Exam on Monday"));

    await announcementLog.write.publish([contentHash, "exam", "MF1"], {
      account: professor.account
    });

    const isValid = await announcementLog.read.verify([1n, contentHash]);
    expect(isValid).to.equal(true);
  });

  it("rejects student announcement publish", async function () {
    const { student, announcementLog } = await setup();
    const contentHash = keccak256(toHex("Homework due Friday"));

    await expectRevert(
      announcementLog.write.publish([contentHash, "homework", "MF1"], {
        account: student.account
      }),
      "NOT_PROFESSOR"
    );
  });

  it("verifies tampered announcement hashes", async function () {
    const { professor, announcementLog } = await setup();
    const contentHash = keccak256(toHex("Lab canceled"));
    const tamperedHash = keccak256(toHex("Lab rescheduled"));

    await announcementLog.write.publish([contentHash, "schedule", "MF1"], {
      account: professor.account
    });

    const ok = await announcementLog.read.verify([1n, contentHash]);
    const bad = await announcementLog.read.verify([1n, tamperedHash]);
    expect(ok).to.equal(true);
    expect(bad).to.equal(false);
  });

  it("registers and verifies documents", async function () {
    const { professor, documentRegistry } = await setup();
    const fileHash = keccak256(toHex("pdf-hash"));

    await documentRegistry.write.register([fileHash, "week1.pdf", "MF1"], {
      account: professor.account
    });

    const ok = await documentRegistry.read.verifyDocument([1n, fileHash]);
    const bad = await documentRegistry.read.verifyDocument([
      1n,
      keccak256(toHex("tampered"))
    ]);

    expect(ok).to.equal(true);
    expect(bad).to.equal(false);
  });

  it("rejects student document registration", async function () {
    const { student, documentRegistry } = await setup();
    const fileHash = keccak256(toHex("sheet"));

    await expectRevert(
      documentRegistry.write.register([fileHash, "sheet.pdf", "MF1"], {
        account: student.account
      }),
      "NOT_PROFESSOR"
    );
  });

  it("acknowledges announcements only for correct group", async function () {
    const { professor, student, outsider, announcementLog, acknowledgmentLog } = await setup();
    const contentHash = keccak256(toHex("Project demo next week"));

    await announcementLog.write.publish([contentHash, "demo", "MF1"], {
      account: professor.account
    });

    await acknowledgmentLog.write.acknowledge([1n], { account: student.account });
    const acknowledgedAt = await acknowledgmentLog.read.getAcknowledgedAt([
      1n,
      student.account.address
    ]);
    expect(acknowledgedAt).to.not.equal(0n);

    await expectRevert(
      acknowledgmentLog.write.acknowledge([1n], { account: outsider.account }),
      "WRONG_GROUP"
    );
  });
});
