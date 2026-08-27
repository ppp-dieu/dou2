import type {
  Mitate,
  MitateState,
  MitateSuggestion,
} from "@/app/mitate/types";
import {
  ApiError,
  apiErrorResponse,
  getVerifiedUser,
} from "@/lib/server/line-user";

type MitateRow = {
  id: string;
  couple_id: string;
  consultation_id: string;
  title: string;
  event_summary: string;
  consultant_states: unknown;
  respondent_states: unknown;
  suggestions: unknown;
  created_at: string;
};

type UserRow = {
  id: string;
  display_name: string;
  picture_url: string | null;
};

const tokyoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDisplayDate(createdAt: string) {
  const parts = tokyoDateFormatter.formatToParts(new Date(createdAt));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  return `${value("year")}.${value("month")}.${value("day")}`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ mitateId: string }> },
) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);
    const { mitateId } = await context.params;

    const { data: mitateData, error: mitateError } = await supabase
      .from("mitates")
      .select(
        "id, couple_id, consultation_id, title, event_summary, consultant_states, respondent_states, suggestions, created_at",
      )
      .eq("id", mitateId)
      .maybeSingle();

    if (mitateError) {
      console.error("Failed to load mitate", mitateError);
      throw new ApiError("ミタテを取得できませんでした", 500);
    }

    if (!mitateData) {
      throw new ApiError("対象のミタテが見つかりません", 404);
    }

    const mitate = mitateData as MitateRow;
    const { data: consultation, error: consultationError } = await supabase
      .from("consultations")
      .select("id, couple_id, consultant_user_id, respondent_user_id")
      .eq("id", mitate.consultation_id)
      .maybeSingle();

    if (consultationError) {
      console.error("Failed to load mitate consultation", consultationError);
      throw new ApiError("ミタテを取得できませんでした", 500);
    }

    if (
      !consultation ||
      (consultation.consultant_user_id !== userId &&
        consultation.respondent_user_id !== userId) ||
      consultation.couple_id !== mitate.couple_id
    ) {
      throw new ApiError("対象のミタテが見つかりません", 404);
    }

    const { data: userData, error: usersError } = await supabase
      .from("users")
      .select("id, display_name, picture_url")
      .in("id", [
        consultation.consultant_user_id,
        consultation.respondent_user_id,
      ]);

    if (usersError) {
      console.error("Failed to load mitate users", usersError);
      throw new ApiError("ミタテを取得できませんでした", 500);
    }

    const usersById = new Map(
      ((userData ?? []) as UserRow[]).map((user) => [user.id, user]),
    );
    const consultant = usersById.get(consultation.consultant_user_id);
    const respondent = usersById.get(consultation.respondent_user_id);

    if (!consultant || !respondent) {
      throw new ApiError("ミタテを取得できませんでした", 500);
    }

    const response: Mitate = {
      id: mitate.id,
      createdAt: mitate.created_at,
      displayDate: formatDisplayDate(mitate.created_at),
      title: mitate.title,
      eventSummary: mitate.event_summary,
      consultant: {
        name: consultant.display_name,
        pictureUrl: consultant.picture_url,
        states: mitate.consultant_states as [
          MitateState,
          MitateState,
          MitateState,
        ],
      },
      respondent: {
        name: respondent.display_name,
        pictureUrl: respondent.picture_url,
        states: mitate.respondent_states as [
          MitateState,
          MitateState,
          MitateState,
        ],
      },
      suggestions: mitate.suggestions as [
        MitateSuggestion,
        MitateSuggestion,
        MitateSuggestion,
      ],
    };

    return Response.json(response);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
