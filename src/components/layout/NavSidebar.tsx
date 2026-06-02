import { useLocation, NavLink } from "react-router-dom";
import {
  LayoutDashboard, FileText, FolderKanban, Milestone, Users, LogOut, Settings, Wrench, Search, CheckSquare,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

const NAV = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/projects",  icon: FolderKanban,     label: "Projekte"  },
  { to: "/notes",     icon: FileText,         label: "Notizen"   },
  { to: "/todos",     icon: CheckSquare,      label: "Todos"     },
  { to: "/milestones", icon: Milestone,       label: "Milestones" },
  { to: "/search",    icon: Search,           label: "Search"    },
  { to: "/users",     icon: Users,            label: "Admin"     },
  { to: "/meta",      icon: Wrench,           label: "Meta"      },
  { to: "/settings",  icon: Settings,         label: "Settings"  },
];

export function NavSidebar() {
  const logout = useAppStore((s) => s.logout);
  const user   = useAppStore((s) => s.currentUser);
  const canSeeUsers = Boolean(user && (user.role === "admin" || user.can_manage_users));
  const navItems = NAV.filter((item) => item.to !== "/users" || canSeeUsers);

  return (
    <aside className="flex flex-col w-14 h-full bg-bg-surface border-r border-border shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-center h-[72px] border-b border-border shrink-0">
        <img
          src="/logo.png"
          alt="SynkNote"
          className="h-[56px] w-[56px] object-contain select-none"
          draggable={false}
        />
      </div>

      {/* Nav links */}
      <nav className="flex flex-col items-center gap-1 py-3 flex-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              `flex items-center justify-center w-9 h-9 rounded-lg transition-colors
               ${isActive
                 ? "bg-accent-muted text-accent"
                 : "text-text-muted hover:bg-bg-hover hover:text-text-primary"
               }`
            }
          >
            <Icon size={18} />
          </NavLink>
        ))}
      </nav>

      {/* Bottom: avatar + logout */}
      <div className="flex flex-col items-center gap-2 pb-3 border-t border-border pt-3">
        <div
          title={user?.full_name ?? ""}
          className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center
                     text-xs font-semibold text-accent select-none"
        >
          {user?.full_name?.charAt(0).toUpperCase() ?? "?"}
        </div>
        <button
          onClick={logout}
          title="Abmelden"
          className="flex items-center justify-center w-9 h-9 rounded-lg text-text-muted
                     hover:bg-bg-hover hover:text-red-400 transition-colors"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
