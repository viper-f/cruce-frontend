export interface ClaimRecord {
  id: number;
  claim_id: number;
  user_id: number | null;
  guest_hash: string | null;
  is_guest: boolean;
  claim_date: string;
  claim_expiration_date: string;
  character_id: number | null;
  claim_created_with_character_sheet: boolean | null;
  claim_author_id: number | null;
  claim_author_username: string | null;
}

export interface ClaimAutocompleteItem {
  id: number;
  name: string;
  is_claimed: boolean | null;
  claim_expiration_date: string | null;
  user_id: number | null;
  guest_hash: string | null;
}

export interface CharacterClaim {
  id: number;
  name: string;
  description: string | null;
  is_claimed: boolean;
  user_id: number;
  guest_hash: string;
  can_change_name: boolean;
  last_claim_date: string | null;
}

export interface ClaimFactionResponse {
  id: number;
  name: string;
  parent_id: number | null;
  level: number;
  description: string | null;
  icon: string | null;
  show_on_profile: boolean;
  faction_status: number;
  claims: CharacterClaim[];
}
