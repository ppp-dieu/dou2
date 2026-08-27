export type MitateState = {
  label: string;
  description: string;
};

export type MitateUser = {
  name: string;
  pictureUrl: string | null;
  states: [MitateState, MitateState, MitateState];
};

export type MitateSuggestion = {
  label: "A" | "B" | "C";
  title: string;
  description: string;
};

export type Mitate = {
  id: string;
  createdAt: string;
  displayDate: string;
  title: string;
  eventSummary: string;
  consultant: MitateUser;
  respondent: MitateUser;
  suggestions: [
    MitateSuggestion,
    MitateSuggestion,
    MitateSuggestion,
  ];
};
