-- BF-2 (brief back-001) : liens expérience ↔ compétence cachés.
-- `shown_in_stack = true` : la compétence est une puce de la stack de l'expérience (comportement
-- jusqu'ici). `false` : lien « mot-clé », pris en compte par le filtre du front mais non affiché.

alter table experience_skills
  add column shown_in_stack boolean not null default true;
