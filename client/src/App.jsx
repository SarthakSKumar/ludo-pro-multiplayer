import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Home from "./pages/Home";
import Game from "./pages/Game";
import Lobby from "./pages/Lobby";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { useSocketStore } from "./store/socketStore";
import { useUserStore } from "./store/userStore";
import { useEffect } from "react";

function App() {
  const token = useUserStore((state) => state.token);
  const initialize = useSocketStore((state) => state.initialize);
  const disconnect = useSocketStore((state) => state.disconnect);
  const socket = useSocketStore((state) => state.socket);

  // Initialize socket with JWT when token is available
  useEffect(() => {
    if (token && !socket) {
      initialize(token);
    }
    // Disconnect socket if user logs out
    if (!token && socket) {
      disconnect();
    }
  }, [token, socket, initialize, disconnect]);

  // Handle auth error (invalid/expired token) from socket
  useEffect(() => {
    if (!socket) return;
    const handleAuthError = (err) => {
      if (
        err.message === "Authentication required" ||
        err.message === "Invalid token"
      ) {
        useUserStore.getState().logout();
      }
    };
    socket.on("connect_error", handleAuthError);
    return () => socket.off("connect_error", handleAuthError);
  }, [socket]);

  return (
    <Router>
      <div className="bg-gray-950 min-h-screen">
        <Routes>
          {token ? (
            <>
              <Route path="/" element={<Home />} />
              <Route path="/lobby/:roomCode" element={<Lobby />} />
              <Route path="/game/:roomCode" element={<Game />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
