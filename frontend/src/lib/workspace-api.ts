const apiUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export type TicketStatus = "Open" | "Triaged" | "In Progress" | "In Review" | "Resolved" | "Closed";
export type TicketPriority = "Low" | "Medium" | "High" | "Urgent";
export type ApiTicketStatus = "OPEN" | "TRIAGED" | "IN_PROGRESS" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
export type ApiTicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type Project = {
  id: string;
  key: string;
  name: string;
  ticketCount: number;
};

export type Ticket = {
  id: string;
  key: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  labels: string[];
  githubUrl: string | null;
  createdAt: string;
  updatedAt: string;
  project: Pick<Project, "id" | "key" | "name">;
  reporter: { id: string; name: string; email: string };
  assignee: { id: string; name: string; email: string } | null;
  comments: { id: string; body: string; createdAt: string; author: { id: string; name: string } }[];
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: string;
  activeTickets: number;
  resolvedTickets: number;
};
export type Workspace = { id: string; name: string; role: "OWNER" | "ADMIN" | "MEMBER" };
export type Profile = { id: string; name: string; email: string; createdAt?: string };

export type Activity = {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
  actor: { id: string; name: string };
  ticket: { id: string; ticketKey: string; title: string } | null;
};

export type Dashboard = {
  totals: { tickets: number; open: number; inProgress: number; resolved: number; projects: number };
  recentTickets: Ticket[];
  recentActivity: Activity[];
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
        message = body.error;
      }
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const dashboardKey = ["workspace", "dashboard"] as const;
export const projectsKey = ["workspace", "projects"] as const;
export const ticketsKey = ["workspace", "tickets"] as const;
export const teamKey = ["workspace", "team"] as const;
export const activityKey = ["workspace", "activity"] as const;
export const workspaceKey = ["workspace", "current"] as const;
export const profileKey = ["profile"] as const;

export const api = {
  workspace: () => apiRequest<Workspace>("/workspace"),
  profile: () => apiRequest<{ user: Profile }>("/profile"),
  updateProfile: (name: string) => apiRequest<{ user: Profile }>("/profile", {
    method: "PATCH",
    body: JSON.stringify({ name }),
  }),
  dashboard: () => apiRequest<Dashboard>("/dashboard"),
  projects: () => apiRequest<{ projects: Project[] }>("/projects"),
  createProject: (input: { name: string; key: string }) => apiRequest<{ project: Project }>("/projects", {
    method: "POST",
    body: JSON.stringify(input),
  }),
  tickets: (filters: Record<string, string> = {}) => {
    const query = new URLSearchParams(filters);
    return apiRequest<{ tickets: Ticket[] }>(`/tickets${query.size ? `?${query}` : ""}`);
  },
  ticket: async (id: string) => (await apiRequest<{ ticket: Ticket }>(`/tickets/${encodeURIComponent(id)}`)).ticket,
  createTicket: (input: {
    projectId: string;
    title: string;
    description: string;
    priority: ApiTicketPriority;
    labels: string[];
    githubUrl?: string;
  }) => apiRequest<{ ticket: Ticket }>("/tickets", { method: "POST", body: JSON.stringify(input) }),
  updateTicket: (id: string, input: {
    status?: ApiTicketStatus;
    priority?: ApiTicketPriority;
    assigneeId?: string | null;
  }) => apiRequest<{ ticket: Ticket }>(`/tickets/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),
  addComment: (id: string, body: string) => apiRequest<{ comment: Ticket["comments"][number] }>(
    `/tickets/${encodeURIComponent(id)}/comments`,
    { method: "POST", body: JSON.stringify({ body }) },
  ),
  team: () => apiRequest<{ members: TeamMember[] }>("/team"),
  updateMemberRole: (userId: string, role: TeamMember["role"]) => apiRequest<{ member: { userId: string; role: TeamMember["role"] } }>(
    `/team/${encodeURIComponent(userId)}/role`,
    { method: "PATCH", body: JSON.stringify({ role }) },
  ),
  activity: (limit = 50) => apiRequest<{ activities: Activity[] }>(`/activity?limit=${limit}`),
  askAssistant: (question: string) => apiRequest<{ answer: string; references: { key: string; title: string }[] }>(
    "/assistant",
    { method: "POST", body: JSON.stringify({ question }) },
  ),
};

export { apiRequest };
