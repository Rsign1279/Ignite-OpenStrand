import React from "react";
import { createRoot } from "react-dom/client";
import { PilotCapacity } from "@/components/staff/pilot-capacity";
createRoot(document.getElementById("root")!).render(
  <main>
    <h1>Synthetic capacity preview</h1>
    <PilotCapacity />
  </main>,
);
