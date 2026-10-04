-- =========================================================
-- Rapor Tahfidz — skema database Supabase
-- Jalankan seluruh isi file ini di Supabase > SQL Editor
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------- Tabel ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  email text,
  role text not null default 'guru' check (role in ('guru','kepala')),
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pengaturan (
  id int primary key default 1 check (id = 1),
  nama_lembaga text default '',
  alamat text default '',
  nama_kepala text default '',
  tempat text default '',
  logo text
);
insert into public.pengaturan (id) values (1) on conflict do nothing;

create table if not exists public.periode (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  aktif boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.kelas (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  guru_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.siswa (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  nis text,
  kelas_id uuid not null references public.kelas(id) on delete cascade,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rapor (
  id uuid primary key default gen_random_uuid(),
  siswa_id uuid not null references public.siswa(id) on delete cascade,
  periode_id uuid not null references public.periode(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','selesai')),
  kelancaran text,
  tajwid text,
  makhraj text,
  adab text,
  predikat text,
  total_hafalan text,
  target text,
  hadir int not null default 0,
  izin int not null default 0,
  sakit int not null default 0,
  alpa int not null default 0,
  catatan text,
  setoran jsonb not null default '[]'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (siswa_id, periode_id)
);

create index if not exists idx_siswa_kelas on public.siswa(kelas_id);
create index if not exists idx_rapor_periode on public.rapor(periode_id);

-- ---------- Fungsi bantu (dipakai oleh aturan akses) ----------
create or replace function public.is_kepala()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'kepala' and aktif
  );
$$;

create or replace function public.is_guru_of_kelas(k uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1
    from public.kelas c
    join public.profiles p on p.id = c.guru_id
    where c.id = k and c.guru_id = auth.uid() and p.aktif
  );
$$;

-- ---------- Row Level Security ----------
alter table public.profiles   enable row level security;
alter table public.pengaturan enable row level security;
alter table public.periode    enable row level security;
alter table public.kelas      enable row level security;
alter table public.siswa      enable row level security;
alter table public.rapor      enable row level security;

-- profiles: setiap orang boleh baca profil sendiri, kepala boleh semuanya
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_kepala());
drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles for all to authenticated
  using (public.is_kepala()) with check (public.is_kepala());

-- pengaturan & periode: semua yang login boleh baca, hanya kepala yang mengubah
drop policy if exists pengaturan_select on public.pengaturan;
create policy pengaturan_select on public.pengaturan for select to authenticated using (true);
drop policy if exists pengaturan_write on public.pengaturan;
create policy pengaturan_write on public.pengaturan for all to authenticated
  using (public.is_kepala()) with check (public.is_kepala());

drop policy if exists periode_select on public.periode;
create policy periode_select on public.periode for select to authenticated using (true);
drop policy if exists periode_write on public.periode;
create policy periode_write on public.periode for all to authenticated
  using (public.is_kepala()) with check (public.is_kepala());

-- kelas: guru hanya melihat kelasnya, kepala melihat dan mengubah semua
drop policy if exists kelas_select on public.kelas;
create policy kelas_select on public.kelas for select to authenticated
  using (public.is_kepala() or public.is_guru_of_kelas(id));
drop policy if exists kelas_write on public.kelas;
create policy kelas_write on public.kelas for all to authenticated
  using (public.is_kepala()) with check (public.is_kepala());

-- siswa: guru mengelola siswa di kelasnya sendiri
drop policy if exists siswa_all on public.siswa;
create policy siswa_all on public.siswa for all to authenticated
  using (public.is_kepala() or public.is_guru_of_kelas(kelas_id))
  with check (public.is_kepala() or public.is_guru_of_kelas(kelas_id));

-- rapor: guru hanya rapor siswa di kelasnya
drop policy if exists rapor_all on public.rapor;
create policy rapor_all on public.rapor for all to authenticated
  using (
    exists (
      select 1 from public.siswa s
      where s.id = rapor.siswa_id
        and (public.is_kepala() or public.is_guru_of_kelas(s.kelas_id))
    )
  )
  with check (
    exists (
      select 1 from public.siswa s
      where s.id = rapor.siswa_id
        and (public.is_kepala() or public.is_guru_of_kelas(s.kelas_id))
    )
  );

-- =========================================================
-- LANGKAH TERAKHIR (jalankan sekali, setelah membuat user kepala
-- lewat Supabase > Authentication > Users > Add user):
--
-- insert into public.profiles (id, nama, email, role)
-- values ('GANTI-DENGAN-UID-USER', 'Kepala Tahfidz', 'email@kepala.com', 'kepala');
-- =========================================================
