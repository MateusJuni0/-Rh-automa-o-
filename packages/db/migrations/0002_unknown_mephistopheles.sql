ALTER TABLE "async_job" ADD COLUMN "candidate_id" uuid;--> statement-breakpoint
ALTER TABLE "interview" ADD COLUMN "candidate_id" uuid;--> statement-breakpoint
ALTER TABLE "async_job" ADD CONSTRAINT "async_job_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview" ADD CONSTRAINT "interview_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "async_job_candidate_idx" ON "async_job" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "interview_candidate_idx" ON "interview" USING btree ("candidate_id");