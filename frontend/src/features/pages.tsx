import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Command,
  Copy,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  Layers3,
  Lightbulb,
  ListFilter,
  MessageCircle,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import {
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Avatar } from "../components/ui/Avatar";
import { PriorityBadge, StatusBadge } from "../components/ui/Badges";
import { Modal } from "../components/ui/Modal";
import { PageHeading } from "../components/ui/PageHeading";
import { domains, team } from "../lib/mockData";
import { useTickets, ticketQueryKey } from "../lib/hooks";
import { addTicketComment, createTicket, updateTicketAssignee, updateTicketStatus } from "../lib/tickets";
import type { Ticket as TicketType, TicketPriority, TicketStatus } from "../types";
import { useQueryClient } from "@tanstack/react-query";

const statusOptions: TicketStatus[] = ["Open", "Triaged", "In Progress", "In Review", "Resolved", "Closed"];
const priorityOptions: TicketPriority[] = ["Low", "Medium", "High", "Urgent"];

function LoadingPanel({ label = "Loading workspace…" }: { label?: string }) {
  return <div className="loading-panel"><span className="spinner" />{label}</div>;
}

function ErrorPanel({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <div className="empty-panel">
      <div className="empty-icon"><CircleHelp size={20} /></div>
      <strong>We couldn’t load this view</strong>
      <p>{message || "Try again in a moment."}</p>
      <button className="button button-secondary" onClick={onRetry}>Try again</button>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="empty-panel">
      <div className="empty-icon"><Ticket size={20} /></div>
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type NotificationPreferences = {
  assignments: boolean;
  comments: boolean;
  weekly: boolean;
};

const defaultPreferences: NotificationPreferences = {
  assignments: true,
  comments: true,
  weekly: false,
};

function readDemoPreferences() {
  try {
    const savedPreferences = localStorage.getItem("gfg-rbu-demo-preferences");
    if (!savedPreferences) return { values: defaultPreferences, error: "" };
    const parsed: unknown = JSON.parse(savedPreferences);
    if (!isRecord(parsed)) throw new Error("Preferences must be an object.");
    if (
      typeof parsed.assignments !== "boolean"
      || typeof parsed.comments !== "boolean"
      || typeof parsed.weekly !== "boolean"
    ) {
      throw new Error("Each notification preference must be true or false.");
    }
    return {
      values: {
        assignments: parsed.assignments,
        comments: parsed.comments,
        weekly: parsed.weekly,
      },
      error: "",
    };
  } catch (error) {
    return {
      values: defaultPreferences,
      error: error instanceof Error ? error.message : "Saved demo preferences could not be read.",
    };
  }
}

function TicketTable({ tickets }: { tickets: TicketType[] }) {
  if (!tickets.length) return <EmptyState title="No tickets match" message="Try adjusting your search or filters." />;
  return (
    <div className="table-scroll">
      <table className="ticket-table">
        <thead><tr>
          <th>Ticket</th><th>Domain</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Created</th>
        </tr></thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td className="ticket-title-cell">
                <Link to={`/tickets/${ticket.id}`} className="ticket-title-link">
                  <span className="ticket-id">{ticket.id}</span>
                  <strong>{ticket.title}</strong>
                </Link>
              </td>
              <td><span className="domain-cell"><i />{ticket.domain}</span></td>
              <td><PriorityBadge priority={ticket.priority} /></td>
              <td><StatusBadge status={ticket.status} /></td>
              <td>
                <span className="assignee-cell">
                  <Avatar initials={ticket.initials} tone={ticket.initials === "?" ? "neutral" : "mint"} />
                  {ticket.assignee}
                </span>
              </td>
              <td className="date-cell">{new Date(`${ticket.createdAt}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreateTicketDialog({ onClose }: { onClose: () => void }) {
  const [notice, setNotice] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const domain = String(form.get("domain") ?? "");
    const priority = String(form.get("priority") ?? "Medium") as TicketPriority;
    if (title.length < 5) {
      setNotice("Add a short, descriptive title (at least 5 characters).");
      return;
    }
    try {
      const ticket = await createTicket({ title, description, domain, priority });
      await queryClient.invalidateQueries({ queryKey: ticketQueryKey });
      onClose();
      navigate(`/tickets/${ticket.id}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The ticket could not be saved.");
    }
  }

  return (
    <Modal
      title="Create a ticket"
      description="Capture the task clearly so the right contributors can pick it up."
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Create ticket"
    >
      <div className="form-field">
        <label htmlFor="ticket-title">Title</label>
        <input id="ticket-title" name="title" autoFocus maxLength={120} placeholder="What needs to be done?" required />
      </div>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="ticket-domain">Domain</label>
          <select id="ticket-domain" name="domain" defaultValue={domains[0].name}>
            {domains.map((domain) => <option key={domain.name}>{domain.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="ticket-priority">Priority</label>
          <select id="ticket-priority" name="priority" defaultValue="Medium">
            {priorityOptions.map((priority) => <option key={priority}>{priority}</option>)}
          </select>
        </div>
      </div>
      <div className="form-field">
        <label htmlFor="ticket-description">Description <span>Optional</span></label>
        <textarea id="ticket-description" name="description" rows={4} maxLength={3000} placeholder="Add context, acceptance criteria, or links…" />
      </div>
      {notice && <p className="inline-error" role="alert">{notice}</p>}
    </Modal>
  );
}

export function DashboardPage() {
  const ticketsQuery = useTickets();
  const navigate = useNavigate();
  if (ticketsQuery.isPending) return <LoadingPanel />;
  if (ticketsQuery.isError) return <ErrorPanel onRetry={() => void ticketsQuery.refetch()} message={ticketsQuery.error.message} />;
  const tickets = ticketsQuery.data;
  const openCount = tickets.filter((ticket) => ["Open", "Triaged"].includes(ticket.status)).length;
  const progressCount = tickets.filter((ticket) => ["In Progress", "In Review"].includes(ticket.status)).length;
  const resolvedCount = tickets.filter((ticket) => ["Resolved", "Closed"].includes(ticket.status)).length;
  const activity = [
    { initials: "IK", tone: "lilac", name: "Isha Kulkarni", action: "opened a pull request for", item: "GFG-139", time: "24 min ago" },
    { initials: "PD", tone: "peach", name: "Priya Deshmukh", action: "commented on", item: "GFG-142", time: "1 hour ago" },
    { initials: "KS", tone: "blue", name: "Kabir Sinha", action: "resolved", item: "GFG-128", time: "Yesterday" },
  ];

  return (
    <>
      <div className="welcome-strip">
        <div>
          <div className="welcome-eyebrow"><span className="welcome-spark"><Sparkles size={13} /></span> WEDNESDAY, NOVEMBER 4</div>
          <h1>Welcome back, Alex <span>✦</span></h1>
          <p>Here’s what’s happening across your GFG RBU workspace.</p>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="art-card"><Check size={18} /><span>Ship it together</span></div>
          <div className="art-dot art-dot-one" /><div className="art-dot art-dot-two" />
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div><h2>Recent tickets</h2><p>The latest work across your workspace</p></div>
            <button className="text-button" onClick={() => navigate("/tickets")}>View all <ArrowRight size={15} /></button>
          </div>
          <TicketTable tickets={tickets.slice(0, 4)} />
        </section>

        <section className="panel progress-panel">
          <div className="panel-heading"><div><h2>Project progress</h2><p>Tickets by status</p></div><button className="text-button" onClick={() => navigate("/tickets")}>Details <ArrowRight size={14} /></button></div>
          <div className="progress-summary"><strong>{resolvedCount}<span>/{tickets.length}</span></strong><span>tickets completed</span></div>
          <div className="stacked-track" aria-label={`${resolvedCount} resolved out of ${tickets.length}`}>
            <i style={{ width: `${Math.max((resolvedCount / tickets.length) * 100, 8)}%` }} /><b style={{ width: `${Math.max((progressCount / tickets.length) * 100, 10)}%` }} />
          </div>
          <div className="progress-legend">
            <div><i className="legend-dot green-dot" /><span>Resolved</span><strong>{resolvedCount}</strong></div>
            <div><i className="legend-dot amber-dot" /><span>In progress</span><strong>{progressCount}</strong></div>
            <div><i className="legend-dot gray-dot" /><span>Open</span><strong>{openCount}</strong></div>
          </div>
          <div className="progress-note"><Lightbulb size={15} /><span>Small, steady contributions move the whole team forward.</span></div>
        </section>

        <section className="panel activity-panel">
          <div className="panel-heading"><div><h2>Team activity</h2><p>A little progress, every day</p></div><button className="text-button" onClick={() => navigate("/activity")}>See activity <ArrowRight size={15} /></button></div>
          <div className="activity-list">
            {activity.map((item) => (
              <div className="activity-item" key={`${item.name}${item.item}`}>
                <Avatar initials={item.initials} tone={item.tone} />
                <p><strong>{item.name}</strong> {item.action} <Link to={`/tickets/${item.item}`}>{item.item}</Link><small>{item.time}</small></p>
              </div>
            ))}
          </div>
        </section>

      </div>
      <div className="demo-note"><span className="demo-dot" /> Demo workspace data <span>·</span> Changes are saved in this browser</div>
    </>
  );
}

export function TicketsPage() {
  const ticketsQuery = useTickets();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [priorityFilter, setPriorityFilter] = useState("All priorities");
  const [sortNewest, setSortNewest] = useState(true);
  const search = searchParams.get("q") ?? "";
  const domainFilter = searchParams.get("domain") ?? "All domains";
  const assigneeFilter = searchParams.get("assignee") ?? "All assignees";
  const mineOnly = searchParams.get("mine") === "1";
  const isCreateOpen = searchParams.get("create") === "1";

  const tickets = useMemo(() => {
    const rows = [...(ticketsQuery.data ?? [])].filter((ticket) => {
      const query = search.trim().toLowerCase();
      const matchesSearch = !query || `${ticket.id} ${ticket.title} ${ticket.domain} ${ticket.assignee}`.toLowerCase().includes(query);
      return matchesSearch
        && (!mineOnly || ticket.assignee === "Alex Morgan")
        && (domainFilter === "All domains" || ticket.domain === domainFilter)
        && (statusFilter === "All statuses" || ticket.status === statusFilter)
        && (priorityFilter === "All priorities" || ticket.priority === priorityFilter)
        && (assigneeFilter === "All assignees" || ticket.assignee === assigneeFilter);
    });
    rows.sort((a, b) => sortNewest ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt));
    return rows;
  }, [ticketsQuery.data, search, domainFilter, statusFilter, priorityFilter, assigneeFilter, sortNewest, mineOnly]);

  function updateSearchParam(name: string, value: string, defaultValue = "") {
    const next = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) next.delete(name);
    else next.set(name, value);
    setSearchParams(next, { replace: true });
  }

  function closeCreate() {
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  }

  const assignees = Array.from(new Set((ticketsQuery.data ?? []).map((ticket) => ticket.assignee)));

  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / TICKETS"
        title={mineOnly ? "My tickets" : "All tickets"}
        description="Track work, unblock contributors, and keep every project moving."
        action={<button className="button button-primary" onClick={() => updateSearchParam("create", "1")}><Plus size={17} /> New ticket</button>}
      />
      <section className="panel tickets-panel">
        <div className="list-toolbar">
          <div className="list-toolbar-title"><strong>Tickets</strong><span>{tickets.length} results</span></div>
          <div className="ticket-filters">
            <label className="table-search"><Search size={16} /><input placeholder="Search tickets…" value={search} onChange={(event) => updateSearchParam("q", event.target.value)} aria-label="Search tickets" /></label>
            <select aria-label="Filter by domain" value={domainFilter} onChange={(event) => updateSearchParam("domain", event.target.value, "All domains")}><option>All domains</option>{domains.map((domain) => <option key={domain.name}>{domain.name}</option>)}</select>
            <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select>
            <select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option>All priorities</option>{priorityOptions.map((priority) => <option key={priority}>{priority}</option>)}</select>
            <select aria-label="Filter by assignee" value={assigneeFilter} onChange={(event) => updateSearchParam("assignee", event.target.value, "All assignees")}><option>All assignees</option>{assignees.map((assignee) => <option key={assignee}>{assignee}</option>)}</select>
            <button className="icon-button sort-button" title={`Sort ${sortNewest ? "oldest" : "newest"} first`} aria-label={`Sort by creation date, ${sortNewest ? "newest" : "oldest"} first`} onClick={() => setSortNewest(!sortNewest)}>{sortNewest ? <ArrowDown size={16} /> : <ArrowUpRight size={16} />}</button>
          </div>
        </div>
        {ticketsQuery.isPending ? <LoadingPanel /> : ticketsQuery.isError ? <ErrorPanel onRetry={() => void ticketsQuery.refetch()} message={ticketsQuery.error.message} /> : <TicketTable tickets={tickets} />}
        <div className="table-footer"><span>Showing <strong>{tickets.length}</strong> of <strong>{ticketsQuery.data?.length ?? 0}</strong> tickets</span><span className="demo-label"><i /> Local demo data</span></div>
      </section>
      {isCreateOpen && <CreateTicketDialog onClose={closeCreate} />}
    </>
  );
}

export function TicketDetailPage() {
  const { ticketId } = useParams();
  const ticketsQuery = useTickets();
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();
  if (ticketsQuery.isPending) return <LoadingPanel />;
  if (ticketsQuery.isError) return <ErrorPanel onRetry={() => void ticketsQuery.refetch()} message={ticketsQuery.error.message} />;
  const ticket = ticketsQuery.data.find((item) => item.id === ticketId);
  if (!ticket) return <EmptyState title="Ticket not found" message="It may have been removed or the link is incorrect." />;

  async function changeStatus(status: TicketStatus) {
    try {
      await updateTicketStatus(ticket!.id, status);
      await queryClient.invalidateQueries({ queryKey: ticketQueryKey });
      setMessage(`Status updated to ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The status could not be updated.");
    }
    window.setTimeout(() => setMessage(""), 2600);
  }

  async function changeAssignee(name: string) {
    const member = team.find((item) => item.name === name);
    try {
      await updateTicketAssignee(ticket!.id, name, member?.initials ?? "?");
      await queryClient.invalidateQueries({ queryKey: ticketQueryKey });
      setMessage(`Assignee updated to ${name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The assignee could not be updated.");
    }
    window.setTimeout(() => setMessage(""), 2600);
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comment.trim()) return;
    try {
      await addTicketComment(ticket!.id, comment.trim());
      await queryClient.invalidateQueries({ queryKey: ticketQueryKey });
      setComment("");
      setMessage("Comment added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The comment could not be added.");
    }
    window.setTimeout(() => setMessage(""), 2600);
  }

  async function copyTicketLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("Ticket link copied.");
    } catch {
      setMessage("Couldn’t copy the link. Copy it from your browser’s address bar.");
    }
    window.setTimeout(() => setMessage(""), 2600);
  }

  return (
    <>
      <Link to="/tickets" className="back-link"><ArrowLeft size={16} /> Back to tickets</Link>
      <div className="detail-heading">
        <div><div className="detail-id">{ticket.id} <span>·</span> {ticket.domain}</div><h1>{ticket.title}</h1></div>
        <button className="button button-secondary" onClick={() => void copyTicketLink()}><Copy size={15} /> Copy link</button>
      </div>
      {message && <div className="toast-message" role="status"><Check size={16} />{message}</div>}
      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel detail-description">
            <div className="panel-heading"><div><h2>Description</h2><p>Ticket details and acceptance context</p></div><span className="demo-label"><i /> Demo ticket</span></div>
            <p className="description-copy">{ticket.description || "No description was added to this ticket."}</p>
            <div className="label-row">{ticket.labels.length ? ticket.labels.map((label) => <span className="label-chip" key={label}>{label}</span>) : <span className="muted-copy">No labels</span>}</div>
            <div className="ticket-meta-line"><span>Created {new Date(`${ticket.createdAt}T12:00:00`).toLocaleDateString("en-US", { dateStyle: "medium" })}</span><span>Updated recently</span><span>Reported by Alex Morgan</span></div>
          </section>

          <section className="panel discussion-panel">
            <div className="panel-heading"><div><h2>Discussion</h2><p>{ticket.comments.length} comments on this ticket</p></div><MessageCircle size={18} className="muted-icon" /></div>
            <div className="comment-list">
              {ticket.comments.length ? ticket.comments.map((item, index) => (
                <div className="comment-item" key={`${item.author}${index}`}><Avatar initials={item.initials} tone={index % 2 ? "peach" : "lilac"} /><div className="comment-content"><div><strong>{item.author}</strong><span>{item.createdAt}</span></div><p>{item.body}</p></div></div>
              )) : <p className="muted-copy comment-empty">No comments yet. Start the conversation.</p>}
            </div>
            <form className="comment-form" onSubmit={submitComment}>
              <Avatar initials="AM" tone="blue" />
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} placeholder="Write a comment…" aria-label="Write a comment" />
              <button className="button button-primary send-comment" type="submit" disabled={!comment.trim()}><Send size={15} /> Send</button>
            </form>
          </section>
        </div>

        <aside className="detail-sidebar">
          <section className="panel properties-panel">
            <div className="panel-heading"><div><h2>Properties</h2></div><Settings2 size={17} className="muted-icon" /></div>
            <div className="property-field"><label>Status</label><select value={ticket.status} onChange={(event) => void changeStatus(event.target.value as TicketStatus)}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></div>
            <div className="property-field"><label>Priority</label><div><PriorityBadge priority={ticket.priority} /></div></div>
            <div className="property-field"><label htmlFor="ticket-assignee">Assignee</label><select id="ticket-assignee" value={ticket.assignee} onChange={(event) => void changeAssignee(event.target.value)}><option>Unassigned</option><option>Alex Morgan</option>{team.map((member) => <option key={member.name}>{member.name}</option>)}</select></div>
            <p className="demo-permission-note">Preview assignment controls are local only; enforce roles in the backend before launch.</p>
            <div className="property-field"><label>Domain</label><div className="property-domain"><Layers3 size={15} />{ticket.domain}</div></div>
          </section>
          <section className="panel links-panel">
            <div className="panel-heading"><div><h2>Development links</h2><p>Code connected to this work</p></div><GitPullRequest size={17} className="muted-icon" /></div>
            {ticket.github ? <a href={`https://${ticket.github}`} target="_blank" rel="noreferrer" className="github-link"><GitBranch size={16} /><span><strong>{ticket.github.split("/").slice(-2).join("/")}</strong><small>GitHub issue or pull request</small></span><ExternalLink size={14} /></a> : <div className="github-empty"><GitBranch size={17} /><span>No GitHub references yet</span></div>}
            <button className="text-button connect-link" onClick={() => setMessage("GitHub linking will be available when the API integration is connected.")}>Connect a link <Plus size={14} /></button>
          </section>
          <section className="panel history-panel">
            <div className="panel-heading"><div><h2>Activity</h2></div></div>
            <div className="history-item"><i /><div><strong>Ticket created</strong><span>{new Date(`${ticket.createdAt}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div></div>
            <div className="history-item"><i /><div><strong>Status is {ticket.status.toLowerCase()}</strong><span>Recently updated</span></div></div>
          </section>
        </aside>
      </div>
    </>
  );
}

export function TeamPage() {
  const [role, setRole] = useState("Everyone");
  const [search, setSearch] = useState("");
  const members = team.filter((member) => (role === "Everyone" || member.role === role) && `${member.name} ${member.username} ${member.domains.join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <PageHeading eyebrow="WORKSPACE / PEOPLE" title="People make progress" description="Meet the contributors building, learning, and shipping together." action={<button className="button button-primary" onClick={() => window.alert("Invitations will be available when authentication is configured.")}><Plus size={17} /> Invite member</button>} />
      <div className="team-summary">
        <div className="team-summary-copy"><div className="eyebrow">GFG RBU COMMUNITY</div><h2>Good work is a team sport.</h2><p>Meet the people sharing knowledge and building what’s next.</p></div>
        <div className="team-summary-stats"><div><strong>{team.length}</strong><span>Contributors</span></div><div><strong>{domains.length}</strong><span>Domains</span></div><div><strong>{team.reduce((total, member) => total + member.resolved, 0)}</strong><span>Tickets resolved</span></div></div>
        <div className="avatar-stack" aria-label="GFG RBU team members">{team.slice(0, 5).map((member) => <Avatar key={member.username} initials={member.initials} tone={member.color} />)}<span>+12</span></div>
      </div>
      <div className="list-toolbar team-toolbar">
        <div className="list-toolbar-title"><strong>Team members</strong><span>{members.length} people</span></div>
        <div className="ticket-filters"><label className="table-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people…" aria-label="Search team members" /></label><select aria-label="Filter by role" value={role} onChange={(event) => setRole(event.target.value)}><option>Everyone</option>{["Core team", "Domain maintainer", "Project contributor", "Administrator"].map((item) => <option key={item}>{item}</option>)}</select></div>
      </div>
      {members.length ? <div className="team-grid">{members.map((member) => <article className="team-card" key={member.username}>
        <div className="team-card-top"><Avatar initials={member.initials} tone={member.color} className="avatar-large" /><span className="team-member-check"><Check size={14} /></span></div>
        <h2>{member.name}</h2><span className="team-username">@{member.username}</span><span className="role-pill">{member.role}</span>
        <div className="member-domains">{member.domains.map((domain) => <span key={domain}>{domain}</span>)}</div>
        <div className="member-stats"><div><strong>{member.activeTickets}</strong><span>Active tickets</span></div><div><strong>{member.resolved}</strong><span>Resolved</span></div></div>
        <Link className="member-contact" to={`/tickets?assignee=${encodeURIComponent(member.name)}`}>View assigned tickets <ArrowUpRight size={14} /></Link>
      </article>)}</div> : <EmptyState title="No team members found" message="Try a different name or role." />}
      <div className="demo-note"><span className="demo-dot" /> Sample contributor profiles · Invite and role management need authentication</div>
    </>
  );
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  references?: string[];
}

const suggestions = [
  "Who is assigned to the caching feature?",
  "Show unresolved backend tickets",
  "Which tickets have been pending for more than seven days?",
  "What did the team resolve this week?",
  "Show my assigned tasks",
];

export function AssistantPage() {
  const ticketsQuery = useTickets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isThinking, setThinking] = useState(false);

  function ask(question: string) {
    const text = question.trim();
    if (!text || isThinking) return;
    setDraft("");
    setMessages((current) => [...current, { role: "user", text }]);
    setThinking(true);
    window.setTimeout(() => {
      const allTickets = ticketsQuery.data ?? [];
      let related = allTickets;
      const normalized = text.toLowerCase();
      if (normalized.includes("backend")) related = related.filter((ticket) => ticket.domain === "Backend Development");
      else if (normalized.includes("cach")) related = related.filter((ticket) => ticket.title.toLowerCase().includes("cache"));
      else if (normalized.includes("assigned") || normalized.includes("my ")) related = related.filter((ticket) => ticket.assignee === "Alex Morgan");
      else if (normalized.includes("resolve")) related = related.filter((ticket) => ["Resolved", "Closed"].includes(ticket.status));
      else related = related.filter((ticket) => ["Open", "Triaged", "In Progress", "In Review"].includes(ticket.status));
      const refs = related.slice(0, 3).map((ticket) => ticket.id);
      const reply = related.length
        ? `I found ${related.length} relevant ${related.length === 1 ? "ticket" : "tickets"} in this demo workspace. Here are the closest matches.`
        : "I couldn’t find a matching ticket in the current demo data. Try asking about a domain, assignee, or ticket title.";
      setMessages((current) => [...current, { role: "assistant", text: reply, references: refs }]);
      setThinking(false);
    }, 750);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      ask(draft);
    }
  }

  if (ticketsQuery.isPending) return <LoadingPanel />;
  if (ticketsQuery.isError) return <ErrorPanel onRetry={() => void ticketsQuery.refetch()} message={ticketsQuery.error.message} />;
  return (
    <>
      <PageHeading eyebrow="GFG RBU / AI ASSISTANT" title="A little help, right here." description="Ask questions about the work and find the context you need to move forward." />
      <div className="assistant-layout">
        <section className="panel assistant-panel">
          <div className="assistant-topline"><div className="assistant-brand-icon"><Sparkles size={17} /></div><div><strong>Workspace assistant</strong><span><i /> Connected to demo tickets</span></div><span className="assistant-beta">PREVIEW</span></div>
          <div className="chat-window" aria-live="polite">
            {!messages.length ? <div className="assistant-welcome">
              <div className="assistant-welcome-icon"><Sparkles size={20} /></div>
              <h2>What would you like to know?</h2>
              <p>Ask a question to find tickets, people, and progress across the workspace.</p>
              <span className="chat-disclaimer"><Lightbulb size={14} /> Answers use sample workspace data and may be incomplete.</span>
            </div> : <div className="chat-messages">
              {messages.map((message, index) => <div className={`chat-message chat-${message.role}`} key={`${message.role}-${index}`}>
                {message.role === "assistant" && <div className="assistant-avatar"><Sparkles size={15} /></div>}
                <div className="message-bubble"><p>{message.text}</p>{message.references?.map((id) => {
                  const ticket = ticketsQuery.data.find((item) => item.id === id);
                  return ticket ? <Link to={`/tickets/${id}`} className="reference-card" key={id}><span className="reference-icon"><Ticket size={15} /></span><span><small>{id} · {ticket.domain}</small><strong>{ticket.title}</strong></span><ArrowUpRight size={14} /></Link> : null;
                })}{message.role === "assistant" && <span className="source-note"><BookOpen size={12} /> Source: workspace ticket records</span>}</div>
              </div>)}
              {isThinking && <div className="chat-message chat-assistant"><div className="assistant-avatar"><Sparkles size={15} /></div><div className="message-bubble thinking"><i /><i /><i /><span>Looking through tickets…</span></div></div>}
            </div>}
          </div>
          {!messages.length && <div className="suggestion-list"><div className="suggestion-label">TRY ASKING</div>{suggestions.map((item) => <button key={item} onClick={() => ask(item)}>{item}<ArrowUpRight size={14} /></button>)}</div>}
          <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); ask(draft); }}>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder="Ask a question about your workspace…" rows={1} aria-label="Ask the workspace assistant" />
            <span>↵ to send · Shift + ↵ for a new line</span><button className="send-button" type="submit" disabled={!draft.trim() || isThinking} aria-label="Send question"><Send size={17} /></button>
          </form>
          {messages.length > 0 && <button className="clear-chat" onClick={() => setMessages([])}>Start a new conversation</button>}
        </section>
        <aside className="assistant-side">
          <section className="panel assistant-info"><div className="assistant-info-icon"><ShieldCheck size={18} /></div><h3>Built for your workspace</h3><p>This preview uses local sample data. Connect an approved AI service and retrieval pipeline before using real team or ticket information.</p><div className="assistant-info-foot"><span>Privacy first</span><span>·</span><span>Source-aware</span></div></section>
          <section className="panel quick-context"><div className="panel-heading"><div><h2>Available context</h2><p>What this assistant can see</p></div></div><div><Ticket size={15} /><span>Tickets</span><strong>{ticketsQuery.data.length}</strong></div><div><Layers3 size={15} /><span>Domains</span><strong>{domains.length}</strong></div><div><Users size={15} /><span>Contributors</span><strong>{team.length}</strong></div></section>
          <div className="assistant-footnote"><CircleHelp size={15} /><span>AI responses can be inaccurate. Confirm important details with the ticket owner.</span></div>
        </aside>
      </div>
    </>
  );
}

export function ActivityPage() {
  const ticketsQuery = useTickets();
  const [activityFilter, setActivityFilter] = useState("All activity");
  if (ticketsQuery.isPending) return <LoadingPanel />;
  if (ticketsQuery.isError) return <ErrorPanel onRetry={() => void ticketsQuery.refetch()} message={ticketsQuery.error.message} />;
  const actions = [
    { category: "Pull requests", title: "Isha Kulkarni opened a pull request", detail: "Improving mobile navigation · GFG-139", time: "24 min ago", initials: "IK", tone: "lilac", icon: GitPullRequest },
    { category: "Comments", title: "Priya Deshmukh commented on a ticket", detail: "“Please include a test for the reset window.” · GFG-142", time: "1 hour ago", initials: "PD", tone: "peach", icon: MessageCircle },
    { category: "Tickets", title: "Kabir Sinha resolved a ticket", detail: "Preview deployments for pull requests · GFG-128", time: "Yesterday at 4:18 PM", initials: "KS", tone: "blue", icon: CheckCheck },
    { category: "Tickets", title: "Aarav Sharma picked up a ticket", detail: "Rate limiting for the public API · GFG-142", time: "Yesterday at 1:42 PM", initials: "AS", tone: "mint", icon: Ticket },
    { category: "Members", title: "Nisha Rao joined the AI / ML domain", detail: "Welcome to the domain team!", time: "Oct 30 at 11:06 AM", initials: "NR", tone: "mint", icon: Users },
  ];
  const visibleActions = activityFilter === "All activity" ? actions : actions.filter((action) => action.category === activityFilter);

  function exportActivity() {
    const records = [
      ["Category", "Activity", "Details", "Time"],
      ...visibleActions.map((action) => [action.category, action.title, action.detail, action.time]),
    ];
    const csv = records
      .map((record) => record.map((value) => `"${value.replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "gfg-rbu-demo-activity.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeading eyebrow="WORKSPACE / ACTIVITY" title="Activity that moves us forward" description="A shared timeline of the small wins and helpful moments across GFG RBU." action={<button className="button button-secondary" onClick={exportActivity}><ArrowDown size={16} /> Export CSV</button>} />
      <div className="activity-page-grid">
        <section className="panel full-activity-panel">
          <div className="activity-filter-row"><div className="list-toolbar-title"><strong>Recent activity</strong><span>Last 30 days</span></div><label className="activity-select"><ListFilter size={14} /><select aria-label="Filter activity" value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>{["All activity", "Tickets", "Pull requests", "Comments", "Members"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={13} /></label></div>
          <div className="activity-timeline">
            <div className="timeline-date">TODAY <span>November 4, 2026</span></div>
            {visibleActions.slice(0, 2).map((action) => { const Icon = action.icon; return <div className="timeline-event" key={action.title}><Avatar initials={action.initials} tone={action.tone} /><div className="timeline-event-content"><div><strong>{action.title}</strong><span>{action.time}</span></div><p>{action.detail}</p></div><span className="timeline-event-icon"><Icon size={15} /></span></div>; })}
            {visibleActions.length > 2 && <div className="timeline-date">EARLIER THIS WEEK <span>November 3, 2026</span></div>}
            {visibleActions.slice(2).map((action) => { const Icon = action.icon; return <div className="timeline-event" key={action.title}><Avatar initials={action.initials} tone={action.tone} /><div className="timeline-event-content"><div><strong>{action.title}</strong><span>{action.time}</span></div><p>{action.detail}</p></div><span className="timeline-event-icon"><Icon size={15} /></span></div>; })}
            {!visibleActions.length && <EmptyState title="No activity in this category" message="Choose a different activity filter." />}
          </div>
        </section>
        <aside className="panel activity-highlights"><div className="panel-heading"><div><h2>Team pulse</h2><p>A week worth celebrating</p></div><Sparkles size={17} className="muted-icon" /></div><div className="pulse-stat"><div className="pulse-icon"><CheckCheck size={17} /></div><strong>8</strong><span>tickets moved forward</span></div><div className="pulse-stat"><div className="pulse-icon pulse-lilac"><GitPullRequest size={17} /></div><strong>5</strong><span>pull requests opened</span></div><div className="pulse-stat"><div className="pulse-icon pulse-peach"><MessageCircle size={17} /></div><strong>14</strong><span>helpful conversations</span></div><div className="pulse-note">Every contribution counts. Thanks for showing up for each other.</div></aside>
      </div>
      <div className="demo-note"><span className="demo-dot" /> Activity is illustrative demo data · The timeline will use API events once connected</div>
    </>
  );
}

export function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [preferences, setPreferences] = useState(readDemoPreferences);
  const toggles = preferences.values;
  function toggle(key: keyof typeof toggles) {
    setPreferences((current) => ({
      ...current,
      values: { ...current.values, [key]: !current.values[key] },
    }));
    setSaved(false);
  }
  return (
    <>
      <PageHeading eyebrow="WORKSPACE / PREFERENCES" title="Settings" description="Make your workspace feel a little more like yours." />
      {saved && <div className="toast-message settings-toast" role="status"><Check size={16} /> Preferences saved in this browser.</div>}
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections"><a className="settings-nav-active" href="#profile"><Users size={16} /> Profile</a><a href="#notifications"><Bell size={16} /> Notifications</a><a href="#workspace"><Command size={16} /> Workspace</a></nav>
        <div className="settings-content">
          <section className="panel settings-panel" id="profile"><div className="panel-heading"><div><h2>Your profile</h2><p>How you show up to the GFG RBU community</p></div><span className="demo-label"><i /> Preview</span></div>
            <div className="profile-settings"><Avatar initials="AM" tone="blue" className="avatar-large" /><div><strong>Alex Morgan</strong><span>Core team member</span></div><button className="button button-secondary button-sm" onClick={() => window.alert("Profile editing will be available when sign-in is connected.")}>Edit profile</button></div>
            <div className="settings-form-grid"><div className="form-field"><label htmlFor="profile-name">Full name</label><input id="profile-name" defaultValue="Alex Morgan" /></div><div className="form-field"><label htmlFor="profile-email">Email address</label><input id="profile-email" defaultValue="alex@gfgrbu.org" readOnly /></div><div className="form-field"><label htmlFor="profile-role">Role</label><input id="profile-role" defaultValue="Core team" readOnly /></div><div className="form-field"><label htmlFor="profile-timezone">Timezone</label><select id="profile-timezone" defaultValue="Asia/Kolkata"><option value="Asia/Kolkata">Asia/Kolkata (IST)</option><option value="UTC">UTC</option></select></div></div>
          </section>
          <section className="panel settings-panel" id="notifications"><div className="panel-heading"><div><h2>Notifications</h2><p>Choose what updates you’d like to hear about</p></div><Bell size={17} className="muted-icon" /></div>
            {preferences.error && <p className="inline-error" role="alert">Saved preferences could not be loaded: {preferences.error} You can save the defaults below to replace them.</p>}
            <div className="settings-option"><div><strong>Ticket assignments</strong><span>When a ticket is assigned to you</span></div><button className={`toggle ${toggles.assignments ? "toggle-on" : ""}`} role="switch" aria-checked={toggles.assignments} aria-label="Ticket assignment notifications" onClick={() => toggle("assignments")}><i /></button></div>
            <div className="settings-option"><div><strong>Comments and mentions</strong><span>When someone replies or mentions you</span></div><button className={`toggle ${toggles.comments ? "toggle-on" : ""}`} role="switch" aria-checked={toggles.comments} aria-label="Comment notifications" onClick={() => toggle("comments")}><i /></button></div>
            <div className="settings-option"><div><strong>Weekly workspace digest</strong><span>A short summary of progress every Monday</span></div><button className={`toggle ${toggles.weekly ? "toggle-on" : ""}`} role="switch" aria-checked={toggles.weekly} aria-label="Weekly digest" onClick={() => toggle("weekly")}><i /></button></div>
          </section>
          <section className="panel settings-panel" id="workspace"><div className="panel-heading"><div><h2>Workspace details</h2><p>Shared settings for your developer community</p></div><Layers3 size={17} className="muted-icon" /></div><div className="workspace-detail"><div className="brand-mark small-brand"><span>G</span><i>R</i></div><div><strong>GFG RBU Workspace</strong><span>GeeksforGeeks Student Chapter · Ramdeobaba University</span></div><span className="workspace-pill">Active</span></div></section>
          <div className="settings-save-row"><span>Demo preferences are saved in this browser.</span><button className="button button-primary" onClick={() => { try { localStorage.setItem("gfg-rbu-demo-preferences", JSON.stringify(toggles)); setPreferences((current) => ({ ...current, error: "" })); setSaved(true); } catch (error) { setPreferences((current) => ({ ...current, error: error instanceof Error ? error.message : "Preferences could not be saved." })); } }}><Check size={16} /> Save preferences</button></div>
        </div>
      </div>
    </>
  );
}

export function HelpPage() {
  return (
    <>
      <PageHeading eyebrow="GFG RBU / SUPPORT" title="How can we help?" description="A few quick paths to get unstuck and keep contributing." />
      <div className="help-grid">
        <Link to="/tickets?create=1" className="help-card"><span className="help-card-icon"><Ticket size={19} /></span><h2>Report a task or issue</h2><p>Create a ticket with the domain, priority, and steps needed to move it forward.</p><span>Go to create ticket <ArrowRight size={14} /></span></Link>
        <Link to="/tickets" className="help-card"><span className="help-card-icon help-blue"><Layers3 size={19} /></span><h2>Find work to contribute to</h2><p>Browse open tasks and find a ticket that fits your interests.</p><span>Browse tickets <ArrowRight size={14} /></span></Link>
        <Link to="/team" className="help-card"><span className="help-card-icon help-lilac"><Users size={19} /></span><h2>Connect with the team</h2><p>Find contributors, maintainers, and the people who can point you in the right direction.</p><span>Meet the team <ArrowRight size={14} /></span></Link>
        <Link to="/settings" className="help-card"><span className="help-card-icon help-peach"><CircleHelp size={19} /></span><h2>Workspace basics</h2><p>Review your profile preview, notification preferences, and workspace information.</p><span>Open settings <ArrowRight size={14} /></span></Link>
      </div>
      <section className="panel help-note"><div className="assistant-info-icon"><Lightbulb size={18} /></div><div><strong>This is a frontend preview</strong><p>Tickets and preferences are stored locally in this browser. Sign-in, invitations, and shared workspace data will work once the backend API and authentication are connected.</p></div></section>
    </>
  );
}

export function LoginPage() {
  const [message, setMessage] = useState("");
  const authUrl = import.meta.env.VITE_GITHUB_AUTH_URL as string | undefined;
  function signIn() {
    if (authUrl) window.location.assign(authUrl);
    else setMessage("GitHub sign-in is not connected yet. Configure VITE_GITHUB_AUTH_URL when the backend OAuth flow is ready.");
  }
  return (
    <main className="login-page">
      <div className="login-left">
        <div className="login-brand"><span className="brand-mark"><span>G</span><i>R</i></span><span><strong>GFG RBU</strong><small>Developer Workspace</small></span></div>
        <div className="login-main">
          <div className="login-eyebrow"><span /> BUILT BY DEVELOPERS, FOR DEVELOPERS</div>
          <h1>Build.<br /><span>Collaborate.</span><br />Contribute.</h1>
          <p>One workspace for every contribution. Pick up a ticket, share what you know, and ship something meaningful together.</p>
          <button className="github-login-button" onClick={signIn}><GitBranch size={19} /> Continue with GitHub <ArrowRight size={17} /></button>
          {message && <p className="login-message" role="status">{message}</p>}
          <div className="login-privacy"><ShieldCheck size={15} /><span>Community workspace · Secure sign-in</span></div>
        </div>
        <div className="login-bottom"><span>GeeksforGeeks Student Chapter</span><span>Ramdeobaba University</span></div>
      </div>
      <div className="login-right" aria-hidden="true">
        <div className="login-decoration decoration-one" /><div className="login-decoration decoration-two" />
        <div className="login-code-card">
          <div className="code-card-head"><div className="code-dots"><i /><i /><i /></div><span>good-first-issue.ts</span><span>TS</span></div>
          <div className="code-card-content"><span className="code-line"><i>01</i><b>const</b> community = <em>"GFG RBU"</em>;</span><span className="code-line"><i>02</i><b>const</b> nextStep = <em>"your contribution"</em>;</span><span className="code-line"><i>03</i></span><span className="code-line"><i>04</i><b>build</b>(community, nextStep);</span><span className="code-line"><i>05</i><span className="code-cursor" /></span></div>
          <div className="code-card-footer"><span><span /> Open for contributions</span><span>main</span></div>
        </div>
        <div className="login-floating-card float-ticket"><div><Ticket size={16} /></div><span><small>GOOD FIRST ISSUE</small><strong>Make your first contribution</strong></span><Check size={16} /></div>
        <div className="login-floating-card float-people"><div className="avatar-stack"><Avatar initials="AS" /><Avatar initials="IK" tone="lilac" /><Avatar initials="PD" tone="peach" /></div><span><strong>25+ contributors</strong><small>building together</small></span></div>
        <div className="login-motto">“Alone we can do so little;<br />together we can do so much.”</div>
      </div>
    </main>
  );
}
