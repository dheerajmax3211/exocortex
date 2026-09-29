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

export type DatePrecision = 'year' | 'month' | 'day' | 'time';

export interface EdgeProps {
  rating_10?: number;
  sentiment?: string;
  quote?: string;
  role?: string;
  subject?: string;
  [key: string]: any;
}

export interface Entry {
  id: string;
  user_id: string;
  raw_text: string;
  entered_at: string;
  event_date?: string;
  date_end?: string;
  date_precision?: DatePrecision;
  source?: string;
  status: 'draft' | 'processed' | 'failed' | 'committed';
  fts?: any;
}

export interface Entity {
  id: string;
  user_id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  summary?: string;
  props?: Record<string, any>;
  start_date?: string;
  end_date?: string;
  date_precision?: DatePrecision;
  created_from_entry?: string;
  deleted_at?: string;
  created_at: string;
}

export interface Edge {
  id: string;
  user_id: string;
  src: string;
  dst: string;
  relation: string;
  props?: EdgeProps;
  entry_id?: string;
  occurred_on?: string;
  deleted_at?: string;
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
