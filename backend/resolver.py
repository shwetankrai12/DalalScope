"""Ticker symbol resolver for company names."""

import requests
from typing import Optional


def resolve_ticker(company_name: str) -> Optional[str]:
    """
    Resolve a company name to its NSE stock ticker symbol.
    
    Uses Yahoo Finance search API to find the ticker symbol for a given company name
    and appends the .NS suffix for NSE (National Stock Exchange of India).
    
    Args:
        company_name: The name of the company (e.g., "Tata Consultancy Services", "Reliance Industries")
    
    Returns:
        The NSE ticker symbol (e.g., "TCS.NS", "RELIANCE.NS") if found, None otherwise.
    
    Raises:
        requests.RequestException: If the API request fails.
    """
    try:
        url = "https://query1.finance.yahoo.com/v1/finance/search"
        params = {"q": company_name}
        
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        # Check if quotes are found in the response
        if "quotes" not in data or len(data["quotes"]) == 0:
            return None
        
        # Return the first matching result's symbol with .NS suffix
        ticker = data["quotes"][0].get("symbol")
        if not ticker:
            return None
        
        # Always append .NS suffix for NSE
        if not ticker.upper().endswith(".NS"):
            ticker = f"{ticker}.NS"
        
        return ticker
    
    except requests.RequestException as e:
        raise requests.RequestException(f"Failed to resolve ticker for '{company_name}': {e}")
    except (KeyError, ValueError) as e:
        raise ValueError(f"Error parsing API response: {e}")
