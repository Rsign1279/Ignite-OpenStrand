import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { PilotCapacity } from "@/components/staff/pilot-capacity";
function Preview() {
  const [showCapacity, setShowCapacity] = useState(true);
  return (
    <main>
      <h1>Synthetic capacity preview</h1>
      <button onClick={() => setShowCapacity(false)}>
        Leave capacity view
      </button>
      {showCapacity && <PilotCapacity />}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
