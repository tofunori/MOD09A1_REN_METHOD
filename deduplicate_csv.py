#!/usr/bin/env python3
"""
Deduplicate CSV data to have one observation per date, prioritizing Terra over Aqua.
Usage: python deduplicate_csv.py input.csv output.csv
"""

import pandas as pd
import sys

def deduplicate_observations(input_file, output_file):
    """Deduplicate observations by date, prioritizing Terra (MOD09GA) over Aqua (MYD09GA)"""
    
    # Read CSV
    df = pd.read_csv(input_file)
    
    # Convert date column to datetime for proper sorting
    df['date'] = pd.to_datetime(df['date'])
    
    # Sort by date and method (MOD09GA comes before MYD09GA alphabetically)
    df_sorted = df.sort_values(['date', 'method'])
    
    # Remove duplicates, keeping first occurrence (Terra priority due to sorting)
    df_dedup = df_sorted.drop_duplicates(subset=['date'], keep='first')
    
    # Sort by date for final output
    df_final = df_dedup.sort_values('date')
    
    # Save to output file
    df_final.to_csv(output_file, index=False)
    
    print(f"Original rows: {len(df)}")
    print(f"Deduplicated rows: {len(df_final)}")
    print(f"Removed {len(df) - len(df_final)} duplicate observations")
    
    # Show method distribution
    method_counts = df_final['method'].value_counts()
    print(f"\nFinal method distribution:")
    for method, count in method_counts.items():
        print(f"  {method}: {count}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python deduplicate_csv.py input.csv output.csv")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    deduplicate_observations(input_file, output_file)