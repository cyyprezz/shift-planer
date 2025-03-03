import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Planner from "./pages/Planner";
import ShiftOverview from "./pages/ShiftOverview";

const AppRoutes = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/shifts" element={<ShiftOverview />} />
      </Routes>
    </Router>
  );
};

export default AppRoutes;
