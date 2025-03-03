import { Button } from "@mui/material";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth, provider } from "../firebase";

const LoginButton = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    console.log("🔍 Überprüfung: auth.currentUser nach Seiten-Neuladen...");
    if (auth.currentUser) {
      console.log("✅ Nutzer bereits angemeldet:", auth.currentUser);
      setUser(auth.currentUser);
    }
  }, []);

  const handleLogin = async () => {
    try {
      console.log("🔄 Login-Versuch gestartet...");
      const popupResult = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(popupResult);
      const token = credential?.accessToken;
      console.log("✅ Login erfolgreich! Nutzer-Info:", popupResult.user, "Token:", token);
      setUser(popupResult.user);
    } catch (error) {
      console.error("❌ Fehler beim Login:", error.code, error.message, error);
    }
  };

  return (
    <Button variant="contained" color="primary" onClick={handleLogin}>
      {user ? `Angemeldet als ${user.displayName}` : "Mit Google anmelden"}
    </Button>
  );
};

export default LoginButton;
