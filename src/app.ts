import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import z from "zod";

const app: Application = express();

app.use(
  cors({
    origin: config.frontend_url,
    credentials: true,
  }),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
// this is the main
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);

app.post("/zod", async (req: Request, res: Response, next: Function) => {
  try {
    const UserZodSchema = z.object({
      name: z.string(),
      email: z.email(),
      age: z.number().optional(),
      isVerified: z.boolean().optional(),
      books: z.array(z.string()).optional(),
    });

    const payload = req.body;

    const result = UserZodSchema.parse(payload);

    console.log("Zod validation result:", result);

    res.status(httpStatus.OK).json({
      success: true,
      data: result,
      message: "Welcome to PH Healthcare System Backend",
    });
  } catch (error) {
    console.error("Zod validation error:", error);
    next(error);
  }
});

// Basic route
app.get("/", async (req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    success: true,
    message: "Welcome to PH Healthcare System Backend",
  });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
