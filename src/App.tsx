import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import InboxPage from "./pages/InboxPage";
import SchedulePage from "./pages/SchedulePage";

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gray-50 text-gray-900">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<InboxPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/search" element={<InboxPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
