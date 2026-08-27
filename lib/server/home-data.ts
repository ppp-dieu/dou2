import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/server/line-user";

export async function getPartnerData(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("couples")
    .select(
      "id, member_a_id, member_b_id, status, invite_code, invite_code_expires_at, connected_at",
    )
    .in("status", ["pending", "connected"])
    .or(`member_a_id.eq.${userId},member_b_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load couple", error);
    throw new Error("Failed to load couple");
  }

  return { couple: data ?? null };
}

export async function getRespondentConsultationData(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data: consultations, error: consultationsError } = await supabase
    .from("consultations")
    .select("id")
    .eq("respondent_user_id", userId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false });

  if (consultationsError) {
    console.error("Failed to load respondent consultations", consultationsError);
    throw new ApiError("回答可能な相談を取得できませんでした", 500);
  }

  if (!consultations || consultations.length === 0) {
    return { status: "none" as const };
  }

  const consultationIds = consultations.map((consultation) => consultation.id);
  const { data: results, error: resultsError } = await supabase
    .from("consultation_results")
    .select("consultation_id, role")
    .in("consultation_id", consultationIds);

  if (resultsError) {
    console.error("Failed to load consultation results", resultsError);
    throw new ApiError("回答可能な相談を取得できませんでした", 500);
  }

  const rolesByConsultation = new Map<string, Set<string>>();

  for (const result of results ?? []) {
    const roles = rolesByConsultation.get(result.consultation_id) ?? new Set();
    roles.add(result.role);
    rolesByConsultation.set(result.consultation_id, roles);
  }

  const pendingConsultation = consultations.find((consultation) => {
    const roles = rolesByConsultation.get(consultation.id);

    return roles?.has("consultant") && !roles.has("respondent");
  });

  if (!pendingConsultation) {
    return { status: "none" as const };
  }

  return {
    status: "pending" as const,
    consultationId: pendingConsultation.id,
  };
}

export async function getConsultationStateData(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data: consultation, error: consultationError } = await supabase
    .from("consultations")
    .select("id")
    .eq("consultant_user_id", userId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (consultationError) {
    console.error("Failed to load latest consultation", consultationError);
    throw new ApiError("相談状態を取得できませんでした", 500);
  }

  if (!consultation) {
    return { consultationState: "none" as const };
  }

  const { data: consultantResult, error: consultantResultError } = await supabase
    .from("consultation_results")
    .select("id")
    .eq("consultation_id", consultation.id)
    .eq("role", "consultant")
    .maybeSingle();

  if (consultantResultError) {
    console.error("Failed to load consultant result", consultantResultError);
    throw new ApiError("相談状態を取得できませんでした", 500);
  }

  if (!consultantResult) {
    return { consultationState: "none" as const };
  }

  const { data: respondentResult, error: respondentResultError } = await supabase
    .from("consultation_results")
    .select("id")
    .eq("consultation_id", consultation.id)
    .eq("role", "respondent")
    .maybeSingle();

  if (respondentResultError) {
    console.error("Failed to load respondent result", respondentResultError);
    throw new ApiError("相談状態を取得できませんでした", 500);
  }

  if (respondentResult) {
    return {
      consultationState: "partner_completed" as const,
      consultationId: consultation.id,
    };
  }

  return {
    consultationState: "waiting_for_partner" as const,
    consultationId: consultation.id,
  };
}
