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
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { authQueryKey, logout, useCurrentUser } from "../../lib/auth";
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const authQuery = useCurrentUser();
  const searchInput = useRef<HTMLInputElement>(null);
  const user = authQuery.data;
  const initials = user?.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

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

  async function handleLogout() {
    setLogoutError("");
    try {
      await logout();
      queryClient.setQueryData(authQueryKey, null);
      navigate("/login", { replace: true });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Unable to sign out.");
    }
  }

  if (authQuery.isPending) {
    return <main className="auth-status" role="status">Checking your sign-in…</main>;
  }
  if (authQuery.isError) {
    return (
      <main className="auth-status" role="alert">
        <p>{authQuery.error.message}</p>
        <button className="button button-secondary" onClick={() => void authQuery.refetch()}>Try again</button>
      </main>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

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
          <button type="button" className="nav-link" onClick={() => { setSidebarOpen(false); void handleLogout(); }}>
            <LogOut size={17} strokeWidth={1.8} /><span>Sign out</span>
          </button>
          {logoutError && <p className="inline-error" role="alert">{logoutError}</p>}
          <div className="sidebar-profile">
            <Avatar initials={initials} tone="blue" />
            <div className="sidebar-profile-copy"><strong>{user.name}</strong><span>GitHub member</span></div>
            <button className="icon-button profile-more" aria-label="Profile options" onClick={() => setProfileOpen(!profileOpen)}><ChevronDown size={16} /></button>
            {profileOpen && <div className="profile-popover"><strong>{user.name}</strong><span>{user.email}</span><button onClick={() => { setProfileOpen(false); navigate("/settings"); }}>Account settings</button></div>}
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <form className="global-search" onSubmit={submitSearch} role="search">
            <Search size={17} />
            <input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets…" aria-label="Search tickets" />
            <kbd>⌘ K</kbd>
          </form>
          <div className="topbar-actions">
            <button className="topbar-user" onClick={() => navigate("/settings")}><Avatar initials={initials} tone="blue" /><span>{user.name}</span><ChevronDown size={15} /></button>
          </div>
        </header>
        <main className="main-content"><Outlet /></main>
        <footer className="app-footer"><span>GFG RBU Workspace</span><span>Build. Collaborate. Contribute.</span></footer>
      </div>
    </div>
  );
}
