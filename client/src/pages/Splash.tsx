import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function Splash() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Đang kết nối cơ sở dữ liệu…");

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const response = await fetch("/api/health");
        const body: { ok?: boolean; message?: string } = await response.json().catch(() => ({}));
        if (stopped) return;
        if (response.ok && body.ok) {
          navigate("/home", { replace: true });
          return;
        }
        setMessage(body.message || "Không kết nối được MongoDB (database vls).");
      } catch {
        if (!stopped) setMessage("Không kết nối được MongoDB (database vls).");
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [navigate]);

  return (
    <main className="splash">
      <p className="seal">Việt Lạc Sớ</p>
      <h1>Đang mở sổ</h1>
      <p>{message}</p>
    </main>
  );
}
