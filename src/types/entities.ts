/**
 * Entity types and interfaces for Constellation knowledge graph
 */

export type EntityType =
  | "country"
  | "company"
  | "leader"
  | "organization"
  | "facility"
  | "chokepoint"
  | "commodity"
  | "product"
  | "weapon_system"
  | "alliance";

export type EntityRelation = "involves" | "affects" | "occurred_in" | "mentions";

/**
 * Entity linked to an event (returned by get_event_entities RPC)
 */
export interface EventEntity {
  entity_id: string;
  name: string;
  node_type: EntityType;
  relation_type: EntityRelation;
  hit_count: number;
}

/**
 * Event linked to an entity (returned by get_entity_events RPC)
 */
export interface EntityEvent {
  event_id: string;
  title: string;
  summary: string;
  category: string;
  severity: number;
  event_timestamp: string;
  relation_type: EntityRelation;
}
