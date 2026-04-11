export interface Feature {
  key: string;
  name: string;
  description: string;
  is_active: boolean;
}

export interface FeatureToggleResponse {
  key: string;
  is_active: boolean;
}
