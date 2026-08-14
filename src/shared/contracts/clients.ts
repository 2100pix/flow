import * as z from "zod";

export const clientStatusSchema = z.enum(["active", "inactive"]);

export const createClientSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

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
