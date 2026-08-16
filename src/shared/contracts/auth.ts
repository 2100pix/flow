export type PendingAccessStatus = "pending" | "approved" | "rejected";

export type PendingAccessStatusResponse = {
  data: {
    status: PendingAccessStatus;
  };
};

export type PendingAccessCompleteResponse = {
  data: {
    success: true;
  };
};
