import "./App.css";



import {
  Routes,
  Route
} from "react-router-dom";
import BottomNavigation from "./components/BottomNavigation/BottomNavigation";
import Sidebar from "./components/Sidebar/Sidebar";
import Dashboard from "./pages/Dashboard";
import Dealtracker from "./pages/Dealtracker";
import Filamenten from "./pages/Filamenten";
import Prints from "./pages/Prints";
import PrintDetails from "./pages/PrintDetails";
import Voorraad from "./pages/Voorraad";
import Inventaris from "./pages/Inventaris";
import Instellingen from "./pages/Instellingen";



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
            path="/dealtracker"
            element={<Dealtracker />}
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

          <Route
            path="/instellingen"
            element={<Instellingen />}
          />

        </Routes>

      </main>

<BottomNavigation />

</div>
  );
}

export default App;
