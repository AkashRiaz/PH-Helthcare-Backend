import bcrypt from "bcryptjs";
import { Role } from "../../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import config from "../config";

export const seedSupperAdmin = async () => {
  try {
    const isSupperAdminExist = await prisma.user.findFirst({
      where: {
        role: Role.SUPER_ADMIN,
      },
    });

    if (isSupperAdminExist) {
      console.log("Supper Admin already exist");
      return;
    }

    const name = config.super_admin.name!;
    const email = config.super_admin.email!;
    const password = config.super_admin.password!;

    if (!name || !email || !password) {
      throw new Error(
        "Super Admin credentials are not set in the environment variables",
      );
    }

    const hashedPassword = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds),
    );

    const supperAdmin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: Role.SUPER_ADMIN,
        needPasswordChange: false,
        emailVerified: true,
      },
    });

    console.log("Supper Admin created successfully", supperAdmin);
  } catch (error) {
    console.error("Error creating Supper Admin:", error);
    await prisma.user.deleteMany({
      where: {
        email: config.super_admin.email!,
      },
    });
  }
};
