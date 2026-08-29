import { sendConsultationReminderLinePushMessage } from "@/lib/line-messaging";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const maxDuration = 60;

const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;
const DAY_IN_MILLISECONDS = 24 * HOUR_IN_MILLISECONDS;

type ReminderKind = "24h" | "7d";

type ConsultationReminderCandidate = {
  id: string;
  respondent_user_id: string | null;
  reminder_24h_sent_at: string | null;
  reminder_7d_sent_at: string | null;
};

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  return (
    Boolean(cronSecret) &&
    request.headers.get("authorization") === `Bearer ${cronSecret}`
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_IN_MILLISECONDS);
  const twentyFourHoursAgo = new Date(now.getTime() - DAY_IN_MILLISECONDS);

  const { data: consultantResults, error: consultantResultsError } =
    await supabase
      .from("consultation_results")
      .select("consultation_id, created_at")
      .eq("role", "consultant")
      .lte("created_at", twentyFourHoursAgo.toISOString());

  if (consultantResultsError) {
    console.error(
      "Failed to load consultation reminder candidates",
      consultantResultsError,
    );
    return Response.json(
      { error: "Failed to load reminder candidates" },
      { status: 500 },
    );
  }

  if (!consultantResults || consultantResults.length === 0) {
    return Response.json({ processed: 0, sent: 0, failed: 0 });
  }

  const consultationIds = consultantResults.map(
    (result) => result.consultation_id,
  );
  const consultantResultCreatedAt = new Map(
    consultantResults.map((result) => [
      result.consultation_id,
      result.created_at,
    ]),
  );

  const [consultationsResponse, respondentResultsResponse] = await Promise.all([
    supabase
      .from("consultations")
      .select(
        "id, respondent_user_id, reminder_24h_sent_at, reminder_7d_sent_at",
      )
      .in("id", consultationIds),
    supabase
      .from("consultation_results")
      .select("consultation_id")
      .eq("role", "respondent")
      .in("consultation_id", consultationIds),
  ]);

  if (consultationsResponse.error || respondentResultsResponse.error) {
    console.error("Failed to verify unanswered consultations", {
      consultationsError: consultationsResponse.error,
      respondentResultsError: respondentResultsResponse.error,
    });
    return Response.json(
      { error: "Failed to verify reminder candidates" },
      { status: 500 },
    );
  }

  const answeredConsultationIds = new Set(
    (respondentResultsResponse.data ?? []).map(
      (result) => result.consultation_id,
    ),
  );
  const candidates = (
    consultationsResponse.data as ConsultationReminderCandidate[] | null
  )?.filter(
    (consultation) => !answeredConsultationIds.has(consultation.id),
  );

  if (!candidates || candidates.length === 0) {
    return Response.json({ processed: 0, sent: 0, failed: 0 });
  }

  const respondentUserIds = [
    ...new Set(
      candidates
        .map((consultation) => consultation.respondent_user_id)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ];
  const { data: respondents, error: respondentsError } = await supabase
    .from("users")
    .select("id, line_user_id")
    .in("id", respondentUserIds);

  if (respondentsError) {
    console.error("Failed to load consultation reminder recipients", respondentsError);
    return Response.json(
      { error: "Failed to load reminder recipients" },
      { status: 500 },
    );
  }

  const lineUserIds = new Map(
    (respondents ?? []).map((respondent) => [
      respondent.id,
      respondent.line_user_id?.trim() || null,
    ]),
  );
  let sent = 0;
  let failed = 0;

  for (const consultation of candidates) {
    const createdAt = consultantResultCreatedAt.get(consultation.id);
    let reminderKind: ReminderKind | null = null;
    if (createdAt && createdAt <= sevenDaysAgo.toISOString()) {
      reminderKind = consultation.reminder_7d_sent_at ? null : "7d";
    } else if (!consultation.reminder_24h_sent_at) {
      reminderKind = "24h";
    }

    if (!reminderKind || !consultation.respondent_user_id) {
      continue;
    }

    const lineUserId = lineUserIds.get(consultation.respondent_user_id);
    if (!lineUserId) {
      failed += 1;
      console.error("Consultation reminder recipient has no LINE user ID", {
        consultationId: consultation.id,
        respondentUserId: consultation.respondent_user_id,
        reminderKind,
      });
      continue;
    }

    try {
      await sendConsultationReminderLinePushMessage(lineUserId);

      const sentAtColumn =
        reminderKind === "7d"
          ? "reminder_7d_sent_at"
          : "reminder_24h_sent_at";
      const { error: updateError } = await supabase
        .from("consultations")
        .update({ [sentAtColumn]: new Date().toISOString() })
        .eq("id", consultation.id)
        .is(sentAtColumn, null);

      if (updateError) {
        throw new Error("Failed to save consultation reminder sent time", {
          cause: updateError,
        });
      }

      sent += 1;
    } catch (error) {
      failed += 1;
      console.error("Failed to send consultation reminder", {
        consultationId: consultation.id,
        respondentUserId: consultation.respondent_user_id,
        reminderKind,
        error,
      });
    }
  }

  return Response.json({ processed: candidates.length, sent, failed });
}
