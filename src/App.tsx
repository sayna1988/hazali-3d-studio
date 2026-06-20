import "./App.css";



import {
  Routes,
  Route
} from "react-router-dom";
import BottomNavigation from "./components/BottomNavigation/BottomNavigation";
import Sidebar from "./components/Sidebar/Sidebar";
import Dashboard from "./pages/Dashboard";
import Filamenten from "./pages/Filamenten";
import Prints from "./pages/Prints";
import PrintDetails from "./pages/PrintDetails";
import Voorraad from "./pages/Voorraad";
import MijnPrinter from "./pages/MijnPrinter";
import { Navigate } from "react-router-dom";
import Inventaris from "./pages/Inventaris";



function App() {

  return (
    <div className="app"> 
      
      <Sidebar />

      <main className="content">

        <Routes>

          <Route
            path="/"
            element={<Dashboard />}
          />
          
          <Route
              path="/inventaris"
              element={<Inventaris />}
          />

          <Route
            path="/filamenten"
            element={<Filamenten />}
          />

          <Route
            path="/prints"
            element={<Prints />}
          />

          <Route
            path="/prints/:id"
            element={<PrintDetails />}
          />

          <Route
            path="/voorraad"
            element={<Voorraad />}
          />

          <Route path="/mijn-printer" element={<MijnPrinter />} />
          <Route path="/instellingen" element={<Navigate to="/mijn-printer" replace />} />

        </Routes>

      </main>

<BottomNavigation />

</div>
  );
}

export default App;
