import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { DoctorService } from "./doctor.service";
import { RequestUser } from "../../middleware/checkAuth";
import { ApplyAsDoctorValidationZodSchema } from "./doctor.validation";

const applyAsDoctor = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const files = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };

    const resume = files?.resume?.[0] ? files.resume[0] : null;
    const additionalFiles = files?.additionalFiles || [];
    const zodValidationResult = ApplyAsDoctorValidationZodSchema.safeParse(
      req.body.data ? JSON.parse(req.body.data) : {},
    );

    if (!zodValidationResult.success) {
      throw new Error(
        zodValidationResult.error.issues
          .map((issue) => issue.message)
          .join(", "),
      );
    }

    const payload = zodValidationResult.data;

    const result = await DoctorService.applyAsDoctor(
      payload,
      resume,
      additionalFiles,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message:
        "Doctor Application Submitted Successfully And Otp Sent To Your Email",
      data: result,
    });
  },
);

const verifyDoctorEmail = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
    const result = await DoctorService.verifyDoctorEmail(payload);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Doctor Email Verified Successfully",
      data: result,
    });
  },
);

const approvedDoctor = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
    const reviewer = req.user;
    const result = await DoctorService.approvedDoctor(
      payload,
      reviewer as RequestUser,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Doctor Approved Successfully",
      data: result,
    });
  },
);

const getAllDoctors = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await DoctorService.getAllDoctors(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Doctors Retrieved Successfully",
    data: data,
    meta: meta,
  });
});

const updateDoctorProfile = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const user = req.user as RequestUser;

  const result = await DoctorService.updateDoctorProfile(payload, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Doctor Profile Updated Successfully",
    data: result,
  });
});

const getAvailableDoctorByTodaysSchedule = catchAsync(
  async (req: Request, res: Response) => {
    const { data, meta } =
      await DoctorService.getAvailableDoctorByTodaysSchedule(req.query);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Today's Available Doctors Retrieved Successfully",
      data,
      meta,
    });
  },
);

const getAllDoctorsListPublic = catchAsync(
  async (req: Request, res: Response) => {
    const { data, meta } = await DoctorService.getAllDoctorsListPublic(
      req.query,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Doctors Retrieved Successfully",
      data,
      meta,
    });
  },
);

const getSingleDoctorPublicProfile = catchAsync(
  async (req: Request, res: Response) => {
    const doctorId = req.params.doctorId as string;

    const result = await DoctorService.getSingleDoctorPublicProfile(doctorId);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Doctor Profile Retrieved Successfully",
      data: result,
    });
  },
);

export const DoctorController = {
  applyAsDoctor,
  verifyDoctorEmail,
  approvedDoctor,
  getAllDoctors,
  updateDoctorProfile,
  getAvailableDoctorByTodaysSchedule,
  getAllDoctorsListPublic,
  getSingleDoctorPublicProfile,
};
