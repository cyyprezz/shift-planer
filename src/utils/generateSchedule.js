import { db } from "../firebase";
import { collection, query, where, orderBy, limit, getDocs, addDoc, Timestamp } from "firebase/firestore";
// NOT IN USE !!!!
// Wochentage
const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

// Schicht-Typen (Samstag & Sonntag nur Morgens/Abends)
const SHIFT_TYPES = {
  "Montag": ["Morgens", "Mittags", "Abends"],
  "Dienstag": ["Morgens", "Mittags", "Abends"],
  "Mittwoch": ["Morgens", "Mittags", "Abends"],
  "Donnerstag": ["Morgens", "Mittags", "Abends"],
  "Freitag": ["Morgens", "Mittags", "Abends"],
  "Samstag": ["Morgens", "Abends"],
  "Sonntag": ["Morgens", "Abends"]
};

// 🔥 **Schritt 1: Historie aus Firestore abrufen**
const getHistoryData = async () => {
  const historyRef = collection(db, "history");
  const historyQuery = query(historyRef, orderBy("timestamp", "desc"), limit(50)); // Letzte 50 Schichten analysieren
  const snapshot = await getDocs(historyQuery);

  const history = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    data.employees.forEach(emp => {
      if (!history[emp.id]) history[emp.id] = 0;
      history[emp.id]++; // Zähle, wie oft jeder gearbeitet hat
    });
  });

  return history;
};

// 🔥 **Schritt 2: Schichtplan generieren & faire Verteilung berücksichtigen**
export const generateSchedule = async (employees) => {
  try {
    const history = await getHistoryData(); // Hol Historie
    let schedule = [];

    // Tracke, wie viele Schichten jeder Mitarbeiter bereits hat
    let shiftsAssigned = {};
    employees.forEach(emp => shiftsAssigned[emp.id] = 0);

    for (const day of WEEKDAYS) {
      for (const shift of SHIFT_TYPES[day]) {
        // Verfügbare Mitarbeiter filtern (die nicht blockiert sind und noch Schichten übrig haben)
        let kitchenWorkers = employees.filter(e => 
          e.role === "Küche" && 
          !e.blockedShifts?.[day]?.includes(shift) &&
          shiftsAssigned[e.id] < e.maxShifts
        );

        let dishwashers = employees.filter(e => 
          e.role === "Spüle" && 
          !e.blockedShifts?.[day]?.includes(shift) &&
          shiftsAssigned[e.id] < e.maxShifts
        );

        // Frühschicht Mo-Fr nur 1 in der Spüle
        const spuelCount = (day === "Samstag" || day === "Sonntag" || shift !== "Morgens") ? 2 : 1;

        // 🔥 **Faire Verteilung:** Mitarbeiter mit weniger Schichten bevorzugen
        kitchenWorkers.sort((a, b) => (history[a.id] || 0) - (history[b.id] || 0));
        dishwashers.sort((a, b) => (history[a.id] || 0) - (history[b.id] || 0));

        // Wähle Mitarbeiter für die Schicht (falls nicht genug, dann so viele wie möglich)
        const selectedKitchen = kitchenWorkers.slice(0, 2);
        const selectedSpuel = dishwashers.slice(0, spuelCount);

        // **Falls zu wenig Leute gefunden wurden, andere verfügbare Mitarbeiter einspringen lassen**
        if (selectedKitchen.length < 2) {
          let missing = 2 - selectedKitchen.length;
          let backupKitchen = employees.filter(e => 
            e.role === "Küche" && 
            !selectedKitchen.includes(e) &&
            shiftsAssigned[e.id] < e.maxShifts
          );
          selectedKitchen.push(...backupKitchen.slice(0, missing));
        }

        if (selectedSpuel.length < spuelCount) {
          let missing = spuelCount - selectedSpuel.length;
          let backupSpuel = employees.filter(e => 
            e.role === "Spüle" && 
            !selectedSpuel.includes(e) &&
            shiftsAssigned[e.id] < e.maxShifts
          );
          selectedSpuel.push(...backupSpuel.slice(0, missing));
        }

        // ✅ **Verhindern, dass ein Mitarbeiter über sein Limit kommt**
        selectedKitchen.forEach(e => shiftsAssigned[e.id]++);
        selectedSpuel.forEach(e => shiftsAssigned[e.id]++);

        // Falls nicht genug Leute da sind, bleibt die Schicht leer
        if (selectedKitchen.length === 2 && selectedSpuel.length === spuelCount) {
          schedule.push({
            weekday: day,
            shift: shift,
            employees: [...selectedKitchen, ...selectedSpuel],
            timestamp: Timestamp.now(),
          });
        }
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
    const historyRef = collection(db, "history"); // Neue Referenz zur Historie

    for (const shift of schedule) {
      await addDoc(shiftsRef, shift);

      // 🔥 Speichere jede Schicht auch in die Historie
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
