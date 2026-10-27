import { NavLink, useNavigate } from "react-router-dom";

const LINKS = [
  { to: "/home", label: "Danh sách" },
  { to: "/print", label: "In sớ" },
  { to: "/tai-nguyen", label: "Tài nguyên" },
  { to: "/settings", label: "Cài đặt" },
];

export function Toolbar() {
  const navigate = useNavigate();
  return (
    <header className="toolbar">
      <NavLink to="/home" className="brand">
        Việt Lạc Sớ
      </NavLink>
      <nav>
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <button type="button" onClick={() => navigate(-1)}>
        Quay lại
      </button>
    </header>
  );
}
