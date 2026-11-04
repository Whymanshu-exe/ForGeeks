import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  CircleHelp,
  CircleDot,
  Clock3,
  ExternalLink,
  GitBranch,
  Layers3,
  MessageCircle,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Ticket as TicketIcon,
  Users,
} from "lucide-react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { Avatar } from "../components/ui/Avatar";
import { PageHeading } from "../components/ui/PageHeading";
import { useCurrentUser } from "../lib/auth";
import {
  activityKey,
  api,
  dashboardKey,
  projectsKey,
  teamKey,
  ticketsKey,
  workspaceKey,
  type Activity,
  type ApiTicketPriority,
  type ApiTicketStatus,
  type Project,
  type TeamMember,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
} from "../lib/workspace-api";

const ticketStatuses: TicketStatus[] = ["Open", "Triaged", "In Progress", "In Review", "Resolved", "Closed"];
const priorities: TicketPriority[] = ["Low", "Medium", "High", "Urgent"];
const statusToApi: Record<TicketStatus, ApiTicketStatus> = {
  Open: "OPEN",
  Triaged: "TRIAGED",
  "In Progress": "IN_PROGRESS",
  "In Review": "IN_REVIEW",
  Resolved: "RESOLVED",
  Closed: "CLOSED",
};
const priorityToApi: Record<TicketPriority, ApiTicketPriority> = {
  Low: "LOW",
  Medium: "MEDIUM",
  High: "HIGH",
  Urgent: "URGENT",
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "?";
}

function LoadingPanel({ label = "Loading workspace…" }: { label?: string }) {
  return <div className="loading-panel"><span className="spinner" />{label}</div>;
}

function ErrorPanel({ error, retry }: { error: Error; retry: () => void }) {
  const needsWorkspaceMembership = error.message === "You are not a member of this workspace";
  return (
    <div className="empty-panel" role="alert">
      <div className="empty-icon"><CircleHelp size={20} /></div>
      <strong>{needsWorkspaceMembership ? "Your account needs workspace access" : "We couldn’t load this view"}</strong>
      {needsWorkspaceMembership ? (
        <>
          <p>Sign in with GitHub at least once, then run this from the backend folder using your verified GitHub email:</p>
          <code>npm run seed:admin -- --email="your-verified-github-email"</code>
          <p>Once the owner is set up, select Try again. If someone else manages the workspace, ask them to grant your account access.</p>
        </>
      ) : <p>{error.message}</p>}
      <button className="button button-secondary" onClick={retry}>Try again</button>
    </div>
  );
}

function EmptyPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="empty-panel">
      <div className="empty-icon"><CircleHelp size={20} /></div>
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

function TicketTable({ tickets }: { tickets: Ticket[] }) {
  if (!tickets.length) return <EmptyPanel title="No tickets yet" message="Create the first ticket in this workspace to start tracking work." />;
  return (
    <div className="table-scroll">
      <table className="ticket-table">
        <thead><tr><th>Ticket</th><th>Project</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Created</th></tr></thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td className="ticket-title-cell"><Link to={`/tickets/${ticket.key}`} className="ticket-title-link"><span className="ticket-id">{ticket.key}</span><strong>{ticket.title}</strong></Link></td>
              <td><span className="domain-cell"><i />{ticket.project.name}</span></td>
              <td><span className={`priority-badge priority-${ticket.priority.toLowerCase()}`}><i className="priority-dot" />{ticket.priority}</span></td>
              <td><span className={`status-badge status-${ticket.status.toLowerCase().replaceAll(" ", "-")}`}>{ticket.status}</span></td>
              <td><span className="assignee-cell"><Avatar initials={ticket.assignee ? initials(ticket.assignee.name) : "?"} tone={ticket.assignee ? "mint" : "neutral"} />{ticket.assignee?.name || "Unassigned"}</span></td>
              <td className="date-cell">{new Date(ticket.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TicketCreateForm({ projects, onClose }: { projects: Project[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const createMutation = useMutation({
    mutationFn: api.createTicket,
    onSuccess: async ({ ticket }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketsKey }),
        queryClient.invalidateQueries({ queryKey: dashboardKey }),
        queryClient.invalidateQueries({ queryKey: projectsKey }),
        queryClient.invalidateQueries({ queryKey: activityKey }),
      ]);
      onClose();
      window.location.assign(`/tickets/${ticket.key}`);
    },
    onError: (reason: Error) => setError(reason.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const githubUrl = String(form.get("githubUrl") || "").trim();
    createMutation.mutate({
      projectId: String(form.get("projectId")),
      title: String(form.get("title") || "").trim(),
      description: String(form.get("description") || "").trim(),
      priority: String(form.get("priority") || "MEDIUM") as ApiTicketPriority,
      labels: String(form.get("labels") || "").split(",").map((label) => label.trim()).filter(Boolean),
      ...(githubUrl ? { githubUrl } : {}),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-ticket-title" onSubmit={submit}>
        <div className="modal-heading"><div><h2 id="create-ticket-title">Create a ticket</h2><p>Tickets are saved in your workspace.</p></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}>×</button></div>
        {projects.length === 0 ? <EmptyPanel title="No project available" message="Ask a workspace owner to create a project before adding tickets." /> : <>
          <div className="form-field"><label htmlFor="create-project">Project</label><select id="create-project" name="projectId" required>{projects.map((project) => <option value={project.id} key={project.id}>{project.name} ({project.key})</option>)}</select></div>
          <div className="form-field"><label htmlFor="create-title">Title</label><input id="create-title" name="title" minLength={5} maxLength={120} required /></div>
          <div className="form-field"><label htmlFor="create-description">Description</label><textarea id="create-description" name="description" rows={4} maxLength={5000} /></div>
          <div className="form-grid">
            <div className="form-field"><label htmlFor="create-priority">Priority</label><select id="create-priority" name="priority">{priorities.map((priority) => <option key={priority} value={priorityToApi[priority]}>{priority}</option>)}</select></div>
            <div className="form-field"><label htmlFor="create-labels">Labels <span>Comma-separated</span></label><input id="create-labels" name="labels" placeholder="bug, backend" /></div>
          </div>
          <div className="form-field"><label htmlFor="create-github-url">GitHub issue or PR URL <span>Optional</span></label><input id="create-github-url" name="githubUrl" type="url" /></div>
        </>}
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={createMutation.isPending || !projects.length}>{createMutation.isPending ? "Creating…" : "Create ticket"}</button></div>
      </form>
    </div>
  );
}

export function DashboardPage() {
  const { data: user } = useCurrentUser();
  const query = useQuery({ queryKey: dashboardKey, queryFn: api.dashboard });
  if (query.isPending) return <LoadingPanel />;
  if (query.isError) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  const { totals, recentTickets, recentActivity } = query.data;
  const cards = [
    { label: "Total tickets", count: totals.tickets, detail: "Across all projects", icon: TicketIcon, tone: "green" },
    { label: "Open tickets", count: totals.open, detail: "Ready to be picked up", icon: CircleDot, tone: "blue" },
    { label: "In progress", count: totals.inProgress, detail: "Currently being worked on", icon: Clock3, tone: "amber" },
    { label: "Resolved", count: totals.resolved, detail: "Completed successfully", icon: CheckCircle2, tone: "purple" },
  ];
  return (
    <>
      <div className="welcome-strip"><div><div className="welcome-eyebrow"><span className="welcome-spark"><ShieldCheck size={13} /></span> GFG RBU WORKSPACE</div><h1>Welcome, {user?.name.trim().split(/\s+/)[0] || "there"}</h1><p>Here’s what’s happening across your workspace.</p></div><div className="welcome-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-card"><TicketIcon size={18} /><span>Your work, in focus</span></div><i className="art-dot art-dot-one" /><i className="art-dot art-dot-two" /></div></div>
      <div className="summary-cards">{cards.map(({ label, count, detail, icon: Icon, tone }) => <section className={`panel summary-card summary-${tone}`} key={label}><div className="summary-card-top"><span>{label}</span><i><Icon size={17} strokeWidth={1.8} /></i></div><strong>{count}</strong><small>{detail}</small></section>)}</div>
      <div className="dashboard-grid">
        <section className="panel recent-panel"><div className="panel-heading"><div><h2>Recent tickets</h2><p>Recently updated workspace work</p></div><Link className="text-button" to="/tickets">View all <ArrowRight size={15} /></Link></div><TicketTable tickets={recentTickets} /></section>
        <section className="panel progress-panel"><div className="panel-heading"><div><h2>Projects</h2><p>Active workspace projects</p></div></div><div className="progress-summary"><strong>{totals.projects}</strong><span>projects</span></div></section>
        <section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Latest workspace updates</p></div><Link className="text-button" to="/activity">See activity <ArrowRight size={15} /></Link></div>{recentActivity.length ? <ActivityList activities={recentActivity} /> : <p className="muted-copy">No activity yet.</p>}</section>
      </div>
    </>
  );
}

export function TicketsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [sortNewest, setSortNewest] = useState(true);
  const mine = searchParams.get("mine") === "1";
  const queryText = searchParams.get("q") || "";
  const projectId = searchParams.get("projectId") || "";
  const assigneeId = searchParams.get("assigneeId") || "";
  const createOpen = searchParams.get("create") === "1";
  const projectQuery = useQuery({ queryKey: projectsKey, queryFn: api.projects });
  const teamQuery = useQuery({ queryKey: teamKey, queryFn: api.team });
  const ticketFilters = useMemo(() => ({
    ...(queryText ? { q: queryText } : {}),
    ...(projectId ? { projectId } : {}),
    ...(assigneeId ? { assigneeId } : {}),
    ...(status ? { status: statusToApi[status as TicketStatus] } : {}),
    ...(priority ? { priority: priorityToApi[priority as TicketPriority] } : {}),
    ...(mine ? { mine: "true" } : {}),
    sort: sortNewest ? "newest" : "oldest",
  }), [assigneeId, mine, priority, projectId, queryText, sortNewest, status]);
  const query = useQuery({ queryKey: [...ticketsKey, ticketFilters], queryFn: () => api.tickets(ticketFilters) });

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  function toggleCreate() {
    updateParam("create", createOpen ? "" : "1");
    if (createOpen) {
      void queryClient.invalidateQueries({ queryKey: ticketsKey });
    }
  }

  return (
    <>
      <PageHeading eyebrow="WORKSPACE / TICKETS" title={mine ? "My tickets" : "All tickets"} description="Create, search, and track work in your workspace." action={<button className="button button-primary" onClick={toggleCreate}><Plus size={16} /> New ticket</button>} />
      {projectQuery.isError && <ErrorPanel error={projectQuery.error} retry={() => void projectQuery.refetch()} />}
      <section className="panel tickets-panel">
        <div className="list-toolbar"><div className="list-toolbar-title"><strong>Tickets</strong>{query.data && <span>{query.data.tickets.length} results</span>}</div><div className="ticket-filters">
          <label className="table-search"><Search size={15} /><input placeholder="Search tickets…" value={queryText} onChange={(event) => updateParam("q", event.target.value)} aria-label="Search tickets" /></label>
          <select aria-label="Filter by project" value={projectId} onChange={(event) => updateParam("projectId", event.target.value)}><option value="">All projects</option>{projectQuery.data?.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
          <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{ticketStatuses.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Filter by priority" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All priorities</option>{priorities.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Filter by assignee" value={assigneeId} onChange={(event) => updateParam("assigneeId", event.target.value)}><option value="">All assignees</option>{teamQuery.data?.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
          <button type="button" className="icon-button sort-button" aria-label={`Sort by creation date, ${sortNewest ? "newest" : "oldest"} first`} onClick={() => setSortNewest((value) => !value)}><ArrowDown size={16} style={{ transform: sortNewest ? undefined : "rotate(180deg)" }} /></button>
        </div></div>
        {query.isPending ? <LoadingPanel /> : query.isError ? <ErrorPanel error={query.error} retry={() => void query.refetch()} /> : <TicketTable tickets={query.data.tickets} />}
      </section>
      {createOpen && (projectQuery.isPending ? <LoadingPanel label="Loading projects…" /> : projectQuery.isError ? <ErrorPanel error={projectQuery.error} retry={() => void projectQuery.refetch()} /> : <TicketCreateForm projects={projectQuery.data.projects} onClose={toggleCreate} />)}
    </>
  );
}

export function TicketDetailPage() {
  const { ticketId = "" } = useParams();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState("");
  const query = useQuery({ queryKey: [...ticketsKey, ticketId], queryFn: () => api.ticket(ticketId) });
  const teamQuery = useQuery({ queryKey: teamKey, queryFn: api.team });
  const mutation = useMutation({
    mutationFn: (input: { status?: ApiTicketStatus; priority?: ApiTicketPriority; assigneeId?: string | null }) => api.updateTicket(ticketId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketsKey }),
        queryClient.invalidateQueries({ queryKey: dashboardKey }),
        queryClient.invalidateQueries({ queryKey: activityKey }),
      ]);
      setNotice("Ticket updated.");
    },
    onError: (error: Error) => setNotice(error.message),
  });
  const commentMutation = useMutation({
    mutationFn: (body: string) => api.addComment(ticketId, body),
    onSuccess: async () => {
      setComment("");
      setNotice("Comment added.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...ticketsKey, ticketId] }),
        queryClient.invalidateQueries({ queryKey: activityKey }),
      ]);
    },
    onError: (error: Error) => setNotice(error.message),
  });

  if (query.isPending) return <LoadingPanel />;
  if (query.isError) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  const ticket = query.data;
  return (
    <>
      <Link to="/tickets" className="back-link"><ArrowLeft size={16} /> Back to tickets</Link>
      <div className="detail-heading"><div><div className="detail-id">{ticket.key} · {ticket.project.name}</div><h1>{ticket.title}</h1></div></div>
      {notice && <div className="toast-message" role="status">{notice}</div>}
      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel detail-description"><div className="panel-heading"><div><h2>Description</h2><p>Ticket details</p></div></div><p className="description-copy">{ticket.description || "No description."}</p><div className="label-row">{ticket.labels.map((label) => <span className="label-chip" key={label}>{label}</span>)}</div><div className="ticket-meta-line"><span>Created {new Date(ticket.createdAt).toLocaleString()}</span><span>Reported by {ticket.reporter.name}</span></div></section>
          <section className="panel discussion-panel"><div className="panel-heading"><div><h2>Discussion</h2><p>{ticket.comments.length} comments</p></div><MessageCircle size={18} className="muted-icon" /></div>
            <div className="comment-list">{ticket.comments.length ? ticket.comments.map((item) => <div className="comment-item" key={item.id}><Avatar initials={initials(item.author.name)} /><div className="comment-content"><div><strong>{item.author.name}</strong><span>{new Date(item.createdAt).toLocaleString()}</span></div><p>{item.body}</p></div></div>) : <p className="muted-copy comment-empty">No comments yet.</p>}</div>
            <form className="comment-form" onSubmit={(event) => { event.preventDefault(); if (comment.trim()) commentMutation.mutate(comment.trim()); }}><Avatar initials="ME" /><textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={4000} rows={2} placeholder="Write a comment…" aria-label="Write a comment" /><button className="button button-primary send-comment" type="submit" disabled={!comment.trim() || commentMutation.isPending}><Send size={15} /> Send</button></form>
          </section>
        </div>
        <aside className="detail-sidebar"><section className="panel properties-panel"><div className="panel-heading"><div><h2>Properties</h2></div><Layers3 size={17} className="muted-icon" /></div>
          <div className="property-field"><label htmlFor="ticket-status">Status</label><select id="ticket-status" value={ticket.status} disabled={mutation.isPending} onChange={(event) => mutation.mutate({ status: statusToApi[event.target.value as TicketStatus] })}>{ticketStatuses.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="property-field"><label htmlFor="ticket-priority">Priority</label><select id="ticket-priority" value={ticket.priority} disabled={mutation.isPending} onChange={(event) => mutation.mutate({ priority: priorityToApi[event.target.value as TicketPriority] })}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="property-field"><label htmlFor="ticket-assignee">Assignee</label><select id="ticket-assignee" value={ticket.assignee?.id || ""} disabled={mutation.isPending || teamQuery.isPending} onChange={(event) => mutation.mutate({ assigneeId: event.target.value || null })}><option value="">Unassigned</option>{teamQuery.data?.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
          {teamQuery.isError && <p className="inline-error">{teamQuery.error.message}</p>}
          <div className="property-field"><label>Reporter</label><span>{ticket.reporter.name}</span></div>
        </section>
        <section className="panel links-panel"><div className="panel-heading"><div><h2>Development link</h2></div><GitBranch size={17} className="muted-icon" /></div>{ticket.githubUrl ? <a href={ticket.githubUrl} target="_blank" rel="noreferrer" className="github-link"><GitBranch size={15} /><span><strong>{ticket.githubUrl}</strong></span><ExternalLink size={14} /></a> : <p className="muted-copy">No GitHub reference.</p>}</section>
        {mutation.isError && <p className="inline-error" role="alert">{mutation.error.message}</p>}
      </aside>
      </div>
    </>
  );
}

export function TeamPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: teamKey, queryFn: api.team });
  const workspaceQuery = useQuery({ queryKey: workspaceKey, queryFn: api.workspace });
  const [filter, setFilter] = useState("");
  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TeamMember["role"] }) => api.updateMemberRole(userId, role),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: teamKey }),
        queryClient.invalidateQueries({ queryKey: activityKey }),
      ]);
    },
  });
  if (query.isPending || workspaceQuery.isPending) return <LoadingPanel />;
  if (query.isError) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  if (workspaceQuery.isError) return <ErrorPanel error={workspaceQuery.error} retry={() => void workspaceQuery.refetch()} />;
  const members = query.data.members.filter((member) => `${member.name} ${member.email} ${member.role}`.toLowerCase().includes(filter.toLowerCase()));
  const canManageRoles = workspaceQuery.data.role === "OWNER" || workspaceQuery.data.role === "ADMIN";
  return (
    <>
      <PageHeading eyebrow="WORKSPACE / PEOPLE" title="Team members" description="Workspace members, roles, and ticket contributions." />
      <div className="ticket-filters" style={{ marginBottom: 16 }}><label className="table-search"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search members…" aria-label="Search members" /></label></div>
      {roleMutation.isError && <p className="inline-error" role="alert">{roleMutation.error.message}</p>}
      {members.length ? <div className="team-grid">{members.map((member) => <article className="team-card" key={member.id}><div className="team-card-top"><Avatar initials={initials(member.name)} className="avatar-large" />{canManageRoles ? <select aria-label={`Role for ${member.name}`} value={member.role} disabled={roleMutation.isPending || (member.role === "OWNER" && workspaceQuery.data.role !== "OWNER")} onChange={(event) => roleMutation.mutate({ userId: member.id, role: event.target.value as TeamMember["role"] })}><option value="MEMBER">Member</option><option value="ADMIN">Admin</option>{(workspaceQuery.data.role === "OWNER" || member.role === "OWNER") && <option value="OWNER">Owner</option>}</select> : <span className="role-pill">{member.role}</span>}</div><h2>{member.name}</h2><span className="team-username">{member.email}</span><div className="member-stats"><div><strong>{member.activeTickets}</strong><span>Active tickets</span></div><div><strong>{member.resolvedTickets}</strong><span>Resolved</span></div></div></article>)}</div> : <EmptyPanel title="No workspace members found" message={filter ? "Try another search." : "Workspace membership will appear here after members are added."} />}
    </>
  );
}

type ChatMessage = { role: "user" | "assistant"; text: string; references?: { key: string; title: string }[] };

export function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({ mutationFn: api.askAssistant });

  async function ask(raw: string) {
    const value = raw.trim();
    if (!value || mutation.isPending) return;
    setQuestion("");
    setError("");
    setMessages((current) => [...current, { role: "user", text: value }]);
    try {
      const result = await mutation.mutateAsync(value);
      setMessages((current) => [...current, { role: "assistant", text: result.answer, references: result.references }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The assistant request failed.");
    }
  }

  return (
    <>
      <PageHeading eyebrow="GFG RBU / AI ASSISTANT" title="AI assistant" description="Answers are generated from tickets you are authorized to see." />
      <div className="assistant-layout">
        <section className="panel assistant-panel">
          <div className="assistant-topline"><div className="assistant-brand-icon"><Bot size={17} /></div><div><strong>Workspace assistant</strong><span>Gemini · workspace-scoped context</span></div></div>
          <div className="chat-window" aria-live="polite">
            {!messages.length ? <div className="assistant-welcome"><div className="assistant-welcome-icon"><Sparkles size={20} /></div><h2>Ask about your workspace</h2><p>Questions are answered using the latest accessible ticket data.</p></div> : <div className="chat-messages">
              {messages.map((message, index) => <div className={`chat-message chat-${message.role}`} key={`${message.role}-${index}`}><div className="message-bubble"><p>{message.text}</p>{message.references?.map((reference) => <Link className="reference-card" key={reference.key} to={`/tickets/${reference.key}`}><span className="reference-icon"><TicketIcon size={15} /></span><span><small>{reference.key}</small><strong>{reference.title}</strong></span><ArrowUpRight size={14} /></Link>)}</div></div>)}
              {mutation.isPending && <div className="chat-message chat-assistant"><div className="message-bubble thinking"><i /><i /><i /><span>Thinking…</span></div></div>}
            </div>}
          </div>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void ask(question); }}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} rows={2} placeholder="Ask a question about tickets…" aria-label="Ask the assistant" /><button className="send-button" type="submit" disabled={!question.trim() || mutation.isPending} aria-label="Send question"><Send size={17} /></button></form>
        </section>
        <aside className="assistant-side"><section className="panel assistant-info"><div className="assistant-info-icon"><ShieldCheck size={18} /></div><h3>Workspace-aware answers</h3><p>Only ticket data from your current workspace is sent to Gemini. Verify important answers against the cited tickets.</p></section><div className="assistant-footnote"><CircleHelp size={15} /><span>The assistant uses the Gemini configuration stored securely on the backend.</span></div></aside>
      </div>
    </>
  );
}

function ActivityList({ activities }: { activities: Activity[] }) {
  return <div className="activity-list">{activities.map((item) => <div className="activity-item" key={item.id}><Avatar initials={initials(item.actor.name)} /><p><strong>{item.actor.name}</strong> {item.summary}{item.ticket && <> · <Link to={`/tickets/${item.ticket.ticketKey}`}>{item.ticket.ticketKey}</Link></>}<small>{new Date(item.createdAt).toLocaleString()}</small></p></div>)}</div>;
}

export function ActivityPage() {
  const query = useQuery({ queryKey: activityKey, queryFn: () => api.activity(100) });
  if (query.isPending) return <LoadingPanel />;
  if (query.isError) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  const activities = query.data.activities;
  return (
    <>
      <PageHeading eyebrow="WORKSPACE / ACTIVITY" title="Activity logs" description="A record of ticket creation, updates, and comments." action={<button className="button button-secondary" disabled={!activities.length} onClick={() => {
        const rows = [["Actor", "Action", "Date"], ...activities.map((item) => [item.actor.name, item.summary, item.createdAt])];
        const csv = rows.map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(",")).join("\r\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        link.download = "workspace-activity.csv";
        link.click();
        URL.revokeObjectURL(link.href);
      }}><ArrowDown size={16} /> Export CSV</button>} />
      <section className="panel full-activity-panel">{activities.length ? <ActivityList activities={activities} /> : <EmptyPanel title="No activity yet" message="Ticket changes and comments will be recorded here." />}</section>
    </>
  );
}

export function SettingsPage() {
  const query = useCurrentUser();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [notice, setNotice] = useState("");
  const workspaceQuery = useQuery({ queryKey: workspaceKey, queryFn: api.workspace });
  const projectsQuery = useQuery({ queryKey: projectsKey, queryFn: api.projects });
  const profileMutation = useMutation({
    mutationFn: api.updateProfile,
    onSuccess: async ({ user }) => {
      queryClient.setQueryData(["auth", "me"], user);
      setName(user.name);
      setNotice("Profile updated.");
    },
    onError: (error: Error) => setNotice(error.message),
  });
  const projectMutation = useMutation({
    mutationFn: api.createProject,
    onSuccess: async () => {
      setProjectName("");
      setProjectKey("");
      setNotice("Project created.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectsKey }),
        queryClient.invalidateQueries({ queryKey: dashboardKey }),
      ]);
    },
    onError: (error: Error) => setNotice(error.message),
  });
  if (query.isPending) return <LoadingPanel label="Loading account…" />;
  if (query.isError) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  if (!query.data) return <Navigate to="/login" replace />;
  const currentName = name || query.data.name;
  const canManageWorkspace = !workspaceQuery.isError && (workspaceQuery.data?.role === "OWNER" || workspaceQuery.data?.role === "ADMIN");
  return (
    <>
      <PageHeading eyebrow="WORKSPACE / PREFERENCES" title="Settings" description="Account and workspace details." />
      {notice && <p role="status" className="inline-error">{notice}</p>}
      <section className="panel settings-panel"><div className="panel-heading"><div><h2>Your account</h2><p>Update your workspace display name</p></div><GitBranch size={17} className="muted-icon" /></div><div className="profile-settings"><Avatar initials={initials(currentName)} tone="blue" className="avatar-large" /><div><strong>{currentName}</strong><span>{query.data.email}</span></div></div><form className="settings-form-grid" onSubmit={(event) => { event.preventDefault(); profileMutation.mutate(name.trim()); }}><div className="form-field"><label htmlFor="account-name">Display name</label><input id="account-name" value={currentName} maxLength={80} onChange={(event) => setName(event.target.value)} required /></div><div className="form-field"><label htmlFor="account-email">Email</label><input id="account-email" value={query.data.email} readOnly /></div><button className="button button-primary" type="submit" disabled={profileMutation.isPending || !name.trim() || name.trim() === query.data.name}>{profileMutation.isPending ? "Saving…" : "Save profile"}</button></form></section>
      <section className="panel settings-panel" style={{ marginTop: 16 }}><div className="panel-heading"><div><h2>Projects</h2><p>Projects in this workspace</p></div><Layers3 size={17} className="muted-icon" /></div>{projectsQuery.isPending ? <LoadingPanel label="Loading projects…" /> : projectsQuery.isError ? <ErrorPanel error={projectsQuery.error} retry={() => void projectsQuery.refetch()} /> : projectsQuery.data.projects.length ? <ul>{projectsQuery.data.projects.map((project) => <li key={project.id}>{project.name} ({project.key}) · {project.ticketCount} tickets</li>)}</ul> : <EmptyPanel title="No projects yet" message="A workspace owner or admin can add a project." />}
        {canManageWorkspace && <form className="settings-form-grid" onSubmit={(event) => { event.preventDefault(); projectMutation.mutate({ name: projectName.trim(), key: projectKey.trim().toUpperCase() }); }}><div className="form-field"><label htmlFor="project-name">New project name</label><input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} minLength={2} maxLength={80} required /></div><div className="form-field"><label htmlFor="project-key">Project key</label><input id="project-key" value={projectKey} onChange={(event) => setProjectKey(event.target.value.toUpperCase())} pattern="[A-Z][A-Z0-9]{1,9}" maxLength={10} required /></div><button type="submit" className="button button-primary" disabled={projectMutation.isPending}>{projectMutation.isPending ? "Creating…" : "Create project"}</button></form>}
      </section>
    </>
  );
}

export function HelpPage() {
  return (
    <>
      <PageHeading eyebrow="GFG RBU / SUPPORT" title="Help & support" description="Use the workspace tools to manage tickets and collaborate with members." />
      <div className="help-grid">
        <Link to="/tickets" className="help-card"><span className="help-card-icon"><TicketIcon size={19} /></span><h2>Ticket management</h2><p>Create and track work in your workspace.</p><span>Open tickets <ArrowRight size={14} /></span></Link>
        <Link to="/team" className="help-card"><span className="help-card-icon help-blue"><Users size={19} /></span><h2>Team members</h2><p>See workspace membership and contributions.</p><span>Open team <ArrowRight size={14} /></span></Link>
      </div>
    </>
  );
}

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const authQuery = useCurrentUser();
  const apiUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const oauthError = searchParams.get("error");
  const message = authQuery.isError
    ? authQuery.error.message
    : oauthError === "account_link_required"
      ? "This email already belongs to an account. Sign in with the provider you used originally."
      : oauthError === "github_not_configured"
        ? "GitHub sign-in is not configured on the server yet."
        : oauthError
          ? "Sign-in failed. Please try again."
          : "";

  if (authQuery.data) return <Navigate to="/" replace />;

  return (
    <main className="login-page">
      <div className="login-left">
        <div className="login-brand"><span className="brand-mark"><span>G</span><i>R</i></span><span><strong>GFG RBU</strong><small>Developer Workspace</small></span></div>
        <div className="login-main">
          <div className="login-eyebrow"><span /> BUILT BY DEVELOPERS, FOR DEVELOPERS</div>
          <h1>Build.<br /><span>Collaborate.</span><br />Contribute.</h1>
          <p>One workspace for every contribution. Sign in with GitHub to continue.</p>
          <div className="oauth-buttons"><a className="oauth-button oauth-button-github" href={`${apiUrl}/api/auth/github`}><GitBranch size={18} /> Continue with GitHub</a></div>
          {message && <p className="login-message" role="alert">{message}</p>}
          <div className="login-privacy"><ShieldCheck size={15} /><span>Community workspace · Secure sign-in</span></div>
        </div>
        <div className="login-bottom"><span>GeeksforGeeks Student Chapter</span><span>Ramdeobaba University</span></div>
      </div>
      <div className="login-right" aria-hidden="true"><div className="login-decoration decoration-one" /><div className="login-decoration decoration-two" /></div>
    </main>
  );
}
