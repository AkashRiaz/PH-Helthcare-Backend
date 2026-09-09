import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";
import { CreatePrescriptionValidationZodSchema } from "./prescription.validation";
import { PrescriptionController } from "./prescription.controller";

const router = Router();

router.post(
  "/create-prescription",
  auth(Role.DOCTOR),
  validateRequest(CreatePrescriptionValidationZodSchema),
  PrescriptionController.createPrescription,
);

router.get(
  "/:appointmentId",
  auth(Role.PATIENT, Role.DOCTOR, Role.ADMIN, Role.SUPER_ADMIN),
  PrescriptionController.getSinglePrescription,
);

export const PrescriptionRoutes = router;
