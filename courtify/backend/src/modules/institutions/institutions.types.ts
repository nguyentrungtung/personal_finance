export interface InstitutionRow {
  id: number;
  name: string;
  type: string;
  supported_channels: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInstitutionDto {
  name: string;
  type: string;
  supported_channels?: string;
}

export type UpdateInstitutionDto = Partial<CreateInstitutionDto>;
