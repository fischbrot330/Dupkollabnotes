import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAppStore } from "./store/useAppStore";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { NotesPage } from "./pages/NotesPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { TodosPage } from "./pages/TodosPage";
import { MilestonesPage } from "./pages/MilestonesPage";
import { UsersPage } from "./pages/UsersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { MetaPage } from "./pages/MetaPage";
import { SearchPage } from "./pages/SearchPage";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user = useAppStore((s) => s.currentUser);
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <AppShell />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="todos" element={<TodosPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="milestones" element={<MilestonesPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="admin" element={<UsersPage />} />
          <Route path="meta" element={<MetaPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
