-- Turn off maintenance so Production domain is usable again
update platform_settings
set value = 'false'::jsonb, updated_at = now()
where key = 'maintenance_mode';

insert into platform_settings (key, value)
values ('maintenance_mode', 'false'::jsonb)
on conflict (key) do update set value = 'false'::jsonb, updated_at = now();
