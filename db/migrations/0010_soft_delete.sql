-- Soft delete partout (docs/01, décision du 19 nov. 2026).
-- `deleted_at timestamptz null` sur chaque table d'entité, distinct de `published` : dépublié = gardé
-- mais non servi, supprimé = marqué pour un nettoyage manuel. L'API ne sert jamais une ligne marquée ;
-- ses traductions et ses liaisons (compétences) restent en base et suivent leur entité. Le seed marque
-- `deleted_at = now()` quand une entité écrite par les seeds disparaît des fichiers, et le remet à
-- `null` si elle réapparaît ; le nettoyage physique est manuel (`db:deleted:list`, `db:deleted:purge`).

alter table profile add column deleted_at timestamptz;
alter table social_links add column deleted_at timestamptz;
alter table skill_groups add column deleted_at timestamptz;
alter table skills add column deleted_at timestamptz;
alter table experiences add column deleted_at timestamptz;
alter table projects add column deleted_at timestamptz;
alter table tools add column deleted_at timestamptz;
alter table resources add column deleted_at timestamptz;
alter table certifications add column deleted_at timestamptz;
alter table education add column deleted_at timestamptz;
alter table languages add column deleted_at timestamptz;
