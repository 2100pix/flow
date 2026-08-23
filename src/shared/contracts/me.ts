import * as z from "zod";

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).nullable(),
  lastName: z.string().trim().min(1).max(80).nullable(),
  timeZone: z.string().trim().min(1).max(100).nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export type ProfileExpertiseItem = {
  id: string;

  name: string;
};

export type UserProfileDto = {
  id: string;

  displayName: string;

  avatarUrl: string | null;

  firstName: string | null;

  lastName: string | null;

  timeZone: string | null;

  expertise: ProfileExpertiseItem[];
};

export type UpdateProfileResponse = {
  data: UserProfileDto;
};
