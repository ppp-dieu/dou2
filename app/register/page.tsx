"use client";

import { initializeLiff, getLiffProfile } from "@/lib/liff";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import RegisterStep1 from "./components/RegisterStep1";
import RegisterStep2 from "./components/RegisterStep2";
import RegisterComplete from "./components/RegisterComplete";

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2 | "complete">(1);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [livingStatus, setLivingStatus] = useState("");
const handleComplete = async () => {
  await initializeLiff();

  const profile = await getLiffProfile();

  if (!profile) {
    return;
  }

  const { error } = await supabase
    .from("users")
    .update({
      display_name: name,
      relationship_type: relationship,
      living_type: livingStatus,
      registration_completed: true,
      registered_at: new Date().toISOString(),
    })
    .eq("line_user_id", profile.userId);

  if (error) {
    console.error(error);
    return;
  }

  setStep("complete");
};
  if (step === 1) {
    return (
      <RegisterStep1
        name={name}
        onNameChange={setName}
        onNext={() => setStep(2)}
      />
    );
  }

  if (step === 2) {
    return (
      <RegisterStep2
        relationship={relationship}
        onRelationshipChange={setRelationship}
        livingStatus={livingStatus}
        onLivingStatusChange={setLivingStatus}
        onBack={() => setStep(1)}
        onComplete={handleComplete}
      />
    );
  }

  return <RegisterComplete />;
}