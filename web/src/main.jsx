import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";
import { AuthProvider, useAuth } from "./auth.jsx";
import { ToastProvider, Empty } from "./components/ui.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Cargos, { NewCargo } from "./pages/Cargos.jsx";
import CargoDetail from "./pages/CargoDetail.jsx";
import Contract from "./pages/Contract.jsx";
import Drivers from "./pages/Drivers.jsx";
import Analytics from "./pages/Analytics.jsx";
import Notifications from "./pages/Notifications.jsx";
import Admin from "./pages/Admin.jsx";

function App() {
  const { user, loading } = useAuth();
  if (loading) return <Empty title="Загружаем кабинет…" />;
  if (!user) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="cargos" element={<Cargos />} />
        <Route path="cargos/new" element={user.role === "admin" ? <Navigate to="/cargos" replace /> : <NewCargo />} />
        <Route path="cargos/:code" element={<CargoDetail />} />
        <Route path="cargos/:code/contract" element={<Contract />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="notifications" element={<Notifications />} />
        {user.role === "admin" && <Route path="admin" element={<Admin />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
