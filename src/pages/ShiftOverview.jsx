import React, { useEffect } from "react";
import useShiftStore from "../store/useShiftStore";
import { CircularProgress, List, ListItem, ListItemText, Typography, Grid2, Divider, Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
const SHIFT_ORDER = ["Morgens", "Mittags", "Abends"];
const WEEKDAYS_ORDER = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

const ShiftOverview = () => {
    const { shifts, fetchShifts, loading } = useShiftStore();
    const navigate = useNavigate();

    useEffect(() => {
        fetchShifts(); // **Schichten abrufen beim Laden der Seite**
    }, []);

    // ✅ Schichten nach Wochentag & Schicht sortieren
    const sortedShifts = [...shifts].sort((a, b) => {
        const dayA = WEEKDAYS_ORDER.indexOf(a.weekday);
        const dayB = WEEKDAYS_ORDER.indexOf(b.weekday);
        if (dayA !== dayB) return dayA - dayB;
        return SHIFT_ORDER.indexOf(a.shift) - SHIFT_ORDER.indexOf(b.shift);
    });

    return (
        <div>

            {/* 🔥 Zurück-Button */}
            <Button onClick={() => navigate("/planner")} variant="outlined" startIcon={<ArrowBackIcon />}>
                Zurück
            </Button>

            <Typography variant="h4" gutterBottom>📅 Schichtübersicht</Typography>

            {loading ? (
                <CircularProgress />
            ) : (
                <Grid2 container columns={12} spacing={2}>
                    {/* 🔥 Küche */}
                    <Grid2 sx={{ width: "100%", maxWidth: 600 }}>
                        <Typography variant="h6">👨‍🍳 Küche</Typography>
                        <List>
                            {sortedShifts.map((shift, index) => (
                                <React.Fragment key={`k-${index}`}>
                                    <ListItem>
                                        <ListItemText
                                            primary={`${shift.weekday} - ${shift.shift}`}
                                            secondary={shift.employees
                                                .filter(emp => emp.role === "Küche")
                                                .map(emp => emp.name)
                                                .join(", ") || "❌ Keine eingeteilt"}
                                        />
                                    </ListItem>
                                    <Divider />
                                </React.Fragment>
                            ))}
                        </List>
                    </Grid2>

                    {/* 🔥 Spüle */}
                    <Grid2 sx={{ width: "100%", maxWidth: 600 }}>
                        <Typography variant="h6">🧼 Spüle</Typography>
                        <List>
                            {sortedShifts.map((shift, index) => (
                                <React.Fragment key={`s-${index}`}>
                                    <ListItem>
                                        <ListItemText
                                            primary={`${shift.weekday} - ${shift.shift}`}
                                            secondary={shift.employees
                                                .filter(emp => emp.role === "Spüle")
                                                .map(emp => emp.name)
                                                .join(", ") || "❌ Keine eingeteilt"}
                                        />
                                    </ListItem>
                                    <Divider />
                                </React.Fragment>
                            ))}
                        </List>
                    </Grid2>
                </Grid2>
            )}
        </div>
    );
};

export default ShiftOverview;