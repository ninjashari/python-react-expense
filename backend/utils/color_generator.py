import random
import math
import hashlib
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from models.categories import Category

def rgb_to_hex(r: int, g: int, b: int) -> str:
    """Convert RGB values to hex color string."""
    return f"#{r:02x}{g:02x}{b:02x}"

def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """Convert hex color string to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def hsl_to_rgb(h: float, s: float, l: float) -> Tuple[int, int, int]:
    """Convert HSL values to RGB tuple."""
    h = h / 360
    s = s / 100
    l = l / 100
    
    def hue_to_rgb(p: float, q: float, t: float) -> float:
        if t < 0:
            t += 1
        if t > 1:
            t -= 1
        if t < 1/6:
            return p + (q - p) * 6 * t
        if t < 1/2:
            return q
        if t < 2/3:
            return p + (q - p) * (2/3 - t) * 6
        return p
    
    if s == 0:
        r = g = b = l  # achromatic
    else:
        q = l * (1 + s) if l < 0.5 else l + s - l * s
        p = 2 * l - q
        r = hue_to_rgb(p, q, h + 1/3)
        g = hue_to_rgb(p, q, h)
        b = hue_to_rgb(p, q, h - 1/3)
    
    return (int(r * 255), int(g * 255), int(b * 255))

def get_color_luminance(hex_color: str) -> float:
    """Calculate the relative luminance of a color."""
    r, g, b = hex_to_rgb(hex_color)
    
    # Convert to relative luminance
    def gamma_correct(c: int) -> float:
        c = c / 255.0
        if c <= 0.03928:
            return c / 12.92
        else:
            return math.pow((c + 0.055) / 1.055, 2.4)
    
    r_linear = gamma_correct(r)
    g_linear = gamma_correct(g)
    b_linear = gamma_correct(b)
    
    return 0.2126 * r_linear + 0.7152 * g_linear + 0.0722 * b_linear

def color_distance(color1: str, color2: str) -> float:
    """Calculate Euclidean distance between two colors in RGB space."""
    r1, g1, b1 = hex_to_rgb(color1)
    r2, g2, b2 = hex_to_rgb(color2)
    return math.sqrt((r2 - r1)**2 + (g2 - g1)**2 + (b2 - b1)**2)

def generate_material_design_colors() -> List[str]:
    """Generate a comprehensive list of Material Design inspired colors."""
    colors = [
        # Red family
        "#FFEBEE", "#FFCDD2", "#EF9A9A", "#E57373", "#EF5350", "#F44336", "#E53935", "#D32F2F", "#C62828", "#B71C1C",
        "#FF8A80", "#FF5252", "#FF1744", "#D50000",
        
        # Pink family
        "#FCE4EC", "#F8BBD9", "#F48FB1", "#F06292", "#EC407A", "#E91E63", "#D81B60", "#C2185B", "#AD1457", "#880E4F",
        "#FF80AB", "#FF4081", "#F50057", "#C51162",
        
        # Purple family
        "#F3E5F5", "#E1BEE7", "#CE93D8", "#BA68C8", "#AB47BC", "#9C27B0", "#8E24AA", "#7B1FA2", "#6A1B9A", "#4A148C",
        "#EA80FC", "#E040FB", "#D500F9", "#AA00FF",
        
        # Deep Purple family
        "#EDE7F6", "#D1C4E9", "#B39DDB", "#9575CD", "#7E57C2", "#673AB7", "#5E35B1", "#512DA8", "#4527A0", "#311B92",
        "#B388FF", "#7C4DFF", "#651FFF", "#6200EA",
        
        # Indigo family
        "#E8EAF6", "#C5CAE9", "#9FA8DA", "#7986CB", "#5C6BC0", "#3F51B5", "#3949AB", "#303F9F", "#283593", "#1A237E",
        "#8C9EFF", "#536DFE", "#3D5AFE", "#304FFE",
        
        # Blue family
        "#E3F2FD", "#BBDEFB", "#90CAF9", "#64B5F6", "#42A5F5", "#2196F3", "#1E88E5", "#1976D2", "#1565C0", "#0D47A1",
        "#82B1FF", "#448AFF", "#2979FF", "#2962FF",
        
        # Light Blue family
        "#E1F5FE", "#B3E5FC", "#81D4FA", "#4FC3F7", "#29B6F6", "#03A9F4", "#039BE5", "#0288D1", "#0277BD", "#01579B",
        "#80D8FF", "#40C4FF", "#00B0FF", "#0091EA",
        
        # Cyan family
        "#E0F2F1", "#B2DFDB", "#80CBC4", "#4DB6AC", "#26A69A", "#009688", "#00897B", "#00796B", "#00695C", "#004D40",
        "#A7FFEB", "#64FFDA", "#1DE9B6", "#00BFA5",
        
        # Teal family
        "#E0F2F1", "#B2DFDB", "#80CBC4", "#4DB6AC", "#26A69A", "#009688", "#00897B", "#00796B", "#00695C", "#004D40",
        "#A7FFEB", "#64FFDA", "#1DE9B6", "#00BFA5",
        
        # Green family
        "#E8F5E8", "#C8E6C9", "#A5D6A7", "#81C784", "#66BB6A", "#4CAF50", "#43A047", "#388E3C", "#2E7D32", "#1B5E20",
        "#B9F6CA", "#69F0AE", "#00E676", "#00C853",
        
        # Light Green family
        "#F1F8E9", "#DCEDC8", "#C5E1A5", "#AED581", "#9CCC65", "#8BC34A", "#7CB342", "#689F38", "#558B2F", "#33691E",
        "#CCFF90", "#B2FF59", "#76FF03", "#64DD17",
        
        # Lime family
        "#F9FBE7", "#F0F4C3", "#E6EE9C", "#DCE775", "#D4E157", "#CDDC39", "#C0CA33", "#AFB42B", "#9E9D24", "#827717",
        "#F4FF81", "#EEFF41", "#C6FF00", "#AEEA00",
        
        # Yellow family
        "#FFFDE7", "#FFF9C4", "#FFF59D", "#FFF176", "#FFEE58", "#FFEB3B", "#FDD835", "#F9A825", "#F57F17",
        "#FFFF8D", "#FFFF00", "#FFEA00", "#FFD600",
        
        # Amber family
        "#FFF8E1", "#FFECB3", "#FFE082", "#FFD54F", "#FFCA28", "#FFC107", "#FFB300", "#FFA000", "#FF8F00", "#FF6F00",
        "#FFE57F", "#FFD740", "#FFC400", "#FFAB00",
        
        # Orange family
        "#FFF3E0", "#FFE0B2", "#FFCC80", "#FFB74D", "#FFA726", "#FF9800", "#FB8C00", "#F57C00", "#EF6C00", "#E65100",
        "#FFD180", "#FFAB40", "#FF9100", "#FF6D00",
        
        # Deep Orange family
        "#FBE9E7", "#FFCCBC", "#FFAB91", "#FF8A65", "#FF7043", "#FF5722", "#F4511E", "#E64A19", "#D84315", "#BF360C",
        "#FF9E80", "#FF6E40", "#FF3D00", "#DD2C00",
        
        # Brown family
        "#EFEBE9", "#D7CCC8", "#BCAAA4", "#A1887F", "#8D6E63", "#795548", "#6D4C41", "#5D4037", "#4E342E", "#3E2723",
        
        # Grey family
        "#FAFAFA", "#F5F5F5", "#EEEEEE", "#E0E0E0", "#BDBDBD", "#9E9E9E", "#757575", "#616161", "#424242", "#212121",
        
        # Blue Grey family
        "#ECEFF1", "#CFD8DC", "#B0BEC5", "#90A4AE", "#78909C", "#607D8B", "#546E7A", "#455A64", "#37474F", "#263238",
    ]
    
    return colors

def generate_vibrant_colors(count: int = 50) -> List[str]:
    """Generate vibrant colors using HSL color space."""
    colors = []
    
    # Generate colors with good saturation and lightness for UI
    saturations = [70, 80, 90]  # High saturation for vibrant colors
    lightnesses = [45, 55, 65]  # Medium lightness for good contrast
    
    for i in range(count):
        hue = (i * 360 / count) % 360
        saturation = random.choice(saturations)
        lightness = random.choice(lightnesses)
        
        r, g, b = hsl_to_rgb(hue, saturation, lightness)
        colors.append(rgb_to_hex(r, g, b))
    
    return colors

def generate_category_color_from_name(name: str) -> str:
    """Generate a consistent color based on category name using hash."""
    # Create a hash of the name
    hash_obj = hashlib.md5(name.lower().encode())
    hash_hex = hash_obj.hexdigest()
    
    # Use first 6 characters as color, but ensure good visibility
    base_color = "#" + hash_hex[:6]
    
    # Adjust the color to ensure it's not too dark or too light
    r, g, b = hex_to_rgb(base_color)
    
    # Ensure minimum brightness for readability
    min_brightness = 100
    max_brightness = 200
    
    r = max(min_brightness, min(max_brightness, r))
    g = max(min_brightness, min(max_brightness, g))
    b = max(min_brightness, min(max_brightness, b))
    
    return rgb_to_hex(r, g, b)

def find_contrasting_colors(existing_colors: List[str], min_distance: float = 50.0) -> List[str]:
    """Find colors that have sufficient contrast with existing colors."""
    material_colors = generate_material_design_colors()
    vibrant_colors = generate_vibrant_colors(100)
    all_candidate_colors = material_colors + vibrant_colors
    
    contrasting_colors = []
    
    for candidate in all_candidate_colors:
        if candidate in existing_colors:
            continue
            
        # Check if this color has sufficient distance from all existing colors
        has_good_contrast = True
        for existing in existing_colors:
            if color_distance(candidate, existing) < min_distance:
                has_good_contrast = False
                break
        
        if has_good_contrast:
            contrasting_colors.append(candidate)
    
    return contrasting_colors

def generate_unique_color(db: Session, category_name: Optional[str] = None, user_id: Optional[str] = None) -> str:
    """
    Generate a unique hex color that's not already used by any category.
    
    Args:
        db: Database session
        category_name: Optional category name to generate consistent color
        user_id: Optional user ID to scope color uniqueness to user
        
    Returns:
        A unique hex color string
    """
    # Build query to get existing colors
    query = db.query(Category.color)
    if user_id:
        query = query.filter(Category.user_id == user_id)
    
    existing_colors = [color[0] for color in query.all()]
    existing_colors_set = set(existing_colors)
    
    # If category name provided, try to generate consistent color first
    if category_name:
        name_based_color = generate_category_color_from_name(category_name)
        if name_based_color not in existing_colors_set:
            return name_based_color
    
    # Get Material Design colors first (highest priority)
    material_colors = generate_material_design_colors()
    for color in material_colors:
        if color not in existing_colors_set:
            return color
    
    # Find contrasting colors
    contrasting_colors = find_contrasting_colors(existing_colors, min_distance=60.0)
    if contrasting_colors:
        return random.choice(contrasting_colors)
    
    # Generate vibrant colors as fallback
    vibrant_colors = generate_vibrant_colors(200)
    for color in vibrant_colors:
        if color not in existing_colors_set:
            return color
    
    # Last resort: generate completely random color
    max_attempts = 1000
    for _ in range(max_attempts):
        # Generate using HSL for better color distribution
        hue = random.randint(0, 360)
        saturation = random.randint(60, 90)  # Keep vibrant
        lightness = random.randint(40, 70)   # Keep visible
        
        r, g, b = hsl_to_rgb(hue, saturation, lightness)
        color = rgb_to_hex(r, g, b)
        
        if color not in existing_colors_set:
            return color
    
    # Ultimate fallback: timestamp-based color
    import time
    timestamp_color = "#{:06x}".format(int(time.time()) % 0xFFFFFF)
    return timestamp_color