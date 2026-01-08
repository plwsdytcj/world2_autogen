#!/usr/bin/env python3
"""
Test script for authentication and data isolation.
Run this after starting the server.
"""

import asyncio
import httpx
import json

BASE_URL = "http://localhost:3000/api"

async def test_auth_endpoints():
    """Test authentication endpoints."""
    print("=" * 60)
    print("Testing Authentication Endpoints")
    print("=" * 60)
    
    async with httpx.AsyncClient() as client:
        # Test 1: Get Google login URL
        print("\n1. Testing GET /auth/login/google")
        try:
            response = await client.get(f"{BASE_URL}/auth/login/google", follow_redirects=False)
            print(f"   Status: {response.status_code}")
            if response.status_code == 302:
                location = response.headers.get("Location", "")
                print(f"   ✅ Redirects to: {location[:80]}...")
            elif response.status_code == 500:
                error = response.text
                print(f"   ⚠️  Server error (expected if Google OAuth not configured):")
                print(f"      {error[:200]}")
            else:
                print(f"   Response: {response.text[:200]}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        # Test 2: Get current user (should fail without auth)
        print("\n2. Testing GET /auth/me (without token)")
        try:
            response = await client.get(f"{BASE_URL}/auth/me")
            print(f"   Status: {response.status_code}")
            if response.status_code == 401:
                print(f"   ✅ Correctly returns 401 Unauthorized")
            else:
                print(f"   Response: {response.text[:200]}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        # Test 3: List projects (should work without auth, but filtered)
        print("\n3. Testing GET /projects (without auth)")
        try:
            response = await client.get(f"{BASE_URL}/projects")
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Returns projects: {len(data.get('data', []))} items")
            else:
                print(f"   Response: {response.text[:200]}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        # Test 4: List credentials (should work without auth, but filtered)
        print("\n4. Testing GET /credentials (without auth)")
        try:
            response = await client.get(f"{BASE_URL}/credentials")
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Returns credentials: {len(data)} items")
            else:
                print(f"   Response: {response.text[:200]}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

async def test_with_token(access_token: str):
    """Test endpoints with authentication token."""
    print("\n" + "=" * 60)
    print("Testing with Authentication Token")
    print("=" * 60)
    
    headers = {"Authorization": f"Bearer {access_token}"}
    
    async with httpx.AsyncClient() as client:
        # Test 1: Get current user
        print("\n1. Testing GET /auth/me (with token)")
        try:
            response = await client.get(f"{BASE_URL}/auth/me", headers=headers)
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                user = response.json()
                print(f"   ✅ User: {user.get('email')} (ID: {user.get('id')})")
            else:
                print(f"   Response: {response.text[:200]}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        # Test 2: List projects
        print("\n2. Testing GET /projects (with token)")
        try:
            response = await client.get(f"{BASE_URL}/projects", headers=headers)
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Returns {len(data.get('data', []))} projects for this user")
            else:
                print(f"   Response: {response.text[:200]}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    print("\n🔍 Starting Authentication Tests")
    print("Make sure the server is running on http://localhost:3000\n")
    
    asyncio.run(test_auth_endpoints())
    
    print("\n" + "=" * 60)
    print("To test with a real token:")
    print("1. Visit http://localhost:3000/api/auth/login/google")
    print("2. Complete Google OAuth")
    print("3. Extract access_token from URL hash")
    print("4. Run: python test_auth.py <access_token>")
    print("=" * 60)
    
    import sys
    if len(sys.argv) > 1:
        token = sys.argv[1]
        asyncio.run(test_with_token(token))

