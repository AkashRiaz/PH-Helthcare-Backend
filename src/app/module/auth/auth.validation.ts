import z from "zod";

const PatientRegistrationZodSchema = z.object({
  name: z
    .string("Not a string!!!")
    .min(3, "Name must be at least 3 characters long")
    .max(10, "Name must be at most 10 characters long"),
  email: z.email("Not a valid email!!!"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, {
      message: "Password must contain at least one uppercase letter",
    })
    .regex(/[a-z]/, {
      message: "Password must contain at least one lowercase letter",
    })
    .regex(/[0-9]/, { message: "Password must contain at least one number" })
    .regex(/[^A-Za-z0-9]/, {
      message: "Password must contain at least one special character",
    }),
  patient: z
    .object({
      contactNumber: z.string().optional(),
    })
    .optional(),
});

const LoginZodSchema = z.object({
  email: z.email("Not a valid email!!!"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, {
      message: "Password must contain at least one uppercase letter",
    })
    .regex(/[a-z]/, {
      message: "Password must contain at least one lowercase letter",
    })
    .regex(/[0-9]/, { message: "Password must contain at least one number" })
    .regex(/[^A-Za-z0-9]/, {
      message: "Password must contain at least one special character",
    }),
});

export const PatientValidation = {
  PatientRegistrationZodSchema,
  LoginZodSchema,
};
