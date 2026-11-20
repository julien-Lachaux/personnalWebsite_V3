-- BF-3 (brief back-001) : stack principale du site.
-- `main_stack_order` : rang de la compétence dans la stack principale (1 = première) ; null = hors
-- stack principale. Unique quand il est renseigné (deux compétences ne partagent pas un rang), et
-- strictement positif.

alter table skills
  add column main_stack_order smallint,
  add constraint skills_main_stack_order_check check (main_stack_order is null or main_stack_order > 0);

create unique index skills_main_stack_order_idx on skills (main_stack_order)
  where main_stack_order is not null;
