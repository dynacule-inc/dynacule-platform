#!/usr/bin/env python3
"""
Test script to verify the OpenMM workflows module.
"""

import sys
import os

# Add the backend/app/utils directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend', 'app', 'utils'))

try:
    import openmm_workflows
    print("Successfully imported openmm_workflows")
    print("Available functions:")
    for func in dir(openmm_workflows):
        if not func.startswith('_'):
            print(f"  - {func}")
except Exception as e:
    print(f"Failed to import openmm_workflows: {e}")
    sys.exit(1)

# Check if OpenMM is available (optional, since we might not have it installed)
if openmm_workflows.openmm is not None:
    print("OpenMM is available in the module.")
else:
    print("OpenMM is not installed (expected if not installed).")

print("Test completed successfully.")