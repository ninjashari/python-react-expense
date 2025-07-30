import random
from sqlalchemy.orm import Session
from models.categories import Category

def generate_unique_color(db: Session) -> str:
    """Generate a unique hex color that's not already used by any category"""
    
    # Get all existing colors
    existing_colors = set(color[0] for color in db.query(Category.color).all())
    
    # Predefined nice colors for better UI
    nice_colors = [
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
        "#F7DC6F", "#BB8FCE", "#85C1E9", "#F8C471", "#82E0AA",
        "#F1948A", "#85C1E9", "#F4D03F", "#AED6F1", "#A9DFBF",
        "#F5B7B1", "#D7BDE2", "#A3E4D7", "#F9E79F", "#D5A6BD",
        "#FFB6C1", "#87CEEB", "#DDA0DD", "#F0E68C", "#90EE90",
        "#FFE4B5", "#D3D3D3", "#FFA500", "#20B2AA", "#9370DB"
    ]
    
    # Try nice colors first
    for color in nice_colors:
        if color not in existing_colors:
            return color
    
    # If all nice colors are taken, generate random ones
    max_attempts = 100
    for _ in range(max_attempts):
        # Generate a random color
        color = "#{:06x}".format(random.randint(0, 0xFFFFFF))
        if color not in existing_colors:
            return color
    
    # Fallback: generate a color based on timestamp
    import time
    return "#{:06x}".format(int(time.time()) % 0xFFFFFF)