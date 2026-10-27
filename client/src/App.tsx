import { Navigate, Route, Routes, Outlet } from "react-router-dom";
import { Toolbar } from "./shell/Toolbar";
import { Splash } from "./pages/Splash";
import { Home } from "./pages/Home";
import { Household } from "./pages/Household";
import { PrintPage } from "./pages/Print";
import { Resources } from "./pages/Resources";
import { Settings } from "./pages/Settings";
import { NotFound } from "./pages/NotFound";

function Shell() {
  return (
    <>
      <Toolbar />
      <Outlet />
    </>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route element={<Shell />}>
        <Route path="/home" element={<Home />} />
        <Route path="/thong-tin-so/:id" element={<Household />} />
        <Route path="/print" element={<PrintPage />} />
        <Route path="/tai-nguyen" element={<Resources />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/index.html" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
