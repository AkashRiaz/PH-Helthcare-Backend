import cron from "node-cron";
import { prisma } from "./prisma";
import { DoctorVerificationStatus, Role } from "../../generated/prisma/enums";

export const deleteUnverifiedDoctors = async () => {
  cron.schedule("*/10 * * * *", async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const deletedDoctors = await prisma.user.deleteMany({
        where: {
          emailVerified: false,
          role: Role.DOCTOR,
          createdAt: {
            lt: oneHourAgo,
          },
          doctor: {
            verificationStatus: DoctorVerificationStatus.PENDING,
          },
        },
      });

      if (deletedDoctors.count > 0) {
        console.log(`Deleted ${deletedDoctors.count} unverified doctors.`);
      }
    } catch (error) {
      throw new Error(`Error deleting unverified doctors: ${error}`);
    }

    console.log("Cron job for deleting unverified doctors executed.");
  });
};
