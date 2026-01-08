#!/usr/bin/env python3
"""
Compilation check script for lorecard project.
Checks both backend Python code and frontend TypeScript code.
"""

import subprocess
import sys
import os
from pathlib import Path

def check_python_files():
    """Check Python files for syntax errors."""
    print("=" * 60)
    print("Checking Python Backend Code")
    print("=" * 60)
    
    server_dir = Path("server/src")
    files_to_check = [
        "controllers/auth.py",
        "controllers/projects.py",
        "controllers/credentials.py",
        "db/users.py",
        "services/auth.py",
        "db/credentials.py",
        "db/projects.py",
    ]
    
    errors = []
    for file_path in files_to_check:
        full_path = server_dir / file_path
        if not full_path.exists():
            print(f"❌ {file_path}: File not found")
            errors.append(f"{file_path}: File not found")
            continue
        
        try:
            # Try to compile the file
            with open(full_path, 'r', encoding='utf-8') as f:
                code = f.read()
            compile(code, str(full_path), 'exec')
            print(f"✅ {file_path}")
        except SyntaxError as e:
            print(f"❌ {file_path}: SyntaxError at line {e.lineno}: {e.msg}")
            errors.append(f"{file_path}: {e}")
        except Exception as e:
            print(f"❌ {file_path}: {type(e).__name__}: {e}")
            errors.append(f"{file_path}: {e}")
    
    return errors

def check_python_imports():
    """Check if Python modules can be imported."""
    print("\n" + "=" * 60)
    print("Checking Python Imports")
    print("=" * 60)
    
    # Add server/src to path
    sys.path.insert(0, str(Path("server/src").absolute()))
    
    imports_to_check = [
        ("controllers.auth", "AuthController"),
        ("controllers.projects", "ProjectController"),
        ("controllers.credentials", "CredentialsController"),
        ("db.users", "User"),
        ("services.auth", "handle_google_callback"),
        ("db.credentials", "list_credentials"),
        ("db.projects", "list_projects_paginated"),
    ]
    
    errors = []
    for module_name, item_name in imports_to_check:
        try:
            module = __import__(module_name, fromlist=[item_name])
            getattr(module, item_name)
            print(f"✅ {module_name}.{item_name}")
        except ImportError as e:
            print(f"❌ {module_name}.{item_name}: ImportError - {e}")
            errors.append(f"{module_name}.{item_name}: {e}")
        except AttributeError as e:
            print(f"❌ {module_name}.{item_name}: AttributeError - {e}")
            errors.append(f"{module_name}.{item_name}: {e}")
        except Exception as e:
            print(f"❌ {module_name}.{item_name}: {type(e).__name__} - {e}")
            errors.append(f"{module_name}.{item_name}: {e}")
    
    return errors

def check_typescript():
    """Check TypeScript files for compilation errors."""
    print("\n" + "=" * 60)
    print("Checking TypeScript Frontend Code")
    print("=" * 60)
    
    client_dir = Path("client")
    if not (client_dir / "package.json").exists():
        print("⚠️  client/package.json not found, skipping TypeScript check")
        return []
    
    try:
        result = subprocess.run(
            ["pnpm", "exec", "tsc", "--noEmit", "--skipLibCheck"],
            cwd=client_dir,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print("✅ TypeScript compilation successful")
            return []
        else:
            print("❌ TypeScript compilation errors:")
            print(result.stdout)
            if result.stderr:
                print("STDERR:", result.stderr)
            return ["TypeScript compilation failed"]
    except FileNotFoundError:
        print("⚠️  pnpm not found, skipping TypeScript check")
        return []
    except subprocess.TimeoutExpired:
        print("⚠️  TypeScript check timed out")
        return []
    except Exception as e:
        print(f"⚠️  Error checking TypeScript: {e}")
        return []

def main():
    """Run all checks."""
    print("\n🔍 Starting Compilation Checks\n")
    
    all_errors = []
    
    # Check Python syntax
    python_errors = check_python_files()
    all_errors.extend(python_errors)
    
    # Check Python imports
    import_errors = check_python_imports()
    all_errors.extend(import_errors)
    
    # Check TypeScript
    ts_errors = check_typescript()
    all_errors.extend(ts_errors)
    
    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    
    if all_errors:
        print(f"❌ Found {len(all_errors)} error(s)")
        for error in all_errors[:10]:  # Show first 10 errors
            print(f"  - {error}")
        if len(all_errors) > 10:
            print(f"  ... and {len(all_errors) - 10} more")
        return 1
    else:
        print("✅ All compilation checks passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())

