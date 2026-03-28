import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Engineer from "./pages/Engineer";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/engineer" element={<Engineer />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
