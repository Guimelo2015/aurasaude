-- =====================================================================
-- Aura Saúde — schema inicial (Fase 2: backend real)
-- Multi-tenant: toda tabela de negócio tem clinic_id + RLS.
-- Espelha src/lib/types.ts. Dinheiro em numeric(12,2); datas em timestamptz.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type user_role          as enum ('admin', 'recepcao', 'profissional');
create type lead_stage         as enum ('novo', 'qualificacao', 'orcamento', 'agendado', 'realizado', 'perdido');
create type conversation_queue as enum ('ia', 'novo', 'em_atendimento', 'aguardando', 'finalizado');
create type conversation_handler as enum ('ia', 'humano');
create type message_author     as enum ('contato', 'ia', 'atendente', 'sistema');
create type appointment_status as enum ('agendado', 'confirmado', 'compareceu', 'faltou', 'cancelado');
create type budget_status      as enum ('aberto', 'aprovado', 'recusado');
create type transaction_type   as enum ('entrada', 'saida');
create type wa_status          as enum ('conectado', 'desconectado', 'aguardando_qr');

-- ---------- Tenancy ----------
create table clinics (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  cnpj        text,
  city        text,
  plan        text not null default 'trial',
  created_at  timestamptz not null default now()
);

create table professionals (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  name        text not null,
  specialty   text,
  cro         text,
  color       text not null default '#0f9d8f',
  active      boolean not null default true
);

-- Perfil ligado ao auth.users do Supabase
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  clinic_id       uuid not null references clinics(id) on delete cascade,
  name            text not null,
  email           text not null,
  role            user_role not null,
  professional_id uuid references professionals(id),
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Helpers usados nas policies
create or replace function current_clinic_id() returns uuid
language sql stable security definer set search_path = public as $$
  select clinic_id from profiles where id = auth.uid()
$$;

create or replace function current_role_is(r user_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = r)
$$;

-- ---------- Catálogo ----------
create table procedures (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references clinics(id) on delete cascade,
  name          text not null,
  category      text not null,
  price         numeric(12,2) not null default 0,
  duration_min  int not null default 30,
  active        boolean not null default true
);

-- ---------- Pacientes ----------
create table patients (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  cpf         char(11) not null check (cpf ~ '^[0-9]{11}$'),
  name        text not null,
  phone       text not null,            -- E.164 sem '+', ex 5511999990000
  email       text not null,
  birth_date  date not null,
  insurance   text not null default 'Particular',
  source      text,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,               -- soft delete (LGPD: anonimizar depois)
  unique (clinic_id, cpf)
);
create index on patients (clinic_id, phone);
create index on patients (clinic_id, name);

create table patient_notes (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  patient_id  uuid not null references patients(id) on delete cascade,
  author_id   uuid references profiles(id),
  text        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- WhatsApp ----------
create table whatsapp_instances (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  name            text not null,
  phone           text,
  department      text not null,
  color           text not null default '#0f9d8f',
  status          wa_status not null default 'aguardando_qr',
  provider        text not null default 'evolution',
  provider_ref    text unique,          -- instanceName na Evolution API
  created_at      timestamptz not null default now()
);

create table leads (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null references clinics(id) on delete cascade,
  name              text not null,
  phone             text,
  source            text,
  stage             lead_stage not null default 'novo',
  interest          text,
  estimated_value   numeric(12,2) not null default 0,
  patient_id        uuid references patients(id) on delete set null,
  owner_id          uuid references profiles(id),
  lost_reason       text,
  created_at        timestamptz not null default now(),
  stage_changed_at  timestamptz not null default now()
);
create index on leads (clinic_id, stage);

create table conversations (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null references clinics(id) on delete cascade,
  instance_id       uuid not null references whatsapp_instances(id),
  contact_name      text,
  phone             text not null,
  lead_id           uuid references leads(id) on delete set null,
  patient_id        uuid references patients(id) on delete set null,
  queue             conversation_queue not null default 'ia',
  handler           conversation_handler not null default 'ia',
  assigned_user_id  uuid references profiles(id),
  department        text,
  handoff           jsonb,                 -- HandoffCard gerado pela IA
  unread            int not null default 0,
  last_message_at   timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  closed_at         timestamptz
);
create index on conversations (clinic_id, queue, last_message_at desc);
create index on conversations (clinic_id, phone);

alter table leads add column conversation_id uuid references conversations(id) on delete set null;

create table messages (
  id                  uuid primary key default gen_random_uuid(),
  clinic_id           uuid not null references clinics(id) on delete cascade,
  conversation_id     uuid not null references conversations(id) on delete cascade,
  author              message_author not null,
  author_user_id      uuid references profiles(id),
  text                text not null,
  kind                text not null default 'texto',
  provider_message_id text,               -- id da mensagem no WhatsApp (idempotência)
  created_at          timestamptz not null default now(),
  unique (clinic_id, provider_message_id)
);
create index on messages (conversation_id, created_at);

-- ---------- Agenda ----------
create table appointments (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  professional_id  uuid not null references professionals(id),
  procedure_id     uuid not null references procedures(id),
  lead_id          uuid references leads(id) on delete set null,
  starts_at        timestamptz not null,
  duration_min     int not null,
  status           appointment_status not null default 'agendado',
  value            numeric(12,2) not null default 0,
  notes            text,
  created_at       timestamptz not null default now()
);
create index on appointments (clinic_id, professional_id, starts_at);
create index on appointments (clinic_id, patient_id);

-- impede dois agendamentos sobrepostos para o mesmo profissional
create extension if not exists btree_gist;
alter table appointments add constraint no_overlap exclude using gist (
  professional_id with =,
  tstzrange(starts_at, starts_at + make_interval(mins => duration_min)) with &&
) where (status <> 'cancelado');

alter table leads add column appointment_id uuid references appointments(id) on delete set null;

-- ---------- Financeiro ----------
create table budgets (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  patient_id  uuid references patients(id) on delete set null,
  lead_id     uuid references leads(id) on delete set null,
  items       jsonb not null default '[]',   -- [{procedureId, description, qty, unitPrice}]
  total       numeric(12,2) not null,
  status      budget_status not null default 'aberto',
  created_at  timestamptz not null default now()
);

alter table leads add column budget_id uuid references budgets(id) on delete set null;

create table transactions (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  type            transaction_type not null,
  category        text not null,
  description     text,
  amount          numeric(12,2) not null check (amount >= 0),
  occurred_at     timestamptz not null default now(),
  method          text,
  patient_id      uuid references patients(id) on delete set null,
  appointment_id  uuid references appointments(id) on delete set null
);
create index on transactions (clinic_id, occurred_at);

-- ---------- Agente de IA ----------
create table ai_agent_configs (
  clinic_id          uuid primary key references clinics(id) on delete cascade,
  enabled            boolean not null default true,
  name               text not null default 'Sofia',
  persona            text not null default '',
  tone               text not null default 'acolhedor',
  triage_questions   jsonb not null default '[]',
  handoff_rules      jsonb not null default '[]',
  working_hours_only boolean not null default false,
  send_booking_link  boolean not null default true,
  updated_at         timestamptz not null default now()
);

-- ---------- Auditoria (LGPD) ----------
create table audit_log (
  id          bigserial primary key,
  clinic_id   uuid not null,
  user_id     uuid,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  at          timestamptz not null default now(),
  diff        jsonb
);

-- =====================================================================
-- RLS: cada usuário só enxerga dados da própria clínica
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'professionals','procedures','patients','patient_notes','whatsapp_instances','leads',
    'conversations','messages','appointments','budgets','transactions','ai_agent_configs','audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy tenant_isolation on %I for all using (clinic_id = current_clinic_id()) with check (clinic_id = current_clinic_id())', t);
  end loop;
end $$;

alter table clinics  enable row level security;
alter table profiles enable row level security;
create policy own_clinic   on clinics  for select using (id = current_clinic_id());
create policy same_clinic  on profiles for select using (clinic_id = current_clinic_id());
create policy admin_manage on profiles for all using (clinic_id = current_clinic_id() and current_role_is('admin'));

-- Financeiro: só admin (substitui a policy genérica)
drop policy tenant_isolation on transactions;
create policy finance_admin on transactions for all
  using (clinic_id = current_clinic_id() and current_role_is('admin'))
  with check (clinic_id = current_clinic_id() and current_role_is('admin'));

-- =====================================================================
-- Views de relatório (usadas pelo Dashboard/Relatórios)
-- =====================================================================
create or replace view v_inactive_patients with (security_invoker = true) as
select p.*, max(a.starts_at) as last_visit
from patients p
join appointments a on a.patient_id = p.id and a.status = 'compareceu'
where p.deleted_at is null
group by p.id
having max(a.starts_at) < now() - interval '6 months'
   and not exists (select 1 from appointments f where f.patient_id = p.id and f.starts_at > now() and f.status <> 'cancelado');

create or replace view v_monthly_revenue with (security_invoker = true) as
select clinic_id,
       date_trunc('month', occurred_at) as month,
       sum(amount) filter (where type = 'entrada') as entradas,
       sum(amount) filter (where type = 'saida')   as saidas
from transactions
group by 1, 2;

create or replace view v_conversion_by_source with (security_invoker = true) as
select clinic_id, source,
       count(*) as leads,
       count(*) filter (where stage in ('agendado','realizado')) as convertidos
from leads
group by 1, 2;

-- Realtime para a caixa de entrada
alter publication supabase_realtime add table conversations, messages;
