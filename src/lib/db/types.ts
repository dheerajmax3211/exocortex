export type EntityType = 
  | 'person' 
  | 'place' 
  | 'restaurant' 
  | 'dish' 
  | 'movie' 
  | 'show' 
  | 'book' 
  | 'school' 
  | 'org' 
  | 'period' 
  | 'event' 
  | 'item' 
  | 'other';

export type DatePrecision = 'day' | 'month' | 'year' | 'period' | 'unknown';

export interface EdgeProps {
  rating_10?: number | null;
  sentiment?: string | null;
  quote?: string | null;
  role?: string | null;
  subject?: string | null;
  [key: string]: any;
}

export interface Entry {
  id: string;
  user_id: string;
  raw_text: string;
  entered_at: string;
  event_date?: string | null;
  date_end?: string | null;
  date_precision?: DatePrecision | null;
  source?: string | null;
  status: 'draft' | 'processed' | 'failed' | 'committed';
  fts?: any;
}

export interface Entity {
  id: string;
  user_id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  summary?: string | null;
  props?: Record<string, any>;
  start_date?: string | null;
  end_date?: string | null;
  date_precision?: DatePrecision | null;
  created_from_entry?: string | null;
  deleted_at?: string | null;
  created_at: string;
}

export interface Edge {
  id: string;
  user_id: string;
  src: string;
  dst: string;
  relation: string;
  props?: EdgeProps;
  entry_id?: string | null;
  occurred_on?: string | null;
  deleted_at?: string | null;
  created_at: string;
}

export interface Fact {
  id: string;
  user_id: string;
  entity_id: string;
  key: string;
  value: any;
  entry_id?: string;
  as_of?: string;
}

export interface EntryEntity {
  entry_id: string;
  entity_id: string;
}

export interface GraphLayout {
  entity_id: string;
  user_id: string;
  x: number;
  y: number;
  updated_at: string;
}
