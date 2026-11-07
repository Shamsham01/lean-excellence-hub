export type PeopleDirectoryPerson = {
  membership_id: string;
  display_name: string | null;
  job_title: string | null;
  job_function_name: string | null;
  job_function_code: string | null;
  status: string;
  avatar_url: string | null;
  primary_unit_id: string | null;
  primary_unit_name: string | null;
  primary_unit_code: string | null;
  joined_at: string | null;
  username: string | null;
  email: string | null;
  notification_email: string | null;
  is_workforce_account?: boolean;
};

export type PeopleDirectoryPayload = {
  people: PeopleDirectoryPerson[];
  total_count: number;
  page: number;
  page_size: number;
  include_inactive: boolean;
  can_read_identity: boolean;
};

export type PeopleDirectoryUnitOption = {
  id: string;
  name: string;
  code: string;
};
