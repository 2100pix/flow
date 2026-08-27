import { useInfiniteQuery } from "@tanstack/react-query";
import { getTaskActivity } from "../api/task-activity";
import { taskQueryKey } from "./use-task";

export function taskActivityQueryKey(taskId: string | undefined) {
  return [...taskQueryKey(taskId), "activity"] as const;
}

export function useTaskActivity(taskId: string | undefined) {
  return useInfiniteQuery({
    queryKey: taskActivityQueryKey(taskId),

    queryFn: ({ pageParam }) => {
      if (!taskId) {
        throw new Error("Task ID is required");
      }

      return getTaskActivity(taskId, pageParam ?? null);
    },

    /*
     * SAFETY: getNextPageParam mengembalikan string | null,
     * jadi tipe page param infinite query adalah string | null;
     * null hanya digunakan sebagai halaman awal (tanpa cursor).
     */
    initialPageParam: null as string | null,

    getNextPageParam: (lastPage) => lastPage.nextCursor,

    enabled: Boolean(taskId),
  });
}
