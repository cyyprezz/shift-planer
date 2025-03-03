import { Container, Typography } from "@mui/material";
import AppRoutes from "./routes";

const App = () => {
  return (
    <Container maxWidth="sm" style={{ textAlign: "center", marginTop: "50px" }}>
      <Typography variant="h4" gutterBottom>Schichtplan Generator</Typography>
      <AppRoutes />
    </Container>
  );
};

export default App;
