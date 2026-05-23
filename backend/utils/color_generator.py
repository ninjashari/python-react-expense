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

def get_semantic_color_for_category(category_name: str) -> Optional[str]:
    """
    AI-powered semantic color assignment based on category meaning and UX best practices.
    Uses psychological color associations and common UI patterns.
    """
    category_lower = category_name.lower()
    
    # Financial categories with semantic meaning
    semantic_mappings = {
        # Income categories - Green family (success, growth, money)
        'salary': '#4CAF50',
        'income': '#66BB6A', 
        'wages': '#4CAF50',
        'bonus': '#81C784',
        'dividend': '#2E7D32',
        'interest': '#388E3C',
        'freelance': '#43A047',
        'side income': '#66BB6A',
        
        # Food & Dining - Orange/Red family (appetite, warmth)
        'food': '#FF9800',
        'groceries': '#FF9800',
        'dining': '#FF5722',
        'restaurant': '#FF5722',
        'coffee': '#8D6E63',  # Brown for coffee
        'lunch': '#FFA726',
        'dinner': '#FF7043',
        'snacks': '#FFB74D',
        'takeout': '#FF8A65',
        
        # Transportation - Blue family (movement, travel)
        'transport': '#2196F3',
        'gas': '#1976D2',
        'fuel': '#1976D2',
        'car': '#1565C0',
        'uber': '#424242',  # Uber brand-ish
        'taxi': '#FFC107',  # Yellow for taxi
        'public transport': '#2196F3',
        'parking': '#607D8B',
        'maintenance': '#455A64',
        
        # Health & Medical - Red/Pink family (medical, care)
        'health': '#E91E63',
        'medical': '#E91E63',
        'doctor': '#C2185B',
        'pharmacy': '#AD1457',
        'insurance': '#EC407A',
        'dental': '#F06292',
        'hospital': '#D81B60',
        
        # Entertainment - Purple family (creativity, fun)
        'entertainment': '#9C27B0',
        'movies': '#8E24AA',
        'games': '#7B1FA2',
        'music': '#AB47BC',
        'streaming': '#BA68C8',
        'netflix': '#E53935',  # Netflix red
        'spotify': '#4CAF50',  # Spotify green
        'books': '#5E35B1',
        
        # Shopping - Indigo/Deep Purple family (retail, luxury)
        'shopping': '#3F51B5',
        'clothes': '#673AB7',
        'clothing': '#673AB7',
        'accessories': '#512DA8',
        'shoes': '#4527A0',
        'electronics': '#303F9F',
        'gadgets': '#283593',
        
        # Utilities - Cyan/Teal family (essential services)
        'utilities': '#00BCD4',
        'electricity': '#FFC107',  # Yellow for electric
        'water': '#03A9F4',  # Blue for water
        'gas bill': '#FF5722',  # Orange for gas
        'internet': '#009688',
        'phone': '#4DD0E1',
        'cable': '#26A69A',
        
        # Home & Family - Green/Brown family (stability, nature)
        'home': '#795548',
        'rent': '#8D6E63',
        'mortgage': '#6D4C41',
        'repairs': '#5D4037',
        'garden': '#4CAF50',
        'family': '#FF9800',
        'kids': '#FFEB3B',
        'education': '#2196F3',
        'school': '#1976D2',
        
        # Travel - Light Blue family (sky, freedom)
        'travel': '#00BCD4',
        'vacation': '#4FC3F7',
        'flight': '#29B6F6',
        'hotel': '#0288D1',
        'tourism': '#0277BD',
        
        # Business - Dark Blue/Grey family (professional)
        'business': '#37474F',
        'office': '#546E7A',
        'supplies': '#607D8B',
        'software': '#455A64',
        'subscriptions': '#78909C',
        
        # Emergency/Important - Red family (urgency, attention)
        'emergency': '#F44336',
        'urgent': '#E53935',
        'fees': '#D32F2F',
        'penalty': '#C62828',
        'tax': '#B71C1C',
    }
    
    # Try direct matches first
    if category_lower in semantic_mappings:
        return semantic_mappings[category_lower]
    
    # Try partial matches for compound category names
    for keyword, color in semantic_mappings.items():
        if keyword in category_lower:
            return color
    
    return None

def generate_ux_optimized_colors() -> List[str]:
    """
    Generate colors optimized for UX best practices:
    - High contrast against white backgrounds
    - Accessible color combinations
    - Distinguishable for color-blind users
    - Aesthetically pleasing color harmony
    """
    return [
        # Primary vibrant colors (high contrast, accessible)
        '#1976D2',  # Material Blue 700
        '#388E3C',  # Material Green 700  
        '#F57C00',  # Material Orange 700
        '#7B1FA2',  # Material Purple 700
        '#C62828',  # Material Red 700
        '#00796B',  # Material Teal 700
        '#5D4037',  # Material Brown 700
        '#455A64',  # Material Blue Grey 700
        
        # Secondary colors (good contrast)
        '#1565C0',  # Material Blue 800
        '#2E7D32',  # Material Green 800
        '#E65100',  # Material Orange 900
        '#6A1B9A',  # Material Purple 800
        '#B71C1C',  # Material Red 900
        '#004D40',  # Material Teal 900
        '#3E2723',  # Material Brown 900
        '#263238',  # Material Blue Grey 900
        
        # Tertiary colors (balanced)
        '#0D47A1',  # Material Blue 900
        '#1B5E20',  # Material Green 900
        '#BF360C',  # Material Deep Orange 900
        '#4A148C',  # Material Purple 900
        '#880E4F',  # Material Pink 900
        '#006064',  # Material Cyan 900
        '#37474F',  # Material Blue Grey 800
        
        # Additional accessible colors
        '#AD1457',  # Material Pink 700
        '#00838F',  # Material Cyan 700
        '#6A4C93',  # Custom Purple
        '#C73E1D',  # Custom Red
        '#F39C12',  # Custom Orange
        '#27AE60',  # Custom Green
        '#2980B9',  # Custom Blue
        '#8E44AD',  # Custom Purple
        '#D35400',  # Custom Orange
        '#16A085',  # Custom Teal
        '#8E44AD',  # Custom Purple variant
        '#E67E22',  # Custom Orange variant
        '#9B59B6',  # Custom Purple light
        '#34495E',  # Custom Blue Grey
        '#2C3E50',  # Custom Dark Blue
        '#E74C3C',  # Custom Red variant
        '#3498DB',  # Custom Blue variant
    ]

def calculate_wcag_contrast_ratio(color1: str, color2: str) -> float:
    """Calculate WCAG contrast ratio between two colors."""
    l1 = get_color_luminance(color1)
    l2 = get_color_luminance(color2)
    
    # Ensure l1 is the lighter color
    if l1 < l2:
        l1, l2 = l2, l1
    
    return (l1 + 0.05) / (l2 + 0.05)

def is_color_accessible(color: str, background: str = '#FFFFFF') -> bool:
    """Check if color meets WCAG AA accessibility standards."""
    contrast_ratio = calculate_wcag_contrast_ratio(color, background)
    return contrast_ratio >= 4.5  # WCAG AA standard for normal text

def get_all_used_colors(db: Session, user_id: str) -> set:
    """
    Get all colors currently used by both categories and payees for a user.
    This ensures global uniqueness across all entities.
    """
    from models.categories import Category
    from models.payees import Payee
    
    # Get all category colors
    category_colors = db.query(Category.color).filter(
        Category.user_id == user_id,
        Category.color.isnot(None)
    ).all()
    
    # Get all payee colors
    payee_colors = db.query(Payee.color).filter(
        Payee.user_id == user_id,
        Payee.color.isnot(None)
    ).all()
    
    # Combine and deduplicate
    all_colors = set()
    for color_tuple in category_colors + payee_colors:
        if color_tuple[0]:  # Check if color is not None
            all_colors.add(color_tuple[0])
    
    return all_colors

def generate_color_palette(count: int) -> List[str]:
    """
    Generate a palette of visually distinct, accessible colors.
    Uses a systematic approach to ensure maximum visual separation.
    """
    colors = []
    
    # Base parameters for high-quality UI colors
    saturation_values = [75, 85, 65]  # High saturation for vibrancy
    lightness_values = [45, 35, 55]   # Medium lightness for accessibility
    
    # Generate colors using optimal hue distribution
    hue_step = 360 / count if count > 0 else 360 / 24  # Distribute evenly around color wheel
    
    for i in range(count):
        # Calculate hue with optimal spacing
        hue = (i * hue_step) % 360
        
        # Vary saturation and lightness for visual rhythm
        saturation = saturation_values[i % len(saturation_values)]
        lightness = lightness_values[i % len(lightness_values)]
        
        # Convert to RGB and hex
        r, g, b = hsl_to_rgb(hue, saturation, lightness)
        color = rgb_to_hex(r, g, b)
        
        # Ensure accessibility
        if is_color_accessible(color):
            colors.append(color)
    
    return colors

def assign_unique_colors_bulk(db: Session, entities: List, user_id: str, entity_type: str) -> List[str]:
    """
    Assign unique colors to a list of entities in bulk.
    Ensures no color conflicts across the entire system.
    
    Args:
        db: Database session
        entities: List of entities to assign colors to
        user_id: User ID for scoping
        entity_type: 'categories' or 'payees'
        
    Returns:
        List of assigned colors in the same order as entities
    """
    if not entities:
        return []
    
    # Get all colors currently used across the system
    existing_colors = get_all_used_colors(db, user_id)
    
    # Start with predefined accessible colors
    available_colors = []
    
    # Add predefined UX-optimized colors
    predefined = generate_ux_optimized_colors()
    for color in predefined:
        if color not in existing_colors:
            available_colors.append(color)
    
    # Generate additional colors if needed
    total_needed = len(entities)
    if len(available_colors) < total_needed:
        additional_needed = total_needed - len(available_colors)
        generated_colors = generate_color_palette(additional_needed * 2)  # Generate extra for selection
        
        for color in generated_colors:
            if (color not in existing_colors and 
                color not in available_colors and
                is_color_accessible(color)):
                available_colors.append(color)
                if len(available_colors) >= total_needed:
                    break
    
    # Assign colors to entities with semantic preferences
    assigned_colors = []
    used_in_this_batch = set()
    
    for i, entity in enumerate(entities):
        assigned_color = None
        
        # Try semantic color first if it's a category
        if entity_type == "categories" and hasattr(entity, 'name'):
            semantic_color = get_semantic_color_for_category(entity.name)
            if (semantic_color and 
                semantic_color not in existing_colors and 
                semantic_color not in used_in_this_batch):
                assigned_color = semantic_color
        
        # If no semantic color, use next available color
        if not assigned_color:
            for color in available_colors:
                if (color not in existing_colors and 
                    color not in used_in_this_batch):
                    assigned_color = color
                    break
        
        # Ultimate fallback: generate a unique color
        if not assigned_color:
            for attempt in range(100):
                hue = (i * 73 + attempt * 47) % 360  # Use prime numbers for distribution
                saturation = 70 + (attempt % 3) * 10
                lightness = 40 + (attempt % 3) * 10
                
                r, g, b = hsl_to_rgb(hue, saturation, lightness)
                color = rgb_to_hex(r, g, b)
                
                if (color not in existing_colors and 
                    color not in used_in_this_batch and
                    is_color_accessible(color)):
                    assigned_color = color
                    break
        
        # Final safety fallback
        if not assigned_color:
            import time
            seed = int(time.time() * 1000000 + i) % 360
            r, g, b = hsl_to_rgb(seed, 75, 45)
            assigned_color = rgb_to_hex(r, g, b)
        
        assigned_colors.append(assigned_color)
        used_in_this_batch.add(assigned_color)
        existing_colors.add(assigned_color)  # Update for next iteration
    
    return assigned_colors

def generate_unique_color(db: Session, entity_name: Optional[str] = None, user_id: Optional[str] = None, entity_type: str = "categories") -> str:
    """
    Generate a single unique color for an entity.
    This function maintains backward compatibility but uses the new bulk assignment logic.
    """
    from models.categories import Category
    from models.payees import Payee
    
    # Create a mock entity for the bulk assignment function
    class MockEntity:
        def __init__(self, name):
            self.name = name
    
    mock_entity = MockEntity(entity_name or "default")
    colors = assign_unique_colors_bulk(db, [mock_entity], user_id, entity_type)
    
    return colors[0] if colors else "#2196F3"  # Fallback blue