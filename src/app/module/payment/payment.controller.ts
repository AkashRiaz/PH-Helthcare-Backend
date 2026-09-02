import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentService } from "./payment.service";
import { RequestUser } from "../../middleware/checkAuth";
import httpStatus from "http-status";

const getMyPayments = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as RequestUser;

  const { data, meta } = await PaymentService.getMyPayments(req.query, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments Retrieved Successfully",
    data,
    meta,
  });
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await PaymentService.getAllPayments(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments Retrieved Successfully",
    data,
    meta,
  });
});

const getSinglePayment = catchAsync(async (req: Request, res: Response) => {
    const paymentId = req.params.paymentId as string;
    const user = req.user as RequestUser;

    const result = await PaymentService.getSinglePayment(paymentId, user);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Payment Retrieved Successfully",
        data: result,
    });
});

export const PaymentController = {
  getMyPayments,
  getSinglePayment,
  getAllPayments,
};
