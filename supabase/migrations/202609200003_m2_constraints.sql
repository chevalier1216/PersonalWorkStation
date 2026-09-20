-- M2 corrective constraints. Apply after today_recurring; never rewrite the applied migration.
alter table public.tasks
  drop constraint tasks_owner_id_recurrence_source_id_fkey,
  add constraint valid_custom_recurrence check (recurrence_type<>'custom' or recurrence_unit is not null),
  add constraint tasks_recurrence_source_fkey foreign key(owner_id,recurrence_source_id)
    references public.tasks(owner_id,id) on delete set null (recurrence_source_id);
