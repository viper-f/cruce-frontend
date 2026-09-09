export interface SmileCategory {
  id: number;
  name: string;
}

export interface Smile {
  id: number;
  text_form: string;
  url: string;
  category: SmileCategory | null;
}

export interface SmileCategoryWithSmiles {
  id: number;
  name: string;
  smiles: Smile[];
}
