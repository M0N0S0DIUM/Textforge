#!/bin/bash

BASE_URL="https://textforge.co/transform"

echo "Testing transformations..."

# Test 1: slugify
result=$(curl -s "${BASE_URL}?text=Hello%20World&action=slugify" | jq -r '.result')
[ "$result" = "hello-world" ] && echo "✓ slugify" || echo "✗ slugify: got $result"

# Test 2: camelcase
result=$(curl -s "${BASE_URL}?text=hello%20world&action=camelcase" | jq -r '.result')
[ "$result" = "helloWorld" ] && echo "✓ camelcase" || echo "✗ camelcase: got $result"

# Test 3: snakecase
result=$(curl -s "${BASE_URL}?text=Hello%20World&action=snakecase" | jq -r '.result')
[ "$result" = "hello_world" ] && echo "✓ snakecase" || echo "✗ snakecase: got $result"

# Test 4: kebabcase
result=$(curl -s "${BASE_URL}?text=Hello%20World&action=kebabcase" | jq -r '.result')
[ "$result" = "hello-world" ] && echo "✓ kebabcase" || echo "✗ kebabcase: got $result"

# Test 5: pascalcase
result=$(curl -s "${BASE_URL}?text=hello%20world&action=pascalcase" | jq -r '.result')
[ "$result" = "HelloWorld" ] && echo "✓ pascalcase" || echo "✗ pascalcase: got $result"

# Test 6: constantcase
result=$(curl -s "${BASE_URL}?text=hello%20world&action=constantcase" | jq -r '.result')
[ "$result" = "HELLO_WORLD" ] && echo "✓ constantcase" || echo "✗ constantcase: got $result"

# Test 7: capitalize
result=$(curl -s "${BASE_URL}?text=hello%20world&action=capitalize" | jq -r '.result')
[ "$result" = "Hello world" ] && echo "✓ capitalize" || echo "✗ capitalize: got $result"

# Test 8: titlecase
result=$(curl -s "${BASE_URL}?text=hello%20world&action=titlecase" | jq -r '.result')
[ "$result" = "Hello World" ] && echo "✓ titlecase" || echo "✗ titlecase: got $result"

# Test 9: sentencecase
result=$(curl -s "${BASE_URL}?text=HELLO%20WORLD&action=sentencecase" | jq -r '.result')
[ "$result" = "Hello world" ] && echo "✓ sentencecase" || echo "✗ sentencecase: got $result"

# Test 10: reverse
result=$(curl -s "${BASE_URL}?text=hello&action=reverse" | jq -r '.result')
[ "$result" = "olleh" ] && echo "✓ reverse" || echo "✗ reverse: got $result"

# Test 11: uppercase
result=$(curl -s "${BASE_URL}?text=hello&action=uppercase" | jq -r '.result')
[ "$result" = "HELLO" ] && echo "✓ uppercase" || echo "✗ uppercase: got $result"

# Test 12: lowercase
result=$(curl -s "${BASE_URL}?text=HELLO&action=lowercase" | jq -r '.result')
[ "$result" = "hello" ] && echo "✓ lowercase" || echo "✗ lowercase: got $result"

# Test 13: trim
result=$(curl -s "${BASE_URL}?text=%20%20hello%20%20&action=trim" | jq -r '.result')
[ "$result" = "hello" ] && echo "✓ trim" || echo "✗ trim: got $result"

# Test 14: base64encode
result=$(curl -s "${BASE_URL}?text=hello&action=base64encode" | jq -r '.result')
[ "$result" = "aGVsbG8=" ] && echo "✓ base64encode" || echo "✗ base64encode: got $result"

# Test 15: base64decode
result=$(curl -s "${BASE_URL}?text=aGVsbG8%3D&action=base64decode" | jq -r '.result')
[ "$result" = "hello" ] && echo "✓ base64decode" || echo "✗ base64decode: got $result"

echo ""
echo "Done"
