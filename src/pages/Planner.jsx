import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import {
    Container,
    Typography,
    Button,
    List,
    ListItem,
    ListItemText,
    TextField,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Checkbox,
    FormControlLabel,
    Select,
    MenuItem,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { generateShifts, saveScheduleToFirestore  } from "../utils/generateShifts";
//import { generateSchedule, saveScheduleToFirestore } from "../utils/generateSchedule"; 
import useShiftStore from "../store/useShiftStore";

const Planner = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [shifts, setShifts] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [newEmployee, setNewEmployee] = useState("");
    const [maxShifts, setMaxShifts] = useState(5);
    const [role, setRole] = useState("Küche");
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [blockedShifts, setBlockedShifts] = useState({});
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const { saveShifts } = useShiftStore();

    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (!user) {
                console.log("🚫 Kein Nutzer eingeloggt, Weiterleitung zur Startseite...");
                navigate("/");
            } else {
                setUser(user);
            }
        });

        const unsubscribeShifts = onSnapshot(collection(db, "shifts"), (snapshot) => {
            setShifts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        });

        const unsubscribeEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
            setEmployees(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubscribeAuth();
            unsubscribeShifts();
            unsubscribeEmployees();
        };
    }, [navigate]);

    const addEmployee = async () => {
        if (!newEmployee.trim()) return;
        try {
            await addDoc(collection(db, "employees"), { name: newEmployee, maxShifts, role, blockedShifts: {} });
            setNewEmployee("");
            setMaxShifts(5);
            setRole("Küche");
            console.log("✅ Mitarbeiter hinzugefügt");
        } catch (error) {
            console.error("❌ Fehler beim Hinzufügen:", error);
        }
    };

    const handleGenerateShifts = async () => {
        console.log("📅 Schichtgenerierung wird gestartet...");
        const result = await generateShifts();
        navigate("/shifts");
        //await saveScheduleToFirestore(result)
        await saveShifts(result);
        if (result) {
            console.log("✅ Schichtplan erfolgreich erstellt!", result);
        } else {
            console.error("❌ Fehler beim Erstellen des Schichtplans.");
        }
    };

    //const handleGenerateSchedule = async () => {
    //    console.log("📅 Schichtplan wird generiert...");
   //     const schedule = await generateSchedule(employees);
   //     await saveScheduleToFirestore(schedule);
   //     console.log("✅ Schichtplan gespeichert!");
   //   };

    const deleteEmployee = async (id) => {
        try {
            await deleteDoc(doc(db, "employees", id));
            console.log("✅ Mitarbeiter entfernt");
        } catch (error) {
            console.error("❌ Fehler beim Löschen:", error);
        }
    };

    const openEditDialog = (employee) => {
        setSelectedEmployee(employee);
        setBlockedShifts(employee.blockedShifts || {});
        setRole(employee.role || "Küche");
        setEditDialogOpen(true);
    };

    const handleBlockedShiftChange = (day, shift) => {
        setBlockedShifts((prev) => {
            const updated = { ...prev };
            if (!updated[day]) updated[day] = [];
            if (updated[day].includes(shift)) {
                updated[day] = updated[day].filter((s) => s !== shift);
            } else {
                updated[day].push(shift);
            }
            return updated;
        });
    };

    const saveEmployeeChanges = async () => {
        if (selectedEmployee) {
            try {
                await updateDoc(doc(db, "employees", selectedEmployee.id), {
                    blockedShifts,
                    role,
                });
                console.log("✅ Änderungen gespeichert");
            } catch (error) {
                console.error("❌ Fehler beim Speichern:", error);
            }
            setEditDialogOpen(false);
        }
    };

    const handleLogout = async () => {
        try {
            console.log("🚪 Logout aufgerufen");
            await signOut(auth);
            navigate("/");
        } catch (error) {
            console.error("❌ Fehler beim Logout:", error);
        }
    };

    return (
        <Container maxWidth="sm" style={{ textAlign: "center", marginTop: "50px" }}>
            <Typography variant="h4" gutterBottom>Schichtplanung</Typography>
            {user ? (
                <>
                    <Typography variant="h6">Willkommen, {user.displayName}! Verwalte hier dein Personal:</Typography>

                    {/* Formular zum Hinzufügen von Mitarbeitern */}
                    <TextField
                        label="Mitarbeitername"
                        variant="outlined"
                        size="small"
                        value={newEmployee}
                        onChange={(e) => setNewEmployee(e.target.value)}
                        style={{ margin: "10px" }}
                    />
                    <TextField
                        label="Max. Schichten"
                        type="number"
                        variant="outlined"
                        size="small"
                        value={maxShifts}
                        onChange={(e) => setMaxShifts(parseInt(e.target.value))}
                        style={{ margin: "10px" }}
                    />
                    <Select value={role} onChange={(e) => setRole(e.target.value)} style={{ margin: "10px" }}>
                        <MenuItem value="Küche">Küche</MenuItem>
                        <MenuItem value="Spüle">Spüle</MenuItem>
                    </Select>
                    <Button variant="contained" color="primary" onClick={addEmployee}>
                        Hinzufügen
                    </Button>

                    {/* Liste der Mitarbeiter */}
                    <List>
                        {employees.map((employee) => (
                            <ListItem key={employee.id}>
                                <ListItemText primary={`${employee.name} (Rolle: ${employee.role}, Max: ${employee.maxShifts} Schichten)`} />
                                <Button onClick={() => openEditDialog(employee)}>Bearbeiten</Button>
                                <IconButton edge="end" onClick={() => deleteEmployee(employee.id)}>
                                    <DeleteIcon />
                                </IconButton>
                            </ListItem>
                        ))}
                    </List>

                    {/* Bearbeiten-Dialog */}
                    <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
                        <DialogTitle>Schichten blockieren</DialogTitle>
                        <DialogContent>
                            <Select value={role} onChange={(e) => setRole(e.target.value)} style={{ marginBottom: "10px" }}>
                                <MenuItem value="Küche">Küche</MenuItem>
                                <MenuItem value="Spüle">Spüle</MenuItem>
                            </Select>
                            {["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"].map((day) => (
                                <div key={day}>
                                    <Typography>{day}</Typography>
                                    {["Morgens", "Mittags", "Abends"].map((shift) => (
                                        <FormControlLabel
                                            key={shift}
                                            control={<Checkbox checked={blockedShifts[day]?.includes(shift)} onChange={() => handleBlockedShiftChange(day, shift)} />}
                                            label={shift}
                                        />
                                    ))}
                                </div>
                            ))}
                            {["Samstag", "Sonntag"].map((day) => (
                                <div key={day}>
                                    <Typography>{day}</Typography>
                                    {["Morgens", "Abends"].map((shift) => (
                                        <FormControlLabel
                                            key={shift}
                                            control={<Checkbox checked={blockedShifts[day]?.includes(shift)} onChange={() => handleBlockedShiftChange(day, shift)} />}
                                            label={shift}
                                        />
                                    ))}
                                </div>
                            ))}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setEditDialogOpen(false)}>Abbrechen</Button>
                            <Button onClick={saveEmployeeChanges} color="primary">Speichern</Button>
                        </DialogActions>
                    </Dialog>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleGenerateShifts}
                        style={{ marginTop: "20px" }}
                    >
                        Schichtplan generieren
                    </Button>;
                    <Button variant="contained" color="secondary" onClick={handleLogout} style={{ marginTop: "20px" }}>
                        Logout
                    </Button>
                </>
            ) : null}
        </Container>
    );
};

export default Planner;
