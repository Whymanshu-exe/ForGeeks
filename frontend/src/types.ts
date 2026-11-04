export type TicketStatus =
  | "Open"
  | "Triaged"
  | "In Progress"
  | "In Review"
  | "Resolved"
  | "Closed";

export type TicketPriority = "Low" | "Medium" | "High" | "Urgent";

export interface TicketComment {
  author: string;
  initials: string;
  body: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  domain: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string;
  initials: string;
  createdAt: string;
  description: string;
  labels: string[];
  comments: TicketComment[];
  github?: string;
}

export interface TeamMember {
  name: string;
  username: string;
  role: string;
  domains: string[];
  activeTickets: number;
  resolved: number;
  initials: string;
  color: string;
}
