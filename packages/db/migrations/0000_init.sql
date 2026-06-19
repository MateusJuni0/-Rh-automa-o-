-- pgvector é obrigatória para as 4 tabelas de embedding (MODELO §10). drizzle-kit não
-- a emite automaticamente; prepend manual (seguro: o snapshot em meta/ rastreia o schema, não o SQL).
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "agency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recruiter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"telegram_chat_id" bigint,
	"telegram_linked_at" timestamp with time zone,
	"voice_enrollment_path" text,
	"voice_enrolled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "recruiter_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "recruiter_telegram_chat_id_unique" UNIQUE("telegram_chat_id")
);
--> statement-breakpoint
CREATE TABLE "assistant_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"recruiter_id" uuid NOT NULL,
	"thread_id" uuid,
	"tool" text NOT NULL,
	"efeito" text DEFAULT 'leitura' NOT NULL,
	"args" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_ref" text,
	"needs_confirm" boolean DEFAULT false NOT NULL,
	"confirmed_by" uuid,
	"status" text DEFAULT 'done' NOT NULL,
	"idempotency_key" text,
	"provider_message_id" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assistant_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"refs" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assistant_thread" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"recruiter_id" uuid NOT NULL,
	"active_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "async_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"recruiter_id" uuid NOT NULL,
	"thread_id" uuid,
	"kind" text NOT NULL,
	"args" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"progress" jsonb,
	"result_ref" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recruiter_memory_embedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fact_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recruiter_memory_fact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"recruiter_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"fact_text" text NOT NULL,
	"source_type" text DEFAULT 'learned' NOT NULL,
	"source_ref" text,
	"confidence" text DEFAULT 'media' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "candidate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"name" text NOT NULL,
	"linkedin_url" text,
	"profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"email" text,
	"phone" text,
	"name_normalized" text,
	"anonymized_at" timestamp with time zone,
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "candidate_memory_embedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fact_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_memory_fact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"process_id" uuid,
	"competencia" text NOT NULL,
	"fact_text" text NOT NULL,
	"evidence_quote" text,
	"evidence_ts" text,
	"speaker" text,
	"fact_type" text DEFAULT 'statement' NOT NULL,
	"classificacao" text DEFAULT 'professional' NOT NULL,
	"usar_no_score" boolean DEFAULT true NOT NULL,
	"corrigido_pela_filipa" boolean DEFAULT false NOT NULL,
	"corrected_by" uuid,
	"retain_until" timestamp with time zone,
	"source_type" text DEFAULT 'interview' NOT NULL,
	"source_doc_id" uuid,
	"estado_prova" text DEFAULT 'direto' NOT NULL,
	"tipo_criterio" text DEFAULT 'competencia' NOT NULL,
	"credencial_estado" text,
	"credencial_doc_ref" text,
	"revalidate_after" timestamp with time zone,
	"nao_sustentado" boolean DEFAULT false NOT NULL,
	"source_chunk_id" uuid[],
	"source_document_id" uuid,
	"cv_version" integer,
	"requisito_id" uuid,
	"rubric_level" text,
	"confianca" text DEFAULT 'media',
	"confianca_motivo" text,
	"parent_fact_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "cmf_rubric_level_chk" CHECK ("candidate_memory_fact"."rubric_level" IS NULL OR "candidate_memory_fact"."rubric_level" IN ('fraco','ok','forte')),
	CONSTRAINT "cmf_confianca_chk" CHECK ("candidate_memory_fact"."confianca" IS NULL OR "candidate_memory_fact"."confianca" IN ('alta','media','baixa'))
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"aliases" text[],
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "client_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"job_id" uuid,
	"criterio" text NOT NULL,
	"peso" text DEFAULT 'normal' NOT NULL,
	"origem" text DEFAULT 'setup' NOT NULL,
	"source_ref" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "client_memory_fact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"fact_text" text NOT NULL,
	"fact_type" text NOT NULL,
	"source_type" text NOT NULL,
	"source_ref" text,
	"source_snippet" text,
	"source_doc_id" uuid,
	"corrigido_pela_filipa" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"confirmed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "intake_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"recruiter_id" uuid NOT NULL,
	"source" text NOT NULL,
	"telegram_chat_id" bigint,
	"telegram_msg_id" bigint,
	"session_id" uuid,
	"raw_text" text,
	"doc_path" text,
	"audio_path" text,
	"audio_transcript" text,
	"extracted" jsonb,
	"entity_type" text,
	"entity_id" uuid,
	"alvo" text,
	"alvo_id" uuid,
	"intencao" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "intake_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"recruiter_id" uuid NOT NULL,
	"telegram_chat_id" bigint NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"target_entity" text,
	"target_job_id" uuid,
	"target_client_id" uuid,
	"messages_raw" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extraction" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"closed_at" timestamp with time zone,
	"expires_at" timestamp with time zone DEFAULT now() + interval '2 hours'
);
--> statement-breakpoint
CREATE TABLE "interview" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"process_id" uuid,
	"recruiter_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"ended_at" timestamp with time zone,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"capture_type" text,
	"livekit_room" text,
	"distilled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interview_gap" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer,
	"cause" text NOT NULL,
	"source_stream_id_before" text,
	"source_stream_id_after" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interview_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"track_id" text,
	"speaker_role" text DEFAULT 'unknown' NOT NULL,
	"display_name" text,
	"bound_by" uuid,
	"bound_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interview_tick" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"tick_n" integer NOT NULL,
	"live_state" jsonb NOT NULL,
	"suggestion" jsonb,
	"tokens_in" integer,
	"tokens_out" integer,
	"cost_usd" numeric(10, 5),
	"model_used" text,
	"tick_latency_ms" integer,
	"degraded" boolean DEFAULT false NOT NULL,
	"derived_from_chunk_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"job_id" uuid,
	"client_id" uuid,
	"candidate_id" uuid,
	"filename" text NOT NULL,
	"storage_path" text NOT NULL,
	"doc_type" text NOT NULL,
	"extracted" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'uploaded' NOT NULL,
	"generated_for" text,
	"based_on_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "doc_is_current_only_uploaded" CHECK ("document"."is_current" = false OR "document"."source" IN ('uploaded','attested'))
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"recruiter_id" uuid NOT NULL,
	"title" text NOT NULL,
	"role_type_slug" text NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"n_vagas" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "role_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"role_type_slug" text NOT NULL,
	"competencias" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"o_que_e_bom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sinais_nivel_errado" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"linguagem_filipa" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"perguntas_chave" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"source_confidence" text DEFAULT 'media' NOT NULL,
	"n_sources" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone DEFAULT now() + interval '90 days'
);
--> statement-breakpoint
CREATE TABLE "rubric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now(),
	"model_used" text DEFAULT 'claude-opus-4-8' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "rubric_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "source_doc" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"url" text,
	"title" text,
	"raw_text" text,
	"summary" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"job_id" uuid,
	"candidate_id" uuid,
	"client_id" uuid,
	"confianca" text DEFAULT 'media' NOT NULL,
	"fetch_status" text DEFAULT 'ok' NOT NULL,
	"fetched_error" text,
	"fetch_cost_usd" numeric(10, 5),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "source_doc_embedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agenda_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"recruiter_id" uuid NOT NULL,
	"process_id" uuid,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"source" text DEFAULT 'google_calendar' NOT NULL,
	"external_ref" text,
	"prep_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proactive_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"recruiter_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_verdict" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"report_id" uuid,
	"verdict" text NOT NULL,
	"reason" text,
	"reason_type" text,
	"bot_predicted" text,
	"bot_flag_inconsistencia" boolean,
	"rubric_version" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "placement_outcome" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"decline_reason" text,
	"guarantee_result" text,
	"guarantee_until" timestamp with time zone,
	"bot_predicted" text,
	"rubric_version" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "placement_outcome_process_id_unique" UNIQUE("process_id")
);
--> statement-breakpoint
CREATE TABLE "process" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"recruiter_id" uuid NOT NULL,
	"stage" text DEFAULT 'sourced' NOT NULL,
	"status_reason" text,
	"consent_status" text,
	"consent_evidence_ref" text,
	"consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"closed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"content_md" text,
	"content_edited" text,
	"content_client_md" text,
	"client_sent_at" timestamp with time zone,
	"model_used" text DEFAULT 'claude-opus-4-8' NOT NULL,
	"rubric_version" integer,
	"filipa_verdict_override" text,
	"filipa_override_reason" text,
	"bot_verdict" text,
	"status" text DEFAULT 'generating' NOT NULL,
	"invalidated_at" timestamp with time zone,
	"stale_reason" text,
	"generated_at" timestamp with time zone DEFAULT now(),
	"exported_at" timestamp with time zone,
	CONSTRAINT "report_interview_id_unique" UNIQUE("interview_id"),
	CONSTRAINT "report_status_chk" CHECK ("report"."status" IN ('generating','ready','failed'))
);
--> statement-breakpoint
CREATE TABLE "contradiction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"process_id" uuid,
	"requisito" text,
	"requisito_id" uuid,
	"tipo" text NOT NULL,
	"chunk_a" uuid,
	"chunk_b" uuid,
	"cv_document_id" uuid,
	"divergence_origin" text,
	"detalhe" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transcript_chunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"speaker" text NOT NULL,
	"speaker_label" text,
	"speaker_corrected" boolean DEFAULT false NOT NULL,
	"ts_start" text NOT NULL,
	"ts_end" text,
	"text" text NOT NULL,
	"classificacao" text DEFAULT 'professional' NOT NULL,
	"retain_until" timestamp with time zone,
	"is_final" boolean DEFAULT true NOT NULL,
	"stt_confidence" real,
	"speaker_confidence" real,
	"audio_gap_ms" integer,
	"start_ms" integer,
	"end_ms" integer,
	"source_stream_id" text,
	"provider_segment_id" text,
	"content_hash" text,
	"prev_hash" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transcript_chunk_embedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chunk_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_action" ADD CONSTRAINT "assistant_action_recruiter_id_recruiter_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_action" ADD CONSTRAINT "assistant_action_thread_id_assistant_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."assistant_thread"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_action" ADD CONSTRAINT "assistant_action_confirmed_by_recruiter_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."recruiter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_message" ADD CONSTRAINT "assistant_message_thread_id_assistant_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."assistant_thread"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_thread" ADD CONSTRAINT "assistant_thread_recruiter_id_recruiter_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "async_job" ADD CONSTRAINT "async_job_recruiter_id_recruiter_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "async_job" ADD CONSTRAINT "async_job_thread_id_assistant_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."assistant_thread"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiter_memory_embedding" ADD CONSTRAINT "recruiter_memory_embedding_fact_id_recruiter_memory_fact_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."recruiter_memory_fact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiter_memory_fact" ADD CONSTRAINT "recruiter_memory_fact_recruiter_id_recruiter_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_memory_embedding" ADD CONSTRAINT "candidate_memory_embedding_fact_id_candidate_memory_fact_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."candidate_memory_fact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_memory_fact" ADD CONSTRAINT "candidate_memory_fact_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_memory_fact" ADD CONSTRAINT "candidate_memory_fact_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_memory_fact" ADD CONSTRAINT "candidate_memory_fact_corrected_by_recruiter_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."recruiter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_memory_fact" ADD CONSTRAINT "candidate_memory_fact_source_doc_id_source_doc_id_fk" FOREIGN KEY ("source_doc_id") REFERENCES "public"."source_doc"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_memory_fact" ADD CONSTRAINT "candidate_memory_fact_source_document_id_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_memory_fact" ADD CONSTRAINT "candidate_memory_fact_parent_fact_id_candidate_memory_fact_id_fk" FOREIGN KEY ("parent_fact_id") REFERENCES "public"."candidate_memory_fact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_criteria" ADD CONSTRAINT "client_criteria_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_memory_fact" ADD CONSTRAINT "client_memory_fact_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_memory_fact" ADD CONSTRAINT "client_memory_fact_source_doc_id_source_doc_id_fk" FOREIGN KEY ("source_doc_id") REFERENCES "public"."source_doc"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_message" ADD CONSTRAINT "intake_message_recruiter_id_recruiter_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_message" ADD CONSTRAINT "intake_message_session_id_intake_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."intake_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_session" ADD CONSTRAINT "intake_session_recruiter_id_recruiter_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_session" ADD CONSTRAINT "intake_session_target_job_id_job_id_fk" FOREIGN KEY ("target_job_id") REFERENCES "public"."job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_session" ADD CONSTRAINT "intake_session_target_client_id_client_id_fk" FOREIGN KEY ("target_client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview" ADD CONSTRAINT "interview_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview" ADD CONSTRAINT "interview_recruiter_id_recruiter_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_gap" ADD CONSTRAINT "interview_gap_interview_id_interview_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interview"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_participant" ADD CONSTRAINT "interview_participant_interview_id_interview_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interview"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_participant" ADD CONSTRAINT "interview_participant_bound_by_recruiter_id_fk" FOREIGN KEY ("bound_by") REFERENCES "public"."recruiter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_tick" ADD CONSTRAINT "interview_tick_interview_id_interview_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interview"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_based_on_document_id_document_id_fk" FOREIGN KEY ("based_on_document_id") REFERENCES "public"."document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job" ADD CONSTRAINT "job_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job" ADD CONSTRAINT "job_recruiter_id_recruiter_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_profile" ADD CONSTRAINT "role_profile_confirmed_by_recruiter_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."recruiter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric" ADD CONSTRAINT "rubric_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_doc" ADD CONSTRAINT "source_doc_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_doc" ADD CONSTRAINT "source_doc_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_doc" ADD CONSTRAINT "source_doc_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_doc_embedding" ADD CONSTRAINT "source_doc_embedding_source_id_source_doc_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source_doc"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_event" ADD CONSTRAINT "agenda_event_recruiter_id_recruiter_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_event" ADD CONSTRAINT "agenda_event_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proactive_task" ADD CONSTRAINT "proactive_task_recruiter_id_recruiter_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_verdict" ADD CONSTRAINT "client_verdict_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_verdict" ADD CONSTRAINT "client_verdict_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_outcome" ADD CONSTRAINT "placement_outcome_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process" ADD CONSTRAINT "process_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process" ADD CONSTRAINT "process_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process" ADD CONSTRAINT "process_recruiter_id_recruiter_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."recruiter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_interview_id_interview_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interview"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contradiction" ADD CONSTRAINT "contradiction_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contradiction" ADD CONSTRAINT "contradiction_chunk_a_transcript_chunk_id_fk" FOREIGN KEY ("chunk_a") REFERENCES "public"."transcript_chunk"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contradiction" ADD CONSTRAINT "contradiction_chunk_b_transcript_chunk_id_fk" FOREIGN KEY ("chunk_b") REFERENCES "public"."transcript_chunk"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contradiction" ADD CONSTRAINT "contradiction_cv_document_id_document_id_fk" FOREIGN KEY ("cv_document_id") REFERENCES "public"."document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_chunk" ADD CONSTRAINT "transcript_chunk_interview_id_interview_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interview"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_chunk_embedding" ADD CONSTRAINT "transcript_chunk_embedding_chunk_id_transcript_chunk_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."transcript_chunk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_action_recruiter_idx" ON "assistant_action" USING btree ("recruiter_id","created_at");--> statement-breakpoint
CREATE INDEX "rme_embedding_idx" ON "recruiter_memory_embedding" USING ivfflat ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "rmf_recruiter_kind_idx" ON "recruiter_memory_fact" USING btree ("recruiter_id","kind");--> statement-breakpoint
CREATE INDEX "candidate_name_norm_idx" ON "candidate" USING btree ("agency_id","name_normalized");--> statement-breakpoint
CREATE INDEX "candidate_email_idx" ON "candidate" USING btree ("email");--> statement-breakpoint
CREATE INDEX "cme_embedding_idx" ON "candidate_memory_embedding" USING ivfflat ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "cmf_candidate_competencia_idx" ON "candidate_memory_fact" USING btree ("candidate_id","competencia");--> statement-breakpoint
CREATE INDEX "client_criteria_client_idx" ON "client_criteria" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "intake_message_unconfirmed_idx" ON "intake_message" USING btree ("agency_id","confirmed_at") WHERE "intake_message"."confirmed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "intake_session_open_idx" ON "intake_session" USING btree ("telegram_chat_id","status") WHERE "intake_session"."status" = 'open';--> statement-breakpoint
CREATE INDEX "interview_status_idx" ON "interview" USING btree ("status");--> statement-breakpoint
CREATE INDEX "interview_gap_interview_idx" ON "interview_gap" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "interview_participant_interview_idx" ON "interview_participant" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "interview_tick_interview_idx" ON "interview_tick" USING btree ("interview_id","tick_n");--> statement-breakpoint
CREATE INDEX "document_candidate_idx" ON "document" USING btree ("candidate_id","doc_type","version");--> statement-breakpoint
CREATE UNIQUE INDEX "role_profile_agency_slug_uidx" ON "role_profile" USING btree ("agency_id","role_type_slug");--> statement-breakpoint
CREATE INDEX "source_doc_candidate_idx" ON "source_doc" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "source_doc_job_idx" ON "source_doc" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "sde_embedding_idx" ON "source_doc_embedding" USING ivfflat ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "proactive_task_status_due_idx" ON "proactive_task" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "client_verdict_process_idx" ON "client_verdict" USING btree ("process_id","verdict");--> statement-breakpoint
CREATE UNIQUE INDEX "process_candidate_job_uidx" ON "process" USING btree ("candidate_id","job_id");--> statement-breakpoint
CREATE INDEX "process_job_stage_idx" ON "process" USING btree ("job_id","stage");--> statement-breakpoint
CREATE INDEX "process_candidate_idx" ON "process" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "transcript_chunk_interview_idx" ON "transcript_chunk" USING btree ("interview_id","seq");--> statement-breakpoint
CREATE INDEX "tce_embedding_idx" ON "transcript_chunk_embedding" USING ivfflat ("embedding" vector_cosine_ops);