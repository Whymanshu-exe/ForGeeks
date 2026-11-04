import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTickets, subscribeTicketStorageUpdates } from "./tickets";

export const ticketQueryKey = ["tickets"] as const;

export function useTickets() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ticketQueryKey, queryFn: getTickets });

  useEffect(
    () => subscribeTicketStorageUpdates(() => {
      void queryClient.invalidateQueries({ queryKey: ticketQueryKey });
    }),
    [queryClient],
  );

  return query;
}
