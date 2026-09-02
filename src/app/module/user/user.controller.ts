import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { UserService } from "./user.service";

const uploadProfileImage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId; 
   const result = await UserService.uploadProfileImage(req.file?.buffer as Buffer, userId as string);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Profile Image Uploaded Successfully",
      data: result,
    });
  },
);

export const UserController = {
  uploadProfileImage,
};
