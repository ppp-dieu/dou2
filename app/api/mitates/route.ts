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

type ConsultationRow = {
  id: string;
  couple_id: string;
  consultant_user_id: string;
  respondent_user_id: string;
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

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await getVerifiedUser(request);

    const [
      { data: couples, error: couplesError },
      { data: consultationData, error: consultationsError },
    ] = await Promise.all([
      supabase
        .from("couples")
        .select("id")
        .or(`member_a_id.eq.${userId},member_b_id.eq.${userId}`),
      supabase
        .from("consultations")
        .select("id, couple_id, consultant_user_id, respondent_user_id")
        .or(
          `consultant_user_id.eq.${userId},respondent_user_id.eq.${userId}`,
        ),
    ]);

    if (couplesError) {
      console.error("Failed to load mitate couples", couplesError);
      throw new ApiError("ミタテを取得できませんでした", 500);
    }

    if (consultationsError) {
      console.error("Failed to load mitate consultations", consultationsError);
      throw new ApiError("ミタテを取得できませんでした", 500);
    }

    const coupleIds = new Set(
      (couples ?? []).map((couple) => couple.id as string),
    );

    if (coupleIds.size === 0) return Response.json([] satisfies Mitate[]);

    const consultations = (consultationData ?? []).filter((consultation) =>
      coupleIds.has(consultation.couple_id),
    ) as ConsultationRow[];

    if (consultations.length === 0) {
      return Response.json([] satisfies Mitate[]);
    }

    const consultationById = new Map(
      consultations.map((consultation) => [consultation.id, consultation]),
    );
    const { data: mitateData, error: mitatesError } = await supabase
      .from("mitates")
      .select(
        "id, couple_id, consultation_id, title, event_summary, consultant_states, respondent_states, suggestions, created_at",
      )
      .in("consultation_id", [...consultationById.keys()])
      .order("created_at", { ascending: false });

    if (mitatesError) {
      console.error("Failed to load mitates", mitatesError);
      throw new ApiError("ミタテを取得できませんでした", 500);
    }

    const mitates = (mitateData ?? []).filter((mitate) => {
      const consultation = consultationById.get(mitate.consultation_id);
      return consultation?.couple_id === mitate.couple_id;
    }) as MitateRow[];

    if (mitates.length === 0) return Response.json([] satisfies Mitate[]);

    const profileIds = [
      ...new Set(
        mitates.flatMap((mitate) => {
          const consultation = consultationById.get(mitate.consultation_id)!;
          return [
            consultation.consultant_user_id,
            consultation.respondent_user_id,
          ];
        }),
      ),
    ];
    const { data: userData, error: usersError } = await supabase
      .from("users")
      .select("id, display_name, picture_url")
      .in("id", profileIds);

    if (usersError) {
      console.error("Failed to load mitate users", usersError);
      throw new ApiError("ミタテを取得できませんでした", 500);
    }

    const usersById = new Map(
      ((userData ?? []) as UserRow[]).map((user) => [user.id, user]),
    );

    const response = mitates.map((mitate): Mitate => {
      const consultation = consultationById.get(mitate.consultation_id)!;
      const consultant = usersById.get(consultation.consultant_user_id);
      const respondent = usersById.get(consultation.respondent_user_id);

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
