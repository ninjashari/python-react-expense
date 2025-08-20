import re
import unicodedata

def create_slug(text: str) -> str:
    """
    Create a URL-friendly slug from text.
    
    Args:
        text: The input text to convert to a slug
        
    Returns:
        A lowercase, hyphenated string without spaces or special characters
        
    Examples:
        create_slug("Grocery Store") -> "grocery-store"
        create_slug("Café & Restaurant") -> "cafe-restaurant"
        create_slug("AT&T Mobile") -> "att-mobile"
    """
    if not text:
        return "unnamed"
    
    # Normalize unicode characters (convert accented chars to base chars)
    text = unicodedata.normalize('NFKD', text)
    
    # Convert to lowercase
    text = text.lower()
    
    # Replace common symbols with words
    replacements = {
        '&': 'and',
        '@': 'at',
        '+': 'plus',
        '%': 'percent',
        '#': 'hash',
        '$': 'dollar',
        '€': 'euro',
        '£': 'pound',
    }
    
    for symbol, word in replacements.items():
        text = text.replace(symbol, f' {word} ')
    
    # Remove non-alphanumeric characters except spaces and hyphens
    text = re.sub(r'[^a-z0-9\s\-]', '', text)
    
    # Replace multiple spaces/hyphens with single hyphen
    text = re.sub(r'[\s\-]+', '-', text)
    
    # Remove leading/trailing hyphens
    text = text.strip('-')
    
    # Ensure maximum length (useful for database constraints)
    text = text[:100]
    
    # Remove trailing hyphen if truncation created one
    text = text.rstrip('-')
    
    # Ensure we never return an empty string (database constraint)
    if not text:
        return 'unnamed'
    
    return text