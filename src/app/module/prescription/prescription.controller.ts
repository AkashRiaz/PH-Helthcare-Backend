import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { PrescriptionService } from "./prescription.service";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";

const createPrescription = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const user = req.user!;

  const result = await PrescriptionService.createPrescription(payload, user);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Prescription Created And Emailed To Patient Successfully",
    data: result,
  });
});

const getSinglePrescription = catchAsync(
  async (req: Request, res: Response) => {
    const appointmentId = req.params.appointmentId as string;
    const user = req.user!;

    const result = await PrescriptionService.getSinglePrescription(
      appointmentId,
      user,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Prescription Retrieved Successfully",
      data: result,
    });
  },
);

export const PrescriptionController = {
  createPrescription,
  getSinglePrescription,
};
