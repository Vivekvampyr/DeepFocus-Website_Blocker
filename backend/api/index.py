import sys
import os

# Add backend directory to sys.path so app can be resolved properly
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
