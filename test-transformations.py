#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "https://textforge.co"

# Test all 28 actual transformations
transformations = [
    # Formatting
    {"action": "slugify", "text": "Hello World", "expected": "hello-world"},
    {"action": "camelcase", "text": "hello world", "expected": "helloWorld"},
    {"action": "snakecase", "text": "Hello World", "expected": "hello_world"},
    {"action": "kebabcase", "text": "Hello World", "expected": "hello-world"},
    {"action": "pascalcase", "text": "hello world", "expected": "HelloWorld"},
    {"action": "constantcase", "text": "hello world", "expected": "HELLO_WORLD"},
    
    # Case
    {"action": "titlecase", "text": "hello world", "expected": "Hello World"},
    {"action": "sentencecase", "text": "hello world. how are you?", "expected": "Hello world. how are you?"},
    
    # Manipulation
    {"action": "reverse", "text": "hello", "expected": "olleh"},
    {"action": "truncate", "text": "hello world this is a long text", "params": {"length": 10}, "expected": "hello worl..."},
    {"action": "removemultiple", "text": "hello    world", "expected": "hello world"},
    {"action": "removespecial", "text": "hello!@#$world", "expected": "helloworld"},
    {"action": "trimtext", "text": "   hello   ", "expected": "hello"},
    
    # Extraction
    {"action": "extractemails", "text": "Contact us at test@example.com or admin@example.org", "expected": ["test@example.com", "admin@example.org"]},
    {"action": "extracturls", "text": "Visit https://example.com and http://test.org", "expected": ["https://example.com", "http://test.org"]},
    {"action": "extractnumbers", "text": "I have 5 apples and 10 oranges", "expected": [5, 10]},
    
    # Counting
    {"action": "countwords", "text": "hello world foo bar", "expected": 4},
    
    # Encoding
    {"action": "base64encode", "text": "hello", "expected": "aGVsbG8="},
    {"action": "base64decode", "text": "aGVsbG8=", "expected": "hello"},
    {"action": "htmlencode", "text": "<div>", "expected": "&lt;div&gt;"},
    {"action": "htmldecode", "text": "&lt;div&gt;", "expected": "<div>"},
    {"action": "markdownplain", "text": "**bold** and *italic*", "expected": "bold and italic"},
    {"action": "unicodenormalize", "text": "café", "expected": "café"},
    
    # Fun
    {"action": "leet", "text": "hello", "expected": "h3ll0"},
    {"action": "morse", "text": "SOS", "expected": "... --- ..."},
    
    # Security/Hashing
    {"action": "hash", "text": "hello", "expected": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"},
    
    # Random (just test it returns a string)
    {"action": "random", "text": "test", "params": {"length": 10}, "expected_type": "string"},
    
    # Palindrome
    {"action": "palindromecheck", "text": "racecar", "expected": {"isPalindrome": True, "normalizedText": "racecar"}},
]

passed = 0
failed = 0

print("Testing all 28 transformations...\n")

for i, test in enumerate(transformations, 1):
    action = test["action"]
    text = test["text"]
    expected = test.get("expected")
    expected_type = test.get("expected_type")
    params = test.get("params", {})
    
    url = f"{BASE_URL}/transform?text={text}&action={action}"
    
    # Add params to URL if present
    if params:
        for key, value in params.items():
            url += f"&{key}={value}"
    
    try:
        response = requests.get(url, timeout=5)
        data = response.json()
        
        if data.get("success"):
            result = data.get("result")
            
            # For random, just check it's a string with right length
            if expected_type:
                if expected_type == "string" and isinstance(result, str):
                    if params.get("length"):
                        if len(result) == params["length"]:
                            print(f"✓ {action}")
                            passed += 1
                        else:
                            print(f"✗ {action} - Wrong length: {len(result)}")
                            failed += 1
                    else:
                        print(f"✓ {action}")
                        passed += 1
                else:
                    print(f"✗ {action} - Wrong type: {type(result)}")
                    failed += 1
            # Compare results
            elif result == expected:
                print(f"✓ {action}")
                passed += 1
            else:
                print(f"✗ {action} - Expected: {expected}, Got: {result}")
                failed += 1
        else:
            print(f"✗ {action} - API Error: {data.get('error')}")
            failed += 1
            
    except Exception as e:
        print(f"✗ {action} - Exception: {str(e)}")
        failed += 1
    
    # Small delay to avoid rate limiting
    if i % 5 == 0:
        time.sleep(0.5)

print(f"\n{'='*50}")
print(f"Results: {passed} passed, {failed} failed out of {len(transformations)} tests")
print(f"{'='*50}")

if failed == 0:
    print("\n🎉 All transformations working correctly!")
    exit(0)
else:
    print(f"\n⚠️  {failed} transformation(s) failed")
    exit(1)
