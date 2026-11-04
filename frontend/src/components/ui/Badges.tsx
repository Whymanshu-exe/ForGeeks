import type { TicketPriority, TicketStatus } from "../../types";

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`status-badge status-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span className={`priority-badge priority-${priority.toLowerCase()}`}>
      <span className="priority-dot" />
      {priority}
    </span>
  );
}
