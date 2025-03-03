import { collection, getDocs, addDoc, query, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "../firebase";

// Verfügbare Schichten
const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const SHIFTS = {
    weekday: ["Morgens", "Mittags", "Abends"], // Mo-Fr
    weekend: ["Morgens", "Abends"], // Sa-So
};

// 🔥 **Schritt 1: Historie abrufen**
const getHistoryData = async () => {
    const historyRef = collection(db, "history");
    const historyQuery = query(historyRef, orderBy("timestamp", "desc"), limit(50)); // Letzte 50 Schichten analysieren
    const snapshot = await getDocs(historyQuery);

    const history = {};

    snapshot.forEach(doc => {
        const data = doc.data();

        data.employees.forEach(emp => {
            if (!history[emp.id]) {
                history[emp.id] = { totalShifts: 0, weekdays: {} };
            }

            // Gesamtzahl der Schichten für den Mitarbeiter hochzählen
            history[emp.id].totalShifts++;

            // Sicherstellen, dass der Wochentag existiert
            if (!history[emp.id].weekdays[data.weekday]) {
                history[emp.id].weekdays[data.weekday] = {};
            }

            // Sicherstellen, dass die Schicht existiert
            if (!history[emp.id].weekdays[data.weekday][data.shift]) {
                history[emp.id].weekdays[data.weekday][data.shift] = 0;
            }

            // Zähle, wie oft der Mitarbeiter in dieser Schicht am Wochentag gearbeitet hat
            history[emp.id].weekdays[data.weekday][data.shift]++;
        });
    });

    return history;
};

// 🔥 **Schritt 2: Schichtplan generieren mit Historie**
export const generateShifts = async () => {
    try {
        console.log("📅 Schichtgenerierung gestartet...");

        // Mitarbeiter abrufen
        const employeesSnap = await getDocs(collection(db, "employees"));
        let employees = employeesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        // Historie abrufen
        const history = await getHistoryData();

        // Anzahl der benötigten Schichten für Küche & Spüle separat berechnen
        let totalKitchenShifts = 0;
        let totalDishShifts = 0;

        for (const day of DAYS) {
            if (day === "Samstag" || day === "Sonntag") {
                totalKitchenShifts += 2; // 2 Küchenschichten pro Tag
                totalDishShifts += 2; // 2 Spülschichten pro Tag
            } else {
                totalKitchenShifts += 2; // Mo-Fr immer 2 Küchenschichten
                totalDishShifts += 1 + 2; // Morgens 1 Spülschicht, Mittags/Abends je 2
            }
        }


        // Schichtplan vorbereiten
        let schedule = [];

        // Liste aller möglichen Schichten zufällig mischen
        let allShifts = [];
        for (const day of DAYS) {
            const shifts = day === "Samstag" || day === "Sonntag" ? SHIFTS.weekend : SHIFTS.weekday;
            for (const shift of shifts) {
                allShifts.push({ day, shift });
            }
        }
        allShifts = allShifts.sort(() => Math.random() - 0.5); // Zufällig mischen

        for (const { day, shift } of allShifts) {
            let assignedEmployees = [];

            // Mitarbeiter-Sortierung basierend auf der Historie
            let kitchenEmployees = employees
                .filter((e) => e.role === "Küche")
                .sort((a, b) => (history[a.id]?.weekdays?.[day]?.[shift] || 0) - (history[b.id]?.weekdays?.[day]?.[shift] || 0));

            let dishEmployees = employees
                .filter((e) => e.role === "Spüle")
                .sort((a, b) => (history[a.id]?.weekdays?.[day]?.[shift] || 0) - (history[b.id]?.weekdays?.[day]?.[shift] || 0));


            // Passende Mitarbeiter filtern (ohne Blockierung & mit noch freien Schichten)
            let availableKitchen = kitchenEmployees.filter((e) =>
                (!e.blockedShifts?.[day] || !e.blockedShifts[day].includes(shift)) &&
                e.maxShifts > 0
            );

            let availableDish = dishEmployees.filter((e) =>
                (!e.blockedShifts?.[day] || !e.blockedShifts[day].includes(shift)) &&
                e.maxShifts > 0
            );

            // Berechne die richtige Anzahl an Mitarbeitern pro Schicht
            let kitchenNeeded = 2;
            let dishwashingNeeded = shift === "Morgens" && DAYS.slice(0, 5).includes(day) ? 1 : 2; // Mo-Fr Morgens = 1, sonst 2

            // Küche zuweisen
            let kitchen = availableKitchen.slice(0, kitchenNeeded);
            // Spüle zuweisen
            let dishwashing = availableDish.slice(0, dishwashingNeeded);

            // Falls nicht genug Leute da sind, alternative Schichten finden
            if (kitchen.length < kitchenNeeded) {
                let missing = kitchenNeeded - kitchen.length;
                let alternativeKitchen = kitchenEmployees.filter((e) => e.maxShifts > 0 && !kitchen.includes(e));
                kitchen = [...kitchen, ...alternativeKitchen.slice(0, missing)];
            }

            if (dishwashing.length < dishwashingNeeded) {
                let missing = dishwashingNeeded - dishwashing.length;
                let alternativeDish = dishEmployees.filter((e) => e.maxShifts > 0 && !dishwashing.includes(e));
                dishwashing = [...dishwashing, ...alternativeDish.slice(0, missing)];
            }

            assignedEmployees = [...kitchen, ...dishwashing];

            if (assignedEmployees.length > 0) {
                schedule.push({
                    weekday: day,
                    shift: shift,
                    employees: assignedEmployees.map((e) => ({ id: e.id, name: e.name, role: e.role })),
                    timestamp: Timestamp.now(),
                });

                // Reduziere die max. Schichten pro Mitarbeiter
                kitchen.forEach((e) => e.maxShifts--);
                dishwashing.forEach((e) => e.maxShifts--);
            }
        }

        console.log("✅ Neuer fairer Schichtplan:", schedule);
        return schedule;
    } catch (error) {
        console.error("❌ Fehler beim Generieren des Plans:", error);
        return [];
    }
};

// 🔥 **Schritt 3: Schichtplan in Firestore speichern**
export const saveScheduleToFirestore = async (schedule) => {
    try {
        const shiftsRef = collection(db, "shifts");
        const historyRef = collection(db, "history");

        for (const shift of schedule) {
            await addDoc(shiftsRef, shift);
            await addDoc(historyRef, {
                weekday: shift.weekday,
                shift: shift.shift,
                employees: shift.employees.map(emp => ({
                    id: emp.id,
                    name: emp.name,
                    role: emp.role
                })),
                timestamp: Timestamp.now(),
            });
        }

        console.log("✅ Schichtplan & Historie erfolgreich gespeichert!");
    } catch (error) {
        console.error("❌ Fehler beim Speichern des Schichtplans:", error);
    }
};
