"""
Entity and relationship models for Constellation knowledge graph.
"""

from pydantic import BaseModel, Field
from typing import Literal


# Suggested entity types - model can use these or create its own
# NOTE: "event" is NOT a valid entity type - it conflicts with database event nodes
SUGGESTED_ENTITY_TYPES = [
    # Countries & Geography
    "country",          # USA, China, Russia
    "city",             # Kyiv, Tehran, Shanghai  
    "region",           # Donbas, Kashmir, Balochistan
    "location",         # borders, zones, areas
    "chokepoint",       # Strait of Hormuz, Suez Canal
    
    # People & Groups
    "leader",           # Xi Jinping, Trump, Putin
    "official",         # ministers, ambassadors, generals
    "group",            # migrants, refugees, ethnic groups (named/specific)
    "ethnic_group",     # Uyghurs, Kurds, Rohingya
    
    # Organizations
    "organization",     # UN, WHO, NGOs
    "company",          # TSMC, Apple, Gazprom
    "military_unit",    # PLA Southern Theatre, IDF, Wagner
    "political_party",  # GOP, DEM, CCP
    "militant_group",   # Hamas, Houthis, Taliban
    "alliance",         # NATO, BRICS, G7
    
    # Things
    "facility",         # ports, bases, refineries
    "commodity",        # oil, gas, wheat
    "product",          # H200 GPU, F-35
    "weapon_system",    # ATACMS, S-400, Patriot
    "infrastructure",   # pipelines, power grid, railways
    
    # Abstract
    "treaty",           # JCPOA, Paris Agreement
    "policy",           # sanctions, tariffs, embargo
    "movement",         # protests, revolution, insurgency
    "sector",           # semiconductor industry, energy sector
]

# Blacklisted entity types (conflict with database or are too vague)
BLACKLISTED_ENTITY_TYPES = ["event", "population"]

# For backwards compatibility - but model can use any string
ENTITY_TYPES = str  # Now accepts any type, not just the literal list


class ExtractedEntity(BaseModel):
    """Entity extracted from article text by LLM."""
    name: str = Field(..., description="Entity name as it appears in text")
    type: str = Field(
        ..., 
        description=(
            "Entity type. Use one of the suggested types if it fits: "
            "country, city, region, location, chokepoint, leader, official, group, ethnic_group, "
            "organization, company, military_unit, political_party, militant_group, alliance, "
            "facility, commodity, product, weapon_system, infrastructure, treaty, policy, "
            "movement, sector. Or create your own type if none fit (e.g., 'trade_route', "
            "'currency', 'ideology'). NEVER use 'event' or 'population' as types."
        )
    )
    canonical_id: str | None = Field(default=None, description="Normalized ID (lowercase, no spaces)")
    role: Literal["actor", "affected", "location", "mentioned"] = Field(
        ...,
        description="Role of entity in the event"
    )


class ExtractedRelationship(BaseModel):
    """Relationship between entities extracted by LLM."""
    from_entity: str = Field(..., description="Source entity name")
    to_entity: str = Field(..., description="Target entity name")
    rel_type: str = Field(..., description="Relationship type (e.g., 'supplies', 'hosts', 'leader_of')")
    percentage: float | None = Field(default=None, ge=0, le=100, description="Relationship strength percentage")
    detail: str | None = Field(default=None, description="Additional context about the relationship")
    polarity: float = Field(default=0.0, ge=-1.0, le=1.0, description="Cooperative (+1) vs adversarial (-1)")


class ResolvedEntity(BaseModel):
    """Entity after resolution to canonical form."""
    id: str = Field(..., description="UUID from database")
    name: str = Field(..., description="Canonical name")
    type: str = Field(..., description="Entity type (flexible, can be any descriptive type)")
    embedding: list[float] | None = Field(default=None, description="3072-dimensional embedding (halfvec)")
    is_hub: bool = Field(default=False, description="High-degree node requiring special handling")


class EntityExtractionResult(BaseModel):
    """Complete entity extraction result from LLM."""
    entities: list[ExtractedEntity] = Field(default_factory=list)
    relationships: list[ExtractedRelationship] = Field(default_factory=list)
