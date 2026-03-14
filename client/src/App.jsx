import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Game from "./pages/Game";
import Lobby from "./pages/Lobby";
import { useSocketStore } from "./store/socketStore";
import { useEffect } from "react";

function App() {
  const initializeSocket = useSocketStore((state) => state.initialize);

  useEffect(() => {
    initializeSocket();
  }, [initializeSocket]);

  return (
    <Router>
      <div className="bg-gray-950 min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby/:roomCode" element={<Lobby />} />
          <Route path="/game/:roomCode" element={<Game />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
