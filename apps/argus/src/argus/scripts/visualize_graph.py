#!/usr/bin/env python3
"""
Generate an interactive graph visualization.
"""

import os
import sys
import json
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent.parent))
os.chdir(Path(__file__).parent.parent)

from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

db = create_client(
    os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

def get_entity_network(entity_name: str, depth: int = 1):
    """Get a network centered on an entity."""
    
    # Find the entity
    result = db.table("nodes").select("id, name, node_type, hit_count").ilike(
        "name", f"%{entity_name}%"
    ).neq("node_type", "event").order("hit_count", desc=True).limit(1).execute()
    
    if not result.data:
        print(f"Entity '{entity_name}' not found")
        return None, None
    
    center = result.data[0]
    print(f"Center: {center['name']} ({center['node_type']}, {center['hit_count']} hits)")
    
    nodes = {center["id"]: center}
    edges = []
    
    # Get edges TO this entity (events that involve it)
    result = db.table("edges").select("source_id, target_id, relation_type").eq(
        "target_id", center["id"]
    ).limit(50).execute()
    
    event_ids = []
    for e in (result.data or []):
        edges.append(e)
        event_ids.append(e["source_id"])
    
    # Get those events
    if event_ids:
        result = db.table("nodes").select("id, name, node_type").in_(
            "id", event_ids
        ).execute()
        for n in (result.data or []):
            nodes[n["id"]] = n
    
    # Get other entities connected to those events
    if event_ids:
        result = db.table("edges").select("source_id, target_id, relation_type").in_(
            "source_id", event_ids
        ).execute()
        
        other_entity_ids = []
        for e in (result.data or []):
            edges.append(e)
            if e["target_id"] not in nodes:
                other_entity_ids.append(e["target_id"])
        
        # Get those entities
        if other_entity_ids:
            result = db.table("nodes").select("id, name, node_type, hit_count").in_(
                "id", other_entity_ids
            ).execute()
            for n in (result.data or []):
                nodes[n["id"]] = n
    
    return list(nodes.values()), edges


def get_top_events_network(limit: int = 10):
    """Get a network of top events and their entities."""
    
    # Get events with most entities
    result = db.table("edges").select("source_id").in_(
        "relation_type", ["involves", "affects", "occurred_in", "mentions"]
    ).execute()
    
    from collections import Counter
    event_counts = Counter(e["source_id"] for e in (result.data or []))
    top_event_ids = [eid for eid, _ in event_counts.most_common(limit)]
    
    nodes = {}
    edges = []
    
    # Get those events
    result = db.table("nodes").select("id, name, node_type").in_(
        "id", top_event_ids
    ).execute()
    for n in (result.data or []):
        # Truncate event names
        n["name"] = n["name"][:40] + "..." if len(n["name"]) > 40 else n["name"]
        nodes[n["id"]] = n
    
    # Get edges from those events
    result = db.table("edges").select("source_id, target_id, relation_type").in_(
        "source_id", top_event_ids
    ).execute()
    
    entity_ids = []
    for e in (result.data or []):
        edges.append(e)
        if e["target_id"] not in nodes:
            entity_ids.append(e["target_id"])
    
    # Get those entities
    if entity_ids:
        result = db.table("nodes").select("id, name, node_type, hit_count").in_(
            "id", entity_ids
        ).execute()
        for n in (result.data or []):
            nodes[n["id"]] = n
    
    return list(nodes.values()), edges


def generate_html(nodes, edges, title="Knowledge Graph"):
    """Generate an HTML file with D3.js visualization."""
    
    # Prepare data for D3
    node_list = []
    node_id_map = {}
    
    for i, n in enumerate(nodes):
        node_id_map[n["id"]] = i
        node_list.append({
            "id": i,
            "name": n["name"],
            "type": n["node_type"],
            "hits": n.get("hit_count", 0)
        })
    
    edge_list = []
    seen_edges = set()
    for e in edges:
        if e["source_id"] in node_id_map and e["target_id"] in node_id_map:
            key = (e["source_id"], e["target_id"], e["relation_type"])
            if key not in seen_edges:
                seen_edges.add(key)
                edge_list.append({
                    "source": node_id_map[e["source_id"]],
                    "target": node_id_map[e["target_id"]],
                    "type": e["relation_type"]
                })
    
    html = f'''<!DOCTYPE html>
<html>
<head>
    <title>{title}</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0a0a0a; }}
        svg {{ width: 100vw; height: 100vh; }}
        .node {{ cursor: pointer; }}
        .node text {{ font-size: 10px; fill: #fff; pointer-events: none; }}
        .link {{ stroke-opacity: 0.4; }}
        .tooltip {{ position: absolute; background: #222; color: #fff; padding: 8px 12px; border-radius: 4px; font-size: 12px; pointer-events: none; }}
        h1 {{ position: absolute; top: 10px; left: 20px; color: #fff; font-size: 18px; margin: 0; }}
        .legend {{ position: absolute; bottom: 20px; left: 20px; color: #fff; font-size: 12px; }}
        .legend div {{ margin: 4px 0; }}
        .legend span {{ display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; }}
    </style>
</head>
<body>
    <h1>{title}</h1>
    <div class="legend">
        <div><span style="background: #ff6b6b;"></span>Event</div>
        <div><span style="background: #4ecdc4;"></span>Country</div>
        <div><span style="background: #ffe66d;"></span>Leader</div>
        <div><span style="background: #95e1d3;"></span>Organization</div>
        <div><span style="background: #a8e6cf;"></span>Company</div>
        <div><span style="background: #dda0dd;"></span>Alliance</div>
        <div><span style="background: #888;"></span>Other</div>
    </div>
    <svg></svg>
    <script>
        const nodes = {json.dumps(node_list)};
        const links = {json.dumps(edge_list)};
        
        const colors = {{
            event: "#ff6b6b",
            country: "#4ecdc4",
            leader: "#ffe66d",
            organization: "#95e1d3",
            company: "#a8e6cf",
            alliance: "#dda0dd",
            facility: "#f9c74f",
            location: "#90be6d",
            commodity: "#f8961e",
            product: "#43aa8b"
        }};
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        const svg = d3.select("svg")
            .attr("viewBox", [0, 0, width, height]);
        
        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(30));
        
        const link = svg.append("g")
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("class", "link")
            .attr("stroke", "#555")
            .attr("stroke-width", 1);
        
        const node = svg.append("g")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .attr("class", "node")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));
        
        node.append("circle")
            .attr("r", d => d.type === "event" ? 8 : Math.min(6 + (d.hits || 0) / 5, 20))
            .attr("fill", d => colors[d.type] || "#888");
        
        node.append("text")
            .attr("dx", 12)
            .attr("dy", 4)
            .text(d => d.name);
        
        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);
        
        node.on("mouseover", function(event, d) {{
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`<strong>${{d.name}}</strong><br/>Type: ${{d.type}}<br/>Hits: ${{d.hits || 0}}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
        }})
        .on("mouseout", function() {{
            tooltip.transition().duration(500).style("opacity", 0);
        }});
        
        simulation.on("tick", () => {{
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
            
            node.attr("transform", d => `translate(${{d.x}},${{d.y}})`);
        }});
        
        function dragstarted(event) {{
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }}
        
        function dragged(event) {{
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }}
        
        function dragended(event) {{
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }}
    </script>
</body>
</html>'''
    
    return html


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--entity", type=str, help="Center on this entity")
    parser.add_argument("--top-events", type=int, default=10, help="Show top N events")
    parser.add_argument("--output", type=str, default="graph.html", help="Output file")
    
    args = parser.parse_args()
    
    if args.entity:
        print(f"Building network for '{args.entity}'...")
        nodes, edges = get_entity_network(args.entity)
        title = f"Network: {args.entity}"
    else:
        print(f"Building network for top {args.top_events} events...")
        nodes, edges = get_top_events_network(args.top_events)
        title = f"Top {args.top_events} Events Network"
    
    if nodes:
        print(f"   Nodes: {len(nodes)}, Edges: {len(edges)}")
        html = generate_html(nodes, edges, title)
        
        output_path = Path(args.output)
        output_path.write_text(html)
        print(f"   ✅ Saved to {output_path.absolute()}")
        print(f"   Open in browser: file://{output_path.absolute()}")
