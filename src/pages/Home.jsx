import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import LoginButton from "../components/LoginButton";

const Home = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log("✅ Nutzer eingeloggt, Weiterleitung zur Schichtplanung...");
        navigate("/planner");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>Willkommen beim Schichtplan Generator</h2>
      <p>Bitte melde dich mit Google an, um fortzufahren.</p>
      <LoginButton />
    </div>
  );
};

export default Home;