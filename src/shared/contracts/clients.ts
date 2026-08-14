import * as z from "zod";

export const clientStatusSchema = z.enum(["active", "inactive"]);

export const createClientSchema = z.object({
  name: z.string().trim().min(1).max(120),
});
export const updateClientSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),

    status: clientStatusSchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.status !== undefined, {
    message: "At least one field is required",
  });

export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export type ArchiveClientResponse = {
  data: {
    success: true;
  };
};
export type ClientStatus = z.infer<typeof clientStatusSchema>;

export type CreateClientInput = z.infer<typeof createClientSchema>;

export type ClientDto = {
  id: string;
  name: string;
  logoUrl: string | null;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
};

export type ClientsResponse = {
  data: ClientDto[];
};

export type ClientResponse = {
  data: ClientDto;
};
