/** biome-ignore-all assist/source/organizeImports: <explanation> */
import bcrypt from "bcryptjs";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import {
  AuthProvider,
  Role,
  UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import {
  IForgotPasswordPayload,
  IGoogleLoginPayload,
  ILoginUserPayload,
  IRegisterPatientPayload,
  IRequestUser,
  IResetPasswordPayload,
  IVerifyEmailPayload,
} from "./auth.interface";
import { googleClient } from "../../lib/googleAuth";
import { TokenPayload } from "google-auth-library";
import crypto from "crypto";
import { redisClient } from "../../lib/redis";
import { transporter } from "../../lib/nodemailer";
import path from "path";
import ejs from "ejs";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";

const registerPatient = async (payload: IRegisterPatientPayload) => {
  const { name, password, patient: patientData } = payload;
  const email = payload.email.trim().toLowerCase();

  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 8);

  const expirationSeconds = 5 * 60;
  const otp = crypto.randomInt(100000, 999999).toString();

  const otpKey = `patient-registration-otp:${email}`;

  await redisClient.set(otpKey, otp, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });

  const patientRegistrationDataKey = `patient-registration-data:${email}`;
  const redisUserDataPayload = {
    name,
    email,
    password: hashedPassword,
    patient: patientData,
  };

  await redisClient.set(
    patientRegistrationDataKey,
    JSON.stringify(redisUserDataPayload),
    {
      expiration: {
        type: "EX",
        value: expirationSeconds,
      },
    },
  );

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/registration-user-otp.ejs",
  );

  const templateData = {
    name: name,
    email: email,
    otp: otp,
    expirationMinutes: expirationSeconds / 60,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.smtp_user,
    to: email,
    subject: "Patient Registration OTP",
    html,
  });
};

const verifyPatientEmail = async (payload: IVerifyEmailPayload) => {
  const { email, otp } = payload;

  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists?.status === "BLOCKED") {
    // throw new Error("User is Blocked");
    throw new AppError(httpStatus.FORBIDDEN, "User is Blocked");
  }

  if (isUserExists?.emailVerified) {
    throw new Error("Email ALready Verified");
  }

  if (isUserExists?.isDeleted || isUserExists?.status === "DELETED") {
    throw new Error("User is Deleted");
  }

  const otpKey = `patient-registration-otp:${email}`;

  const redisOtp = await redisClient.get(otpKey);

  if (!redisOtp) {
    throw new Error("OTP has expired or is invalid");
  }

  if (redisOtp !== otp) {
    throw new Error("Invalid OTP");
  }

  await redisClient.del([otpKey]);

  const patientRegistrationDataKey = `patient-registration-data:${email}`;
  const redisPatientData = await redisClient.get(patientRegistrationDataKey);

  if (!redisPatientData) {
    throw new Error("Patient registration data has expired or is invalid");
  }

  const patientPayload: IRegisterPatientPayload = redisPatientData
    ? JSON.parse(redisPatientData)
    : null;

  const createdUser = await prisma.user.create({
    data: {
      name: patientPayload?.name,
      email: patientPayload?.email,
      password: patientPayload?.password,
      authProvider: AuthProvider.CREDENTIALS,
      role: Role.PATIENT,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      patient: {
        create: {
          name: patientPayload?.name,
          email: patientPayload?.email,
          contactNumber: patientPayload?.patient?.contactNumber || null,
        },
      },
    },
    omit: { password: true },
    include: { patient: true },
  });

  await redisClient.del([patientRegistrationDataKey]);

  const expirationSeconds = 5 * 60;

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/patient-welcome-email.ejs",
  );

  const templateData = {
    name: createdUser.name,
    email: createdUser.email,
    otp: otp,
    expirationMinutes: expirationSeconds / 60,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.smtp_user,
    to: email,
    subject: "welcome to PH-Healthcare",
    html,
  });

  const { patient, ...user } = createdUser;
  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    user,
    patient,
    accessToken,
    refreshToken,
  };
};

const loginUser = async (payload: ILoginUserPayload) => {
  const { password } = payload;
  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new Error("User is blocked");
  }

  if (user.isDeleted || user.status === UserStatus.DELETED) {
    throw new Error("User is deleted");
  }

  if (user.password === null && user.googleId !== null) {
    throw new Error(
      "User registered with Google login. Please use Google login.",
    );
  }

  const isPasswordMatched = await bcrypt.compare(
    password,
    user.password as string,
  );

  if (!isPasswordMatched) {
    throw new Error("Invalid credentials");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};

const getMe = async (user: IRequestUser) => {
  const isUserExists = await prisma.user.findUnique({
    where: {
      id: user.userId,
    },
    include: {
      patient: true,
    },
    omit: {
      password: true,
    },
  });

  if (!isUserExists) {
    throw new Error("User not found");
  }

  return isUserExists;
};

const refreshToken = async (token: string) => {
  const verifiedRefreshToken = jwtUtils.verifyToken(
    token,
    config.jwt_refresh_secret,
  );

  if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
    throw new Error(
      config.node_env === "development"
        ? verifiedRefreshToken.error
        : "Invalid refresh token",
    );
  }

  const data = verifiedRefreshToken.data as JwtPayload;

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
  });

  if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
    throw new Error("User is inactive or not found");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
  let googleIdTokenPayload: TokenPayload | null | undefined = null;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: payload.idToken,
      audience: config.google_client_id,
    });

    googleIdTokenPayload = ticket.getPayload();
  } catch (error) {
    console.log(error);
    throw new Error(
      config.node_env === "development"
        ? `Google login failed: ${error}`
        : "Google login failed due to invalid token",
    );
  }

  if (!googleIdTokenPayload) {
    throw new Error(
      "Google login failed: Unable to retrieve user information from Google",
    );
  }

  if (!googleIdTokenPayload.email) {
    throw new Error(
      "Google login failed: Unable to retrieve user email from Google",
    );
  }

  if (!googleIdTokenPayload.name) {
    throw new Error(
      "Google login failed: Unable to retrieve user name from Google",
    );
  }

  const isPatientExistsOnGoogleAuth = await prisma.user.findUnique({
    where: {
      email: googleIdTokenPayload.email,
      role: Role.PATIENT,
      googleId: googleIdTokenPayload.sub,
    },
  });

  let user = isPatientExistsOnGoogleAuth;

  if (!isPatientExistsOnGoogleAuth) {
    const ifPatientExistsWithCredentials = await prisma.user.findUnique({
      where: {
        email: googleIdTokenPayload.email,
        role: Role.PATIENT,
        authProvider: AuthProvider.CREDENTIALS,
      },
    });

    if (ifPatientExistsWithCredentials) {
      if (ifPatientExistsWithCredentials.emailVerified === false) {
        throw new Error("User email is not verified");
      }
      if (ifPatientExistsWithCredentials.status === UserStatus.BLOCKED) {
        throw new Error("User is blocked");
      }

      if (
        ifPatientExistsWithCredentials.isDeleted ||
        ifPatientExistsWithCredentials.status === UserStatus.DELETED
      ) {
        throw new Error("User is deleted");
      }

      user = await prisma.user.update({
        where: {
          id: ifPatientExistsWithCredentials.id,
        },
        data: {
          googleId: googleIdTokenPayload.sub,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: googleIdTokenPayload.name,
          email: googleIdTokenPayload.email,
          googleId: googleIdTokenPayload.sub,
          authProvider: AuthProvider.GOOGLE,
          role: Role.PATIENT,
          emailVerified: true,
          patient: {
            create: {
              name: googleIdTokenPayload.name,
              email: googleIdTokenPayload.email,
            },
          },
        },
      });

      const expirationSeconds = 5 * 60;

      const templatePath = path.join(
        process.cwd(),
        "src/app/templates/patient-welcome-email.ejs",
      );

      const templateData = {
        name: user.name,
        email: user.email,
        expirationMinutes: expirationSeconds / 60,
      };

      const html = await ejs.renderFile(templatePath, templateData);

      await transporter.sendMail({
        from: config.smtp_user,
        to: user.email,
        subject: "welcome to PH-Healthcare",
        html,
      });
    }
  }

  if (!user) {
    throw new Error("User not found after Google login");
  }

  if (user?.status === UserStatus.BLOCKED) {
    throw new Error("User is blocked");
  }

  if (user?.isDeleted || user?.status === UserStatus.DELETED) {
    throw new Error("User is deleted");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};

const forgotPassword = async (payload: IForgotPasswordPayload) => {
  const { email } = payload;
  const isUserExists = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!isUserExists) {
    throw new Error("User not found");
  }

  if (isUserExists.status === "BLOCKED") {
    throw new Error("User is blocked");
  }

  if (!isUserExists.emailVerified) {
    throw new Error("User email is not verified");
  }

  if (isUserExists.isDeleted || isUserExists.status === "DELETED") {
    throw new Error("User is deleted");
  }

  if (isUserExists.googleId && isUserExists.authProvider === "GOOGLE") {
    throw new Error(
      "User registered with Google login. Please use Google login.",
    );
  }

  const otp = crypto.randomInt(100000, 999999).toString();

  const key = `forgot-password-otp:${isUserExists.email}`;
  const expirationSeconds = 5 * 60;

  await redisClient.set(key, otp, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/forgot-password.ejs",
  );

  const templateData = {
    name: isUserExists.name,
    otp,
    expirationMinutes: expirationSeconds / 60,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.smtp_user,
    to: isUserExists.email,
    subject: "Forgot Password OTP",
    // text : `Your OTP is ${otp}`
    // html: `<h1>Your OTP is ${otp}</h1>`
    html,
  });
};

const resetPassword = async (payload: IResetPasswordPayload) => {
  const { email, otp, newPassword } = payload;
  const isUserExists = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!isUserExists) {
    throw new Error("User not found");
  }

  if (isUserExists.status === "BLOCKED") {
    throw new Error("User is blocked");
  }

  if (!isUserExists.emailVerified) {
    throw new Error("User email is not verified");
  }

  if (isUserExists.isDeleted || isUserExists.status === "DELETED") {
    throw new Error("User is deleted");
  }

  if (isUserExists.googleId && isUserExists.authProvider === "GOOGLE") {
    throw new Error(
      "User registered with Google login. Please use Google login.",
    );
  }

  const key = `forgot-password-otp:${isUserExists.email}`;

  const redisOtp = await redisClient.get(key);

  if (!redisOtp) {
    throw new Error("OTP has expired or is invalid");
  }

  if (redisOtp !== otp) {
    throw new Error("Invalid OTP");
  }

  const hashedNewPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await prisma.user.update({
    where: {
      email: isUserExists.email,
    },
    data: {
      password: hashedNewPassword,
    },
    omit: {
      password: true,
    },
  });

  await redisClient.del([key]);

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/reset-password-success.ejs",
  );

  const templateData = {
    name: isUserExists.name,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.smtp_user,
    to: isUserExists.email,
    subject: "Password Changed",
    // text : `Your OTP is ${otp}`
    // html: `<h1>Your Password Is Changed</h1>`
    html,
  });
};

export const AuthService = {
  registerPatient,
  loginUser,
  getMe,
  refreshToken,
  googleLogin,
  forgotPassword,
  resetPassword,
  verifyPatientEmail,
};
