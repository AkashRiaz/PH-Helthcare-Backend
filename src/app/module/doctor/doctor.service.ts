import {
  DoctorVerificationStatus,
  Role,
  ScheduleStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redisClient } from "../../lib/redis";
import path from "path";
import ejs from "ejs";
import { transporter } from "../../lib/nodemailer";
import {
  IApplyAsDoctorPayload,
  IApproveDoctorPayload,
  IUpdateDoctorProfilePayload,
  IVerifyDoctorEmailPayload,
} from "./doctor.interface";
import { RequestUser } from "../../middleware/checkAuth";
import { DoctorWhereInput } from "../../../generated/prisma/models";
import { IQuery } from "../../interfaces";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import { addDays, startOfDay } from "date-fns";

const applyAsDoctor = async (
  payload: IApplyAsDoctorPayload,
  resume: Express.Multer.File | null,
  additionalFiles: Express.Multer.File[],
) => {
  const isUserExist = await prisma.user.findUnique({
    where: { email: payload.user.email },
  });

  if (isUserExist) {
    throw new Error("User Already Exists With This Email");
  }

  // 2. Upload the new image to Cloudinary
  const resumeResult = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary upload failed"));
          return;
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      },
    );

    uploadStream.end(resume?.buffer);
  });

  const additionalFilesResults = await Promise.all(
    additionalFiles.map((file) => {
      return new Promise<{
        secure_url: string;
        public_id: string;
      }>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: "auto",
          },
          (error, result) => {
            if (error) {
              reject(error);
              return;
            }
            if (!result) {
              reject(new Error("Cloudinary upload failed"));
              return;
            }
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
            });
          },
        );
        uploadStream.end(file.buffer);
      });
    }),
  );
  const randomPassword = Math.random().toString(36).slice(-8);
  const hashedPassword = await bcrypt.hash(
    randomPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const doctorApplication = await prisma.user.create({
    data: {
      ...payload.user,
      password: hashedPassword,
      role: Role.DOCTOR,
      doctor: {
        create: {
          name: payload.user.name,
          email: payload.user.email,
          ...payload.doctor,
          resumeUrl: resumeResult?.secure_url,
          resumePublicId: resumeResult?.public_id,
          additionalFiles: additionalFilesResults.map((file) => ({
            secure_url: file.secure_url,
            public_id: file.public_id,
          })),
        },
      },
    },
    include: {
      doctor: true,
    },
  });

  const expirationSeconds = 60 * 60;
  const otpKey = `doctor-application:otp:${payload.user.email}`;
  const otpValue = crypto.randomInt(100000, 999999).toString();

  await redisClient.set(otpKey, otpValue, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/registration-user-otp.ejs",
  );

  const templateData = {
    name: payload.user.name,
    email: payload.user.email,
    otp: otpValue,
    expirationMinutes: expirationSeconds / 60,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.smtp_user,
    to: payload.user.email,
    subject: "Patient Registration OTP",
    html,
  });

  return doctorApplication;
};

const verifyDoctorEmail = async (payload: IVerifyDoctorEmailPayload) => {
  const { email, otp } = payload;

  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (!isUserExists) {
    throw new Error("User Not Found");
  }

  if (isUserExists?.status === "BLOCKED") {
    throw new Error("User is Blocked");
  }

  if (isUserExists?.emailVerified) {
    throw new Error("Email ALready Verified");
  }

  if (isUserExists?.isDeleted || isUserExists?.status === "DELETED") {
    throw new Error("User is Deleted");
  }

  const otpKey = `doctor-application:otp:${email}`;
  const storedOtp = await redisClient.get(otpKey);

  if (!storedOtp) {
    throw new Error("OTP has expired or is invalid");
  }

  if (storedOtp !== otp) {
    throw new Error("Invalid OTP");
  }

  await redisClient.del([otpKey]);

  const updatedUser = await prisma.user.update({
    where: {
      id: isUserExists?.id,
    },
    data: {
      emailVerified: true,
    },
  });

  return updatedUser;
};

const approvedDoctor = async (
  payload: IApproveDoctorPayload,
  reviewer: RequestUser,
) => {
  const { doctorId, verificationStatus, rejectionReason } = payload;

  const existingDoctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: { user: true },
  });

  if (!existingDoctor) {
    throw new Error("Doctor not found");
  }

  if (existingDoctor.isDeleted) {
    throw new Error("Doctor Application Has Been Deleted");
  }

  if (!existingDoctor.user.emailVerified) {
    throw new Error(
      "Doctor Has Not Verified Their Email Yet. Application Cannot Be Reviewed.",
    );
  }

  if (existingDoctor.verificationStatus !== DoctorVerificationStatus.PENDING) {
    throw new Error(
      `Doctor Application Has Already Been ${existingDoctor.verificationStatus.toLowerCase()}`,
    );
  }

  if (
    verificationStatus === DoctorVerificationStatus.REJECTED &&
    !rejectionReason
  ) {
    throw new Error(
      "Rejection Reason Is Required When Rejecting A Doctor Application",
    );
  }

  const updatedDoctor = await prisma.doctor.update({
    where: { id: doctorId },
    data: {
      verificationStatus,
      rejectionReason:
        verificationStatus === DoctorVerificationStatus.REJECTED
          ? rejectionReason
          : null,
      reviewedBy: reviewer.userId,
      reviewedAt: new Date(),
    },
  });

  const isApproved = verificationStatus === DoctorVerificationStatus.APPROVED;

  const templatePath = path.join(
    process.cwd(),
    `src/app/templates/${
      isApproved
        ? "doctor-application-approved.ejs"
        : "doctor-application-rejected.ejs"
    }`,
  );

  const templateData = {
    name: updatedDoctor.name,
    reason: updatedDoctor.rejectionReason,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.smtp_user,
    to: updatedDoctor.email,
    subject: isApproved
      ? "Your Doctor Application Has Been Approved"
      : "Your Doctor Application Has Been Rejected",
    html,
  });

  return updatedDoctor;
};

const getAllDoctors = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: DoctorWhereInput[] = [];

  //Searching
  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { email: { contains: query.searchTerm, mode: "insensitive" } },
        {
          specialization: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          licenseNumber: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  //filtering
  if (query.specialization) {
    andConditions.push({
      specialization: { equals: query.specialization, mode: "insensitive" },
    });
  }

  if (query.email) {
    andConditions.push({
      email: { contains: query.email, mode: "insensitive" },
    });
  }

  if (query.licenseNumber) {
    andConditions.push({
      licenseNumber: { equals: query.licenseNumber, mode: "insensitive" },
    });
  }

  if (query.verificationStatus) {
    andConditions.push({
      verificationStatus: query.verificationStatus as DoctorVerificationStatus,
    });
  }

  andConditions.push({ isDeleted: false });

  const allDoctors = await prisma.doctor.findMany({
    where: {
      AND: andConditions.length > 0 ? andConditions : undefined,
    },

    take: limit,
    skip: skip,

    orderBy: {
      // sortBy : sortOrder
      [sortBy]: sortOrder,
    },

    include: {
      user: {
        omit: {
          password: true,
        },
      },

      // schedules: true,
      // appointments: true
      // prescriptions: true
    },
  });

  const totalDoctorCount = await prisma.doctor.count({
    where: {
      AND: andConditions,
    },
  });

  return {
    data: allDoctors,
    meta: {
      page: page,
      limit: limit,
      total: totalDoctorCount,
      totalPages: Math.ceil(totalDoctorCount / limit),
    },
  };
};

const updateDoctorProfile = async (
  payload: IUpdateDoctorProfilePayload,
  user: RequestUser,
) => {
  const existingDoctor = await prisma.doctor.findUnique({
    where: { userId: user.userId },
  });

  if (!existingDoctor) {
    throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found");
  }

  const updatedDoctor = await prisma.doctor.update({
    where: { id: existingDoctor.id },
    data: payload,
  });

  return updatedDoctor;
};

const getAvailableDoctorByTodaysSchedule = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const now = new Date();
  const startOfToday = startOfDay(now);
  const startOfTomorrow = addDays(startOfToday, 1);

  const andConditions: DoctorWhereInput[] = [
    { isDeleted: false },
    { verificationStatus: DoctorVerificationStatus.APPROVED },
    {
      schedules: {
        some: {
          isDeleted: false,
          status: ScheduleStatus.PUBLISHED,
          availableSlots: { gt: 0 },
          startDateTime: {
            gte: startOfToday,
            lt: startOfTomorrow,
            gt: now,
          },
        },
      },
    },
  ];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { specialization: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (query.specialization) {
    andConditions.push({
      specialization: { equals: query.specialization, mode: "insensitive" },
    });
  }

  const availableDoctors = await prisma.doctor.findMany({
    where: {
      AND: andConditions,
    },

    take: limit,
    skip,

    orderBy: {
      [sortBy]: sortOrder,
    },

    select: {
      id: true,
      name: true,
      specialization: true,
      licenseNumber: true,
      qualifications: true,
      experienceYears: true,
      bio: true,
      consultationFee: true,
      createdAt: true,
      schedules: {
        where: {
          isDeleted: false,
          status: ScheduleStatus.PUBLISHED,
          availableSlots: { gt: 0 },
          startDateTime: {
            gte: startOfToday,
            lt: startOfTomorrow,
            gt: now,
          },
        },
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          startDateTime: true,
          endDateTime: true,
          availableSlots: true,
          totalSlots: true,
        },
      },
    },
  });

  const totalAvailableDoctorCount = await prisma.doctor.count({
    where: { AND: andConditions },
  });

  return {
    data: availableDoctors,
    meta: {
      page,
      limit,
      total: totalAvailableDoctorCount,
      totalPages: Math.ceil(totalAvailableDoctorCount / limit),
    },
  };
};

const getAllDoctorsListPublic = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: DoctorWhereInput[] = [
    { isDeleted: false },
    { verificationStatus: DoctorVerificationStatus.APPROVED },
  ];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { specialization: { contains: query.searchTerm, mode: "insensitive" } },
        { qualifications: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (query.specialization) {
    andConditions.push({
      specialization: { equals: query.specialization, mode: "insensitive" },
    });
  }

  const allDoctors = await prisma.doctor.findMany({
    where: {
      AND: andConditions,
    },

    take: limit,
    skip,

    orderBy: {
      [sortBy]: sortOrder,
    },

    select: {
      id: true,
      name: true,
      specialization: true,
      licenseNumber: true,
      qualifications: true,
      experienceYears: true,
      bio: true,
      consultationFee: true,
      createdAt: true,
    },
  });

  const totalDoctorCount = await prisma.doctor.count({
    where: { AND: andConditions },
  });

  return {
    data: allDoctors,
    meta: {
      page,
      limit,
      total: totalDoctorCount,
      totalPages: Math.ceil(totalDoctorCount / limit),
    },
  };
};

const getSingleDoctorPublicProfile = async (doctorId: string) => {
  const doctor = await prisma.doctor.findUnique({
    where: {
      id: doctorId,
      isDeleted: false,
      verificationStatus: DoctorVerificationStatus.APPROVED,
    },
    select: {
      id: true,
      name: true,
      specialization: true,
      licenseNumber: true,
      qualifications: true,
      experienceYears: true,
      bio: true,
      consultationFee: true,
      createdAt: true,
    },
  });

  if (!doctor) {
    throw new AppError(httpStatus.NOT_FOUND, "Doctor Not Found");
  }

  return doctor;
};

export const DoctorService = {
  applyAsDoctor,
  verifyDoctorEmail,
  approvedDoctor,
  getAllDoctors,
  updateDoctorProfile,
  getAllDoctorsListPublic,
  getSingleDoctorPublicProfile,
  getAvailableDoctorByTodaysSchedule,
};
