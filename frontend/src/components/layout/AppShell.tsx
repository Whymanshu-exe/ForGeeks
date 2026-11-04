import {
  Activity,
  Bot,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTickets } from "../../lib/hooks";
import { Avatar } from "../ui/Avatar";

const primaryNavigation = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, end: true },
  { label: "My tickets", to: "/tickets?mine=1", icon: ClipboardList },
  { label: "All tickets", to: "/tickets", icon: ClipboardList },
  { label: "Team members", to: "/team", icon: Users },
  { label: "AI assistant", to: "/assistant", icon: Bot },
  { label: "Activity logs", to: "/activity", icon: Activity },
];

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const searchInput = useRef<HTMLInputElement>(null);
  const ticketsQuery = useTickets();
  const myOpenTickets = ticketsQuery.data?.filter(
    (ticket) => ticket.assignee === "Alex Morgan" && !["Resolved", "Closed"].includes(ticket.status),
  ).length;

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(`/tickets?q=${encodeURIComponent(search.trim())}`);
    setSidebarOpen(false);
  }

  return (
    <div className="app-frame">
      {sidebarOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <span className="brand-wordmark">geeks</span>
          <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>

        <div className="sidebar-section-label">Workspace</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {primaryNavigation.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={label}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => {
                const active = label === "My tickets"
                  ? isActive && location.search.includes("mine=1")
                  : label === "All tickets"
                    ? isActive && !location.search.includes("mine=1")
                    : isActive;
                return `nav-link ${active ? "nav-link-active" : ""}`;
              }}
            >
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              {label === "My tickets" && myOpenTickets !== undefined && <span className="nav-count">{myOpenTickets}</span>}
            </NavLink>
          ))}
        </nav>

        <button className="sidebar-create button button-primary" onClick={() => navigate("/tickets?create=1")}>
          <Plus size={17} /> Create ticket <span className="shortcut">⌘ K</span>
        </button>

        <div className="sidebar-bottom">
          <div className="sidebar-section-label">General</div>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`} onClick={() => setSidebarOpen(false)}>
            <Settings size={17} strokeWidth={1.8} /><span>Settings</span>
          </NavLink>
          <NavLink to="/help" className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`} onClick={() => setSidebarOpen(false)}>
            <CircleHelp size={17} strokeWidth={1.8} /><span>Help & support</span>
          </NavLink>
          <NavLink to="/login" className="nav-link" onClick={() => setSidebarOpen(false)}>
            <LogOut size={17} strokeWidth={1.8} /><span>Sign out</span>
          </NavLink>
          <div className="sidebar-profile">
            <Avatar initials="AM" tone="blue" />
            <div className="sidebar-profile-copy"><strong>Alex Morgan</strong><span>Core team</span></div>
            <button className="icon-button profile-more" aria-label="Profile options" onClick={() => setProfileOpen(!profileOpen)}><ChevronDown size={16} /></button>
            {profileOpen && <div className="profile-popover"><strong>Alex Morgan</strong><span>alex@gfgrbu.org</span><button onClick={() => { setProfileOpen(false); navigate("/settings"); }}>Account settings</button></div>}
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <form className="global-search" onSubmit={submitSearch} role="search">
            <Search size={17} />
            <input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets, projects, people..." aria-label="Search workspace" />
            <kbd>⌘ K</kbd>
          </form>
          <div className="topbar-actions">
            <button className="topbar-user" onClick={() => navigate("/settings")}><Avatar initials="AM" tone="blue" /><span>Alex Morgan</span><ChevronDown size={15} /></button>
          </div>
        </header>
        <main className="main-content"><Outlet /></main>
        <footer className="app-footer"><span>GFG RBU Workspace</span><span>Build. Collaborate. Contribute.</span></footer>
      </div>
    </div>
  );
}
