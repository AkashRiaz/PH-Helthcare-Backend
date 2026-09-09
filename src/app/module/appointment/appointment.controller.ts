import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { AppointmentService } from "./appointment.service";
import { RequestUser } from "../../middleware/checkAuth";

const bookAppointment = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
    const user = req.user;
    const result = await AppointmentService.bookAppointment(
      payload,
      user as RequestUser,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Appointment booked successfully",
      data: result,
    });
  },
);

const payAppointment = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
    const user = req.user;
    const result = await AppointmentService.payAppointment(
      payload,
      user as RequestUser,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Appointment payment initiated successfully",
      data: result,
    });
  },
);

const bookAppointmentCallback = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { redirectURL } = await AppointmentService.bookAppointmentCallback(
      req.query as Record<string, any>,
    );

    res.redirect(redirectURL);
  },
);

const cancelAppointment = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
    const user = req.user;
    const result = await AppointmentService.cancelAppointment(
      payload,
      user as RequestUser,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Appointment canceled successfully",
      data: result,
    });
  },
);

const updateAppointmentStatus = catchAsync(
  async (req: Request, res: Response) => {
    const appointmentId = req.params.appointmentId as string;
    const payload = req.body;
    const user = req.user as RequestUser;

    const result = await AppointmentService.updateAppointmentStatus(
      appointmentId,
      payload,
      user,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Appointment Status Updated Successfully",
      data: result,
    });
  },
);

const getMyAppointments = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as RequestUser;

  const { data, meta } = await AppointmentService.getMyAppointments(
    req.query,
    user,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Appointments Retrieved Successfully",
    data,
    meta,
  });
});

const getDoctorAppointments = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as RequestUser;

    const { data, meta } = await AppointmentService.getDoctorAppointments(
      req.query,
      user,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Appointments Retrieved Successfully",
      data,
      meta,
    });
  },
);

const getAllAppointments = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await AppointmentService.getAllAppointments(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Appointments Retrieved Successfully",
    data,
    meta,
  });
});

const getSingleAppointment = catchAsync(async (req: Request, res: Response) => {
  const appointmentId = req.params.appointmentId as string;
  const user = req.user as RequestUser;

  const result = await AppointmentService.getSingleAppointment(
    appointmentId,
    user,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Appointment Retrieved Successfully",
    data: result,
  });
});

export const AppointmentController = {
  bookAppointment,
  payAppointment,
  bookAppointmentCallback,
  cancelAppointment,
  updateAppointmentStatus,
  getMyAppointments,
  getDoctorAppointments,
  getAllAppointments,
  getSingleAppointment,
};
