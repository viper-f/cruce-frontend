import { CustomFieldsData } from './Character';
import { ClaimRecord } from './CharacterClaim';
import { Faction } from './Faction';
import { UserInfo } from './User';

export interface GetWantedCharacterListRequest {
  faction_ids: number[];
  page: number;
}

export interface WantedCharacterListResponse {
  items: WantedCharacter[];
  total_pages: number;
}

export interface WantedCharacter {
  id: number;
  name: string;
  is_claimed: boolean;
  author_user_id: number;
  date_created: string;
  character_claim_id: number | null;
  is_deleted: boolean | null;
  topic_id: number;
  custom_fields: CustomFieldsData;
  factions: Faction[] | null;
  wanted_character_status?: number;
  claim_record: ClaimRecord | null;
  user_info?: UserInfo | null;
}
