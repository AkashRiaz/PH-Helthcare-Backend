import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ScheduleService } from "./schedule.service";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { RequestUser } from "../../middleware/checkAuth";

const createSchedule = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
    const user = req.user as RequestUser;

    const result = await ScheduleService.createSchedule(payload, user);
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Schedule Created Successfully",
      data: result,
    });
  },
);

const getScheduleById = catchAsync(async (req: Request, res: Response) => {
  const scheduleId = req.params.scheduleId as string;

  const result = await ScheduleService.getScheduleById(scheduleId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule Retrieved Successfully",
    data: result,
  });
});

const getMySchedules = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as RequestUser;

  const { data, meta } = await ScheduleService.getMySchedules(req.query, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedules Retrieved Successfully",
    data,
    meta,
  });
});

const getAllSchedules = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await ScheduleService.getAllSchedules(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedules Retrieved Successfully",
    data,
    meta,
  });
});

const getTodaysSchedules = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await ScheduleService.getTodaysSchedules(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Today's Schedules Retrieved Successfully",
    data,
    meta,
  });
});

const updateSchedule = catchAsync(async (req: Request, res: Response) => {
  const scheduleId = req.params.scheduleId as string;
  const payload = req.body;
  const user = req.user as RequestUser;

  const result = await ScheduleService.updateSchedule(
    scheduleId,
    payload,
    user,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule Updated Successfully",
    data: result,
  });
});

const publishSchedule = catchAsync(async (req: Request, res: Response) => {
  const scheduleId = req.params.scheduleId as string;
  const user = req.user as RequestUser;

  const result = await ScheduleService.publishSchedule(scheduleId, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule Published Successfully",
    data: result,
  });
});

const deleteSchedule = catchAsync(async (req: Request, res: Response) => {
  const scheduleId = req.params.scheduleId as string;
  const user = req.user as RequestUser;

  const result = await ScheduleService.deleteSchedule(scheduleId, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule Deleted Successfully",
    data: result,
  });
});

export const ScheduleController = {
  createSchedule,
  getMySchedules,
  getAllSchedules,
  getTodaysSchedules,
  updateSchedule,
  publishSchedule,
  deleteSchedule,
  getScheduleById,
};
