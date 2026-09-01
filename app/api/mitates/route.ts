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

type UserRow = {
  id: string;
  display_name: string;
  picture_url: string | null;
};

type ConsultationRow = {
  id: string;
  couple_id: string;
  consultant_user_id: string;
  respondent_user_id: string;
  consultant: UserRow | null;
  respondent: UserRow | null;
};

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
  consultation: ConsultationRow;
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

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);

    const [
      { data: couples, error: couplesError },
      { data: mitateData, error: mitatesError },
    ] = await Promise.all([
      supabase
        .from("couples")
        .select("id")
        .eq("status", "connected")
        .or(`member_a_id.eq.${userId},member_b_id.eq.${userId}`),
      supabase
        .from("mitates")
        .select(
          `
            id,
            couple_id,
            consultation_id,
            title,
            event_summary,
            consultant_states,
            respondent_states,
            suggestions,
            created_at,
            consultation:consultations!inner(
              id,
              couple_id,
              consultant_user_id,
              respondent_user_id,
              consultant:users!consultations_consultant_user_id_fkey(
                id,
                display_name,
                picture_url
              ),
              respondent:users!consultations_respondent_user_id_fkey(
                id,
                display_name,
                picture_url
              )
            )
          `,
        )
        .or(
          `consultant_user_id.eq.${userId},respondent_user_id.eq.${userId}`,
          { referencedTable: "consultation" },
        )
        .order("created_at", { ascending: false })
        .overrideTypes<MitateRow[], { merge: false }>(),
    ]);

    if (couplesError) {
      console.error("Failed to load mitate couples", couplesError);
      throw new ApiError("ミタテを取得できませんでした", 500);
    }

    if (mitatesError) {
      console.error("Failed to load mitates", mitatesError);
      throw new ApiError("ミタテを取得できませんでした", 500);
    }

    const coupleIds = new Set(
      (couples ?? []).map((couple) => couple.id as string),
    );

    if (coupleIds.size === 0) return Response.json([] satisfies Mitate[]);

    const mitates = (mitateData ?? []).filter((mitate) => {
      const consultation = mitate.consultation;
      return (
        coupleIds.has(mitate.couple_id) &&
        consultation.couple_id === mitate.couple_id &&
        (consultation.consultant_user_id === userId ||
          consultation.respondent_user_id === userId)
      );
    });

    if (mitates.length === 0) return Response.json([] satisfies Mitate[]);

    const response = mitates.map((mitate): Mitate => {
      const { consultant, respondent } = mitate.consultation;

      if (!consultant || !respondent) {
        throw new ApiError("ミタテを取得できませんでした", 500);
      }

      return {
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
    });

    return Response.json(response);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    return apiErrorResponse(error);
  }
}
