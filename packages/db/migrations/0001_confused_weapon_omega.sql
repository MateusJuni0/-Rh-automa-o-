DROP INDEX "interview_status_idx";--> statement-breakpoint
DROP INDEX "interview_tick_interview_idx";--> statement-breakpoint
CREATE INDEX "interview_agency_status_idx" ON "interview" USING btree ("agency_id","status");--> statement-breakpoint
CREATE INDEX "interview_agency_recruiter_idx" ON "interview" USING btree ("agency_id","recruiter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interview_tick_interview_tickn_uidx" ON "interview_tick" USING btree ("interview_id","tick_n");--> statement-breakpoint
ALTER TABLE "interview" ADD CONSTRAINT "interview_status_chk" CHECK ("interview"."status" IN ('scheduled','live','done','unstructured'));--> statement-breakpoint
ALTER TABLE "interview" ADD CONSTRAINT "interview_capture_type_chk" CHECK ("interview"."capture_type" IS NULL OR "interview"."capture_type" IN ('bot_online','local_mic','none'));