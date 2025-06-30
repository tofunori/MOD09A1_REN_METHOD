#!/usr/bin/env python3
"""
Installation script for MODIS Albedo Comparison Framework dependencies
"""

import subprocess
import sys
import os

def install_requirements():
    """Install required packages from requirements.txt"""
    try:
        print("🔧 Installing Python dependencies...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependencies installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error installing dependencies: {e}")
        return False

def check_ee_auth():
    """Check if Google Earth Engine is authenticated"""
    try:
        import ee
        ee.Initialize()
        print("✅ Google Earth Engine authenticated and initialized")
        return True
    except Exception as e:
        print("⚠️  Google Earth Engine not authenticated")
        print("💡 Run the following commands to authenticate:")
        print("   python -c \"import ee; ee.Authenticate()\"")
        print(f"   Error: {e}")
        return False

def main():
    """Main installation process"""
    print("🏗️ MODIS Albedo Comparison Framework - Setup")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists("requirements.txt"):
        print("❌ requirements.txt not found. Please run from python_version directory")
        return False
    
    # Install dependencies
    if not install_requirements():
        return False
    
    # Check Earth Engine authentication
    if not check_ee_auth():
        print("\n🔍 Please authenticate Google Earth Engine first")
        return False
    
    print("\n🎉 Setup complete! You can now run:")
    print("   python main.py --help")
    print("   python main.py --start-date 2020-06-01 --end-date 2020-06-30 --methods ren --relaxed-qa")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)