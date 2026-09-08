import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AuthController } from "./auth.controller";
import { PatientValidation } from "./auth.validation";
import { validateRequest } from "../../middleware/validateRequest";

const router = Router();


router.post(
  "/register",
  validateRequest(PatientValidation.PatientRegistrationZodSchema),
  AuthController.registerPatient,
);
router.post("/login", validateRequest(PatientValidation.LoginZodSchema), AuthController.loginUser);
router.post("/google", AuthController.googleLogin);
router.get(
  "/me",
  auth(Role.ADMIN, Role.DOCTOR, Role.PATIENT, Role.SUPER_ADMIN),
  AuthController.getMe,
);
router.post("/refresh-token", AuthController.refreshToken);

export const AuthRoutes = router;
