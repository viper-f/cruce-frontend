import { CharacterListItem } from './Character';

export interface Faction {
  id: number,
  name: string,
  parent_id: number|null,
  level: number,
  description: string|null,
  icon: string|null,
  faction_status: number,
  show_on_profile: boolean,
  characters: CharacterListItem[]
}

export interface FactionShort {
  id: number,
  name: string,
}
