-- BRAK AI — model danych (Supabase / Postgres)
-- Kwoty w groszach (bigint). Każda tabela ma firma_id; dostęp ogranicza RLS.

create table firmy (
  id uuid primary key default gen_random_uuid(),
  nazwa text not null,
  nip text,
  utworzono timestamptz not null default now()
);

-- Powiązanie kont logowania (auth.users) z firmą.
create table czlonkowie (
  firma_id uuid not null references firmy(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rola text not null default 'wlasciciel' check (rola in ('wlasciciel', 'pracownik')),
  primary key (firma_id, user_id)
);

create table pracownicy (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmy(id) on delete cascade,
  imie_nazwisko text not null
);

create table klienci (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmy(id) on delete cascade,
  nazwa text not null,
  typ text not null default 'B2C' check (typ in ('B2B', 'B2C')),
  nip text,
  telefon text,
  email text,
  zgoda_marketing boolean not null default false,
  unique (firma_id, nazwa)
);

create table zapytania (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmy(id) on delete cascade,
  klient_id uuid references klienci(id) on delete set null,
  pracownik_id uuid references pracownicy(id) on delete set null,
  kanal text,
  tresc text,
  wplynelo timestamptz not null default now(),
  pierwszy_kontakt timestamptz
);

create table oferty (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmy(id) on delete cascade,
  klient_id uuid not null references klienci(id) on delete cascade,
  zapytanie_id uuid references zapytania(id) on delete set null,
  pracownik_id uuid references pracownicy(id) on delete set null,
  wartosc_netto bigint not null check (wartosc_netto >= 0),
  wyslana timestamptz not null,
  ostatni_kontakt timestamptz,
  status text not null default 'wyslana' check (status in ('wyslana', 'wygrana', 'przegrana')),
  przyczyna_przegranej text check (przyczyna_przegranej in ('cena', 'termin', 'brak_kontaktu', 'konkurencja', 'rezygnacja')),
  check (status <> 'przegrana' or przyczyna_przegranej is not null)
);

create table faktury (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmy(id) on delete cascade,
  klient_id uuid not null references klienci(id) on delete cascade,
  numer text not null,
  kwota_brutto bigint not null,
  termin_platnosci date not null,
  zaplacona date,
  unique (firma_id, numer)
);

create table realizacje (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmy(id) on delete cascade,
  klient_id uuid not null references klienci(id) on delete cascade,
  oferta_id uuid references oferty(id) on delete set null,
  opis text,
  zakonczona date not null,
  ostatni_przeglad date,
  wymaga_przegladu boolean not null default false
);

-- Wynik silnika reguł; odświeżany codziennie. Jedno źródło = najwyżej jedna otwarta strata.
create table straty (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmy(id) on delete cascade,
  typ text not null check (typ in ('zapytanie_bez_odpowiedzi', 'oferta_bez_followupu', 'oferta_przegrana', 'faktura_przeterminowana', 'przeglad_zalegly')),
  zrodlo_id uuid not null,
  wartosc bigint not null,
  pracownik_id uuid references pracownicy(id) on delete set null,
  przyczyna text,
  opis text not null,
  wykryto timestamptz not null default now(),
  status text not null default 'otwarta' check (status in ('otwarta', 'odzyskana', 'zamknieta')),
  odzyskano timestamptz,
  wartosc_odzyskana bigint
);
create unique index straty_jedna_otwarta on straty (firma_id, typ, zrodlo_id) where status = 'otwarta';

create table zadania_odzysku (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmy(id) on delete cascade,
  strata_id uuid not null references straty(id) on delete cascade,
  pracownik_id uuid references pracownicy(id) on delete set null,
  opis text not null,
  termin date not null,
  wykonano timestamptz
);

-- Indeksy pod RLS i dashboard.
create index on zapytania (firma_id);
create index on oferty (firma_id, status);
create index on faktury (firma_id) where zaplacona is null;
create index on realizacje (firma_id) where wymaga_przegladu;
create index on straty (firma_id, status);
create index on zadania_odzysku (firma_id, termin) where wykonano is null;

-- RLS: użytkownik widzi wyłącznie dane firm, których jest członkiem.
create function moje_firmy() returns setof uuid
language sql stable security definer set search_path = public as $$
  select firma_id from czlonkowie where user_id = auth.uid()
$$;

alter table firmy enable row level security;
create policy firmy_dostep on firmy for all using (id in (select moje_firmy())) with check (id in (select moje_firmy()));

alter table czlonkowie enable row level security;
create policy czlonkowie_odczyt on czlonkowie for select using (firma_id in (select moje_firmy()));

do $$
declare t text;
begin
  foreach t in array array['pracownicy', 'klienci', 'zapytania', 'oferty', 'faktury', 'realizacje', 'straty', 'zadania_odzysku'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all using (firma_id in (select moje_firmy())) with check (firma_id in (select moje_firmy()))',
      t || '_dostep', t
    );
  end loop;
end $$;

-- Rejestracja: nowy użytkownik nie jest jeszcze członkiem żadnej firmy, więc RLS
-- nie pozwoliłby mu jej utworzyć. Ta funkcja tworzy firmę i czyni go właścicielem.
create function utworz_firme(p_nazwa text, p_nip text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Brak zalogowanego użytkownika';
  end if;
  insert into firmy (nazwa, nip) values (p_nazwa, p_nip) returning id into v_id;
  insert into czlonkowie (firma_id, user_id, rola) values (v_id, auth.uid(), 'wlasciciel');
  return v_id;
end $$;
