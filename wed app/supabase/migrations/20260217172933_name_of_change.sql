drop trigger if exists "update_pomodoro_sessions_updated_at" on "public"."pomodoro_sessions";

drop policy "Allow teachers/admins to manage absentee list" on "public"."absentees";

drop policy "Allow managers to delete their own classes" on "public"."classes";

drop policy "Allow managers to insert their own classes" on "public"."classes";

drop policy "Allow managers to update their own classes" on "public"."classes";

drop policy "Staff can view attempts from their school's students" on "public"."exam_attempts";

drop policy "Allow managers to delete their own sessions" on "public"."online_sessions";

drop policy "Allow managers to insert their own sessions" on "public"."online_sessions";

drop policy "Allow managers to update their own sessions" on "public"."online_sessions";

drop policy "Enable read access for relevant users" on "public"."online_sessions";

drop policy "Teachers can initiate presence checks" on "public"."presence_checks";

drop policy "Users can read presence data" on "public"."presence_checks";

drop policy "Allow profile read access" on "public"."profiles";

drop policy "Allow profile update access" on "public"."profiles";

drop policy "Admins, Teachers, and Consultants can manage scores" on "public"."scores";

drop policy "Admins, Teachers, and Consultants can view all scores" on "public"."scores";

drop policy "Staff can view answers for their school's students" on "public"."student_answers";

drop policy "Admins can manage subjects" on "public"."subjects";

alter table "public"."absentees" drop constraint "absentees_student_id_fkey";

alter table "public"."active_sessions" drop constraint "active_sessions_student_id_fkey";

alter table "public"."channel_members" drop constraint "channel_members_channel_id_fkey";

alter table "public"."channel_members" drop constraint "channel_members_user_id_fkey";

alter table "public"."channel_users" drop constraint "channel_users_channel_id_fkey";

alter table "public"."channel_users" drop constraint "channel_users_user_id_fkey";

alter table "public"."classes" drop constraint "classes_manager_id_fkey";

alter table "public"."exam_attempts" drop constraint "exam_attempts_exam_id_fkey";

alter table "public"."exam_attempts" drop constraint "exam_attempts_student_id_fkey";

alter table "public"."exams" drop constraint "exams_class_id_fkey";

alter table "public"."exams" drop constraint "exams_manager_id_fkey";

alter table "public"."exams" drop constraint "exams_subject_id_fkey";

alter table "public"."messages" drop constraint "messages_channel_id_fkey";

alter table "public"."online_sessions" drop constraint "online_sessions_class_id_fkey";

alter table "public"."online_sessions" drop constraint "online_sessions_created_by_fkey";

alter table "public"."online_sessions" drop constraint "online_sessions_manager_id_fkey";

alter table "public"."presence_checks" drop constraint "presence_checks_session_id_fkey";

alter table "public"."presence_checks" drop constraint "presence_checks_student_id_fkey";

alter table "public"."profiles" drop constraint "profiles_class_id_fkey";

alter table "public"."profiles" drop constraint "profiles_consultant_id_fkey";

alter table "public"."profiles" drop constraint "profiles_manager_id_fkey";

alter table "public"."questions" drop constraint "questions_exam_id_fkey";

alter table "public"."scores" drop constraint "scores_exam_id_fkey";

alter table "public"."scores" drop constraint "scores_student_id_fkey";

alter table "public"."student_answers" drop constraint "student_answers_exam_id_fkey";

alter table "public"."student_answers" drop constraint "student_answers_question_id_fkey";

alter table "public"."student_answers" drop constraint "student_answers_student_id_fkey";

alter table "public"."subjects" drop constraint "subjects_manager_id_fkey";

alter table "public"."subscriptions" drop constraint "subscriptions_user_id_fkey";

alter table "public"."task_feedback" drop constraint "task_feedback_task_id_fkey";

alter table "public"."task_feedback" drop constraint "task_feedback_user_id_fkey";

alter table "public"."tasks" drop constraint "tasks_class_id_fkey";

alter table "public"."channels" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."messages" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."pomodoro_sessions" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."tasks" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."absentees" add constraint "absentees_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."absentees" validate constraint "absentees_student_id_fkey";

alter table "public"."active_sessions" add constraint "active_sessions_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."active_sessions" validate constraint "active_sessions_student_id_fkey";

alter table "public"."channel_members" add constraint "channel_members_channel_id_fkey" FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE not valid;

alter table "public"."channel_members" validate constraint "channel_members_channel_id_fkey";

alter table "public"."channel_members" add constraint "channel_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."channel_members" validate constraint "channel_members_user_id_fkey";

alter table "public"."channel_users" add constraint "channel_users_channel_id_fkey" FOREIGN KEY (channel_id) REFERENCES public.channels(id) not valid;

alter table "public"."channel_users" validate constraint "channel_users_channel_id_fkey";

alter table "public"."channel_users" add constraint "channel_users_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) not valid;

alter table "public"."channel_users" validate constraint "channel_users_user_id_fkey";

alter table "public"."classes" add constraint "classes_manager_id_fkey" FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."classes" validate constraint "classes_manager_id_fkey";

alter table "public"."exam_attempts" add constraint "exam_attempts_exam_id_fkey" FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE not valid;

alter table "public"."exam_attempts" validate constraint "exam_attempts_exam_id_fkey";

alter table "public"."exam_attempts" add constraint "exam_attempts_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."exam_attempts" validate constraint "exam_attempts_student_id_fkey";

alter table "public"."exams" add constraint "exams_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE not valid;

alter table "public"."exams" validate constraint "exams_class_id_fkey";

alter table "public"."exams" add constraint "exams_manager_id_fkey" FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."exams" validate constraint "exams_manager_id_fkey";

alter table "public"."exams" add constraint "exams_subject_id_fkey" FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE not valid;

alter table "public"."exams" validate constraint "exams_subject_id_fkey";

alter table "public"."messages" add constraint "messages_channel_id_fkey" FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE not valid;

alter table "public"."messages" validate constraint "messages_channel_id_fkey";

alter table "public"."online_sessions" add constraint "online_sessions_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE not valid;

alter table "public"."online_sessions" validate constraint "online_sessions_class_id_fkey";

alter table "public"."online_sessions" add constraint "online_sessions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."online_sessions" validate constraint "online_sessions_created_by_fkey";

alter table "public"."online_sessions" add constraint "online_sessions_manager_id_fkey" FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."online_sessions" validate constraint "online_sessions_manager_id_fkey";

alter table "public"."presence_checks" add constraint "presence_checks_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.online_sessions(id) ON DELETE CASCADE not valid;

alter table "public"."presence_checks" validate constraint "presence_checks_session_id_fkey";

alter table "public"."presence_checks" add constraint "presence_checks_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."presence_checks" validate constraint "presence_checks_student_id_fkey";

alter table "public"."profiles" add constraint "profiles_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL not valid;

alter table "public"."profiles" validate constraint "profiles_class_id_fkey";

alter table "public"."profiles" add constraint "profiles_consultant_id_fkey" FOREIGN KEY (consultant_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."profiles" validate constraint "profiles_consultant_id_fkey";

alter table "public"."profiles" add constraint "profiles_manager_id_fkey" FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."profiles" validate constraint "profiles_manager_id_fkey";

alter table "public"."questions" add constraint "questions_exam_id_fkey" FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE not valid;

alter table "public"."questions" validate constraint "questions_exam_id_fkey";

alter table "public"."scores" add constraint "scores_exam_id_fkey" FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE not valid;

alter table "public"."scores" validate constraint "scores_exam_id_fkey";

alter table "public"."scores" add constraint "scores_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."scores" validate constraint "scores_student_id_fkey";

alter table "public"."student_answers" add constraint "student_answers_exam_id_fkey" FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE not valid;

alter table "public"."student_answers" validate constraint "student_answers_exam_id_fkey";

alter table "public"."student_answers" add constraint "student_answers_question_id_fkey" FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE not valid;

alter table "public"."student_answers" validate constraint "student_answers_question_id_fkey";

alter table "public"."student_answers" add constraint "student_answers_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."student_answers" validate constraint "student_answers_student_id_fkey";

alter table "public"."subjects" add constraint "subjects_manager_id_fkey" FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."subjects" validate constraint "subjects_manager_id_fkey";

alter table "public"."subscriptions" add constraint "subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_user_id_fkey";

alter table "public"."task_feedback" add constraint "task_feedback_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE not valid;

alter table "public"."task_feedback" validate constraint "task_feedback_task_id_fkey";

alter table "public"."task_feedback" add constraint "task_feedback_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."task_feedback" validate constraint "task_feedback_user_id_fkey";

alter table "public"."tasks" add constraint "tasks_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) not valid;

alter table "public"."tasks" validate constraint "tasks_class_id_fkey";

create or replace view "public"."daily_pomodoro_stats" as  SELECT pomodoro_sessions.user_id,
    pomodoro_sessions.session_date,
    sum(
        CASE
            WHEN ((pomodoro_sessions.session_type = 'focus'::text) AND (pomodoro_sessions.completed = true)) THEN pomodoro_sessions.duration_minutes
            ELSE 0
        END) AS total_focus_minutes,
    count(
        CASE
            WHEN ((pomodoro_sessions.session_type = 'focus'::text) AND (pomodoro_sessions.completed = true)) THEN 1
            ELSE NULL::integer
        END) AS completed_pomodoros,
    count(
        CASE
            WHEN ((pomodoro_sessions.session_type = 'focus'::text) AND (pomodoro_sessions.completed = false)) THEN 1
            ELSE NULL::integer
        END) AS incomplete_pomodoros
   FROM public.pomodoro_sessions
  GROUP BY pomodoro_sessions.user_id, pomodoro_sessions.session_date;



  create policy "Allow teachers/admins to manage absentee list"
  on "public"."absentees"
  as permissive
  for all
  to public
using ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'teacher'::text, 'consultant'::text])));



  create policy "Allow managers to delete their own classes"
  on "public"."classes"
  as permissive
  for delete
  to authenticated
using (((manager_id = ( SELECT profiles.manager_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (manager_id = auth.uid())));



  create policy "Allow managers to insert their own classes"
  on "public"."classes"
  as permissive
  for insert
  to authenticated
with check (((manager_id = ( SELECT profiles.manager_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (manager_id = auth.uid())));



  create policy "Allow managers to update their own classes"
  on "public"."classes"
  as permissive
  for update
  to authenticated
using (((manager_id = ( SELECT profiles.manager_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (manager_id = auth.uid())));



  create policy "Staff can view attempts from their school's students"
  on "public"."exam_attempts"
  as permissive
  for select
  to public
using (((( SELECT profiles.manager_id
   FROM public.profiles
  WHERE (profiles.id = exam_attempts.student_id)) = ( SELECT profiles.manager_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (( SELECT profiles.manager_id
   FROM public.profiles
  WHERE (profiles.id = exam_attempts.student_id)) = auth.uid())));



  create policy "Allow managers to delete their own sessions"
  on "public"."online_sessions"
  as permissive
  for delete
  to authenticated
using (((manager_id = ( SELECT profiles.manager_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (manager_id = auth.uid())));



  create policy "Allow managers to insert their own sessions"
  on "public"."online_sessions"
  as permissive
  for insert
  to authenticated
with check (((manager_id = ( SELECT profiles.manager_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (manager_id = auth.uid())));



  create policy "Allow managers to update their own sessions"
  on "public"."online_sessions"
  as permissive
  for update
  to authenticated
using (((manager_id = ( SELECT profiles.manager_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (manager_id = auth.uid())));



  create policy "Enable read access for relevant users"
  on "public"."online_sessions"
  as permissive
  for select
  to authenticated
using (((class_id = ( SELECT profiles.class_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (manager_id = ( SELECT profiles.manager_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (manager_id = auth.uid())));



  create policy "Teachers can initiate presence checks"
  on "public"."presence_checks"
  as permissive
  for insert
  to authenticated
with check (((is_entry = false) AND (EXISTS ( SELECT 1
   FROM public.online_sessions
  WHERE ((online_sessions.id = presence_checks.session_id) AND ((online_sessions.created_by = auth.uid()) OR (online_sessions.manager_id = auth.uid())))))));



  create policy "Users can read presence data"
  on "public"."presence_checks"
  as permissive
  for select
  to public
using (((auth.uid() = student_id) OR (((public.get_my_claim('role'::text) = ANY (ARRAY['"admin"'::jsonb, '"teacher"'::jsonb, '"consultant"'::jsonb])) AND (EXISTS ( SELECT 1
   FROM public.online_sessions
  WHERE ((online_sessions.id = presence_checks.session_id) AND (online_sessions.manager_id = ( SELECT profiles.manager_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))))) OR (EXISTS ( SELECT 1
   FROM public.online_sessions
  WHERE ((online_sessions.id = presence_checks.session_id) AND (online_sessions.manager_id = auth.uid())))))));



  create policy "Allow profile read access"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (((auth.uid() = id) OR (manager_id = auth.uid()) OR (public.get_my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'teacher'::text, 'consultant'::text]))));



  create policy "Allow profile update access"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using (((auth.uid() = id) OR ((public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'consultant'::text])) AND (manager_id = auth.uid()))))
with check (((auth.uid() = id) OR ((public.get_my_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'consultant'::text])) AND (manager_id = auth.uid()))));



  create policy "Admins, Teachers, and Consultants can manage scores"
  on "public"."scores"
  as permissive
  for all
  to authenticated
using ((public.get_user_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'consultant'::text])))
with check ((public.get_user_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'consultant'::text])));



  create policy "Admins, Teachers, and Consultants can view all scores"
  on "public"."scores"
  as permissive
  for select
  to authenticated
using ((public.get_user_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'consultant'::text])));



  create policy "Staff can view answers for their school's students"
  on "public"."student_answers"
  as permissive
  for select
  to public
using ((( SELECT profiles.manager_id
   FROM public.profiles
  WHERE (auth.uid() = profiles.id)) = ( SELECT profiles.manager_id
   FROM public.profiles
  WHERE (profiles.id = student_answers.student_id))));



  create policy "Admins can manage subjects"
  on "public"."subjects"
  as permissive
  for all
  to authenticated
using ((public.get_user_role() = 'admin'::text))
with check ((public.get_user_role() = 'admin'::text));


CREATE TRIGGER update_pomodoro_sessions_updated_at BEFORE UPDATE ON public.pomodoro_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

drop trigger if exists "on_auth_user_created" on "auth"."users";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

drop policy "Allow staff to manage question images" on "storage"."objects";


  create policy "Allow staff to manage question images"
  on "storage"."objects"
  as permissive
  for all
  to authenticated
using (((bucket_id = 'question_images'::text) AND (( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'teacher'::text, 'consultant'::text, 'super_admin'::text]))));



