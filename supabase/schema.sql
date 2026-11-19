-- =====================================================================
-- CASHLESS HOTEL - Esquema Supabase
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- Seguridad: RLS activo sin políticas => la llave pública NO puede leer
-- ni escribir tablas directamente. Todo pasa por funciones SECURITY DEFINER
-- que validan un token de sesión.
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- ---------- TABLAS ----------
create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'bar',           -- bar | restaurante | otro
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  full_name text not null,
  pass_hash text not null,
  role text not null check (role in ('admin','operator')),
  venue_id uuid references venues(id) on delete set null,
  active boolean not null default true,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  id_type text not null default 'CC',          -- CC, CE, Pasaporte, TI, etc.
  id_number text not null unique,
  phone text,
  pin_hash text not null,
  balance numeric(14,2) not null default 0 check (balance >= 0),
  nfc_uid text unique,
  qr_code text not null unique default encode(extensions.gen_random_bytes(12),'hex'),
  check_in timestamptz not null default now(), -- inicio de reserva (automático)
  active boolean not null default true,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  name text not null,
  category text,
  price numeric(14,2) not null check (price >= 0),
  stock int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  venue_id uuid references venues(id) on delete set null,
  staff_id uuid references staff(id) on delete set null,
  type text not null check (type in ('charge','topup')),
  amount numeric(14,2) not null check (amount > 0),
  balance_after numeric(14,2) not null,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists tx_guest_idx on transactions(guest_id, created_at desc);

create table if not exists sessions (
  token text primary key,
  kind text not null check (kind in ('guest','staff')),
  ref_id uuid not null,
  expires_at timestamptz not null
);

alter table venues enable row level security;
alter table staff enable row level security;
alter table guests enable row level security;
alter table products enable row level security;
alter table transactions enable row level security;
alter table sessions enable row level security;
-- (sin políticas a propósito)

-- ---------- HELPERS INTERNOS ----------
create or replace function _norm_code(p text) returns text
language sql immutable as $$
  select upper(regexp_replace(replace(coalesce(p,''),'CL:',''), '[^A-Za-z0-9]', '', 'g'))
$$;

create or replace function _new_session(p_kind text, p_ref uuid, p_hours int)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare t text := encode(gen_random_bytes(32),'hex');
begin
  delete from sessions where expires_at < now();
  insert into sessions(token, kind, ref_id, expires_at)
  values (t, p_kind, p_ref, now() + make_interval(hours => p_hours));
  return t;
end $$;

create or replace function _staff_from(p_token text, p_role text default null)
returns staff language plpgsql security definer set search_path = public, extensions as $$
declare s staff;
begin
  select st.* into s from sessions se join staff st on st.id = se.ref_id
   where se.token = p_token and se.kind='staff' and se.expires_at > now() and st.active;
  if s.id is null then raise exception 'SESION_INVALIDA'; end if;
  if p_role is not null and s.role <> p_role then raise exception 'SIN_PERMISO'; end if;
  return s;
end $$;

create or replace function _guest_from(p_token text)
returns guests language plpgsql security definer set search_path = public, extensions as $$
declare g guests;
begin
  select gu.* into g from sessions se join guests gu on gu.id = se.ref_id
   where se.token = p_token and se.kind='guest' and se.expires_at > now() and gu.active;
  if g.id is null then raise exception 'SESION_INVALIDA'; end if;
  return g;
end $$;

-- busca huésped por QR, UID NFC o cédula
create or replace function _find_guest(p_code text)
returns guests language plpgsql security definer set search_path = public, extensions as $$
declare g guests; c text := _norm_code(p_code);
begin
  if c = '' then raise exception 'CODIGO_VACIO'; end if;
  select * into g from guests
   where upper(qr_code) = c or upper(nfc_uid) = c
      or upper(regexp_replace(id_number, '[^A-Za-z0-9]', '', 'g')) = c limit 1;
  if g.id is null then raise exception 'CLIENTE_NO_ENCONTRADO'; end if;
  return g;
end $$;

create or replace function _guest_json(g guests) returns jsonb
language sql stable as $$
  select jsonb_build_object('id',g.id,'full_name',g.full_name,'id_type',g.id_type,
    'id_number',g.id_number,'phone',g.phone,'balance',g.balance,'nfc_uid',g.nfc_uid,
    'qr_code',g.qr_code,'check_in',g.check_in,'active',g.active)
$$;

create or replace function _check_pin(p text) returns void language plpgsql as $$
begin
  if p is null or p !~ '^[0-9]{4}$' then raise exception 'PIN_INVALIDO'; end if;
end $$;

-- ---------- AUTENTICACIÓN ----------
create or replace function app_login_guest(p_id_number text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare g guests;
begin
  select * into g from guests where upper(id_number) = upper(trim(p_id_number));
  if g.id is null or not g.active then raise exception 'CREDENCIALES_INVALIDAS'; end if;
  if g.locked_until is not null and g.locked_until > now() then raise exception 'CUENTA_BLOQUEADA'; end if;
  if g.pin_hash <> crypt(p_pin, g.pin_hash) then
    update guests set failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '10 minutes' else null end
     where id = g.id;
    raise exception 'CREDENCIALES_INVALIDAS';
  end if;
  update guests set failed_attempts = 0, locked_until = null where id = g.id;
  return jsonb_build_object('token', _new_session('guest', g.id, 12), 'role', 'guest');
end $$;

create or replace function app_login_staff(p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s staff;
begin
  select * into s from staff where lower(username) = lower(trim(p_username));
  if s.id is null or not s.active then raise exception 'CREDENCIALES_INVALIDAS'; end if;
  if s.locked_until is not null and s.locked_until > now() then raise exception 'CUENTA_BLOQUEADA'; end if;
  if s.pass_hash <> crypt(p_password, s.pass_hash) then
    update staff set failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '10 minutes' else null end
     where id = s.id;
    raise exception 'CREDENCIALES_INVALIDAS';
  end if;
  update staff set failed_attempts = 0, locked_until = null where id = s.id;
  return jsonb_build_object('token', _new_session('staff', s.id, 12), 'role', s.role);
end $$;

create or replace function app_logout(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from sessions where token = p_token
$$;

create or replace function staff_me(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s staff; v venues;
begin
  s := _staff_from(p_token);
  select * into v from venues where id = s.venue_id;
  return jsonb_build_object('id',s.id,'username',s.username,'full_name',s.full_name,
    'role',s.role,'venue_id',s.venue_id,'venue_name',v.name);
end $$;

create or replace function staff_change_password(p_token text, p_old text, p_new text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare s staff;
begin
  s := _staff_from(p_token);
  if length(coalesce(p_new,'')) < 6 then raise exception 'CLAVE_CORTA'; end if;
  if s.pass_hash <> crypt(p_old, s.pass_hash) then raise exception 'CREDENCIALES_INVALIDAS'; end if;
  update staff set pass_hash = crypt(p_new, gen_salt('bf')) where id = s.id;
end $$;

-- ---------- HUÉSPED ----------
create or replace function guest_me(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare g guests;
begin
  g := _guest_from(p_token);
  return _guest_json(g) || jsonb_build_object(
    'total_spent', coalesce((select sum(amount) from transactions where guest_id=g.id and type='charge'),0),
    'total_topup', coalesce((select sum(amount) from transactions where guest_id=g.id and type='topup'),0));
end $$;

create or replace function guest_transactions(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare g guests;
begin
  g := _guest_from(p_token);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id',t.id,'type',t.type,'amount',t.amount,'description',t.description,
      'venue',v.name,'created_at',t.created_at,'balance_after',t.balance_after) order by t.created_at desc)
    from transactions t left join venues v on v.id=t.venue_id
    where t.guest_id=g.id), '[]'::jsonb);
end $$;

create or replace function guest_spending_by_venue(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare g guests;
begin
  g := _guest_from(p_token);
  return coalesce((select jsonb_agg(jsonb_build_object('venue',coalesce(v.name,'Otro'),'total',x.total))
    from (select venue_id, sum(amount) total from transactions
           where guest_id=g.id and type='charge' group by venue_id) x
    left join venues v on v.id=x.venue_id), '[]'::jsonb);
end $$;

create or replace function guest_menu(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare g guests;
begin
  g := _guest_from(p_token);
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'category',p.category,
      'price',p.price,'venue',v.name) order by v.name, p.name)
    from products p join venues v on v.id=p.venue_id
    where p.active and v.active and p.stock > 0), '[]'::jsonb);
end $$;

create or replace function guest_change_pin(p_token text, p_old text, p_new text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare g guests;
begin
  g := _guest_from(p_token);
  perform _check_pin(p_new);
  if g.pin_hash <> crypt(p_old, g.pin_hash) then raise exception 'CREDENCIALES_INVALIDAS'; end if;
  update guests set pin_hash = crypt(p_new, gen_salt('bf')) where id = g.id;
end $$;

-- ---------- OPERARIO / ADMIN: consulta y cobro ----------
create or replace function staff_lookup(p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s staff; g guests;
begin
  s := _staff_from(p_token);
  g := _find_guest(p_code);
  return jsonb_build_object('id',g.id,'full_name',g.full_name,'id_number',g.id_number,
    'balance',g.balance,'active',g.active,'nfc_uid',g.nfc_uid);
end $$;

create or replace function operator_charge(p_token text, p_code text, p_amount numeric, p_description text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s staff; g guests;
begin
  s := _staff_from(p_token);
  if p_amount is null or p_amount <= 0 then raise exception 'MONTO_INVALIDO'; end if;
  g := _find_guest(p_code);
  select * into g from guests where id = g.id for update;     -- bloqueo anti doble cobro
  if not g.active then raise exception 'CLIENTE_INACTIVO'; end if;
  if g.balance <= 0 or g.balance < p_amount then raise exception 'SIN_SALDO'; end if;
  update guests set balance = balance - p_amount where id = g.id returning * into g;
  insert into transactions(guest_id, venue_id, staff_id, type, amount, balance_after, description)
  values (g.id, s.venue_id, s.id, 'charge', p_amount, g.balance, nullif(trim(p_description),''));
  return jsonb_build_object('full_name',g.full_name,'balance',g.balance,'charged',p_amount);
end $$;

-- ---------- ADMIN: clientes ----------
create or replace function admin_create_guest(p_token text, p_full_name text, p_id_type text,
  p_id_number text, p_phone text, p_balance numeric, p_nfc_uid text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s staff; g guests;
begin
  s := _staff_from(p_token,'admin');
  perform _check_pin(p_pin);
  if coalesce(p_balance,0) < 0 then raise exception 'MONTO_INVALIDO'; end if;
  insert into guests(full_name,id_type,id_number,phone,balance,nfc_uid,pin_hash)
  values (trim(p_full_name), coalesce(nullif(p_id_type,''),'CC'), trim(p_id_number), nullif(trim(p_phone),''),
          coalesce(p_balance,0), nullif(_norm_code(p_nfc_uid),''), crypt(p_pin, gen_salt('bf')))
  returning * into g;
  if g.balance > 0 then
    insert into transactions(guest_id,type,amount,balance_after,description,staff_id)
    values (g.id,'topup',g.balance,g.balance,'Saldo inicial',s.id);
  end if;
  return _guest_json(g);
exception when unique_violation then raise exception 'DUPLICADO';
end $$;

create or replace function admin_update_guest(p_token text, p_id uuid, p_full_name text, p_id_type text,
  p_id_number text, p_phone text, p_nfc_uid text, p_active boolean, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare g guests;
begin
  perform _staff_from(p_token,'admin');
  update guests set full_name=trim(p_full_name), id_type=p_id_type, id_number=trim(p_id_number),
    phone=nullif(trim(p_phone),''), nfc_uid=nullif(_norm_code(p_nfc_uid),''), active=p_active,
    pin_hash = case when p_pin is null or p_pin='' then pin_hash else crypt(p_pin, gen_salt('bf')) end
  where id=p_id returning * into g;
  if p_pin is not null and p_pin <> '' then perform _check_pin(p_pin); end if;
  if g.id is null then raise exception 'CLIENTE_NO_ENCONTRADO'; end if;
  return _guest_json(g);
exception when unique_violation then raise exception 'DUPLICADO';
end $$;

create or replace function admin_delete_guest(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _staff_from(p_token,'admin');
  delete from guests where id = p_id;
end $$;

create or replace function admin_list_guests(p_token text, p_search text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _staff_from(p_token,'admin');
  return coalesce((select jsonb_agg(_guest_json(g) order by g.created_at desc) from (
    select * from guests
     where p_search is null or trim(p_search)=''
        or full_name ilike '%'||trim(p_search)||'%' or id_number ilike '%'||trim(p_search)||'%'
        or phone ilike '%'||trim(p_search)||'%'
     order by created_at desc limit 200) g), '[]'::jsonb);
end $$;

create or replace function admin_topup(p_token text, p_code text, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s staff; g guests;
begin
  s := _staff_from(p_token,'admin');
  if p_amount is null or p_amount <= 0 then raise exception 'MONTO_INVALIDO'; end if;
  g := _find_guest(p_code);
  update guests set balance = balance + p_amount where id = g.id returning * into g;
  insert into transactions(guest_id,type,amount,balance_after,description,staff_id)
  values (g.id,'topup',p_amount,g.balance,'Recarga de saldo',s.id);
  return jsonb_build_object('full_name',g.full_name,'balance',g.balance,'added',p_amount);
end $$;

create or replace function admin_recent_transactions(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _staff_from(p_token,'admin');
  return coalesce((select jsonb_agg(x) from (
    select jsonb_build_object('id',t.id,'type',t.type,'amount',t.amount,'created_at',t.created_at,
      'guest',g.full_name,'venue',v.name,'staff',st.full_name,'description',t.description) x
    from transactions t join guests g on g.id=t.guest_id
    left join venues v on v.id=t.venue_id left join staff st on st.id=t.staff_id
    order by t.created_at desc limit 100) q), '[]'::jsonb);
end $$;

-- ---------- ADMIN: lugares (venues) ----------
create or replace function admin_list_venues(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _staff_from(p_token);   -- admin y operario pueden verlos
  return coalesce((select jsonb_agg(to_jsonb(v) order by v.name) from venues v), '[]'::jsonb);
end $$;

create or replace function admin_save_venue(p_token text, p_id uuid, p_name text, p_kind text, p_active boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _staff_from(p_token,'admin');
  if p_id is null then insert into venues(name,kind,active) values (trim(p_name),p_kind,coalesce(p_active,true));
  else update venues set name=trim(p_name), kind=p_kind, active=p_active where id=p_id; end if;
end $$;

create or replace function admin_delete_venue(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _staff_from(p_token,'admin');
  delete from venues where id = p_id;
end $$;

-- ---------- ADMIN: operarios ----------
create or replace function admin_list_staff(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _staff_from(p_token,'admin');
  return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'username',s.username,'full_name',s.full_name,
      'role',s.role,'venue_id',s.venue_id,'venue_name',v.name,'active',s.active) order by s.full_name)
    from staff s left join venues v on v.id=s.venue_id), '[]'::jsonb);
end $$;

create or replace function admin_save_staff(p_token text, p_id uuid, p_username text, p_full_name text,
  p_password text, p_role text, p_venue_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare me staff;
begin
  me := _staff_from(p_token,'admin');
  if p_role not in ('admin','operator') then raise exception 'ROL_INVALIDO'; end if;
  if p_id is null then
    if length(coalesce(p_password,'')) < 6 then raise exception 'CLAVE_CORTA'; end if;
    insert into staff(username,full_name,pass_hash,role,venue_id,active)
    values (trim(p_username), trim(p_full_name), crypt(p_password, gen_salt('bf')), p_role, p_venue_id, coalesce(p_active,true));
  else
    if p_id = me.id and (p_active = false or p_role <> 'admin') then raise exception 'NO_AUTO_DESACTIVAR'; end if;
    update staff set username=trim(p_username), full_name=trim(p_full_name), role=p_role,
      venue_id=p_venue_id, active=p_active,
      pass_hash = case when p_password is null or p_password='' then pass_hash else crypt(p_password, gen_salt('bf')) end
    where id=p_id;
  end if;
exception when unique_violation then raise exception 'DUPLICADO';
end $$;

create or replace function admin_delete_staff(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me staff;
begin
  me := _staff_from(p_token,'admin');
  if p_id = me.id then raise exception 'NO_AUTO_DESACTIVAR'; end if;
  delete from staff where id = p_id;
end $$;

-- ---------- ADMIN: inventario ----------
create or replace function admin_list_products(p_token text, p_venue_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _staff_from(p_token,'admin');
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'venue_id',p.venue_id,'venue',v.name,
      'name',p.name,'category',p.category,'price',p.price,'stock',p.stock,'active',p.active) order by v.name,p.name)
    from products p join venues v on v.id=p.venue_id
    where p_venue_id is null or p.venue_id=p_venue_id), '[]'::jsonb);
end $$;

create or replace function admin_save_product(p_token text, p_id uuid, p_venue_id uuid, p_name text,
  p_category text, p_price numeric, p_stock int, p_active boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _staff_from(p_token,'admin');
  if p_id is null then
    insert into products(venue_id,name,category,price,stock,active)
    values (p_venue_id, trim(p_name), nullif(trim(p_category),''), p_price, coalesce(p_stock,0), coalesce(p_active,true));
  else
    update products set venue_id=p_venue_id, name=trim(p_name), category=nullif(trim(p_category),''),
      price=p_price, stock=coalesce(p_stock,0), active=p_active where id=p_id;
  end if;
end $$;

create or replace function admin_delete_product(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _staff_from(p_token,'admin');
  delete from products where id = p_id;
end $$;

-- ---------- PERMISOS ----------
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public;
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname
           from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and (p.proname like 'app\_%' or p.proname like 'staff\_%'
              or p.proname like 'guest\_%' or p.proname like 'admin\_%' or p.proname like 'operator\_%')
  loop
    execute format('grant execute on function %s to anon, authenticated', f.sig);
  end loop;
end $$;

-- ---------- DATOS INICIALES ----------
insert into venues(name,kind) select 'Bar','bar' where not exists (select 1 from venues);
insert into venues(name,kind) select 'Restaurante','restaurante' where (select count(*) from venues) = 1;

-- Administrador inicial. CAMBIAR LA CLAVE al primer ingreso (Admin > Mi cuenta).
insert into staff(username, full_name, pass_hash, role)
select 'admin', 'Administrador', crypt('Admin2026*', gen_salt('bf')), 'admin'
where not exists (select 1 from staff where role='admin');
