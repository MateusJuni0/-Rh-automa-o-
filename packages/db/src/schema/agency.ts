import { bigint, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agencyId, createdAt, deletedAt, pk } from "./_shared";

/** Agência (tenant raiz). v1 = só a IRIS. */
export const agency = pgTable("agency", {
  id: pk(),
  name: text("name").notNull(),
  createdAt: createdAt(),
  deletedAt: deletedAt(),
});

/** Recrutador (Filipa/Inês). Liga a Supabase auth.users(id) — FK lógica (schema auth fora do Drizzle). */
export const recruiter = pgTable("recruiter", {
  id: pk(),
  agencyId: agencyId(),
  userId: uuid("user_id").notNull().unique(),
  name: text("name").notNull(),
  telegramChatId: bigint("telegram_chat_id", { mode: "number" }).unique(),
  telegramLinkedAt: timestamp("telegram_linked_at", { withTimezone: true }),
  // Enrollment de voz — fallback de diarização (MODELO §6).
  voiceEnrollmentPath: text("voice_enrollment_path"),
  voiceEnrolledAt: timestamp("voice_enrolled_at", { withTimezone: true }),
  createdAt: createdAt(),
});
