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
