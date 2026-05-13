-- Stores user profile data synced from onboarding.
-- `id` is the auth.users UUID so each row belongs to exactly one user.
-- `created_at` is a Unix ms timestamp to match the app's Profile type.

create table if not exists profiles (
  id          uuid    primary key references auth.users(id) on delete cascade,
  name        text    not null,
  sex         text    not null check (sex in ('male', 'female', 'other')),
  age         integer not null,
  height_cm   numeric not null,
  weight_kg   numeric not null,
  goal        text    not null check (goal in ('lose', 'maintain', 'gain')),
  activity    text    not null check (activity in ('sedentary', 'light', 'moderate', 'active', 'athlete')),
  goal_kcal   integer not null,
  created_at  bigint  not null
);

alter table profiles enable row level security;

create policy "select_own_profile" on profiles
  for select using (auth.uid() = id);

create policy "insert_own_profile" on profiles
  for insert with check (auth.uid() = id);

create policy "update_own_profile" on profiles
  for update using (auth.uid() = id);
