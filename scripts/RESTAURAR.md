# Respaldos de la SuperLiga THC

Hay dos capas de respaldo, independientes entre sí:

| Capa | Dónde | Frecuencia | Cuánto guarda |
|---|---|---|---|
| 1 | Dentro de Supabase (`private.backups`) | Todos los días, ~04:00 hora de Chile | Los últimos ~30 días + los manuales para siempre |
| 2 | Rama `backups` de este repositorio en GitHub | Todos los lunes, ~05:00 hora de Chile | Para siempre (cada semana queda en el historial de git) |

La capa 1 sirve para deshacer rápido un error de carga (por ejemplo, un resultado mal editado o datos pisados).
La capa 2 protege si algo le pasa al proyecto de Supabase completo.

## Qué contiene cada respaldo

Las tablas `temporadas`, `teams`, `players`, `matches`, `cup_players` y `cup_matches` completas, y en la capa 2 además los escudos (`escudos/`).
No incluye las cuentas de editor (esas viven en Supabase Auth).

## Correr un respaldo a mano

- **Capa 1** (SQL Editor de Supabase): `select private.take_backup('manual-antes-de-algo');`
- **Capa 2**: GitHub → pestaña **Actions** → **Respaldo semanal** → **Run workflow**.

## Restaurar

La forma más simple: pedírselo a Claude indicando la fecha a la que querés volver.

### Desde la capa 1 (SQL Editor de Supabase)

1. Ver los respaldos disponibles:

   ```sql
   select id, kind, taken_at at time zone 'America/Santiago' as hora_chile
   from private.backups order by taken_at desc;
   ```

2. Restaurar el respaldo elegido (cambiá `N` por su `id`). Primero guarda una copia del estado actual por si hay que volver atrás:

   ```sql
   begin;
   select private.take_backup('antes-de-restaurar');
   delete from public.cup_players;
   delete from public.players;
   delete from public.cup_matches;
   delete from public.matches;
   delete from public.teams;
   insert into public.teams       select * from jsonb_populate_recordset(null::public.teams,       (select data->'teams'       from private.backups where id = N));
   insert into public.players     select * from jsonb_populate_recordset(null::public.players,     (select data->'players'     from private.backups where id = N));
   insert into public.matches     select * from jsonb_populate_recordset(null::public.matches,     (select data->'matches'     from private.backups where id = N));
   insert into public.cup_matches select * from jsonb_populate_recordset(null::public.cup_matches, (select data->'cup_matches' from private.backups where id = N));
   insert into public.cup_players select * from jsonb_populate_recordset(null::public.cup_players, (select data->'cup_players' from private.backups where id = N));
   commit;
   ```

   Para restaurar una sola tabla (por ejemplo solo `matches`), usá solo sus líneas `delete` e `insert`.

### Desde la capa 2 (archivos en GitHub)

Cada carpeta `datos/AAAA-MM-DD/` tiene un `.json` por tabla con las filas tal como estaban en la base.
Se pueden volver a cargar con el mismo SQL de arriba reemplazando `(select data->'teams' from private.backups where id = N)` por el contenido del archivo entre comillas simples y con `::jsonb` al final, o pidiéndole a Claude que lo haga.
Los escudos se vuelven a subir al bucket `team-logos` de Supabase Storage con los mismos nombres de archivo.
