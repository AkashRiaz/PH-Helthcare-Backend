import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
  // 1. Get the existing user's Cloudinary public ID
  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      imagePublicId: true,
    },
  });

  // 2. Upload the new image to Cloudinary
  const cloudinaryResult = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary upload failed"));
          return;
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      },
    );

    uploadStream.end(buffer);
  });

  // 3. Delete the old image from Cloudinary
  if (existingUser?.imagePublicId) {
    await cloudinary.uploader.destroy(existingUser.imagePublicId);
  }

  // 4. Update database with the new image
  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      imageUrl: cloudinaryResult.secure_url,
      imagePublicId: cloudinaryResult.public_id,
    },
  });

  return updatedUser;
};

export const UserService = {
  uploadProfileImage,
};
