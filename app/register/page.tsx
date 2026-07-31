"use client";

import { useState } from "react";
import RegisterStep1 from "./components/RegisterStep1";
import RegisterStep2 from "./components/RegisterStep2";
import RegisterComplete from "./components/RegisterComplete";

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2 | "complete">(1);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [livingStatus, setLivingStatus] = useState("");

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
        onComplete={() => setStep("complete")}
      />
    );
  }

  return <RegisterComplete />;
}