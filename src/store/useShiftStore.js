import { create } from "zustand";
import { collection, getDocs, deleteDoc, doc, addDoc } from "firebase/firestore";
import { db } from "../firebase";

const useShiftStore = create((set) => ({
  shifts: [],
  loading: false,

  // **Schichten aus Firestore abrufen**
  fetchShifts: async () => {
    set({ loading: true });

    try {
      const snapshot = await getDocs(collection(db, "shifts"));
      const shifts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      set({ shifts, loading: false });
    } catch (error) {
      console.error("Fehler beim Abrufen der Schichten:", error);
      set({ loading: false });
    }
  },

  // **Schichtplan speichern & Historie aktualisieren**
  saveShifts: async (newShifts) => {
    try {
      const shiftsRef = collection(db, "shifts");
      const historyRef = collection(db, "history");

      // **1️⃣ Alle alten Schichten aus `shifts` löschen**
      const shiftsSnapshot = await getDocs(shiftsRef);
      const deletePromises = shiftsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // **2️⃣ Neue Schichten in `shifts` speichern**
      const addShiftPromises = newShifts.map(shift => addDoc(shiftsRef, shift));
      await Promise.all(addShiftPromises);

      // **3️⃣ Neue Historie in `history` speichern**
      const addHistoryPromises = newShifts.map(shift =>
        addDoc(historyRef, {
          weekday: shift.weekday,
          shift: shift.shift,
          employees: shift.employees.map(emp => ({
            id: emp.id,
            name: emp.name,
            role: emp.role
          })),
          timestamp: new Date(), // Firestore-Timestamp für Sortierung
        })
      );
      await Promise.all(addHistoryPromises);

      // **4️⃣ Zustand mit neuen Schichten aktualisieren**
      set({ shifts: newShifts });

      console.log("✅ Neuer Schichtplan & Historie erfolgreich gespeichert!");
    } catch (error) {
      console.error("❌ Fehler beim Speichern des Schichtplans & Historie:", error);
    }
  }
}));

export default useShiftStore;
