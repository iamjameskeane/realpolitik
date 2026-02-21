"""
Enhanced synthesis logic for Cassandra microservice.
Migrated from Argus with graph-aware context and tool calling.
"""

import asyncio
import json
import time
from typing import List, Dict, Any, Optional
from models.events import SynthesizedEvent, EventSource
from models.context import AnalysisContext
from .prompts import ENHANCED_SYNTHESIS_PROMPT


class EnhancedSynthesizer:
    """Enhanced synthesis with graph context and tool calling."""
    
    def __init__(self, ai_client, graph_queries):
        self.ai_client = ai_client
        self.graph_queries = graph_queries
    
    async def synthesize_with_context(
        self,
        event_sources: List[EventSource],
        context: AnalysisContext,
        model: str
    ) -> Optional[SynthesizedEvent]:
        """
        Synthesize event with full graph context.
        
        Args:
            event_sources: List of EventSource objects
            context: Complete analysis context
            model: Model to use for synthesis
            
        Returns:
            SynthesizedEvent with enhanced fallout prediction
        """
        
        # Build comprehensive prompt with context
        prompt = self._build_contextual_prompt(event_sources, context)
        
        # Define tools for enhanced reasoning
        tools = self._get_synthesis_tools()
        
        try:
            # Generate with tool calling support
            print(f"   🧠 Generating enhanced synthesis with context...")
            result = await self.ai_client.generate_with_tools(
                prompt=prompt,
                tools=tools,
                model=model,
                max_tool_calls=3
            )
            
            if not result["content"]:
                print(f"   ⚠️ Empty synthesis response")
                return None
            
            # Parse JSON response
            try:
                response_data = json.loads(result["content"])
                
                # Map response to SynthesizedEvent
                synthesized = SynthesizedEvent(
                    title=response_data.get("title", "Enhanced Analysis"),
                    summary=response_data.get("summary", "Context-aware summary"),
                    fallout_prediction=response_data.get("fallout_prediction", "No prediction available"),
                    severity=response_data.get("severity", 5)
                )
                
                # Log tool usage for monitoring
                if result["tool_calls"]:
                    print(f"   🔧 Used {len(result['tool_calls'])} tools for enhanced analysis")
                
                print(f"  ✓ Enhanced synthesis completed")
                return synthesized
                
            except (json.JSONDecodeError, KeyError) as e:
                print(f"   ⚠️ Failed to parse enhanced synthesis response: {e}")
                return None
                
        except Exception as e:
            print(f"   ⚠️ Enhanced synthesis failed: {type(e).__name__}: {e}")
            return None
    
    def _build_contextual_prompt(
        self, 
        event_sources: List[EventSource], 
        context: AnalysisContext
    ) -> str:
        """Build comprehensive prompt with context."""
        
        # Build timeline from sources
        timeline_parts = []
        for i, source in enumerate(event_sources):
            timeline_parts.append(
                f"{i+1}. [{source.source_name}] {source.timestamp}\n   "
                f"Headline: {source.headline}\n   "
                f"Summary: {source.summary}"
            )
        timeline = "\n".join(timeline_parts)
        
        # Build context sections
        context_sections = []
        
        # Entity context
        if context.entity_neighborhood:
            entities = context.entity_neighborhood[:10]  # Limit for token count
            entity_list = [
                f"- {e.get('name', 'Unknown')} ({e.get('entity_type', 'unknown')})"
                for e in entities
            ]
            context_sections.append(
                f"ENTITIES INVOLVED:\n" + "\n".join(entity_list)
            )
        
        # Relationship context
        if context.relationship_graph and context.relationship_graph.get("direct_relationships"):
            relationships = context.relationship_graph["direct_relationships"][:5]
            rel_list = [
                f"- {r['source_name']} --[{r['relationship_type']}]--> {r['target_name']}"
                for r in relationships
            ]
            context_sections.append(
                f"KEY RELATIONSHIPS:\n" + "\n".join(rel_list)
            )
        
        # Historical analogues
        if context.historical_analogues:
            analogues = context.historical_analogues[:3]
            analogue_list = []
            for a in analogues:
                analogue_list.append(
                    f"- {a['title']} (similarity: {a['similarity_score']:.2f})"
                )
            context_sections.append(
                f"HISTORICAL ANALOGUES:\n" + "\n".join(analogue_list)
            )
        
        # Causal chains
        if context.causal_chains:
            chains = context.causal_chains[:2]
            chain_list = []
            for chain in chains:
                cause = chain.get("cause_event", {}).get("title", "Unknown")
                effect = chain.get("effect_event", {}).get("title", "Unknown")
                chain_list.append(f"- {cause} → {effect}")
            context_sections.append(
                f"CAUSAL RELATIONSHIPS:\n" + "\n".join(chain_list)
            )
        
        context_text = "\n\n".join(context_sections)
        
        # Build final prompt
        full_prompt = f"""
{ENHANCED_SYNTHESIS_PROMPT}

EVENT CONTEXT:
{context_text}

NEWS REPORTS TO SYNTHESIZE:
{timeline}

Analyze these reports with the provided context. Use tool calls to gather additional information if needed, then provide your enhanced analysis.
"""
        
        return full_prompt
    
    def _get_synthesis_tools(self) -> List[Dict[str, Any]]:
        """Define tools available for enhanced synthesis."""
        
        return [
            {
                "type": "function",
                "function": {
                    "name": "get_entity_relationships",
                    "description": "Get relationships for a specific entity",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "entity_id": {
                                "type": "string",
                                "description": "Entity UUID to get relationships for"
                            },
                            "max_depth": {
                                "type": "integer",
                                "description": "Relationship traversal depth (1-3)",
                                "default": 2
                            }
                        },
                        "required": ["entity_id"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_event_network",
                    "description": "Get complete network graph around an event",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "event_id": {
                                "type": "string",
                                "description": "Event UUID to get network for"
                            },
                            "include_indirect": {
                                "type": "boolean",
                                "description": "Include 2-hop relationships",
                                "default": True
                            }
                        },
                        "required": ["event_id"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "find_similar_events",
                    "description": "Find historically similar events",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "event_text": {
                                "type": "string",
                                "description": "Event description for similarity search"
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Maximum results to return",
                                "default": 5
                            }
                        },
                        "required": ["event_text"]
                    }
                }
            }
        ]
    
    async def execute_tool_call(
        self, 
        tool_name: str, 
        arguments: Dict[str, Any]
    ) -> str:
        """Execute tool calls during synthesis."""
        
        try:
            if tool_name == "get_entity_relationships":
                entity_id = arguments.get("entity_id")
                max_depth = arguments.get("max_depth", 2)
                
                relationships = await self.graph_queries.get_entity_relationships(entity_id, max_depth)
                
                if relationships:
                    rel_text = "Entity relationships:\n"
                    for rel in relationships[:10]:  # Limit results
                        rel_text += f"- {rel['target_name']} ({rel['relationship_type']}, "
                        rel_text += f"confidence: {rel['confidence']:.2f})\n"
                    return rel_text
                else:
                    return "No relationships found for this entity."
            
            elif tool_name == "get_event_network":
                event_id = arguments.get("event_id")
                include_indirect = arguments.get("include_indirect", True)
                
                network = await self.graph_queries.get_event_network_graph(event_id, include_indirect)
                
                if network and network.get("entities"):
                    network_text = f"Event network ({len(network['entities'])} entities):\n"
                    for entity in network["entities"][:5]:
                        network_text += f"- {entity['name']} ({entity.get('entity_type', 'unknown')})\n"
                    
                    if network.get("direct_relationships"):
                        network_text += "\nKey relationships:\n"
                        for rel in network["direct_relationships"][:3]:
                            network_text += f"- {rel['source_name']} --[{rel['relationship_type']}]--> {rel['target_name']}\n"
                    
                    return network_text
                else:
                    return "No network data found for this event."
            
            elif tool_name == "find_similar_events":
                event_text = arguments.get("event_text", "")
                limit = arguments.get("limit", 5)
                
                analogues = await self.graph_queries.find_historical_analogues(event_text, limit)
                
                if analogues:
                    analogue_text = "Similar historical events:\n"
                    for analogue in analogues:
                        analogue_text += f"- {analogue['title']} (similarity: {analogue['similarity_score']:.2f})\n"
                        analogue_text += f"  {analogue['summary'][:200]}...\n\n"
                    return analogue_text
                else:
                    return "No similar events found."
            
            else:
                return f"Unknown tool: {tool_name}"
                
        except Exception as e:
            return f"Tool execution failed: {str(e)}"


async def synthesize_incident_legacy(
    ai_client,
    sources: List[EventSource],
    model: str,
    location_name: str = ""
) -> Optional[SynthesizedEvent]:
    """
    Legacy synthesis function (migrated from Argus).
    
    Args:
        ai_client: AI client wrapper
        sources: List of event sources to synthesize
        model: Model name to use
        location_name: Location for logging
    
    Returns:
        SynthesizedEvent or None on failure
    """
    
    # Sort by credibility (highest first), then by timestamp
    def source_sort_key(s: EventSource) -> tuple[int, str]:
        from config import get_source_credibility
        cred = get_source_credibility(s.source_name)
        return (-cred, s.timestamp)
    
    sorted_sources = sorted(sources, key=source_sort_key)
    
    # Build timeline
    timeline_parts = []
    for i, s in enumerate(sorted_sources):
        from config import get_source_credibility
        cred = get_source_credibility(s.source_name)
        label = "HIGH" if cred >= 8 else "MEDIUM" if cred >= 6 else "LOW" if cred >= 4 else "VERY LOW"
        timeline_parts.append(
            f"{i+1}. [{s.source_name}] ({label}) {s.timestamp}\n   "
            f"Headline: {s.headline}\n   Summary: {s.summary}"
        )
    timeline = "\n".join(timeline_parts)
    
    try:
        from .prompts import get_current_date_context
        date_context = get_current_date_context()
        
        from .prompts import SYNTHESIS_PROMPT
        initial_prompt = f"{date_context}\n\n{SYNTHESIS_PROMPT}\n\nNews reports:\n\n{timeline}"
        
        # Call AI client
        response_text = await ai_client.generate_content(
            initial_prompt,
            model=model,
            response_format={"type": "json_object"}
        )
        
        if not response_text:
            print(f"   ⚠️ Empty synthesis response for {location_name}")
            return None
        
        # Parse JSON response
        try:
            response_data = json.loads(response_text)
            
            synthesized = SynthesizedEvent(
                title=response_data.get("title", "Untitled Event"),
                summary=response_data.get("summary", "No summary available"),
                fallout_prediction=response_data.get("fallout_prediction", "No fallout prediction available"),
                severity=response_data.get("severity", 5)
            )
            
            print(f"  ✓ Synthesized: {location_name} ({len(sources)} sources)")
            return synthesized
            
        except (json.JSONDecodeError, KeyError) as e:
            print(f"   ⚠️ Failed to parse synthesis response for {location_name}: {e}")
            return None
            
    except Exception as e:
        print(f"   ⚠️ Synthesis failed for {location_name}: {type(e).__name__}: {e}")
        return None